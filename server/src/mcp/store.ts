import crypto from 'crypto';
import { query } from '../config/database.js';

// Persistence for the MCP connector: registered OAuth clients, short-lived
// authorization codes, and "grants" (one per connected AI app or personal
// access token). Raw tokens are never stored - only their SHA-256 hashes.

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;            // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SECONDS = 5 * 60;                // 5 minutes
export const PAT_TTL_DAYS = 90;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

export async function ensureMcpSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
      client_id text PRIMARY KEY,
      client_info jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS mcp_grants (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      kind text NOT NULL CHECK (kind IN ('oauth', 'pat')),
      client_id text,
      name text NOT NULL,
      scopes text[] NOT NULL DEFAULT '{}',
      resource text,
      created_at timestamptz DEFAULT now(),
      last_used_at timestamptz,
      revoked_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_grants_user ON mcp_grants(user_id);

    CREATE TABLE IF NOT EXISTS mcp_auth_codes (
      code_hash text PRIMARY KEY,
      client_id text NOT NULL,
      user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      redirect_uri text NOT NULL,
      code_challenge text NOT NULL,
      scopes text[] NOT NULL DEFAULT '{}',
      resource text,
      expires_at timestamptz NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_tokens (
      token_hash text PRIMARY KEY,
      grant_id uuid NOT NULL REFERENCES mcp_grants(id) ON DELETE CASCADE,
      token_type text NOT NULL CHECK (token_type IN ('access', 'refresh', 'pat')),
      expires_at timestamptz NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_tokens_grant ON mcp_tokens(grant_id);
  `);

  // Housekeeping: expired codes and tokens are useless, drop them on boot.
  await query('DELETE FROM mcp_auth_codes WHERE expires_at < now()');
  await query('DELETE FROM mcp_tokens WHERE expires_at < now()');
}

// --- OAuth clients (dynamic client registration) ---

export async function getClient(clientId: string): Promise<any | undefined> {
  const r = await query('SELECT client_info FROM mcp_oauth_clients WHERE client_id = $1', [clientId]);
  return r.rows[0]?.client_info;
}

export async function saveClient(clientInfo: any): Promise<void> {
  await query(
    'INSERT INTO mcp_oauth_clients (client_id, client_info) VALUES ($1, $2) ON CONFLICT (client_id) DO UPDATE SET client_info = EXCLUDED.client_info',
    [clientInfo.client_id, clientInfo]
  );
}

// --- Authorization codes ---

export async function createAuthCode(params: {
  clientId: string; userId: string; redirectUri: string; codeChallenge: string; scopes: string[]; resource?: string;
}): Promise<string> {
  const code = newToken('sclab_code');
  await query(
    `INSERT INTO mcp_auth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scopes, resource, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8))`,
    [hashToken(code), params.clientId, params.userId, params.redirectUri, params.codeChallenge, params.scopes, params.resource || null, AUTH_CODE_TTL_SECONDS]
  );
  return code;
}

export async function peekAuthCode(code: string) {
  const r = await query('SELECT * FROM mcp_auth_codes WHERE code_hash = $1 AND expires_at > now()', [hashToken(code)]);
  return r.rows[0];
}

/** Codes are single-use: deleting and returning in one statement makes a replayed code fail. */
export async function consumeAuthCode(code: string) {
  const r = await query('DELETE FROM mcp_auth_codes WHERE code_hash = $1 AND expires_at > now() RETURNING *', [hashToken(code)]);
  return r.rows[0];
}

// --- Grants and tokens ---

export async function createGrant(params: {
  userId: string; kind: 'oauth' | 'pat'; clientId?: string; name: string; scopes: string[]; resource?: string;
}): Promise<string> {
  const r = await query(
    'INSERT INTO mcp_grants (user_id, kind, client_id, name, scopes, resource) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [params.userId, params.kind, params.clientId || null, params.name, params.scopes, params.resource || null]
  );
  return r.rows[0].id;
}

export async function issueToken(grantId: string, type: 'access' | 'refresh' | 'pat', ttlSeconds: number): Promise<string> {
  const prefix = type === 'access' ? 'sclab_at' : type === 'refresh' ? 'sclab_rt' : 'sclab_pat';
  const token = newToken(prefix);
  await query(
    'INSERT INTO mcp_tokens (token_hash, grant_id, token_type, expires_at) VALUES ($1, $2, $3, now() + make_interval(secs => $4))',
    [hashToken(token), grantId, type, ttlSeconds]
  );
  return token;
}

export interface ResolvedToken {
  grantId: string;
  userId: string;
  email: string;
  clientId: string | null;
  scopes: string[];
  resource: string | null;
  tokenType: 'access' | 'refresh' | 'pat';
  expiresAt: Date;
}

/**
 * Resolves a raw token to its grant and owner. Returns null when the token is unknown,
 * expired, revoked, issued before the owner's last password change, or the owner is
 * deactivated - the same rules the web session JWTs follow.
 */
export async function resolveToken(token: string, types: Array<ResolvedToken['tokenType']>): Promise<ResolvedToken | null> {
  const r = await query(
    `SELECT t.token_type, t.expires_at, g.id AS grant_id, g.user_id, g.client_id, g.scopes, g.resource, g.created_at,
            g.last_used_at, u.email, up.is_active, up.last_password_changed_at, up.require_password_change
     FROM mcp_tokens t
     JOIN mcp_grants g ON g.id = t.grant_id
     JOIN users u ON u.id = g.user_id
     JOIN user_profiles up ON up.id = g.user_id
     WHERE t.token_hash = $1 AND t.expires_at > now() AND g.revoked_at IS NULL`,
    [hashToken(token)]
  );
  const row = r.rows[0];
  if (!row || !types.includes(row.token_type)) return null;
  if (row.is_active === false || row.require_password_change) return null;
  if (row.last_password_changed_at && new Date(row.created_at) < new Date(row.last_password_changed_at)) return null;

  // Throttle last_used_at writes to once every 5 minutes per grant.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 5 * 60 * 1000) {
    query('UPDATE mcp_grants SET last_used_at = now() WHERE id = $1', [row.grant_id]).catch(() => {});
  }

  return {
    grantId: row.grant_id,
    userId: row.user_id,
    email: row.email,
    clientId: row.client_id,
    scopes: row.scopes || [],
    resource: row.resource,
    tokenType: row.token_type,
    expiresAt: new Date(row.expires_at),
  };
}

export async function deleteToken(token: string): Promise<void> {
  await query('DELETE FROM mcp_tokens WHERE token_hash = $1', [hashToken(token)]);
}

export async function revokeGrant(grantId: string, userId?: string): Promise<boolean> {
  const r = userId
    ? await query('UPDATE mcp_grants SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id', [grantId, userId])
    : await query('UPDATE mcp_grants SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id', [grantId]);
  if (r.rows.length === 0) return false;
  await query('DELETE FROM mcp_tokens WHERE grant_id = $1', [grantId]);
  return true;
}

export async function listGrants(userId: string) {
  const r = await query(
    `SELECT g.id, g.kind, g.name, g.created_at, g.last_used_at,
            (SELECT MAX(expires_at) FROM mcp_tokens t WHERE t.grant_id = g.id) AS expires_at
     FROM mcp_grants g
     WHERE g.user_id = $1 AND g.revoked_at IS NULL
     ORDER BY g.created_at DESC`,
    [userId]
  );
  return r.rows;
}
