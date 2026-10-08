// Work planning routes - handles /api/work/* paths used by frontend
import { Router, Request, Response } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { notifyWorkComment } from '../services/workNotificationService.js';

const router = Router();

function canManage(req: Request, perm: string): boolean {
  const isSuper = req.user?.user_role === 'super_admin' || req.user?.user_role === 'superadmin';
  const isAdmin = req.user?.user_role === 'admin';
  return isSuper || isAdmin || (req.user?.permissions.has(perm) ?? false);
}


const WORK_PRIORITIES = ['low', 'medium', 'high', 'code_red'];
const DEPENDENCY_TYPES = ['blocks', 'is_blocked_by', 'relates_to', 'delayed_by_code_red'];
const ISSUE_TYPES = ['task', 'experiment', 'milestone', 'equipment_maintenance', 'bug_incident', 'procurement_task'];
const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'delayed'];
const PROBLEM_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const PROBLEM_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// Columns of assigned_works a work's assignee / assigner may edit via PUT /api/work/:id.
const MEMBER_EDITABLE_WORK_FIELDS = ['work_title', 'description', 'project_name', 'start_date', 'end_date', 'priority', 'issue_type'];
// Additional columns only admins or edit_work / manage_work_cycles holders may edit.
const MANAGER_EDITABLE_WORK_FIELDS = [
  ...MEMBER_EDITABLE_WORK_FIELDS,
  'assigned_by', 'assigned_by_user_id', 'cycle_id', 'admin_status', 'admin_feedback', 'procurement_request_ids',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: any): boolean {
  return typeof v === 'string' && UUID_RE.test(v);
}

// Reject malformed ids in route params with a 400 instead of letting Postgres throw (500).
for (const param of ['id', 'milestoneId', 'problemId', 'depId', 'requestId']) {
  router.param(param, (_req: Request, res: Response, next, value) => {
    if (!isUuid(value)) return res.status(400).json({ error: 'Invalid id' });
    next();
  });
}

function isValidIsoDate(v: any): boolean {
  if (v === undefined || v === null || v === '') return true;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const day = s.slice(0, 10);
  const d = new Date(day + 'T00:00:00Z');
  // Round-trip so impossible dates like 2026-02-30 are rejected instead of rolling over.
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

// Validates a proposed milestone list (change requests). Returns an error message or null.
function validateProposedMilestones(list: any[], startIso: string | null, endIso: string | null): string | null {
  for (const m of list) {
    const title = m?.milestone_description ?? m?.title;
    if (!title || !String(title).trim()) return 'Every proposed milestone needs a title';
    if (!m.target_date || !isValidIsoDate(m.target_date)) return `Proposed milestone "${title}" has an invalid target date`;
    const mDate = String(m.target_date).slice(0, 10);
    if (startIso && mDate < startIso) {
      return `Proposed milestone "${title}" target date (${mDate}) cannot be before the work start date (${startIso}).`;
    }
    if (endIso && mDate > endIso) {
      return `Proposed milestone "${title}" target date (${mDate}) cannot be beyond the project target end date (${endIso}).`;
    }
  }
  return null;
}

// Shared validation for work items (create + edit). Returns an error message or null.
function validateWorkInput(body: any, opts: { requireTitle: boolean }): string | null {
  const { work_title, project_name, issue_type, start_date, end_date, priority, milestones, initial_percentage } = body;
  if (opts.requireTitle || work_title !== undefined) {
    if (!work_title || !String(work_title).trim()) return 'Work title is required';
    if (String(work_title).length > 300) return 'Work title must be 300 characters or fewer';
  }
  if (opts.requireTitle || project_name !== undefined) {
    if (!project_name || !String(project_name).trim()) return 'Project name is required';
  }
  if (issue_type !== undefined && issue_type !== null && issue_type !== '' && !ISSUE_TYPES.includes(issue_type)) {
    return `Issue type must be one of: ${ISSUE_TYPES.join(', ')}`;
  }
  if (!isValidIsoDate(start_date)) return 'Start date is not a valid date (use YYYY-MM-DD)';
  if (!isValidIsoDate(end_date)) return 'End date is not a valid date (use YYYY-MM-DD)';
  if (start_date && end_date && String(end_date).slice(0, 10) < String(start_date).slice(0, 10)) {
    return 'End date cannot be earlier than start date';
  }
  if (priority !== undefined && priority !== null && priority !== '' && !WORK_PRIORITIES.includes(priority)) {
    return `Priority must be one of: ${WORK_PRIORITIES.join(', ')}`;
  }
  if (initial_percentage !== undefined && initial_percentage !== null && initial_percentage !== '') {
    const pct = Number(initial_percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) return 'Initial completion percentage must be between 0 and 100';
  }
  if (Array.isArray(milestones)) {
    for (const m of milestones) {
      const title = m?.milestone_description ?? m?.title;
      if (!title || !String(title).trim()) return 'Every milestone needs a title';
      if (!isValidIsoDate(m.target_date)) return `Milestone "${title}" has an invalid target date`;
      if (m.target_date && start_date && String(m.target_date).slice(0, 10) < String(start_date).slice(0, 10)) {
        return `Milestone "${title}" target date cannot be before the work start date (${String(start_date).slice(0, 10)})`;
      }
      if (m.status !== undefined && m.status !== null && m.status !== '' && !MILESTONE_STATUSES.includes(m.status)) {
        return `Milestone status must be one of: ${MILESTONE_STATUSES.join(', ')}`;
      }
    }
  }
  return null;
}

async function loadWorkOwner(workId: string, reqUser?: any): Promise<string | null> {
  const r = await query('SELECT user_id, assigned_by_user_id, assigned_by FROM assigned_works WHERE id = $1', [workId]);
  if (!r.rows[0]) return null;
  const { user_id, assigned_by_user_id, assigned_by } = r.rows[0];

  // Resolve assigner authorization exclusively by verified foreign key UUID or immutable email,
  // NEVER by user-editable display names (full_name) to prevent name-collision privilege escalation.
  if (reqUser) {
    if (assigned_by_user_id && reqUser.id === assigned_by_user_id) {
      return reqUser.id;
    }
    if (assigned_by && reqUser.email && assigned_by.trim().toLowerCase() === reqUser.email.trim().toLowerCase()) {
      return reqUser.id;
    }
  }

  return user_id;
}

function mapWorkRow(row: any) {
  return {
    ...row,
    user_profiles: {
      full_name: row.user_name || null,
      department: row.department || null,
      email: row.user_email || null,
    },
  };
}

// Recomputes completion_percentage from milestone completion ratio and logs it as a new
// progress entry, so overall progress always reflects milestones — rising as they're checked
// off, falling back down if one is unchecked. No-ops when a work item has no milestones, since
// there's nothing to derive a ratio from (manual progress updates remain the only signal then).
async function recalculateProgressFromMilestones(client: { query: (text: string, params?: any[]) => Promise<any> }, workId: string) {
  const milestonesResult = await client.query(
    'SELECT status, justification_status FROM work_milestones WHERE work_id = $1',
    [workId]
  );
  const total = milestonesResult.rows.length;
  if (total === 0) return;

  const completed = milestonesResult.rows.filter((m: any) => m.status === 'completed').length;
  const percentage = Math.round((completed / total) * 100);

  // If any uncompleted milestone is delayed without approved supervisor justification, or rejected, the work status is by default 'delayed'
  const hasUnapprovedDelay = milestonesResult.rows.some((m: any) =>
    m.status === 'delayed' && m.justification_status !== 'approved'
  );
  const hasRejectedDelay = milestonesResult.rows.some((m: any) =>
    m.status === 'delayed' && m.justification_status === 'rejected'
  );

  let status = 'in_progress';
  if (percentage === 100) {
    status = 'completed';
  } else if (hasUnapprovedDelay || hasRejectedDelay) {
    status = 'delayed';
  } else if (percentage === 0) {
    status = 'not_started';
  } else {
    status = 'in_progress';
  }

  // Check the latest recorded progress update to avoid logging identical duplicate rows when progress has not changed
  const latestUpdateResult = await client.query(
    `SELECT completion_percentage, status FROM progress_updates
     WHERE work_id = $1
     ORDER BY update_date DESC, created_at DESC, id DESC
     LIMIT 1`,
    [workId]
  );
  const latest = latestUpdateResult.rows[0];
  if (latest && Number(latest.completion_percentage) === percentage && latest.status === status) {
    return;
  }

  const summary = status === 'delayed'
    ? `Auto-updated from milestones: ${completed} of ${total} completed (${percentage}%). Work is DELAYED due to overdue/unapproved milestone(s).`
    : `Auto-updated from milestones: ${completed} of ${total} completed (${percentage}%).`;

  await client.query(
    `INSERT INTO progress_updates (work_id, update_date, status, completion_percentage, summary)
     VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
    [
      workId,
      status,
      percentage,
      summary,
    ]
  );
}

async function listMitigationActions(problemId: string) {
  const result = await query(
    `SELECT
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
     ORDER BY created_at ASC`,
    [problemId]
  );
  return result.rows;
}

async function logWorkActivity(
  clientOrPool: { query: (text: string, params?: any[]) => Promise<any> },
  workId: string,
  userId: string,
  action: string,
  remarks: string,
  oldValue: any = null,
  newValue: any = null
) {
  try {
    await clientOrPool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, performed_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'assigned_work',
        workId,
        action,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        userId,
        remarks,
      ]
    );
  } catch (err) {
    console.error('Failed to log work activity:', err);
  }
}

// Automatically flags any milestone whose expected target date has passed as 'delayed'
// User can then provide a delay justification which enters pending status for supervisor approval.
export async function syncOverdueMilestones(
  clientOrPool?: { query: (text: string, params?: any[]) => Promise<any> }
): Promise<number> {
  const db = clientOrPool || { query: (text: string, params?: any[]) => query(text, params) };
  try {
    const updated = await db.query(
      `UPDATE work_milestones
       SET status = 'delayed', updated_at = now()
       WHERE target_date IS NOT NULL
         AND target_date < CURRENT_DATE
         AND status NOT IN ('completed', 'delayed')
       RETURNING id, work_id, title, target_date`
    );

    if (updated.rows.length > 0) {
      for (const m of updated.rows) {
        const targetDateFormatted =
          m.target_date instanceof Date
            ? m.target_date.toISOString().split('T')[0]
            : String(m.target_date).split('T')[0];

        const workRes = await db.query(
          `SELECT aw.id, aw.work_title, aw.issue_key, aw.user_id, aw.assigned_by_user_id, aw.assigned_by
           FROM assigned_works aw
           WHERE aw.id = $1`,
          [m.work_id]
        );
        if (workRes.rows.length === 0) continue;
        const work = workRes.rows[0];

        await logWorkActivity(
          db,
          work.id,
          work.user_id || 'system',
          'milestone_auto_delayed',
          `Milestone "${m.title}" (target date: ${targetDateFormatted}) has passed expected completion date and was automatically marked as Delayed. Justification required.`
        );

        if (work.user_id) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
             VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
            [
              work.user_id,
              `Milestone Auto-Delayed: [${work.issue_key || 'WORK'}]`,
              `Milestone "${m.title}" passed expected completion date (${targetDateFormatted}) and has been automatically marked Delayed. Please provide a justification.`,
              work.id,
            ]
          );
        }

        let notifyAssignerId: string | null = null;
        if (work.assigned_by_user_id) {
          notifyAssignerId = work.assigned_by_user_id;
        } else if (work.assigned_by && work.assigned_by.includes('@')) {
          const supByEmail = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [work.assigned_by.trim()]);
          if (supByEmail.rows.length > 0) {
            notifyAssignerId = supByEmail.rows[0].id;
          }
        }

        if (notifyAssignerId && notifyAssignerId !== work.user_id) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
             VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
            [
              notifyAssignerId,
              `Milestone Overdue Alert: [${work.issue_key || 'WORK'}]`,
              `Milestone "${m.title}" for ${work.work_title} passed target date (${targetDateFormatted}) and was automatically marked Delayed. Awaiting user justification.`,
              work.id,
            ]
          );
        }
      }
    }

    // Always ensure all works with unapproved delayed milestones have their latest
    // progress_updates entry synchronized so status is 'delayed'
    const delayedWorksRes = await db.query(
      `SELECT DISTINCT work_id FROM work_milestones
       WHERE status = 'delayed'
         AND (justification_status IS NULL OR justification_status != 'approved')`
    );
    const affectedWorkIds = new Set<string>([
      ...updated.rows.map((r: any) => r.work_id),
      ...delayedWorksRes.rows.map((r: any) => r.work_id),
    ]);

    for (const wId of affectedWorkIds) {
      await recalculateProgressFromMilestones(db, wId as string);
    }

    return updated.rows.length;
  } catch (err) {
    console.error('[syncOverdueMilestones] Error syncing overdue milestones:', err);
    return 0;
  }
}

// GET /api/work - list assigned work entries
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    await syncOverdueMilestones();
    const canReadAll = canManage(req, 'manage_work_cycles') || canManage(req, 'manage_users');
    const params: any[] = [];
    const conditions: string[] = [];

    if (!canReadAll) {
      conditions.push(`(aw.user_id = $${params.length + 1} OR aw.assigned_by_user_id = $${params.length + 1} OR (aw.assigned_by IS NOT NULL AND LOWER(aw.assigned_by) = LOWER($${params.length + 2})))`);
      params.push(req.user!.id);
      params.push(req.user!.email);
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
        up.email AS user_email,
        (SELECT COUNT(*)::int FROM milestone_change_requests WHERE work_id = aw.id AND status = 'pending') AS pending_milestone_requests_count,
        (SELECT COUNT(*)::int FROM work_dependencies wd JOIN assigned_works dep ON dep.id = wd.depends_on_work_id WHERE wd.work_id = aw.id AND dep.priority = 'code_red' AND dep.admin_status NOT IN ('completed', 'approved')) AS blocked_by_code_red_count
      FROM assigned_works aw
      LEFT JOIN user_profiles up ON up.id = aw.user_id
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY (aw.priority = 'code_red') DESC, aw.created_at DESC`;
    const result = await query(sql, params);
    res.json(result.rows.map(mapWorkRow));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/work/linkable - get lightweight list of works for dependency selection
router.get('/linkable', authenticate, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         aw.id,
         aw.issue_key,
         aw.work_title,
         aw.project_name,
         aw.priority,
         aw.issue_type,
         aw.admin_status,
         aw.code_red_activated_at,
         up.full_name AS user_name
       FROM assigned_works aw
       LEFT JOIN user_profiles up ON up.id = aw.user_id
       ORDER BY (aw.priority = 'code_red') DESC, aw.created_at DESC
       LIMIT 300`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/work - create a work entry
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!canManage(req, 'create_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const {
      user_id,
      project_name,
      assigned_by,
      work_title,
      description,
      start_date,
      end_date,
      priority,
      issue_type,
      milestones = [],
      initial_status,
      initial_percentage,
      progress_notes,
    } = req.body;

    const currentUserId = req.user!.id;
    const currentUserRole = (req.user!.user_role || '').toLowerCase();
    const isSuperAdmin = currentUserRole === 'super_admin' || currentUserRole === 'superadmin';
    const isAdmin = currentUserRole === 'admin';

    if ((user_id && !isUuid(user_id)) || (req.body.assigned_by_user_id && !isUuid(req.body.assigned_by_user_id))) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    let ownerId = currentUserId;
    let finalAssignedBy = assigned_by;
    let assignedByUserId: string | null = null;

    // Check if work is being assigned to someone else
    if (user_id && user_id !== currentUserId) {
      const targetUserResult = await query(
        'SELECT id, full_name, user_role FROM user_profiles WHERE id = $1',
        [user_id]
      );
      if (targetUserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Assigned target user not found' });
      }

      const targetUser = targetUserResult.rows[0];
      const targetRole = (targetUser.user_role || '').toLowerCase();
      const targetIsSuperAdmin = targetRole === 'super_admin' || targetRole === 'superadmin';
      const targetIsAdmin = targetRole === 'admin';
      const targetIsUser = targetRole === 'user';

      if (isSuperAdmin) {
        // Super admin has full authority to assign work to any valid user
      } else if (isAdmin) {
        if (!targetIsUser && !targetIsAdmin && !targetIsSuperAdmin) {
          return res.status(403).json({
            error: 'Admins can only assign work to Users and Admins.'
          });
        }
      } else {
        if (!targetIsUser) {
          return res.status(403).json({
            error: 'Users can only assign work to Users.'
          });
        }
      }

      ownerId = user_id;
      assignedByUserId = currentUserId;

      if (!finalAssignedBy) {
        const assignerProfile = await query('SELECT full_name FROM user_profiles WHERE id = $1', [currentUserId]);
        finalAssignedBy = assignerProfile.rows[0]?.full_name || 'Supervisor';
      }
    } else {
      if (req.body.assigned_by_user_id) {
        const supCheck = await query('SELECT u.id, up.full_name, u.email FROM users u LEFT JOIN user_profiles up ON up.id = u.id WHERE u.id = $1', [req.body.assigned_by_user_id]);
        if (supCheck.rows.length > 0) {
          assignedByUserId = supCheck.rows[0].id;
          if (!finalAssignedBy) {
            finalAssignedBy = supCheck.rows[0].full_name || supCheck.rows[0].email;
          }
        }
      } else if (finalAssignedBy && finalAssignedBy.includes('@')) {
        const supByEmail = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [finalAssignedBy.trim()]);
        if (supByEmail.rows.length > 0) {
          assignedByUserId = supByEmail.rows[0].id;
        }
      }

      if (!finalAssignedBy) {
        return res.status(400).json({ error: 'assigned_by is required' });
      }
    }

    const workInputError = validateWorkInput(req.body, { requireTitle: true });
    if (workInputError) return res.status(400).json({ error: workInputError });

    if (end_date && Array.isArray(milestones)) {
      const pEndDate = String(end_date).slice(0, 10);
      for (const m of milestones) {
        const mDate = m.target_date ? String(m.target_date).slice(0, 10) : null;
        if (mDate && mDate > pEndDate) {
          return res.status(400).json({
            error: `Milestone "${m.milestone_description || m.title || 'Milestone'}" target date (${mDate}) cannot be beyond the project target end date (${pEndDate}).`
          });
        }
      }
    }

    const isCodeRed = priority === 'code_red';
    const createdWork = await transaction(async (client) => {
      const workResult = await client.query(
        `INSERT INTO assigned_works
           (user_id, assigned_by_user_id, project_name, assigned_by, work_title, description, start_date, end_date, priority, issue_type, code_red_activated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          ownerId,
          assignedByUserId,
          project_name,
          finalAssignedBy,
          work_title,
          description,
          start_date,
          end_date,
          priority || 'medium',
          issue_type || 'task',
          isCodeRed ? new Date() : null,
        ]
      );

      const work = workResult.rows[0];

      await logWorkActivity(
        client,
        work.id,
        currentUserId,
        'created',
        `Created work [${work.issue_key}] (${work.issue_type || 'task'}): "${work.work_title}"${isCodeRed ? ' [🚨 CODE-RED PRIORITY ACTIVATED]' : ''}`,
        null,
        work
      );

      if (isCodeRed) {
        const admins = await client.query(`SELECT id FROM user_profiles WHERE user_role IN ('admin', 'super_admin')`);
        for (const adm of admins.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
             VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
            [
              adm.id,
              `🚨 CODE-RED TASK: [${work.issue_key}]`,
              `Code-Red priority task activated: "${work.work_title}" for ${finalAssignedBy}. Other dependent milestones may be delayed.`,
              work.id
            ]
          );
        }
      }

      for (const milestone of milestones) {
        const title = milestone.milestone_description || milestone.title;
        if (!title || !milestone.target_date) continue;
        await client.query(
          `INSERT INTO work_milestones (work_id, title, target_date, expected_outcome, status)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            work.id,
            title,
            milestone.target_date,
            milestone.expected_outcome || null,
            milestone.is_completed ? 'completed' : (milestone.status || 'pending'),
          ]
        );
      }

      const completion = Number.isFinite(Number(initial_percentage)) ? Number(initial_percentage) : 0;
      if (initial_status || progress_notes || completion > 0) {
        await client.query(
          `INSERT INTO progress_updates
             (work_id, update_date, status, completion_percentage, summary)
           VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
          [
            work.id,
            initial_status || 'on_track',
            completion,
            progress_notes || 'Work entry created',
          ]
        );
      }

      return work;
    });

    res.status(201).json(createdWork);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/work/:id - get a single assigned work with all related data
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await syncOverdueMilestones();
    const work = await query(`
      SELECT
        aw.*,
        up.full_name as user_name,
        up.department,
        up.email as user_email,
        (SELECT COUNT(*)::int FROM milestone_change_requests WHERE work_id = aw.id AND status = 'pending') AS pending_milestone_requests_count,
        (SELECT COUNT(*)::int FROM work_dependencies wd JOIN assigned_works dep ON dep.id = wd.depends_on_work_id WHERE wd.work_id = aw.id AND dep.priority = 'code_red' AND dep.admin_status NOT IN ('completed', 'approved')) AS blocked_by_code_red_count
      FROM assigned_works aw
      LEFT JOIN user_profiles up ON up.id = aw.user_id
      WHERE aw.id = $1`, [req.params.id]);
    if (work.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const row = work.rows[0];
    const isOwner = row.user_id === req.user!.id;
    const isAssigner = Boolean(
      (row.assigned_by_user_id && row.assigned_by_user_id === req.user!.id) ||
      (row.assigned_by && req.user!.email && row.assigned_by.trim().toLowerCase() === req.user!.email.trim().toLowerCase())
    );
    if (!isOwner && !isAssigner && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(mapWorkRow(row));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/work/:id - owner may update their own work; others need edit_work
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    const hasManagerPerm = canManage(req, 'edit_work');
    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    if (ownerId !== req.user!.id && !hasManagerPerm && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const prevWorkRes = await query(
      `SELECT aw.*, aw.start_date::text AS start_date_iso, aw.end_date::text AS end_date_iso, u.email AS assignee_email
       FROM assigned_works aw LEFT JOIN users u ON u.id = aw.user_id
       WHERE aw.id = $1`,
      [req.params.id]
    );
    const prevWork = prevWorkRes.rows[0];
    const editError = validateWorkInput({
      ...req.body,
      start_date: req.body.start_date !== undefined ? req.body.start_date : prevWork?.start_date_iso,
      end_date: req.body.end_date !== undefined ? req.body.end_date : prevWork?.end_date_iso,
    }, { requireTitle: false });
    if (editError) return res.status(400).json({ error: editError });

    const isWorkManager = hasManagerPerm || isAdmin || canManage(req, 'manage_work_cycles');
    const milestonesProvided = Array.isArray(req.body.milestones);
    const milestones: any[] = milestonesProvided ? req.body.milestones : [];
    const deletedMilestoneIds: any[] = Array.isArray(req.body.deleted_milestone_ids) ? req.body.deleted_milestone_ids : [];
    const milestoneChangeReason = req.body.milestone_change_reason;
    if (deletedMilestoneIds.some((mid) => !isUuid(mid)) || milestones.some((m: any) => m?.id && !isUuid(m.id))) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Allowlist of editable columns: anything else in the body is ignored and never reaches SQL.
    // Supervisor / cycle / review fields are reserved for admins and work managers.
    const editable = isWorkManager ? MANAGER_EDITABLE_WORK_FIELDS : MEMBER_EDITABLE_WORK_FIELDS;
    const fields: Record<string, any> = {};
    for (const key of editable) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    if (fields.assigned_by_user_id !== undefined && fields.assigned_by_user_id !== null && !isUuid(fields.assigned_by_user_id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (fields.cycle_id !== undefined && fields.cycle_id !== null && !isUuid(fields.cycle_id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (fields.issue_type === null || fields.issue_type === '') delete fields.issue_type;
    if (fields.priority === null || fields.priority === '') delete fields.priority;

    // Work assigned by someone else: its dates and priority are owned by the supervisor.
    const assignedBySomeoneElse = Boolean(
      (prevWork?.assigned_by_user_id && prevWork.assigned_by_user_id !== prevWork.user_id) ||
      (!prevWork?.assigned_by_user_id && prevWork?.assigned_by && String(prevWork.assigned_by).includes('@') &&
        String(prevWork.assigned_by).trim().toLowerCase() !== String(prevWork.assignee_email || '').trim().toLowerCase())
    );
    const isAssigner = Boolean(
      (prevWork?.assigned_by_user_id && prevWork.assigned_by_user_id === req.user!.id) ||
      (prevWork?.assigned_by && req.user!.email &&
        String(prevWork.assigned_by).trim().toLowerCase() === req.user!.email.trim().toLowerCase())
    );
    if (!isWorkManager && !isAssigner && assignedBySomeoneElse) {
      const normDate = (v: any) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, 10));
      const startChanged = fields.start_date !== undefined && normDate(fields.start_date) !== (prevWork?.start_date_iso || null);
      const endChanged = fields.end_date !== undefined && normDate(fields.end_date) !== (prevWork?.end_date_iso || null);
      const priorityChanged = fields.priority !== undefined && fields.priority !== prevWork?.priority;
      if (startChanged || endChanged || priorityChanged) {
        return res.status(403).json({
          error: 'Dates and priority of assigned work are set by your supervisor. Ask them, or submit a milestone change request.'
        });
      }
    }

    // Code-Red priority transition tracking
    if (fields.priority !== undefined) {
      if (fields.priority === 'code_red' && prevWork?.priority !== 'code_red') {
        fields.code_red_activated_at = new Date();
      } else if (fields.priority !== 'code_red' && prevWork?.priority === 'code_red') {
        fields.code_red_activated_at = null;
      }
    }

    // Validate milestone target dates do not exceed project end date
    const effectiveEndDate = req.body.end_date || prevWork?.end_date_iso;
    const effectiveStartDate = req.body.start_date || prevWork?.start_date_iso;
    if (effectiveEndDate && Array.isArray(milestones)) {
      const pEndDate = String(effectiveEndDate).slice(0, 10);
      for (const m of milestones) {
        const mDate = m.target_date ? String(m.target_date).slice(0, 10) : null;
        if (mDate && mDate > pEndDate) {
          const mTitle = m.milestone_description || m.title || 'Milestone';
          return res.status(400).json({
            error: `Milestone "${mTitle}" target date (${mDate}) cannot be beyond the project target end date (${pEndDate}).`
          });
        }
      }
    }

    // Milestone change management:
    // Only administrators or users with manage_work_cycles can directly alter active milestones.
    // Regular team members submitting milestone edits/deletions must go through milestone_change_requests!
    const canDirectlyManageMilestones = isAdmin || canManage(req, 'manage_work_cycles');

    // For other users, work out up front whether a change request is needed. Only an explicit
    // `milestones` array (or explicit deletions) counts as a milestone edit; omitting it changes nothing.
    let changeRequestProposal: any[] | null = null;
    let currentMilestones: any[] = [];
    if (!canDirectlyManageMilestones && (milestonesProvided || deletedMilestoneIds.length > 0)) {
      const currentMilestonesRes = await query(
        'SELECT id, title, target_date, expected_outcome, status FROM work_milestones WHERE work_id = $1 ORDER BY target_date',
        [req.params.id]
      );
      currentMilestones = currentMilestonesRes.rows;
      const currentById = new Map<string, any>(currentMilestones.map((cm: any) => [cm.id, cm]));
      const deletedSet = new Set<string>(deletedMilestoneIds);
      const proposal = milestonesProvided
        ? milestones.filter((m: any) => !m.id || !deletedSet.has(m.id))
        : currentMilestones.filter((cm: any) => !deletedSet.has(cm.id));

      const milestonesAltered =
        deletedMilestoneIds.some((mid: string) => currentById.has(mid)) ||
        proposal.length !== currentMilestones.length ||
        proposal.some((m: any) => {
          if (!m.id) return true; // Newly added milestone
          const cur = currentById.get(m.id);
          if (!cur) return true;
          const curTitle = (cur.title || '').trim();
          const curDate = cur.target_date ? new Date(cur.target_date).toISOString().slice(0, 10) : '';
          const newDate = m.target_date ? new Date(m.target_date).toISOString().slice(0, 10) : '';
          const curOutcome = (cur.expected_outcome || '').trim();
          const newOutcome = (m.expected_outcome || '').trim();
          const titleChanged =
            (m.title !== undefined && String(m.title).trim() !== curTitle) ||
            (m.milestone_description !== undefined && String(m.milestone_description).trim() !== curTitle);
          return titleChanged || curDate !== newDate || curOutcome !== newOutcome;
        });

      if (milestonesAltered) {
        if (proposal.length === 0) {
          return res.status(400).json({ error: 'A milestone change request must propose at least one milestone' });
        }
        const proposalError = validateProposedMilestones(
          proposal,
          effectiveStartDate ? String(effectiveStartDate).slice(0, 10) : null,
          effectiveEndDate ? String(effectiveEndDate).slice(0, 10) : null
        );
        if (proposalError) return res.status(400).json({ error: proposalError });
        changeRequestProposal = proposal;
      }
    }

    const proposalToSubmit = changeRequestProposal;
    const rawKeys = Object.keys(fields);
    const result = await transaction(async (client) => {
      let updated;
      if (rawKeys.length > 0) {
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.id);
        updated = await client.query(
          `UPDATE assigned_works SET ${setClause}, updated_at = now() WHERE id = $${values.length} RETURNING *`, values
        );
      } else {
        updated = await client.query('SELECT * FROM assigned_works WHERE id = $1', [req.params.id]);
      }

      if (canDirectlyManageMilestones) {
        if (deletedMilestoneIds.length > 0) {
          await client.query(
            `DELETE FROM work_milestones
             WHERE work_id = $1 AND id = ANY($2::uuid[])`,
            [req.params.id, deletedMilestoneIds]
          );
        }

        for (const milestone of milestones) {
          const title = milestone.milestone_description || milestone.title;
          if (!title || !milestone.target_date) continue;
          if (milestone.id) {
            await client.query(
              `UPDATE work_milestones
               SET title = $1, target_date = $2, expected_outcome = $3, status = $4, updated_at = now()
               WHERE id = $5 AND work_id = $6`,
              [
                title,
                milestone.target_date,
                milestone.expected_outcome || null,
                milestone.is_completed ? 'completed' : (milestone.status || 'pending'),
                milestone.id,
                req.params.id,
              ]
            );
          } else {
            await client.query(
              `INSERT INTO work_milestones (work_id, title, target_date, expected_outcome, status)
               VALUES ($1,$2,$3,$4,$5)`,
              [
                req.params.id,
                title,
                milestone.target_date,
                milestone.expected_outcome || null,
                milestone.is_completed ? 'completed' : (milestone.status || 'pending'),
              ]
            );
          }
        }

        if (milestones.length > 0 || deletedMilestoneIds.length > 0) {
          await recalculateProgressFromMilestones(client, req.params.id);
        }
      } else if (proposalToSubmit) {
        // Regular user modified milestones:
        // Keep active milestones intact and create a change request for Admin approval!
        await client.query(
          `INSERT INTO milestone_change_requests (work_id, requested_by, reason, proposed_milestones, previous_milestones)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.params.id,
            req.user!.id,
            milestoneChangeReason || 'Milestone modification requested via work edit',
            JSON.stringify(proposalToSubmit),
            JSON.stringify(currentMilestones),
          ]
        );

        // Notify all administrators
        const admins = await client.query(
          `SELECT id FROM user_profiles WHERE user_role IN ('admin', 'super_admin')`
        );
        for (const adm of admins.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
             VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
            [
              adm.id,
              `Milestone Edit Request: [${prevWork?.issue_key || 'WORK'}]`,
              `${req.user!.email} requested milestone modifications for "${prevWork?.work_title || 'Work'}". Admin approval required.`,
              req.params.id,
            ]
          );
        }

        await logWorkActivity(
          client,
          req.params.id,
          req.user!.id,
          'change_request_submitted',
          `Submitted milestone change request with ${proposalToSubmit.length} proposed milestones for admin approval`,
          null,
          { proposed_milestones: proposalToSubmit, reason: milestoneChangeReason }
        );
      }

      // Log activity
      let activityRemark = `Updated work details`;
      if (fields.priority && fields.priority !== prevWork?.priority) {
        activityRemark = `Priority changed from ${prevWork?.priority} to ${fields.priority}`;
      } else if (fields.work_title && fields.work_title !== prevWork?.work_title) {
        activityRemark = `Title updated to "${fields.work_title}"`;
      }
      await logWorkActivity(client, req.params.id, req.user!.id, 'updated', activityRemark, prevWork, updated.rows[0]);

      return updated;
    });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/work/:id - requires delete_work permission (or admin)
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (!canManage(req, 'delete_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await query('DELETE FROM assigned_works WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Sub-resources ---
// GET /api/work/:id/milestones
router.get('/:id/milestones', authenticate, async (req: Request, res: Response) => {
  try {
    await syncOverdueMilestones();
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const result = await query(
      `SELECT
         wm.id,
         wm.title,
         wm.title AS milestone_description,
         wm.target_date,
         wm.expected_outcome,
         wm.status,
         wm.justification,
         wm.justification_linked_work_id,
         wm.justification_status,
         wm.justification_submitted_at,
         wm.justification_reviewed_by,
         wm.justification_reviewed_at,
         wm.justification_review_notes,
         rev_user.full_name AS justification_reviewer_name,
         linked.issue_key AS linked_work_key,
         linked.work_title AS linked_work_title,
         linked.priority AS linked_work_priority,
         (wm.status = 'completed') AS is_completed,
         CASE WHEN wm.status = 'completed' THEN wm.updated_at ELSE NULL END AS completed_at,
         wm.created_at,
         wm.updated_at
       FROM work_milestones wm
       LEFT JOIN assigned_works linked ON linked.id = wm.justification_linked_work_id
       LEFT JOIN user_profiles rev_user ON rev_user.id = wm.justification_reviewed_by
       WHERE wm.work_id = $1
       ORDER BY wm.target_date`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/:id/milestones', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    const isManager = canManage(req, 'manage_work_cycles');
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        error: 'Only administrators can add milestones directly to an existing work entry. Please submit a Milestone Change Request.'
      });
    }
    const { title, target_date, status, justification, justification_linked_work_id } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Milestone title is required' });
    }
    if (!isValidIsoDate(target_date)) {
      return res.status(400).json({ error: 'Milestone target date is not a valid date (use YYYY-MM-DD)' });
    }
    if (status !== undefined && status !== null && status !== '' && !MILESTONE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Milestone status must be one of: ${MILESTONE_STATUSES.join(', ')}` });
    }
    if (justification_linked_work_id && !isUuid(justification_linked_work_id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const workRes = await query(
      'SELECT start_date::text AS start_date, end_date::text AS end_date FROM assigned_works WHERE id = $1',
      [req.params.id]
    );
    if (workRes.rows.length === 0) return res.status(404).json({ error: 'Work not found' });
    if (workRes.rows[0].start_date && target_date && String(target_date).slice(0, 10) < workRes.rows[0].start_date) {
      return res.status(400).json({
        error: `Milestone target date (${String(target_date).slice(0, 10)}) cannot be before the work start date (${workRes.rows[0].start_date}).`
      });
    }
    if (workRes.rows[0].end_date && target_date) {
      const pEndDate = String(workRes.rows[0].end_date).slice(0, 10);
      const mDate = String(target_date).slice(0, 10);
      if (mDate > pEndDate) {
        return res.status(400).json({
          error: `Milestone target date (${mDate}) cannot be beyond the project target end date (${pEndDate}).`
        });
      }
    }

    const result = await transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO work_milestones (work_id, title, target_date, status, justification, justification_linked_work_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.id, String(title).trim(), target_date || null, status || 'pending', justification || null, justification_linked_work_id || null]
      );
      await recalculateProgressFromMilestones(client, req.params.id);
      return inserted;
    });
    res.status(201).json(result.rows[0]);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.put('/:id/milestones/:milestoneId', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    const isManager = canManage(req, 'manage_work_cycles');
    const isOwner = ownerId === req.user!.id;
    if (!isOwner && !canManage(req, 'edit_work') && !isAdmin && !isManager) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const {
      milestone_description,
      title,
      target_date,
      expected_outcome,
      status,
      is_completed,
      justification,
      justification_linked_work_id,
    } = req.body;

    if (status !== undefined && status !== null && !MILESTONE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Milestone status must be one of: ${MILESTONE_STATUSES.join(', ')}` });
    }
    if (target_date !== undefined && (!target_date || !isValidIsoDate(target_date))) {
      return res.status(400).json({ error: 'Milestone target date is not a valid date (use YYYY-MM-DD)' });
    }
    const newTitle = title !== undefined ? title : milestone_description;
    if (newTitle !== undefined && (!newTitle || !String(newTitle).trim())) {
      return res.status(400).json({ error: 'Milestone title is required' });
    }
    if (justification_linked_work_id && !isUuid(justification_linked_work_id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const prevMilestoneRes = await query(
      'SELECT * FROM work_milestones WHERE id = $1 AND work_id = $2',
      [req.params.milestoneId, req.params.id]
    );
    if (prevMilestoneRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    const prevMilestone = prevMilestoneRes.rows[0];

    // Non-admins can ONLY update status / completion with justification.
    // They CANNOT edit title, milestone_description, expected_outcome, or target_date directly!
    if (!isAdmin && !isManager) {
      if (
        milestone_description !== undefined ||
        title !== undefined ||
        expected_outcome !== undefined ||
        target_date !== undefined
      ) {
        return res.status(403).json({
          error: 'Modifying milestone details (title, dates, or expected outcome) requires submitting a Milestone Change Request for Admin approval.'
        });
      }
    }

    // Completing an already-completed milestone again is a no-op: never overwrite the recorded justification.
    const wantsComplete = status === 'completed' || (status === undefined && is_completed === true);
    if (prevMilestone.status === 'completed' && wantsComplete &&
        milestone_description === undefined && title === undefined && expected_outcome === undefined && target_date === undefined) {
      return res.json(prevMilestone);
    }

    const fields: Record<string, any> = {};
    if (milestone_description !== undefined) fields.title = milestone_description;
    if (title !== undefined) fields.title = title;
    if (expected_outcome !== undefined) fields.expected_outcome = expected_outcome;
    if (target_date !== undefined) fields.target_date = target_date;

    if (fields.target_date) {
      const workRes = await query('SELECT end_date FROM assigned_works WHERE id = $1', [req.params.id]);
      if (workRes.rows[0]?.end_date) {
        const pEndDate = String(workRes.rows[0].end_date).slice(0, 10);
        const mDate = String(fields.target_date).slice(0, 10);
        if (mDate > pEndDate) {
          return res.status(400).json({
            error: `Milestone target date (${mDate}) cannot be beyond the project target end date (${pEndDate}).`
          });
        }
      }
    }

    if (status !== undefined) {
      fields.status = status;
    } else if (is_completed !== undefined) {
      fields.status = is_completed ? 'completed' : 'pending';
    }

    if (justification !== undefined) {
      fields.justification = justification;
    }
    if (justification_linked_work_id !== undefined) {
      fields.justification_linked_work_id = justification_linked_work_id || null;
    }

    const finalStatus = fields.status || prevMilestone.status;
    const finalJustification = fields.justification !== undefined ? fields.justification : prevMilestone.justification;

    // Requirement: each time milestone is completed or delayed, justification is required
    if ((finalStatus === 'completed' || finalStatus === 'delayed') && (!finalJustification || !finalJustification.trim())) {
      return res.status(400).json({
        error: `A justification is required when marking a milestone as ${finalStatus}.`
      });
    }

    // Justification approval tracking:
    // When marking a milestone delayed (or updating a justification for a delay):
    // Non-admins must enter 'pending' state awaiting supervisor approval.
    if (finalStatus === 'delayed') {
      if (!isAdmin && !isManager) {
        fields.justification_status = 'pending';
        fields.justification_submitted_at = new Date().toISOString();
        fields.justification_reviewed_by = null;
        fields.justification_reviewed_at = null;
        fields.justification_review_notes = null;
      } else {
        if (req.body.justification_status !== undefined) {
          if (req.body.justification_status !== null && !['pending', 'approved', 'rejected'].includes(req.body.justification_status)) {
            return res.status(400).json({ error: 'Justification status must be pending, approved or rejected' });
          }
          fields.justification_status = req.body.justification_status;
        } else if (fields.justification_status === undefined) {
          fields.justification_status = 'approved';
          fields.justification_reviewed_by = req.user!.id;
          fields.justification_reviewed_at = new Date().toISOString();
        }
      }
    } else if (finalStatus === 'pending') {
      const targetDate = fields.target_date || prevMilestone.target_date;
      const targetDateStr =
        targetDate instanceof Date
          ? targetDate.toISOString().split('T')[0]
          : targetDate
          ? String(targetDate).split('T')[0]
          : null;
      const todayStr = new Date().toISOString().split('T')[0];
      if (targetDateStr && targetDateStr < todayStr && !isAdmin && !isManager) {
        return res.status(400).json({
          error: `Cannot reset milestone to Pending: Target date (${targetDateStr}) has passed. Overdue milestones remain Delayed until completed or rescheduled via Admin Revision.`
        });
      }
      // A delay justification under review (or rejected by the supervisor) must not be wiped by the member.
      if (!isAdmin && !isManager && ['pending', 'rejected'].includes(prevMilestone.justification_status)) {
        return res.status(400).json({
          error: prevMilestone.justification_status === 'rejected'
            ? 'Cannot reset milestone to Pending: your delay justification was rejected by your supervisor. Complete the milestone, submit a new justification, or ask your supervisor to reschedule it.'
            : 'Cannot reset milestone to Pending while your delay justification is awaiting supervisor review.'
        });
      }

      // Resetting back to pending clears justification and approval state
      fields.justification = null;
      fields.justification_linked_work_id = null;
      fields.justification_status = null;
      fields.justification_submitted_at = null;
      fields.justification_reviewed_by = null;
      fields.justification_reviewed_at = null;
      fields.justification_review_notes = null;
    }

    const rawKeys = Object.keys(fields);
    if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields provided' });
    const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
    const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = rawKeys.map(k => fields[k]);
    values.push(req.params.milestoneId, req.params.id);

    const result = await transaction(async (client) => {
      const updated = await client.query(
        `UPDATE work_milestones
         SET ${setClause}, updated_at = now()
         WHERE id = $${values.length - 1} AND work_id = $${values.length}
         RETURNING *`,
        values
      );

      // Auto-upsert dependency if a linked work is given as justification
      const linkedWorkId = fields.justification_linked_work_id || prevMilestone.justification_linked_work_id;
      if (linkedWorkId && linkedWorkId !== req.params.id) {
        const linkedWork = await client.query('SELECT id, priority, issue_key, work_title FROM assigned_works WHERE id = $1', [linkedWorkId]);
        if (linkedWork.rows.length > 0) {
          const isCodeRed = linkedWork.rows[0].priority === 'code_red';
          const depType = isCodeRed ? 'delayed_by_code_red' : (finalStatus === 'delayed' ? 'is_blocked_by' : 'relates_to');
          await client.query(
            `INSERT INTO work_dependencies (work_id, depends_on_work_id, dependency_type, notes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (work_id, depends_on_work_id)
             DO UPDATE SET dependency_type = EXCLUDED.dependency_type, notes = EXCLUDED.notes`,
            [
              req.params.id,
              linkedWorkId,
              depType,
              `Milestone "${updated.rows[0].title}" ${finalStatus}: ${finalJustification || 'Linked via milestone justification'}`
            ]
          );

          if (isCodeRed && finalStatus === 'delayed') {
            const admins = await client.query(`SELECT id FROM user_profiles WHERE user_role IN ('admin', 'super_admin')`);
            for (const adm of admins.rows) {
              await client.query(
                `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
                 VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
                [
                  adm.id,
                  `Milestone Delayed by Code-Red: [${linkedWork.rows[0].issue_key}]`,
                  `Milestone "${updated.rows[0].title}" delayed due to Code-Red task "${linkedWork.rows[0].work_title}".`,
                  req.params.id
                ]
              );
            }
          }
        }
      }

      if (fields.justification_status === 'pending') {
        const workInfoRes = await client.query(
          'SELECT work_title, issue_key, assigned_by, assigned_by_user_id, user_id FROM assigned_works WHERE id = $1',
          [req.params.id]
        );
        const workInfo = workInfoRes.rows[0];

        let supervisorIds: string[] = [];
        if (workInfo?.assigned_by_user_id) {
          supervisorIds.push(workInfo.assigned_by_user_id);
        } else if (workInfo?.assigned_by && workInfo.assigned_by.includes('@')) {
          const supRes = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [workInfo.assigned_by.trim()]);
          supervisorIds = supRes.rows.map((r: any) => r.id);
        }
        const adminRes = await client.query(`SELECT id FROM user_profiles WHERE user_role IN ('admin', 'super_admin')`);
        const targetIds = Array.from(new Set([...supervisorIds, ...adminRes.rows.map((r: any) => r.id)]));

        for (const tid of targetIds) {
          if (tid !== req.user!.id) {
            await client.query(
              `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
               VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
              [
                tid,
                `Milestone Delay Justification Submitted: [${workInfo?.issue_key || 'WORK'}]`,
                `${req.user!.email} submitted delay justification for "${updated.rows[0].title}". Supervisor approval required.`,
                req.params.id,
              ]
            );
          }
        }
      }

      if (fields.status !== undefined) {
        await recalculateProgressFromMilestones(client, req.params.id);
      }

      await logWorkActivity(
        client,
        req.params.id,
        req.user!.id,
        'milestone_updated',
        `Milestone "${updated.rows[0].title}" status set to ${updated.rows[0].status}.${finalJustification ? ` Justification: "${finalJustification}"` : ''}`,
        prevMilestone,
        updated.rows[0]
      );

      return updated;
    });

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/work/:id/milestones/:milestoneId - only admins/managers can delete directly
router.delete('/:id/milestones/:milestoneId', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    const isManager = canManage(req, 'manage_work_cycles');
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        error: 'Only administrators can delete milestones directly. Please submit a Milestone Change Request for review.'
      });
    }

    await transaction(async (client) => {
      await client.query('DELETE FROM work_milestones WHERE id = $1 AND work_id = $2', [req.params.milestoneId, req.params.id]);
      await recalculateProgressFromMilestones(client, req.params.id);
    });

    res.json({ message: 'Milestone deleted' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/work/:id/milestones/:milestoneId/review-justification
// Allows supervisor or admin to approve or reject a milestone delay justification
router.put('/:id/milestones/:milestoneId/review-justification', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });

    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    const isManager = canManage(req, 'manage_work_cycles');

    const workRes = await query('SELECT aw.*, up.full_name as user_name FROM assigned_works aw LEFT JOIN user_profiles up ON up.id = aw.user_id WHERE aw.id = $1', [req.params.id]);
    const work = workRes.rows[0];

    const isSupervisor = Boolean(
      (work?.assigned_by_user_id && work.assigned_by_user_id === req.user!.id) ||
      (work?.assigned_by && req.user!.email && work.assigned_by.trim().toLowerCase() === req.user!.email.trim().toLowerCase())
    );

    if (!isAdmin && !isManager && !isSupervisor) {
      return res.status(403).json({ error: 'Only the assigned supervisor or an administrator can review milestone justifications' });
    }
    if (work?.user_id === req.user!.id && !isAdmin) {
      return res.status(403).json({ error: 'You cannot review the justification on your own work item' });
    }

    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const prevMilestoneRes = await query(
      'SELECT * FROM work_milestones WHERE id = $1 AND work_id = $2',
      [req.params.milestoneId, req.params.id]
    );
    if (prevMilestoneRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    const prevMilestone = prevMilestoneRes.rows[0];

    const result = await transaction(async (client) => {
      const defaultJustification = status === 'approved'
        ? (review_notes || 'Delay acknowledged and approved by supervisor.')
        : (review_notes || 'Delay reviewed and rejected by supervisor.');
      const updated = await client.query(
        `UPDATE work_milestones
         SET justification_status = $1,
             justification_reviewed_by = $2,
             justification_reviewed_at = now(),
             justification_review_notes = $3,
             justification = COALESCE(justification, $6),
             updated_at = now()
         WHERE id = $4 AND work_id = $5
         RETURNING *`,
        [status, req.user!.id, review_notes || null, req.params.milestoneId, req.params.id, defaultJustification]
      );

      await logWorkActivity(
        client,
        req.params.id,
        req.user!.id,
        status === 'approved' ? 'milestone_justification_approved' : 'milestone_justification_rejected',
        `Supervisor ${status === 'approved' ? 'approved' : 'rejected'} justification for milestone "${prevMilestone.title}".${review_notes ? ` Note: "${review_notes}"` : ''}`,
        prevMilestone,
        updated.rows[0]
      );

      // Notify the work assignee
      if (work?.user_id && work.user_id !== req.user!.id) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
           VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
          [
            work.user_id,
            `Milestone Justification ${status === 'approved' ? 'Approved' : 'Rejected'}: [${work.issue_key || 'WORK'}]`,
            `Your delay justification for milestone "${prevMilestone.title}" was ${status} by supervisor.${review_notes ? ` Note: "${review_notes}"` : ''}`,
            req.params.id,
          ]
        );
      }

      await recalculateProgressFromMilestones(client, req.params.id);

      return updated.rows[0];
    });

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/work/:id/progress
router.get('/:id/progress', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const result = await query(
      `SELECT
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
       ORDER BY update_date DESC, created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/:id/progress', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'edit_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { update_date, status, completion_percentage, summary, progress_notes, next_steps, blockers } = req.body;

    // Validate completion_percentage (must be numeric and between 0 and 100)
    let finalPercentage = 0;
    if (completion_percentage !== undefined && completion_percentage !== null && completion_percentage !== '') {
      const pct = Number(completion_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: 'Completion percentage must be a valid number between 0 and 100' });
      }
      finalPercentage = pct;
    }

    // Validate status
    const validStatuses = ['on_track', 'delayed', 'blocked', 'completed', 'not_started', 'in_progress'];
    const finalStatus = status ? String(status).trim().toLowerCase() : 'on_track';
    if (status && !validStatuses.includes(finalStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    if (finalStatus === 'completed' || finalPercentage === 100) {
      const openMs = await query(
        "SELECT COUNT(*)::int AS n FROM work_milestones WHERE work_id = $1 AND status <> 'completed'",
        [req.params.id]
      );
      if (openMs.rows[0].n > 0) {
        return res.status(400).json({
          error: `Cannot mark this work completed while ${openMs.rows[0].n} milestone(s) are still open. Complete the milestones first.`,
        });
      }
    }

    // Validate update_date if provided
    let finalDate = new Date().toISOString().slice(0, 10);
    if (update_date) {
      if (!isValidIsoDate(update_date)) {
        return res.status(400).json({ error: 'Invalid update date format' });
      }
      finalDate = update_date;
    }

    const result = await query(
      `INSERT INTO progress_updates (work_id, update_date, status, completion_percentage, summary, next_steps, blockers)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.params.id,
        finalDate,
        finalStatus,
        finalPercentage,
        progress_notes || summary || 'Progress updated',
        next_steps || null,
        blockers || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    if (err?.code === '23514') {
      return res.status(400).json({ error: `Value violates validation constraint: ${err.constraint || 'check constraint failed'}` });
    }
    if (err?.code === '22007' || err?.code === '22P02') {
      return res.status(400).json({ error: 'Invalid data format provided' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/work/:id/problems
router.get('/:id/problems', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const result = await query(
      `SELECT
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
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    const mapped = await Promise.all(result.rows.map(async (row) => ({
      ...row,
      mitigation_actions: await listMitigationActions(row.id),
    })));
    res.json(mapped);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/:id/problems', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'edit_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const {
      title,
      category,
      description,
      severity,
      impact_level,
      proposed_mitigation,
      support_required_from,
      urgency_level,
    } = req.body;
    const problemSeverity = severity || impact_level || 'medium';
    if (!PROBLEM_SEVERITIES.includes(problemSeverity)) {
      return res.status(400).json({ error: `Severity must be one of: ${PROBLEM_SEVERITIES.join(', ')}` });
    }
    if (req.body.status !== undefined && req.body.status !== null && !PROBLEM_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Problem status must be one of: ${PROBLEM_STATUSES.join(', ')}` });
    }
    const problem = await transaction(async (client) => {
      const result = await client.query(
        'INSERT INTO work_problems (work_id, title, description, severity) VALUES ($1,$2,$3,$4) RETURNING *',
        [req.params.id, title || category || 'general', description, problemSeverity]
      );
      if (proposed_mitigation) {
        await client.query(
          `INSERT INTO mitigation_actions
             (problem_id, action_description, support_required_from, urgency_level, status)
           VALUES ($1,$2,$3,$4,$5)`,
          [result.rows[0].id, proposed_mitigation, support_required_from || null, urgency_level || null, 'planned']
        );
      }
      return result.rows[0];
    });
    const result = { ...problem, category: problem.title, impact_level: problem.severity, is_resolved: false };
    res.status(201).json(result);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.put('/:id/problems/:problemId', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'edit_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (req.body.impact_level !== undefined && !PROBLEM_SEVERITIES.includes(req.body.impact_level)) {
      return res.status(400).json({ error: `Severity must be one of: ${PROBLEM_SEVERITIES.join(', ')}` });
    }
    if (req.body.status !== undefined && !PROBLEM_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Problem status must be one of: ${PROBLEM_STATUSES.join(', ')}` });
    }
    if (req.body.category !== undefined && (!req.body.category || !String(req.body.category).trim())) {
      return res.status(400).json({ error: 'Problem category is required' });
    }
    if (req.body.is_resolved && req.body.resolution_date && isNaN(new Date(req.body.resolution_date).getTime())) {
      return res.status(400).json({ error: 'Resolution date is not a valid date' });
    }

    const fields: Record<string, any> = {};
    if (req.body.category !== undefined) fields.title = req.body.category;
    if (req.body.description !== undefined) fields.description = req.body.description;
    if (req.body.impact_level !== undefined) fields.severity = req.body.impact_level;
    if (req.body.status !== undefined) fields.status = req.body.status;
    if (req.body.is_resolved !== undefined) {
      fields.status = req.body.is_resolved ? 'resolved' : 'open';
      fields.resolved_at = req.body.is_resolved ? (req.body.resolution_date || new Date().toISOString()) : null;
    }

    const rawKeys = Object.keys(fields);
    if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields' });
    const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
    const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = rawKeys.map(k => fields[k]);
    values.push(req.params.problemId, req.params.id);
    const result = await query(
      `UPDATE work_problems
       SET ${setClause}
       WHERE id = $${values.length - 1} AND work_id = $${values.length}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/work/:id/comments - visible to the work's owner and staff with view_work
router.get('/:id/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
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
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

// POST /api/work/:id/comments
router.post('/:id/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    
    // Check if the user is an admin OR if the user is the owner/supervisor of the work
    if (!canManage(req, 'edit_work') && ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const rawComment = req.body.comment ?? req.body.comment_text;
    const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
    if (!comment) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    const result = await query(
      'INSERT INTO admin_comments (work_id, comment, commented_by) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, comment, req.user!.id]
    );

    // Notify assignee, supervisor, and/or admins as appropriate
    await notifyWorkComment(req.params.id, req.user!.id, comment);

    res.status(201).json(result.rows[0]);
  } catch (err: any) { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/:id/comments/mark-read', authenticate, async (_req: Request, res: Response) => {
  res.json({ message: 'No-op for local comment reads' });
});

// --- Dependencies ---
router.get('/:id/dependencies', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Direct dependencies (this work depends on)
    const outgoing = await query(
      `SELECT wd.id, wd.work_id, wd.depends_on_work_id, wd.dependency_type, wd.notes, wd.created_at,
              dep.issue_key, dep.work_title, dep.priority, dep.issue_type, dep.admin_status,
              up.full_name as assigned_to_name
       FROM work_dependencies wd
       JOIN assigned_works dep ON dep.id = wd.depends_on_work_id
       LEFT JOIN user_profiles up ON up.id = dep.user_id
       WHERE wd.work_id = $1
       ORDER BY wd.created_at DESC`,
      [req.params.id]
    );

    // Inward dependencies (other works depending on this work)
    const incoming = await query(
      `SELECT wd.id, wd.work_id, wd.depends_on_work_id, wd.dependency_type, wd.notes, wd.created_at,
              src.issue_key, src.work_title, src.priority, src.issue_type, src.admin_status,
              up.full_name as assigned_to_name
       FROM work_dependencies wd
       JOIN assigned_works src ON src.id = wd.work_id
       LEFT JOIN user_profiles up ON up.id = src.user_id
       WHERE wd.depends_on_work_id = $1
       ORDER BY wd.created_at DESC`,
      [req.params.id]
    );

    res.json({
      dependencies: outgoing.rows,
      dependents: incoming.rows,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/dependencies', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'edit_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { depends_on_work_id, dependency_type = 'blocks', notes } = req.body;
    if (!depends_on_work_id) {
      return res.status(400).json({ error: 'Target work ID (depends_on_work_id) is required' });
    }
    if (!isUuid(depends_on_work_id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (depends_on_work_id === req.params.id) {
      return res.status(400).json({ error: 'A work item cannot depend on itself' });
    }
    if (!DEPENDENCY_TYPES.includes(dependency_type)) {
      return res.status(400).json({ error: `Dependency type must be one of: ${DEPENDENCY_TYPES.join(', ')}` });
    }
    const dupDep = await query(
      'SELECT 1 FROM work_dependencies WHERE work_id = $1 AND depends_on_work_id = $2',
      [req.params.id, depends_on_work_id]
    );
    if (dupDep.rows.length > 0) {
      return res.status(409).json({ error: 'These work items are already linked' });
    }
    // Reject links that would create a cycle (A depends on B while B already depends, directly or indirectly, on A)
    const cycle = await query(
      `WITH RECURSIVE chain(id) AS (
         SELECT depends_on_work_id FROM work_dependencies WHERE work_id = $1
         UNION
         SELECT wd.depends_on_work_id FROM work_dependencies wd JOIN chain c ON wd.work_id = c.id
       )
       SELECT 1 FROM chain WHERE id = $2 LIMIT 1`,
      [depends_on_work_id, req.params.id]
    );
    if (cycle.rows.length > 0) {
      return res.status(400).json({ error: 'This link would create a circular dependency' });
    }

    const targetWorkRes = await query('SELECT id, issue_key, work_title, priority FROM assigned_works WHERE id = $1', [depends_on_work_id]);
    if (targetWorkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target work to link not found' });
    }
    const targetWork = targetWorkRes.rows[0];

    const result = await transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO work_dependencies (work_id, depends_on_work_id, dependency_type, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (work_id, depends_on_work_id)
         DO UPDATE SET dependency_type = EXCLUDED.dependency_type, notes = EXCLUDED.notes
         RETURNING *`,
        [req.params.id, depends_on_work_id, dependency_type, notes || null]
      );

      await logWorkActivity(
        client,
        req.params.id,
        req.user!.id,
        'dependency_added',
        `Linked dependency: ${dependency_type} [${targetWork.issue_key}] "${targetWork.work_title}"${notes ? ` (${notes})` : ''}`,
        null,
        inserted.rows[0]
      );

      return inserted.rows[0];
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id/dependencies/:depId', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'edit_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const depRes = await query('SELECT * FROM work_dependencies WHERE id = $1 AND work_id = $2', [req.params.depId, req.params.id]);
    if (depRes.rows.length === 0) return res.status(404).json({ error: 'Dependency link not found' });
    const dep = depRes.rows[0];

    await transaction(async (client) => {
      await client.query('DELETE FROM work_dependencies WHERE id = $1', [req.params.depId]);
      await logWorkActivity(
        client,
        req.params.id,
        req.user!.id,
        'dependency_removed',
        `Removed dependency link to work ${dep.depends_on_work_id}`,
        dep,
        null
      );
    });

    res.json({ message: 'Dependency removed' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Milestone Change Requests (Admin Approval Workflow) ---
router.get('/:id/milestone-change-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await query(
      `SELECT mcr.*,
              w.work_title,
              w.issue_key,
              w.project_name,
              req_user.full_name as requester_name,
              req_user.email as requester_email,
              req_user.department as requester_department,
              rev_user.full_name as reviewer_name
       FROM milestone_change_requests mcr
       JOIN assigned_works w ON w.id = mcr.work_id
       LEFT JOIN user_profiles req_user ON req_user.id = mcr.requested_by
       LEFT JOIN user_profiles rev_user ON rev_user.id = mcr.reviewed_by
       WHERE mcr.work_id = $1
       ORDER BY mcr.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/milestone-change-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'edit_work')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { reason, proposed_milestones } = req.body;
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'Reason for milestone change is required' });
    }
    if (!Array.isArray(proposed_milestones) || proposed_milestones.length === 0) {
      return res.status(400).json({ error: 'Proposed milestones are required' });
    }

    const workRes = await query('SELECT * FROM assigned_works WHERE id = $1', [req.params.id]);
    if (workRes.rows.length === 0) return res.status(404).json({ error: 'Work not found' });
    const work = workRes.rows[0];

    const proposalError = validateProposedMilestones(
      proposed_milestones,
      work.start_date ? String(work.start_date).slice(0, 10) : null,
      work.end_date ? String(work.end_date).slice(0, 10) : null
    );
    if (proposalError) return res.status(400).json({ error: proposalError });

    const curMilestonesRes = await query(
      'SELECT id, title, target_date, expected_outcome, status FROM work_milestones WHERE work_id = $1 ORDER BY target_date ASC',
      [req.params.id]
    );
    const previousMilestones = curMilestonesRes.rows;

    const result = await transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO milestone_change_requests (work_id, requested_by, reason, proposed_milestones, previous_milestones)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.params.id, req.user!.id, reason.trim(), JSON.stringify(proposed_milestones), JSON.stringify(previousMilestones)]
      );

      await logWorkActivity(
        client,
        req.params.id,
        req.user!.id,
        'change_request_submitted',
        `Submitted milestone change request: "${reason.trim()}" (${proposed_milestones.length} milestones)`,
        null,
        { proposed_milestones, reason }
      );

      // Notify admins
      const admins = await client.query(`SELECT id FROM user_profiles WHERE user_role IN ('admin', 'super_admin')`);
      for (const adm of admins.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
           VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
          [
            adm.id,
            `Milestone Edit Request: [${work.issue_key}]`,
            `${req.user!.email} requested milestone changes for "${work.work_title}". Admin review required.`,
            req.params.id
          ]
        );
      }

      return inserted.rows[0];
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id/milestone-change-requests/:requestId/review', authenticate, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    const canReviewMilestones = isAdmin || canManage(req, 'manage_work_cycles');
    if (!canReviewMilestones) {
      return res.status(403).json({ error: 'Only administrators or authorized managers can review milestone change requests' });
    }

    const { status, admin_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const reqResult = await query(
      'SELECT * FROM milestone_change_requests WHERE id = $1 AND work_id = $2',
      [req.params.requestId, req.params.id]
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Change request not found' });
    }
    const changeRequest = reqResult.rows[0];
    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ error: `Change request has already been ${changeRequest.status}` });
    }

    const workRes = await query('SELECT * FROM assigned_works WHERE id = $1', [req.params.id]);
    const work = workRes.rows[0];

    if (status === 'approved') {
      const proposed = changeRequest.proposed_milestones;
      if (!Array.isArray(proposed) || proposed.length === 0) {
        return res.status(400).json({ error: 'Cannot approve a change request with no proposed milestones. Reject it instead.' });
      }
      const proposalError = validateProposedMilestones(
        proposed,
        work?.start_date ? String(work.start_date).slice(0, 10) : null,
        work?.end_date ? String(work.end_date).slice(0, 10) : null
      );
      if (proposalError) return res.status(400).json({ error: proposalError });
    }

    const updatedRequest = await transaction(async (client) => {
      if (status === 'approved') {
        const proposedMilestones = changeRequest.proposed_milestones || [];
        
        // Apply the approved proposal IN PLACE: existing milestones keep their id, status, justification
        // and review history (only title / date / outcome change); new entries are inserted; milestones
        // left out of the proposal are removed.
        const existingRes = await client.query('SELECT id FROM work_milestones WHERE work_id = $1', [req.params.id]);
        const existingIds = new Set<string>(existingRes.rows.map((r: any) => r.id));
        const keptIds = new Set<string>();

        for (const m of proposedMilestones) {
          const title = m.milestone_description || m.title;
          if (!title || !m.target_date) continue;
          if (m.id && existingIds.has(m.id)) {
            keptIds.add(m.id);
            await client.query(
              `UPDATE work_milestones SET title = $1, target_date = $2, expected_outcome = $3, updated_at = now()
               WHERE id = $4 AND work_id = $5`,
              [title, m.target_date, m.expected_outcome || null, m.id, req.params.id]
            );
          } else {
            await client.query(
              `INSERT INTO work_milestones (work_id, title, target_date, expected_outcome, status)
               VALUES ($1, $2, $3, $4, 'pending')`,
              [req.params.id, title, m.target_date, m.expected_outcome || null]
            );
          }
        }
        for (const id of existingIds) {
          if (!keptIds.has(id)) {
            await client.query('DELETE FROM work_milestones WHERE id = $1 AND work_id = $2', [id, req.params.id]);
          }
        }

        await recalculateProgressFromMilestones(client, req.params.id);
      }

      const updated = await client.query(
        `UPDATE milestone_change_requests
         SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
         WHERE id = $4
         RETURNING *`,
        [status, admin_notes || null, req.user!.id, req.params.requestId]
      );

      await logWorkActivity(
        client,
        req.params.id,
        req.user!.id,
        status === 'approved' ? 'change_request_approved' : 'change_request_rejected',
        `${status === 'approved' ? 'Approved' : 'Rejected'} milestone change request.${admin_notes ? ` Note: "${admin_notes}"` : ''}`,
        changeRequest,
        updated.rows[0]
      );

      // Notify requester
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES ($1, 'work', $2, $3, 'assigned_work', $4)`,
        [
          changeRequest.requested_by,
          `Milestone Request ${status.toUpperCase()}: [${work.issue_key}]`,
          `Your milestone change request for "${work.work_title}" has been ${status}.${admin_notes ? ` Admin remarks: ${admin_notes}` : ''}`,
          req.params.id
        ]
      );

      return updated.rows[0];
    });

    res.json(updatedRequest);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Activity Feed & Audit Trail ---
router.get('/:id/activity', authenticate, async (req: Request, res: Response) => {
  try {
    const ownerId = await loadWorkOwner(req.params.id, req.user);
    if (ownerId === null) return res.status(404).json({ error: 'Not found' });
    if (ownerId !== req.user!.id && !canManage(req, 'manage_work_cycles') && !canManage(req, 'manage_users')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await query(
      `SELECT al.id, al.action, al.remarks, al.old_value, al.new_value, al.performed_at,
              COALESCE(up.full_name, 'System / Automation') as user_name, up.email as user_email, COALESCE(up.user_role, 'system') as user_role
       FROM audit_logs al
       LEFT JOIN user_profiles up ON up.id = al.performed_by
       WHERE (al.entity_type IN ('assigned_work', 'assigned_works') AND al.entity_id = $1::uuid)
          OR (jsonb_typeof(al.new_value) = 'object' AND al.new_value->>'work_id' = $1::text)
       ORDER BY al.performed_at DESC
       LIMIT 200`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching work activity logs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

