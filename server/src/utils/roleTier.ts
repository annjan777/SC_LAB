/**
 * user_profiles.user_role is a fixed "tier" column (CHECK constraint) used by the RBAC gateway.
 * Custom roles created in Settings are stored in role_id; their holders sit in the base 'user' tier
 * and get their extra rights from the role's permissions.
 */
export const ROLE_TIERS = ['super_admin', 'admin', 'lab_manager', 'researcher', 'student', 'guest', 'user'];

export function tierForRole(roleName: string | null | undefined): string {
  const n = String(roleName || '').trim().toLowerCase();
  return ROLE_TIERS.includes(n) ? n : 'user';
}
