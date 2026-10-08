import { Router, Request, Response } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

const SYSTEM_ROLE_NAMES = ['admin', 'user'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: Response, err: any) => {
  if (err?.code === '23505') return res.status(409).json({ error: 'A role with this name already exists' });
  if (err?.code === '22P02') return res.status(400).json({ error: 'Invalid id' });
  if (err?.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
  console.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// --- ROLES ---
router.get('/roles', authenticate, requirePermission('manage_roles', 'manage_settings'), async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM roles ORDER BY created_at');
    res.json(result.rows);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/roles', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req: Request, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    if (name.length > 60) return res.status(400).json({ error: 'Role name must be at most 60 characters' });
    const dup = await query('SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
    if (dup.rows.length) return res.status(409).json({ error: 'A role with this name already exists' });
    const result = await query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [name, req.body.description ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { fail(res, err); }
});

router.delete('/roles/:id', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid role id' });
    const check = await query('SELECT name, is_system_role FROM roles WHERE id = $1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Role not found' });
    if (check.rows[0].is_system_role || SYSTEM_ROLE_NAMES.includes(String(check.rows[0].name).toLowerCase())) {
      return res.status(400).json({ error: 'Cannot delete system role' });
    }
    const inUse = await query('SELECT count(*)::int AS n FROM user_profiles WHERE role_id = $1', [req.params.id]);
    if (inUse.rows[0].n > 0) {
      return res.status(409).json({ error: `This role is still assigned to ${inUse.rows[0].n} user(s). Move them to another role first.` });
    }
    await query('DELETE FROM roles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) { fail(res, err); }
});

// --- PERMISSIONS ---
router.get('/permissions', authenticate, requirePermission('manage_roles', 'manage_settings'), async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM permissions ORDER BY category, display_name');
    res.json(result.rows);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

// --- ROLE PERMISSIONS ---
router.get('/role-permissions/:roleId', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.roleId)) return res.status(400).json({ error: 'Invalid role id' });
    const result = await query(
      `SELECT rp.*, p.name, p.display_name, p.category
       FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [req.params.roleId]
    );
    res.json(result.rows);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.put('/role-permissions/:roleId', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req: Request, res: Response) => {
  try {
    const { permission_ids } = req.body; // array of permission UUIDs
    if (!UUID_RE.test(req.params.roleId)) return res.status(400).json({ error: 'Invalid role id' });
    if (!Array.isArray(permission_ids) || permission_ids.some((p: any) => typeof p !== 'string' || !UUID_RE.test(p))) {
      return res.status(400).json({ error: 'permission_ids must be an array of permission ids' });
    }
    const role = await query('SELECT name FROM roles WHERE id = $1', [req.params.roleId]);
    if (!role.rows.length) return res.status(404).json({ error: 'Role not found' });
    if (String(role.rows[0].name).toLowerCase() === 'admin') {
      const required = await query("SELECT id FROM permissions WHERE name IN ('manage_roles','manage_users','manage_settings')");
      if (required.rows.some((r: any) => !permission_ids.includes(r.id))) {
        return res.status(400).json({ error: 'The admin role must keep manage_roles, manage_users and manage_settings (otherwise administrators lock themselves out)' });
      }
    }
    await query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.roleId]);
    for (const pid of permission_ids) {
      await query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.roleId, pid]
      );
    }
    res.json({ message: 'Updated' });
  } catch (err: any) { fail(res, err); }
});

// --- USER PERMISSIONS (direct grants) ---
router.get('/user-permissions/:userId', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.userId)) return res.status(400).json({ error: 'Invalid user id' });
    const result = await query(
      `SELECT up.*, p.name, p.display_name, p.category
       FROM user_permissions up JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.put('/user-permissions/:userId', authenticate, requirePermission('manage_roles', 'manage_settings'), async (req: Request, res: Response) => {
  try {
    const { role_id, permission_ids } = req.body;

    // Validate everything up front so malformed ids are a 400, not a 500 halfway through.
    if (!UUID_RE.test(req.params.userId)) return res.status(400).json({ error: 'Invalid user id' });
    if (role_id !== undefined && role_id !== null && (typeof role_id !== 'string' || !UUID_RE.test(role_id))) {
      return res.status(400).json({ error: 'Invalid role id' });
    }
    if (permission_ids !== undefined && permission_ids !== null &&
        (!Array.isArray(permission_ids) || permission_ids.some((p: any) => typeof p !== 'string' || !UUID_RE.test(p)))) {
      return res.status(400).json({ error: 'permission_ids must be an array of permission ids' });
    }

    await transaction(async (client) => {
      // Update role. Role assignment can never produce user_role 'super_admin' — that tier is
      // not grantable through Settings (a role named "super_admin" maps to 'admin').
      if (role_id) {
        await client.query(
          `UPDATE user_profiles up
           SET role_id = r.id,
               user_role = CASE
                 WHEN LOWER(r.name) = 'super_admin' THEN 'admin'
                 WHEN LOWER(r.name) IN ('admin','lab_manager','researcher','student','guest','user') THEN LOWER(r.name)
                 ELSE 'user'
               END
           FROM roles r
           WHERE r.id = $1 AND up.id = $2`,
          [role_id, req.params.userId]
        );
      }

      // Update direct permissions (delete + insert atomically)
      if (Array.isArray(permission_ids)) {
        await client.query('DELETE FROM user_permissions WHERE user_id = $1', [req.params.userId]);
        for (const pid of permission_ids) {
          await client.query(
            'INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [req.params.userId, pid, req.user!.id]
          );
        }
      }
    });

    res.json({ message: 'Updated' });
  } catch (err: any) { fail(res, err); }
});

export default router;
