import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
const router = Router();
// --- ROLES ---
router.get('/roles', authenticate, async (_req, res) => {
    try {
        const result = await query('SELECT * FROM roles ORDER BY created_at');
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/roles', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const result = await query('INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.delete('/roles/:id', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req, res) => {
    try {
        const check = await query('SELECT is_system_role FROM roles WHERE id = $1', [req.params.id]);
        if (check.rows[0]?.is_system_role)
            return res.status(400).json({ error: 'Cannot delete system role' });
        await query('DELETE FROM roles WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- PERMISSIONS ---
router.get('/permissions', authenticate, async (_req, res) => {
    try {
        const result = await query('SELECT * FROM permissions ORDER BY category, display_name');
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- ROLE PERMISSIONS ---
router.get('/role-permissions/:roleId', authenticate, async (req, res) => {
    try {
        const result = await query(`SELECT rp.*, p.name, p.display_name, p.category
       FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1`, [req.params.roleId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/role-permissions/:roleId', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req, res) => {
    try {
        const { permission_ids } = req.body; // array of permission UUIDs
        await query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.roleId]);
        for (const pid of permission_ids) {
            await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.roleId, pid]);
        }
        res.json({ message: 'Updated' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- USER PERMISSIONS (direct grants) ---
router.get('/user-permissions/:userId', authenticate, async (req, res) => {
    try {
        const result = await query(`SELECT up.*, p.name, p.display_name, p.category
       FROM user_permissions up JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1`, [req.params.userId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/user-permissions/:userId', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req, res) => {
    try {
        const { role_id, permission_ids } = req.body;
        // Update role
        if (role_id !== undefined) {
            await query('UPDATE user_profiles SET role_id = $1 WHERE id = $2', [role_id, req.params.userId]);
        }
        // Update direct permissions
        if (permission_ids) {
            await query('DELETE FROM user_permissions WHERE user_id = $1', [req.params.userId]);
            for (const pid of permission_ids) {
                await query('INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.params.userId, pid, req.user.id]);
            }
        }
        res.json({ message: 'Updated' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
