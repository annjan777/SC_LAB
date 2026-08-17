import { Router } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { updateUserProfileSchema } from '../validators/userValidator.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
const router = Router();
// GET /api/users - list all users (with expertise)
router.get('/', authenticate, async (req, res) => {
    try {
        const isPrivileged = req.user?.permissions.has('manage_users');
        let sql;
        if (isPrivileged) {
            sql = 'SELECT * FROM user_profiles ORDER BY created_at DESC';
        }
        else {
            sql = `
        SELECT id, full_name, roll_number, gender, email, department, program_designation, 
               supervisor, joining_date, tenure_ending_date, user_role, is_active, 
               profile_picture_url, created_at, updated_at 
        FROM user_profiles 
        ORDER BY created_at DESC
      `;
        }
        const result = await query(sql);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const isOwnerOrPrivileged = req.user.id === req.params.id || req.user?.permissions.has('manage_users');
        let sql;
        if (isOwnerOrPrivileged) {
            sql = 'SELECT * FROM user_profiles WHERE id = $1';
        }
        else {
            sql = `
        SELECT id, full_name, roll_number, gender, email, department, program_designation, 
               supervisor, joining_date, tenure_ending_date, user_role, is_active, 
               profile_picture_url, created_at, updated_at 
        FROM user_profiles 
        WHERE id = $1
      `;
        }
        const result = await query(sql, [req.params.id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// PUT /api/users/:id
router.put('/:id', authenticate, validateBody(updateUserProfileSchema), async (req, res) => {
    try {
        // Users can update their own profile; admins can update anyone
        if (req.user.id !== req.params.id && req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const fields = req.body;
        // Only admin/super_admin can change user_role and is_active
        if (req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin') {
            delete fields.user_role;
            delete fields.is_active;
        }
        delete fields.id;
        delete fields.created_at;
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields to update' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.id);
        await transaction(async (client) => {
            // If email is being updated, update auth users table explicitly in same transaction
            if (fields.email) {
                await client.query('UPDATE users SET email = $1, updated_at = now() WHERE id = $2', [fields.email, req.params.id]);
            }
            await client.query(`UPDATE user_profiles SET ${setClause} WHERE id = $${values.length}`, values);
        });
        const result = await query('SELECT * FROM user_profiles WHERE id = $1', [req.params.id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.delete('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
    try {
        await transaction(async (client) => {
            const userId = req.params.id;
            // Nullify references where we want to preserve the record but un-link the user
            await client.query('UPDATE user_permissions SET granted_by = NULL WHERE granted_by = $1', [userId]);
            await client.query('UPDATE work_cycles SET created_by = NULL WHERE created_by = $1', [userId]);
            // For purchase/leave requests: nullify approver first, then delete records the user created
            await client.query('UPDATE purchase_requests SET approved_by = NULL WHERE approved_by = $1', [userId]);
            await client.query('DELETE FROM purchase_requests WHERE requested_by = $1', [userId]);
            await client.query('UPDATE leave_requests SET approved_by = NULL WHERE approved_by = $1', [userId]);
            await client.query('DELETE FROM leave_requests WHERE requested_by = $1', [userId]);
            // Delete remaining user-owned records
            await client.query('DELETE FROM admin_comments WHERE commented_by = $1', [userId]);
            await client.query('DELETE FROM repository_documents WHERE uploaded_by = $1', [userId]);
            await client.query('DELETE FROM audit_logs WHERE performed_by = $1', [userId]);
            // Delete user — cascades to user_profiles, user_permissions (as grantee),
            // notifications, expertise, work assignments, and all ON DELETE CASCADE children.
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
        });
        res.json({ message: 'User deleted' });
    }
    catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});
export default router;
