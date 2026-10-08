import { query } from '../config/database.js';

/**
 * Security-related schema changes. Idempotent; call once at server boot.
 *
 * - user_profiles.sessions_revoked_at: set by POST /api/auth/logout. Any session JWT
 *   issued before this timestamp is rejected by the authenticate middleware.
 */
export async function ensureSecuritySchema(): Promise<void> {
  await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sessions_revoked_at timestamptz`);
}
