import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
const router = Router();
// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
    try {
        const archived = req.query.is_archived === 'true';
        const limit = parseInt(req.query.limit) || 20;
        const result = await query(`SELECT * FROM notifications WHERE user_id = $1 AND is_archived = $2
       ORDER BY created_at DESC LIMIT $3`, [req.user.id, archived, limit]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// PUT /api/notifications/:id
router.put('/:id', authenticate, async (req, res) => {
    try {
        const fields = req.body;
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields to update' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.id);
        values.push(req.user.id);
        const result = await query(`UPDATE notifications SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`, values);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /api/notifications/mark-all-read
router.post('/mark-all-read', authenticate, async (req, res) => {
    try {
        await query(`UPDATE notifications SET is_read = true, read_at = now()
       WHERE user_id = $1 AND is_read = false`, [req.user.id]);
        res.json({ message: 'All marked as read' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /api/notifications/archive-all
router.post('/archive-all', authenticate, async (req, res) => {
    try {
        await query(`UPDATE notifications SET is_archived = true WHERE user_id = $1 AND is_archived = false`, [req.user.id]);
        res.json({ message: 'All archived' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false AND is_archived = false', [req.user.id]);
        res.json({ count: parseInt(result.rows[0].count) });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
