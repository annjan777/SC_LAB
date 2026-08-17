import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'sc-lab-jwt-secret-change-in-production')) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production!');
}
const JWT_SECRET = process.env.JWT_SECRET || 'sc-lab-jwt-secret-change-in-production';
export function generateToken(userId, email) {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}
export function generatePasswordResetToken(userId, email) {
    return jwt.sign({ userId, email, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '1h' });
}
export function generateRefreshToken(userId) {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}
export async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.purpose === 'password_reset') {
            return res.status(401).json({ error: 'Password reset token cannot be used for standard authentication' });
        }
        // Fetch profile + permissions
        const profileResult = await query('SELECT id, user_role, is_active, last_password_changed_at FROM user_profiles WHERE id = $1', [decoded.userId]);
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
        const permResult = await query('SELECT * FROM get_user_permissions($1)', [decoded.userId]);
        const permissions = new Set(permResult.rows.map((r) => r.permission_name));
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            user_role: profile.user_role,
            permissions,
            auth_purpose: decoded.purpose || 'session',
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
export async function optionalAuthenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next();
    }
    try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const profileResult = await query('SELECT id, user_role, is_active, last_password_changed_at FROM user_profiles WHERE id = $1', [decoded.userId]);
        if (profileResult.rows.length > 0 && profileResult.rows[0].is_active !== false) {
            const profile = profileResult.rows[0];
            // Token invalidation check
            if (profile.last_password_changed_at && decoded.iat) {
                if (decoded.iat * 1000 < new Date(profile.last_password_changed_at).getTime() - 1000) {
                    return next(); // Fail silently for optional auth
                }
            }
            const permResult = await query('SELECT * FROM get_user_permissions($1)', [decoded.userId]);
            const permissions = new Set(permResult.rows.map((r) => r.permission_name));
            req.user = {
                id: decoded.userId,
                email: decoded.email,
                user_role: profile.user_role,
                permissions,
                auth_purpose: decoded.purpose || 'session',
            };
        }
    }
    catch {
        // Ignore token errors for optional auth, user remains undefined (GUEST)
    }
    next();
}
export async function authenticateResetToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        // Allow both standard session tokens (for logged-in users) and reset tokens
        // Fetch profile + permissions
        const profileResult = await query('SELECT id, user_role, is_active, last_password_changed_at FROM user_profiles WHERE id = $1', [decoded.userId]);
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
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            user_role: profile.user_role,
            permissions: new Set(), // permissions not strictly needed just to change password
            auth_purpose: decoded.purpose || 'session',
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid or expired reset token' });
    }
}
export function requirePermission(...perms) {
    return (req, res, next) => {
        const has = perms.some(p => req.user?.permissions.has(p));
        if (!has)
            return res.status(403).json({ error: 'Insufficient permissions' });
        next();
    };
}
