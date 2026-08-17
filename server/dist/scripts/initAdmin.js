import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, transaction } from '../config/database.js';
export async function initializeSuperAdmin() {
    try {
        // Ensure default permissions for user role are present
        await query(`
      DELETE FROM role_permissions
      WHERE role_id = (SELECT id FROM roles WHERE LOWER(name) = 'user')
        AND permission_id IN (
          SELECT id FROM permissions
          WHERE name IN ('view_leaves', 'view_procurement', 'view_reports', 'generate_reports', 'view_users')
        );
    `);
        await query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p 
      WHERE LOWER(r.name) = 'user' 
        AND p.name IN (
          'create_leave_request', 
          'create_purchase_request', 
          'create_work', 'edit_work', 'view_work', 
          'view_inventory', 'create_inventory', 'edit_inventory', 
          'view_settings', 
          'view_notifications', 'view_facilities'
        )
      ON CONFLICT DO NOTHING;
    `);
        // Ensure all user_profiles have a role_id mapped
        await query(`
      UPDATE user_profiles up
      SET role_id = r.id
      FROM roles r
      WHERE up.role_id IS NULL AND LOWER(r.name) = LOWER(up.user_role);
    `);
        // Check if any admin profile already exists
        const checkAdmin = await query("SELECT id FROM user_profiles WHERE user_role = 'admin' LIMIT 1");
        if (checkAdmin.rows.length > 0) {
            return; // Admin account already exists
        }
        console.log('[SECURITY] No administrator account found. Initializing superadmin account...');
        const email = process.env.SUPERADMIN_EMAIL || 'annjan0077@gmail.com';
        let password = process.env.SUPERADMIN_PASSWORD;
        let generated = false;
        if (!password) {
            // Generate a strong random 16-character password if not supplied in environment
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
            password = Array.from(crypto.randomBytes(16)).map(b => chars[b % chars.length]).join('');
            generated = true;
        }
        const hash = await bcrypt.hash(password, 10);
        const userId = '00000000-0000-0000-0000-000000000001';
        await transaction(async (client) => {
            await client.query(`INSERT INTO users (id, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`, [userId, email, hash]);
            const roleRes = await client.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
            const roleId = roleRes.rows[0]?.id || null;
            await client.query(`INSERT INTO user_profiles (id, full_name, email, user_role, role_id, is_active, require_password_change)
         VALUES ($1, 'Super Admin', $2, 'admin', $3, true, $4)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`, [userId, email, roleId, generated]);
        });
        console.log(`[SECURITY] Superadmin initialized successfully!`);
        console.log(`           Email:    ${email}`);
        if (generated) {
            console.log(`           Password: ${password} (GENERATED - PLEASE SAVE SECURELY)`);
        }
        else {
            console.log(`           Password: [CONFIGURED FROM ENVIRONMENT]`);
        }
    }
    catch (err) {
        console.error('[SECURITY FATAL] Failed to initialize superadmin account:', err.message);
    }
}
