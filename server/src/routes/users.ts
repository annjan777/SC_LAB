import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { query, transaction } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { updateUserProfileSchema } from '../validators/userValidator.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { extractIndianPhone, validateEmail } from '../utils/userValidation.js';
import { checkUserNeedsSkillReminder, dismissSkillPopup, checkAndTriggerSkillReminders } from '../services/skillReminderService.js';
import { tierForRole } from '../utils/roleTier.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
// The seeded bootstrap administrator is protected exactly like a super_admin account.
const BOOTSTRAP_SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

function isProtectedAccount(id: string, userRole: string | null | undefined): boolean {
  return id === BOOTSTRAP_SUPER_ADMIN_ID || userRole === 'super_admin';
}

function isSuperAdminRoleName(name: unknown): boolean {
  const n = String(name || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return n === 'super_admin' || n === 'superadmin';
}

// Active admins other than `excludeId` (used to never demote/deactivate/delete the last one).
async function countOtherActiveAdmins(excludeId: string): Promise<number> {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM user_profiles
     WHERE user_role IN ('admin', 'super_admin') AND COALESCE(is_active, true) = true AND id <> $1`,
    [excludeId]
  );
  return r.rows[0]?.n || 0;
}

// Accepts YYYY-MM-DD (optionally followed by a time part) and rejects impossible dates like 2026-02-30.
function isValidDateString(val: unknown): boolean {
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const PROFILE_DATE_FIELDS = [
  'date_of_birth', 'joining_date', 'tenure_ending_date', 'project_start_date', 'project_end_date',
  'staff_contract_start_date', 'staff_contract_end_date',
];

// The profile validator strips unknown keys, so keep the re-authentication password aside first.
function captureCurrentPassword(req: Request, res: Response, next: NextFunction) {
  res.locals.currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : undefined;
  next();
}

router.param('id', (req: Request, res: Response, next, id) => {
  if (!UUID_RE.test(String(id))) return res.status(400).json({ error: 'Invalid id' });
  next();
});

// GET /api/users - list all users (with expertise)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const isPrivileged = req.user?.permissions.has('manage_users');

    let sql: string;
    if (isPrivileged) {
      sql = 'SELECT * FROM user_profiles ORDER BY created_at DESC';
    } else {
      sql = `
        SELECT id, full_name, roll_number, email, department, program_designation, 
               supervisor, joining_date, tenure_ending_date, user_role, is_active, 
               profile_picture_url, is_profile_completed, designation, project_name, project_code,
               project_start_date, project_end_date, project_tenure, project_role_responsibility,
               project_pi_coordinator, reporting_manager,
               created_at, updated_at 
        FROM user_profiles 
        ORDER BY created_at DESC
      `;
    }
    const result = await query(sql);
    res.json(result.rows);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/users/skill-reminder/status - check if current user needs skill reminder
router.get('/skill-reminder/status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await checkUserNeedsSkillReminder(req.user!.id);
    res.json(status);
  } catch (err: any) {
    console.error('[SKILL REMINDER STATUS ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve skill reminder status' });
  }
});

// POST /api/users/skill-reminder/dismiss - snooze/skip skill popup for 14 days
router.post('/skill-reminder/dismiss', authenticate, async (req: Request, res: Response) => {
  try {
    await dismissSkillPopup(req.user!.id);
    res.json({ success: true, message: 'Skill reminder snoozed for 14 days' });
  } catch (err: any) {
    console.error('[SKILL REMINDER DISMISS ERROR]', err);
    res.status(500).json({ error: 'Failed to dismiss skill reminder' });
  }
});

// POST /api/users/skill-reminder/trigger-check - admin trigger to run 14-day check
router.post('/skill-reminder/trigger-check', authenticate, requirePermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await checkAndTriggerSkillReminders({ force });
    res.json(result);
  } catch (err: any) {
    console.error('[SKILL REMINDER TRIGGER ERROR]', err);
    res.status(500).json({ error: 'Failed to run skill reminder check' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const isOwnerOrPrivileged = req.user!.id === req.params.id || req.user?.permissions.has('manage_users');

    let sql: string;
    if (isOwnerOrPrivileged) {
      sql = 'SELECT * FROM user_profiles WHERE id = $1';
    } else {
      sql = `
        SELECT id, full_name, roll_number, email, department, program_designation, 
               supervisor, joining_date, tenure_ending_date, user_role, is_active, 
               profile_picture_url, is_profile_completed, designation, project_name, project_code,
               project_start_date, project_end_date, project_tenure, project_role_responsibility,
               project_pi_coordinator, reporting_manager,
               created_at, updated_at 
        FROM user_profiles 
        WHERE id = $1
      `;
    }
    const result = await query(sql, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, captureCurrentPassword, validateBody(updateUserProfileSchema), async (req: Request, res: Response) => {
  try {
    const isCallerAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    const isOwner = req.user!.id === req.params.id;
    // Holders of manage_users (e.g. a custom "Coordinator" role) may edit other users' profiles,
    // but only administrators may change roles or touch administrator accounts.
    const canManageUsers = isCallerAdmin || req.user!.permissions.has('manage_users');

    // Users can update their own profile; admins / user managers can update others
    if (!isOwner && !canManageUsers) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const targetRes = await query('SELECT user_role, role_id, is_active, email FROM user_profiles WHERE id = $1', [req.params.id]);
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const target = targetRes.rows[0];
    const targetProtected = isProtectedAccount(req.params.id, target.user_role);

    if (!isOwner && !isCallerAdmin && ['admin', 'super_admin'].includes(target.user_role)) {
      return res.status(403).json({ error: 'Only administrators can modify administrator accounts' });
    }

    const fields = req.body;

    // If caller is admin updating another user, prevent regular admin from modifying a super_admin
    if (isCallerAdmin && !isOwner && targetProtected && req.user!.user_role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super administrators can modify super admin accounts' });
    }

    if (fields.phone) {
      const phoneCheck = extractIndianPhone(fields.phone, false);
      if (phoneCheck.isValid && phoneCheck.phone) {
        fields.phone = phoneCheck.phone;
      }
    }
    if (fields.email) {
      const emailCheck = validateEmail(fields.email);
      if (emailCheck.isValid) {
        fields.email = emailCheck.email;
      }
    }

    // Keep designation and program_designation aligned
    if (fields.designation && !fields.program_designation) {
      fields.program_designation = fields.designation;
    } else if (fields.program_designation && !fields.designation) {
      fields.designation = fields.program_designation;
    }
    // Keep reporting_manager and supervisor aligned
    if (fields.reporting_manager && !fields.supervisor) {
      fields.supervisor = fields.reporting_manager;
    } else if (fields.supervisor && !fields.reporting_manager) {
      fields.reporting_manager = fields.supervisor;
    }

    // Security & RBAC: Strip all privileged / system-controlled fields for non-admin callers
    if (!isCallerAdmin && !(canManageUsers && !isOwner)) {
      delete fields.role_id;
      delete fields.user_role;
      delete fields.is_active;
      delete fields.require_password_change;
      delete fields.is_profile_completed;
      delete fields.temp_password_expires_at;
      delete fields.last_password_changed_at;
    } else if (!isCallerAdmin) {
      // User managers (non-admin) may activate/deactivate and fix profile flags, never change roles
      delete fields.role_id;
      delete fields.user_role;
    } else {
      // Admin role modification: validate role_id against database and synchronize user_role
      if (fields.role_id) {
        const roleCheck = await query('SELECT id, name FROM roles WHERE id = $1', [fields.role_id]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid role_id: role does not exist in system' });
        }
        fields.user_role = tierForRole(roleCheck.rows[0].name);
      } else if (fields.user_role) {
        const roleCheck = await query('SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1)', [fields.user_role]);
        if (roleCheck.rows.length > 0) {
          fields.role_id = roleCheck.rows[0].id;
          fields.user_role = tierForRole(roleCheck.rows[0].name);
        }
      }
      // The super admin tier can never be granted from the portal
      if ((isSuperAdminRoleName(fields.user_role) || isSuperAdminRoleName(req.body.user_role)) && target.user_role !== 'super_admin') {
        return res.status(403).json({ error: 'Super admin cannot be assigned' });
      }
    }

    // Role / status / email protection (fields here only contain what the caller may change)
    const differs = (key: string) =>
      fields[key] !== undefined && String(fields[key] ?? '') !== String(target[key] ?? '');
    const roleChanging = differs('user_role') || differs('role_id');
    const deactivating = fields.is_active === false && target.is_active !== false;
    const emailChanging = fields.email !== undefined && fields.email !== null && fields.email !== '' &&
      String(fields.email).toLowerCase() !== String(target.email || '').toLowerCase();

    if (targetProtected && (roleChanging || deactivating)) {
      return res.status(403).json({ error: 'The super admin account cannot be demoted or deactivated' });
    }
    if (isOwner && roleChanging) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }
    if (isOwner && deactivating) {
      return res.status(403).json({ error: 'You cannot deactivate your own account' });
    }
    const newTier = fields.user_role !== undefined ? fields.user_role : target.user_role;
    if (['admin', 'super_admin'].includes(target.user_role) && target.is_active !== false &&
        (deactivating || !['admin', 'super_admin'].includes(newTier))) {
      if ((await countOtherActiveAdmins(req.params.id)) === 0) {
        return res.status(409).json({ error: 'This is the last active administrator and cannot be demoted or deactivated' });
      }
    }
    if (emailChanging && !isOwner && targetProtected) {
      return res.status(403).json({ error: 'Only the super admin can change their own email address' });
    }
    if (emailChanging && isOwner) {
      const currentPassword = res.locals.currentPassword;
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change your email address' });
      }
      const pw = await query('SELECT password_hash FROM users WHERE id = $1', [req.params.id]);
      const hash = pw.rows[0]?.password_hash;
      if (!hash || !(await bcrypt.compare(currentPassword, hash))) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    delete fields.id;
    delete fields.created_at;

    if (fields.full_name !== undefined && (!fields.full_name || !String(fields.full_name).trim())) {
      return res.status(400).json({ error: 'Full name cannot be empty' });
    }
    if (fields.full_name !== undefined && String(fields.full_name).trim().length > 150) {
      return res.status(400).json({ error: 'Full name must be 150 characters or fewer' });
    }
    for (const key of PROFILE_DATE_FIELDS) {
      const val = fields[key];
      if (val === undefined || val === null || val === '') continue;
      if (!isValidDateString(val)) {
        return res.status(400).json({ error: `${key.replace(/_/g, ' ')} is not a valid date` });
      }
    }
    if (fields.date_of_birth && String(fields.date_of_birth).slice(0, 10) > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Date of birth cannot be in the future' });
    }
    if (fields.email) {
      const emailTaken = await query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2', [fields.email, req.params.id]);
      if (emailTaken.rows.length > 0) {
        return res.status(409).json({ error: 'Another account already uses this email address' });
      }
    }
    // Date ranges must be in order (compare with stored values when only one side changes)
    const datePairs: [string, string, string][] = [
      ['project_start_date', 'project_end_date', 'Project end date'],
      ['staff_contract_start_date', 'staff_contract_end_date', 'Contract end date'],
    ];
    const needsCurrent = datePairs.some(([a, b]) => fields[a] !== undefined || fields[b] !== undefined);
    if (needsCurrent) {
      const cur = await query(
        `SELECT project_start_date::text, project_end_date::text, staff_contract_start_date::text, staff_contract_end_date::text
         FROM user_profiles WHERE id = $1`, [req.params.id]);
      const row = cur.rows[0] || {};
      for (const [a, b, label] of datePairs) {
        const start = fields[a] !== undefined ? fields[a] : row[a];
        const end = fields[b] !== undefined ? fields[b] : row[b];
        if (start && end && String(end).slice(0, 10) < String(start).slice(0, 10)) {
          return res.status(400).json({ error: `${label} cannot be earlier than the start date` });
        }
      }
    }

    // Convert empty strings to null for nullable db columns
    for (const key of Object.keys(fields)) {
      if (fields[key] === '') {
        fields[key] = null;
      }
    }

    fields.updated_at = new Date().toISOString();

    const rawKeys = Object.keys(fields);
    if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields to update' });

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
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, requirePermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Guard: Prevent administrators from deleting their own account
    if (req.user!.id === userId) {
      return res.status(400).json({ error: 'Administrators cannot delete their own account' });
    }

    // Guard: Prevent non-super_admin from deleting super_admin
    const targetCheck = await query('SELECT user_role, is_active FROM user_profiles WHERE id = $1', [userId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (userId === BOOTSTRAP_SUPER_ADMIN_ID) {
      return res.status(403).json({ error: 'The super admin account cannot be deleted' });
    }
    if (targetCheck.rows[0].user_role === 'super_admin' && req.user!.user_role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super administrators can delete super admin accounts' });
    }
    if (['admin', 'super_admin'].includes(targetCheck.rows[0].user_role) && targetCheck.rows[0].is_active !== false &&
        (await countOtherActiveAdmins(userId)) === 0) {
      return res.status(409).json({ error: 'This is the last active administrator and cannot be deleted' });
    }

    // Users with purchase, leave, inventory or work history must be deactivated instead, so those
    // records (and the audit trail) are never destroyed by an account deletion.
    const history = await query(
      `SELECT EXISTS (SELECT 1 FROM purchase_requests WHERE requested_by = $1)
           OR EXISTS (SELECT 1 FROM leave_requests WHERE requested_by = $1)
           OR EXISTS (SELECT 1 FROM inventory_requests WHERE requested_by = $1)
           OR EXISTS (SELECT 1 FROM assigned_works WHERE user_id = $1) AS has_history`,
      [userId]
    );
    if (history.rows[0]?.has_history) {
      return res.status(409).json({
        error: 'This user has purchase, leave, inventory or work history. Deactivate the account instead so the records are kept.',
      });
    }

    // Repository files on disk are removed after the rows are deleted (only once the transaction commits)
    const docFiles = await query('SELECT file_path FROM repository_documents WHERE uploaded_by = $1 AND file_path IS NOT NULL', [userId]);

    await transaction(async (client) => {
      // Nullify references where we want to preserve the historical record but un-link the deleted user
      await client.query('UPDATE user_permissions SET granted_by = NULL WHERE granted_by = $1', [userId]);
      await client.query('UPDATE work_cycles SET created_by = NULL WHERE created_by = $1', [userId]);

      // Un-link the user as approver on other people's purchase/leave requests (records are kept)
      await client.query('UPDATE purchase_requests SET approved_by = NULL WHERE approved_by = $1', [userId]);
      await client.query('UPDATE leave_requests SET approved_by = NULL WHERE approved_by = $1', [userId]);

      // Nullify reviewer foreign keys on milestone justification reviews and milestone change request reviews
      await client.query('UPDATE work_milestones SET justification_reviewed_by = NULL WHERE justification_reviewed_by = $1', [userId]);
      await client.query('UPDATE milestone_change_requests SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);

      // Delete remaining user-owned records
      await client.query('DELETE FROM admin_comments WHERE commented_by = $1', [userId]);
      await client.query('DELETE FROM repository_documents WHERE uploaded_by = $1', [userId]);
      // Audit logs are never deleted: un-link the actor but record who it was
      await client.query(
        `UPDATE audit_logs
         SET performed_by = NULL,
             remarks = COALESCE(remarks || ' ', '') || '[performed by deleted user ' || $2 || ']'
         WHERE performed_by = $1`,
        [userId, String(userId)]
      );

      // Delete user — cascades to user_profiles, user_permissions (as grantee),
      // notifications, expertise, work assignments, and all ON DELETE CASCADE children.
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });

    for (const { file_path } of docFiles.rows) {
      const fullPath = path.resolve(UPLOAD_DIR, String(file_path));
      if (!fullPath.startsWith(UPLOAD_DIR + path.sep)) continue;
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (fileErr: any) {
        console.error('Delete user: failed to remove repository file', fullPath, fileErr.message);
      }
    }
    res.json({ message: 'User deleted' });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
