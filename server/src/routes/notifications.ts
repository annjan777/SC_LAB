import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const archived = req.query.is_archived === 'true';
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 AND is_archived = $2
       ORDER BY created_at DESC LIMIT $3`,
      [req.user!.id, archived, limit]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/notifications
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { user_id, type, title, message, related_entity_type, related_entity_id, action_url } = req.body;
    
    // Only allow admins or people with specific permissions to create notifications for others
    if (user_id && user_id !== req.user!.id && !req.user!.permissions.has('manage_settings')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetUserId = user_id || req.user!.id;
    
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [targetUserId, type || 'info', title, message, related_entity_type || null, related_entity_id || null, action_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/notifications/broadcast
router.post('/broadcast', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, message, type } = req.body;
    
    if (!req.user!.permissions.has('manage_settings') && !req.user!.permissions.has('manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions to broadcast' });
    }

    const users = await query(`SELECT id FROM user_profiles WHERE is_active = true`);
    
    if (users.rows.length === 0) {
      return res.json({ message: 'No active users to notify' });
    }

    // Insert for all users
    const placeholders = users.rows.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
    const values = users.rows.flatMap(u => [u.id, type || 'announcement', title, message]);

    await query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES ${placeholders}`,
      values
    );

    res.status(201).json({ message: `Broadcast sent to ${users.rows.length} users` });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/notifications/:id
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const fields = req.body;
    const rawKeys = Object.keys(fields);
    if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
    const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = rawKeys.map(k => fields[k]);
    values.push(req.params.id);
    values.push(req.user!.id);

    const result = await query(
      `UPDATE notifications SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', authenticate, async (req: Request, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true, read_at = now()
       WHERE user_id = $1 AND is_read = false`,
      [req.user!.id]
    );
    res.json({ message: 'All marked as read' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/notifications/archive-all
router.post('/archive-all', authenticate, async (req: Request, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_archived = true WHERE user_id = $1 AND is_archived = false`,
      [req.user!.id]
    );
    res.json({ message: 'All archived' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/notifications/archived-all
router.delete('/archived-all', authenticate, async (req: Request, res: Response) => {
  try {
    await query(
      `DELETE FROM notifications WHERE user_id = $1 AND is_archived = true`,
      [req.user!.id]
    );
    res.json({ message: 'All archived notifications deleted' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false AND is_archived = false',
      [req.user!.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
