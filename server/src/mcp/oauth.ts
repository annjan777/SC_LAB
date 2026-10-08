import crypto from 'crypto';
import express, { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { query } from '../config/database.js';
import { sanitizeString } from '../middleware/xssSanitizer.js';
import {
  getLoginBlockRemainingMs, recordFailedLogin, resetFailedLogin, formatTime,
  getAccountBlockRemainingMs, recordFailedLoginForAccount, resetAccountFailures,
} from '../middleware/progressiveRateLimiter.js';
import {
  ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS,
  getClient, saveClient, createAuthCode, peekAuthCode, consumeAuthCode,
  createGrant, issueToken, resolveToken, deleteToken, revokeGrant,
} from './store.js';

export const MCP_SCOPE = 'sclab';

// Authorization requests waiting for the member to sign in. Keyed by an unguessable id
// that is embedded in the login form, which also makes the form CSRF-safe.
interface PendingAuthorization {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  expiresAt: number;
}
const pending = new Map<string, PendingAuthorization>();
const PENDING_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pending) if (p.expiresAt < now) pending.delete(id);
}, 60 * 1000).unref();

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** CSP source that lets the login form's redirect reach the AI app's callback (https origin or custom scheme). */
function redirectCspSource(redirectUri: string): string {
  const u = new URL(redirectUri);
  return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : u.protocol;
}

function clientDisplayName(client: OAuthClientInformationFull): string {
  return (client.client_name || 'An AI assistant').slice(0, 80);
}

function renderLoginPage(res: Response, requestId: string, p: PendingAuthorization, error?: string, email = '') {
  const appName = escapeHtml(clientDisplayName(p.client));
  res
    .status(error ? 400 : 200)
    .set('Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self' ${redirectCspSource(p.params.redirectUri)}; frame-ancestors 'none'; base-uri 'none'`)
    .set('Cache-Control', 'no-store')
    .type('html')
    .send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to SC Lab</title>
<style>
  :root { color-scheme: light dark; --bg:#f5f7fb; --card:#fff; --text:#1f2937; --muted:#6b7280; --line:#d1d5db; --accent:#2563eb; --err:#b91c1c; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f172a; --card:#1e293b; --text:#e2e8f0; --muted:#94a3b8; --line:#334155; --accent:#60a5fa; --err:#fca5a5; } }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; padding:16px; box-sizing:border-box; }
  main { width:100%; max-width:400px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:28px; }
  h1 { font-size:20px; margin:0 0 4px; } p { margin:0 0 16px; color:var(--muted); }
  label { display:block; font-weight:600; margin:14px 0 4px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:transparent; color:inherit; font:inherit; }
  ul { margin:16px 0; padding-left:20px; color:var(--muted); }
  .row { display:flex; flex-direction:row-reverse; gap:8px; margin-top:20px; }
  button { flex:1; padding:10px; border-radius:8px; border:1px solid var(--line); font:inherit; font-weight:600; cursor:pointer; background:transparent; color:inherit; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  .err { color:var(--err); background:color-mix(in srgb, var(--err) 10%, transparent); padding:8px 12px; border-radius:8px; margin-bottom:12px; }
</style></head>
<body><main>
  <h1>Connect ${appName} to SC Lab</h1>
  <p>Sign in with your SC Lab account to let this AI assistant work on your behalf.</p>
  ${error ? `<div class="err" role="alert">${escapeHtml(error)}</div>` : ''}
  <form method="post" action="/oauth/login">
    <input type="hidden" name="request_id" value="${escapeHtml(requestId)}">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" autocapitalize="none" required value="${escapeHtml(email)}">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <ul>
      <li>It can see and update your own work items, requests, bookings, to-dos and notifications.</li>
      <li>It can never approve, issue or delete anything on anyone else's behalf.</li>
      <li>You can disconnect it any time from AI Connector in the SC Lab menu.</li>
    </ul>
    <div class="row">
      <!-- Allow comes first in the markup so pressing Enter in a field submits "allow" (browsers
           use the first submit button); row-reverse keeps Cancel visually on the left. -->
      <button type="submit" name="decision" value="allow" class="primary">Allow access</button>
      <button type="submit" name="decision" value="deny" formnovalidate>Cancel</button>
    </div>
  </form>
</main></body></html>`);
}

const clientsStore: OAuthRegisteredClientsStore = {
  getClient: (clientId: string) => getClient(clientId),
  registerClient: async (client) => {
    await saveClient(client);
    return client as OAuthClientInformationFull;
  },
};

export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(client, params, res) {
    const requestId = crypto.randomBytes(24).toString('base64url');
    const p = { client, params, expiresAt: Date.now() + PENDING_TTL_MS };
    pending.set(requestId, p);
    renderLoginPage(res, requestId, p);
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const row = await peekAuthCode(authorizationCode);
    if (!row || row.client_id !== client.client_id) throw new InvalidGrantError('Invalid authorization code');
    return row.code_challenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri, _resource): Promise<OAuthTokens> {
    const row = await consumeAuthCode(authorizationCode);
    if (!row || row.client_id !== client.client_id) throw new InvalidGrantError('Invalid authorization code');
    if (redirectUri && redirectUri !== row.redirect_uri) throw new InvalidGrantError('redirect_uri does not match');

    // Reconnecting the same app replaces its previous connection instead of piling up grants.
    const old = await query(
      "SELECT id FROM mcp_grants WHERE user_id = $1 AND client_id = $2 AND kind = 'oauth' AND revoked_at IS NULL",
      [row.user_id, client.client_id]
    );
    for (const g of old.rows) await revokeGrant(g.id);

    const grantId = await createGrant({
      userId: row.user_id, kind: 'oauth', clientId: client.client_id,
      name: clientDisplayName(client), scopes: row.scopes, resource: row.resource || undefined,
    });
    return {
      access_token: await issueToken(grantId, 'access', ACCESS_TOKEN_TTL_SECONDS),
      refresh_token: await issueToken(grantId, 'refresh', REFRESH_TOKEN_TTL_SECONDS),
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: MCP_SCOPE,
    };
  },

  async exchangeRefreshToken(client, refreshToken): Promise<OAuthTokens> {
    const t = await resolveToken(refreshToken, ['refresh']);
    if (!t || t.clientId !== client.client_id) throw new InvalidGrantError('Invalid refresh token');
    // Rotate: the old refresh token stops working as soon as a new one is issued.
    await deleteToken(refreshToken);
    return {
      access_token: await issueToken(t.grantId, 'access', ACCESS_TOKEN_TTL_SECONDS),
      refresh_token: await issueToken(t.grantId, 'refresh', REFRESH_TOKEN_TTL_SECONDS),
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: MCP_SCOPE,
    };
  },

  async verifyAccessToken(token): Promise<AuthInfo> {
    const t = await resolveToken(token, ['access', 'pat']);
    if (!t) throw new InvalidTokenError('Invalid or expired token');
    return {
      token,
      clientId: t.clientId || 'personal-access-token',
      scopes: [MCP_SCOPE],
      expiresAt: Math.floor(t.expiresAt.getTime() / 1000),
      extra: { userId: t.userId, email: t.email, grantId: t.grantId },
    };
  },

  async revokeToken(client, request: OAuthTokenRevocationRequest) {
    const t = await resolveToken(request.token, ['access', 'refresh']);
    if (t && t.clientId === client.client_id) await revokeGrant(t.grantId);
  },
};

/** Handles the sign-in form shown by authorize(). Mounted at /oauth/login. */
export function oauthLoginRouter(): Router {
  const router = Router();
  router.post('/oauth/login', express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    const requestId = String(req.body.request_id || '');
    const p = pending.get(requestId);
    if (!p || p.expiresAt < Date.now()) {
      pending.delete(requestId);
      return res.status(400).type('text').send('This sign-in link has expired. Go back to your AI app and start connecting again.');
    }

    const { redirectUri, state } = p.params;
    const finish = (params: Record<string, string>) => {
      pending.delete(requestId);
      const url = new URL(redirectUri);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      if (state) url.searchParams.set('state', state);
      res.redirect(302, url.href);
    };

    if (req.body.decision !== 'allow') {
      return finish({ error: 'access_denied', error_description: 'The user cancelled the connection' });
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    const blockedMs = Math.max(getLoginBlockRemainingMs(ip), getAccountBlockRemainingMs(email));
    if (blockedMs > 0) {
      return renderLoginPage(res, requestId, p, `Too many failed attempts. Try again in ${formatTime(blockedMs)}.`, email);
    }

    try {
      const userRes = await query(
        `SELECT u.id, u.password_hash, up.is_active, up.require_password_change
         FROM users u JOIN user_profiles up ON up.id = u.id
         WHERE LOWER(u.email) = LOWER($1)`,
        [email]
      );
      const user = userRes.rows[0];
      // The website login receives the password after the global input sanitizer, and passwords
      // were set through it too, so check the sanitized form as well as the raw one.
      const candidates = Array.from(new Set([password, sanitizeString(password)]));
      let valid = false;
      for (const candidate of candidates) {
        if (user && await bcrypt.compare(candidate, user.password_hash)) { valid = true; break; }
      }
      if (!user || !valid) {
        recordFailedLogin(ip, email);
        recordFailedLoginForAccount(email);
        return renderLoginPage(res, requestId, p, 'Invalid email or password.', email);
      }
      resetFailedLogin(ip);
      resetAccountFailures(email);

      if (user.is_active === false) {
        return renderLoginPage(res, requestId, p, 'Your account has been deactivated. Contact an administrator.', email);
      }
      if (user.require_password_change) {
        return renderLoginPage(res, requestId, p, 'Sign in to the SC Lab website once to set your own password, then connect again.', email);
      }

      const code = await createAuthCode({
        clientId: p.client.client_id,
        userId: user.id,
        redirectUri,
        codeChallenge: p.params.codeChallenge,
        scopes: [MCP_SCOPE],
        resource: p.params.resource?.href,
      });
      finish({ code });
    } catch (err) {
      console.error('[MCP OAuth login error]', err);
      renderLoginPage(res, requestId, p, 'Something went wrong. Please try again.', email);
    }
  });
  return router;
}
