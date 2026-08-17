import { query, transaction } from '../../config/database.js';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  user_role: string;
  role_id: string | null;
  is_active: boolean;
  department: string | null;
  program_designation: string | null;
  supervisor: string | null;
}

export class IdentityRepository {
  async findUserById(id: string): Promise<UserProfile | null> {
    const result = await query(
      `SELECT id, full_name, email, user_role, role_id, is_active, department, program_designation, supervisor
       FROM user_profiles WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findUserPermissions(userId: string): Promise<string[]> {
    const result = await query('SELECT permission_name FROM get_user_permissions($1)', [userId]);
    return result.rows.map(r => r.permission_name);
  }

  async updateUserRoleAndPermissions(userId: string, userRole?: string, roleId?: string, permissionIds?: string[], grantedBy?: string): Promise<void> {
    await transaction(async (client) => {
      if (roleId !== undefined) {
        await client.query('UPDATE user_profiles SET role_id = $1 WHERE id = $2', [roleId, userId]);
      }
      if (userRole !== undefined) {
        await client.query('UPDATE user_profiles SET user_role = $1 WHERE id = $2', [userRole, userId]);
      }
      if (permissionIds !== undefined && Array.isArray(permissionIds)) {
        await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
        for (const pid of permissionIds) {
          await client.query(
            'INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [userId, pid, grantedBy || null]
          );
        }
      }
    });
  }
}

export const identityRepository = new IdentityRepository();
