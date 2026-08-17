// Work planning routes - handles /api/work/* paths used by frontend
import { Router } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
const router = Router();
function canManage(req, perm) {
    return req.user.permissions.has(perm);
}
async function loadWorkOwner(workId) {
    const r = await query('SELECT user_id FROM assigned_works WHERE id = $1', [workId]);
    return r.rows[0]?.user_id ?? null;
}
function mapWorkRow(row) {
    return {
        ...row,
        user_profiles: {
            full_name: row.user_name || null,
            department: row.department || null,
            email: row.user_email || null,
        },
    };
}
async function listMitigationActions(problemId) {
    const result = await query(`SELECT
       id,
       action_description,
       action_description AS proposed_mitigation,
       support_required_from,
       urgency_level,
       status,
       created_at,
       updated_at
     FROM mitigation_actions
     WHERE problem_id = $1
     ORDER BY created_at ASC`, [problemId]);
    return result.rows;
}
// GET /api/work - list assigned work entries
router.get('/', authenticate, async (req, res) => {
    try {
        const canReadAll = canManage(req, 'manage_work_cycles') || canManage(req, 'manage_users');
        const params = [];
        const conditions = [];
        if (!canReadAll) {
            conditions.push(`aw.user_id = $${params.length + 1}`);
            params.push(req.user.id);
        }
        if (req.query.user_id && canReadAll) {
            conditions.push(`aw.user_id = $${params.length + 1}`);
            params.push(req.query.user_id);
        }
        let sql = `
      SELECT
        aw.*,
        aw.id AS work_id,
        up.full_name AS user_name,
        up.department,
        up.email AS user_email
      FROM assigned_works aw
      LEFT JOIN user_profiles up ON up.id = aw.user_id
    `;
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        sql += ` ORDER BY aw.created_at DESC`;
        const result = await query(sql, params);
        res.json(result.rows.map(mapWorkRow));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /api/work - create a work entry
router.post('/', authenticate, async (req, res) => {
    try {
        if (!canManage(req, 'create_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const { user_id, project_name, assigned_by, work_title, description, start_date, end_date, priority, milestones = [], initial_status, initial_percentage, progress_notes, } = req.body;
        const ownerId = user_id || req.user.id;
        const createdWork = await transaction(async (client) => {
            const workResult = await client.query(`INSERT INTO assigned_works
           (user_id, project_name, assigned_by, work_title, description, start_date, end_date, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`, [ownerId, project_name, assigned_by, work_title, description, start_date, end_date, priority || 'medium']);
            const work = workResult.rows[0];
            for (const milestone of milestones) {
                const title = milestone.milestone_description || milestone.title;
                if (!title || !milestone.target_date)
                    continue;
                await client.query(`INSERT INTO work_milestones (work_id, title, target_date, expected_outcome, status)
           VALUES ($1,$2,$3,$4,$5)`, [
                    work.id,
                    title,
                    milestone.target_date,
                    milestone.expected_outcome || null,
                    milestone.is_completed ? 'completed' : (milestone.status || 'pending'),
                ]);
            }
            const completion = Number.isFinite(Number(initial_percentage)) ? Number(initial_percentage) : 0;
            if (initial_status || progress_notes || completion > 0) {
                await client.query(`INSERT INTO progress_updates
             (work_id, update_date, status, completion_percentage, summary)
           VALUES ($1, CURRENT_DATE, $2, $3, $4)`, [
                    work.id,
                    initial_status || 'on_track',
                    completion,
                    progress_notes || 'Work entry created',
                ]);
            }
            return work;
        });
        res.status(201).json(createdWork);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/work/:id - get a single assigned work with all related data
router.get('/:id', authenticate, async (req, res) => {
    try {
        const work = await query(`
      SELECT aw.*, up.full_name as user_name, up.department, up.email as user_email
      FROM assigned_works aw
      LEFT JOIN user_profiles up ON up.id = aw.user_id
      WHERE aw.id = $1`, [req.params.id]);
        if (work.rows.length === 0)
            return res.status(404).json({ error: 'Not found' });
        const row = work.rows[0];
        const isOwner = row.user_id === req.user.id;
        if (!isOwner && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        res.json(mapWorkRow(row));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// PUT /api/work/:id - owner may update their own work; others need edit_work
router.put('/:id', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        const hasManagerPerm = canManage(req, 'edit_work');
        if (ownerId !== req.user.id && !hasManagerPerm && req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const fields = { ...req.body };
        const milestones = Array.isArray(fields.milestones) ? fields.milestones : [];
        const deletedMilestoneIds = Array.isArray(fields.deleted_milestone_ids) ? fields.deleted_milestone_ids : [];
        delete fields.milestones;
        delete fields.deleted_milestone_ids;
        delete fields.id;
        delete fields.created_at;
        delete fields.user_id;
        if (!hasManagerPerm && req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin') {
            const systemFields = ['admin_status', 'admin_feedback', 'procurement_request_ids'];
            for (const sysField of systemFields)
                delete fields[sysField];
        }
        const rawKeys = Object.keys(fields);
        const result = await transaction(async (client) => {
            let updated;
            if (rawKeys.length > 0) {
                const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
                const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
                const values = rawKeys.map(k => fields[k]);
                values.push(req.params.id);
                updated = await client.query(`UPDATE assigned_works SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
            }
            else {
                updated = await client.query('SELECT * FROM assigned_works WHERE id = $1', [req.params.id]);
            }
            if (deletedMilestoneIds.length > 0) {
                await client.query(`DELETE FROM work_milestones
           WHERE work_id = $1 AND id = ANY($2::uuid[])`, [req.params.id, deletedMilestoneIds]);
            }
            for (const milestone of milestones) {
                const title = milestone.milestone_description || milestone.title;
                if (!title || !milestone.target_date)
                    continue;
                if (milestone.id) {
                    await client.query(`UPDATE work_milestones
             SET title = $1, target_date = $2, expected_outcome = $3, status = $4
             WHERE id = $5 AND work_id = $6`, [
                        title,
                        milestone.target_date,
                        milestone.expected_outcome || null,
                        milestone.is_completed ? 'completed' : (milestone.status || 'pending'),
                        milestone.id,
                        req.params.id,
                    ]);
                }
                else {
                    await client.query(`INSERT INTO work_milestones (work_id, title, target_date, expected_outcome, status)
             VALUES ($1,$2,$3,$4,$5)`, [
                        req.params.id,
                        title,
                        milestone.target_date,
                        milestone.expected_outcome || null,
                        milestone.is_completed ? 'completed' : (milestone.status || 'pending'),
                    ]);
                }
            }
            return updated;
        });
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// DELETE /api/work/:id - requires delete_work permission (or admin)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (!canManage(req, 'delete_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        await query('DELETE FROM assigned_works WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- Sub-resources ---
// GET /api/work/:id/milestones
router.get('/:id/milestones', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'view_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const result = await query(`SELECT
         id,
         title,
         title AS milestone_description,
         target_date,
         expected_outcome,
         status,
         (status = 'completed') AS is_completed,
         CASE WHEN status = 'completed' THEN updated_at ELSE NULL END AS completed_at,
         created_at,
         updated_at
       FROM work_milestones
       WHERE work_id = $1
       ORDER BY target_date`, [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/:id/milestones', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'edit_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const { title, target_date, status } = req.body;
        const result = await query('INSERT INTO work_milestones (work_id, title, target_date, status) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, title, target_date, status || 'pending']);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/:id/milestones/:milestoneId', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'edit_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const fields = {};
        if (req.body.milestone_description !== undefined)
            fields.title = req.body.milestone_description;
        if (req.body.target_date !== undefined)
            fields.target_date = req.body.target_date;
        if (req.body.expected_outcome !== undefined)
            fields.expected_outcome = req.body.expected_outcome;
        if (req.body.status !== undefined)
            fields.status = req.body.status;
        if (req.body.is_completed !== undefined)
            fields.status = req.body.is_completed ? 'completed' : 'pending';
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.milestoneId, req.params.id);
        const result = await query(`UPDATE work_milestones
       SET ${setClause}
       WHERE id = $${values.length - 1} AND work_id = $${values.length}
       RETURNING *`, values);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/work/:id/progress
router.get('/:id/progress', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'view_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const result = await query(`SELECT
         id,
         work_id,
         update_date,
         status,
         completion_percentage,
         summary,
         summary AS progress_notes,
         next_steps,
         blockers,
         created_at
       FROM progress_updates
       WHERE work_id = $1
       ORDER BY update_date DESC, created_at DESC`, [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/:id/progress', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'edit_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const { update_date, status, completion_percentage, summary, progress_notes, next_steps, blockers } = req.body;
        const result = await query(`INSERT INTO progress_updates (work_id, update_date, status, completion_percentage, summary, next_steps, blockers)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [
            req.params.id,
            update_date || new Date().toISOString().slice(0, 10),
            status || 'on_track',
            completion_percentage || 0,
            progress_notes || summary || 'Progress updated',
            next_steps || null,
            blockers || null,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/work/:id/problems
router.get('/:id/problems', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'view_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const result = await query(`SELECT
         id,
         work_id,
         title,
         title AS category,
         description,
         severity,
         severity AS impact_level,
         status,
         (status IN ('resolved', 'closed')) AS is_resolved,
         reported_at,
         reported_at AS reported_date,
         resolved_at,
         resolved_at AS resolution_date,
         created_at,
         updated_at
       FROM work_problems
       WHERE work_id = $1
       ORDER BY created_at DESC`, [req.params.id]);
        const mapped = await Promise.all(result.rows.map(async (row) => ({
            ...row,
            mitigation_actions: await listMitigationActions(row.id),
        })));
        res.json(mapped);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/:id/problems', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'edit_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const { title, category, description, severity, impact_level, proposed_mitigation, support_required_from, urgency_level, } = req.body;
        const problem = await transaction(async (client) => {
            const result = await client.query('INSERT INTO work_problems (work_id, title, description, severity) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, title || category || 'general', description, severity || impact_level || 'medium']);
            if (proposed_mitigation) {
                await client.query(`INSERT INTO mitigation_actions
             (problem_id, action_description, support_required_from, urgency_level, status)
           VALUES ($1,$2,$3,$4,$5)`, [result.rows[0].id, proposed_mitigation, support_required_from || null, urgency_level || null, 'planned']);
            }
            return result.rows[0];
        });
        const result = { ...problem, category: problem.title, impact_level: problem.severity, is_resolved: false };
        res.status(201).json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/:id/problems/:problemId', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'edit_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const fields = {};
        if (req.body.category !== undefined)
            fields.title = req.body.category;
        if (req.body.description !== undefined)
            fields.description = req.body.description;
        if (req.body.impact_level !== undefined)
            fields.severity = req.body.impact_level;
        if (req.body.status !== undefined)
            fields.status = req.body.status;
        if (req.body.is_resolved !== undefined) {
            fields.status = req.body.is_resolved ? 'resolved' : 'open';
            fields.resolved_at = req.body.is_resolved ? (req.body.resolution_date || new Date().toISOString()) : null;
        }
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.problemId, req.params.id);
        const result = await query(`UPDATE work_problems
       SET ${setClause}
       WHERE id = $${values.length - 1} AND work_id = $${values.length}
       RETURNING *`, values);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/work/:id/comments - visible to the work's owner and staff with view_work
router.get('/:id/comments', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'view_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const result = await query(`
      SELECT
        ac.id,
        ac.comment,
        ac.comment AS comment_text,
        ac.created_at,
        false AS is_read_by_user,
        json_build_object('full_name', up.full_name) AS admin_profile,
        json_build_object('full_name', up.full_name) AS user_profiles
      FROM admin_comments ac LEFT JOIN user_profiles up ON up.id = ac.commented_by
      WHERE ac.work_id = $1 ORDER BY ac.created_at DESC`, [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /api/work/:id/comments - admin-comments are, by design, authored by admins/managers only
router.post('/:id/comments', authenticate, async (req, res) => {
    try {
        if (!canManage(req, 'edit_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const comment = req.body.comment || req.body.comment_text;
        const result = await query('INSERT INTO admin_comments (work_id, comment, commented_by) VALUES ($1,$2,$3) RETURNING *', [req.params.id, comment, req.user.id]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/:id/comments/mark-read', authenticate, async (_req, res) => {
    res.json({ message: 'No-op for local comment reads' });
});
// Dependencies
router.get('/:id/dependencies', authenticate, async (req, res) => {
    try {
        const ownerId = await loadWorkOwner(req.params.id);
        if (ownerId === null)
            return res.status(404).json({ error: 'Not found' });
        if (ownerId !== req.user.id && !canManage(req, 'view_work')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const result = await query('SELECT * FROM work_dependencies WHERE work_id = $1', [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
