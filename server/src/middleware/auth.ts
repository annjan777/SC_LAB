import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'sc-lab-jwt-secret-change-in-production')) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production!');
}

const JWT_SECRET = process.env.JWT_SECRET || 'sc-lab-jwt-secret-change-in-production';

export interface AuthUser {
  id: string;
  email: string;
  user_role: string;
  permissions: Set<string>;
  auth_purpose?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '2h' });
}

export function generatePasswordResetToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '1h' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * A session JWT in the query string leaks into logs, history and Referer headers,
 * so it is only honoured for GET links the browser opens directly (file
 * downloads/previews). Every other request must use the Authorization header.
 */
function allowsQueryToken(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const path = (req.originalUrl || req.url || '').split('?')[0];
  return (
    path.includes('/download') ||
    path.includes('/view') ||
    path.includes('/proposal-document') ||
    path.includes('/url/')
  );
}

/** True when the token was issued before the user's last server-side logout. */
function isRevokedBySignOut(iat: number | undefined, sessionsRevokedAt: unknown): boolean {
  if (!sessionsRevokedAt || !iat) return false;
  // iat has second precision; compare at second granularity so a fresh login
  // within the same second as the logout is not rejected.
  return iat < Math.floor(new Date(sessionsRevokedAt as string).getTime() / 1000);
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (allowsQueryToken(req) && req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; purpose?: string; iat?: number };

    if (decoded.purpose === 'password_reset') {
      return res.status(401).json({ error: 'Password reset token cannot be used for standard authentication' });
    }

    // Fetch profile + permissions
    const profileResult = await query(
      'SELECT id, user_role, is_active, last_password_changed_at, sessions_revoked_at FROM user_profiles WHERE id = $1',
      [decoded.userId]
    );
    if (profileResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const profile = profileResult.rows[0];
    if (profile.is_active === false) {
      return res.status(403).json({ error: 'Account has been deactivated. Contact an administrator.' });
    }

    // Check if token was issued before the last password change
    if (profile.last_password_changed_at && decoded.iat) {
      // decoded.iat is in seconds, DB timestamp is in milliseconds
      if (decoded.iat * 1000 < new Date(profile.last_password_changed_at).getTime() - 1000) {
        return res.status(401).json({ error: 'Session expired due to password change' });
      }
    }

    if (isRevokedBySignOut(decoded.iat, profile.sessions_revoked_at)) {
      return res.status(401).json({ error: 'Session has been signed out. Please log in again.' });
    }

    const permResult = await query('SELECT * FROM get_user_permissions($1)', [decoded.userId]);
    const permissions = new Set<string>(permResult.rows.map((r: any) => r.permission_name));

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      user_role: profile.user_role,
      permissions,
      auth_purpose: decoded.purpose || 'session',
    };

    next();
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired after 2 hours. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (allowsQueryToken(req) && req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; iat?: number; purpose?: string };
    // A first-login / password-reset token only works on the change-password route (authenticateResetToken);
    // everywhere else the caller is a guest, so the gateway answers 401 before any route logic runs.
    if (decoded.purpose === 'password_reset') return next();

    const profileResult = await query(
      'SELECT id, user_role, is_active, last_password_changed_at, sessions_revoked_at FROM user_profiles WHERE id = $1',
      [decoded.userId]
    );
    if (profileResult.rows.length > 0 && profileResult.rows[0].is_active !== false) {
      const profile = profileResult.rows[0];
      
      // Token invalidation check
      if (profile.last_password_changed_at && decoded.iat) {
        if (decoded.iat * 1000 < new Date(profile.last_password_changed_at).getTime() - 1000) {
          return next(); // Fail silently for optional auth
        }
      }
      if (isRevokedBySignOut(decoded.iat, profile.sessions_revoked_at)) {
        return next();
      }

      const permResult = await query('SELECT * FROM get_user_permissions($1)', [decoded.userId]);
      const permissions = new Set<string>(permResult.rows.map((r: any) => r.permission_name));

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        user_role: profile.user_role,
        permissions,
        auth_purpose: decoded.purpose || 'session',
      };
    }
  } catch {
    // Ignore token errors for optional auth, user remains undefined (GUEST)
  }
  next();
}

export async function authenticateResetToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);

  // 1. Check if token matches an active reset_password_token in the database (hex token flow)
  try {
    const userResult = await query(
      `SELECT u.id, u.email, u.reset_password_expires, up.user_role, up.is_active, up.last_password_changed_at
       FROM users u
       LEFT JOIN user_profiles up ON up.id = u.id
       WHERE u.reset_password_token = $1`,
      [token]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      if (user.is_active === false) {
        return res.status(403).json({ error: 'Account has been deactivated' });
      }
      if (!user.reset_password_expires || new Date(user.reset_password_expires) < new Date()) {
        return res.status(401).json({ error: 'Reset token is invalid or has expired' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        user_role: user.user_role || 'user',
        permissions: new Set(),
        auth_purpose: 'password_reset',
      };
      return next();
    }
  } catch (dbErr) {
    console.error('Error checking reset token in DB:', dbErr);
  }

  // 2. Fall back to signed JWT verification (JWT reset token or session token flow)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; purpose?: string; iat?: number };

    // Fetch profile + permissions
    const profileResult = await query(
      'SELECT id, user_role, is_active, last_password_changed_at, require_password_change FROM user_profiles WHERE id = $1',
      [decoded.userId]
    );
    if (profileResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const profile = profileResult.rows[0];
    if (profile.is_active === false) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    // Token invalidation check
    if (profile.last_password_changed_at && decoded.iat) {
      if (decoded.iat * 1000 < new Date(profile.last_password_changed_at).getTime() - 1000) {
        return res.status(401).json({ error: 'Reset token expired due to password change' });
      }
    }

    // If purpose is password_reset, ensure it's either an authorized first-time login require_password_change
    // OR matches a stored reset token
    if (decoded.purpose === 'password_reset') {
      const userCheck = await query(
        'SELECT reset_password_token, reset_password_expires FROM users WHERE id = $1',
        [decoded.userId]
      );
      const storedToken = userCheck.rows[0]?.reset_password_token;
      const expiresAt = userCheck.rows[0]?.reset_password_expires;

      if (storedToken) {
        if (storedToken !== token || (expiresAt && new Date(expiresAt) < new Date())) {
          return res.status(401).json({ error: 'Reset token is invalid or has expired' });
        }
      } else if (!profile.require_password_change) {
        return res.status(401).json({ error: 'Reset token has already been used or is invalid' });
      }
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      user_role: profile.user_role,
      permissions: new Set(),
      auth_purpose: decoded.purpose || 'session',
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired reset token' });
  }
}

export function requirePermission(...perms: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.user_role === 'super_admin' || req.user?.user_role === 'admin') {
      return next();
    }
    const has = perms.some(p => req.user?.permissions.has(p));
    if (!has) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
