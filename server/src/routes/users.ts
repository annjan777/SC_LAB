import { Router, Request, Response } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateRequest.js';
import { updateUserProfileSchema } from '../validators/userValidator.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { extractIndianPhone, validateEmail } from '../utils/userValidation.js';
import { checkUserNeedsSkillReminder, dismissSkillPopup, checkAndTriggerSkillReminders } from '../services/skillReminderService.js';

const router = Router();

// GET /api/users - list all users (with expertise)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const isPrivileged = req.user?.permissions.has('manage_users');

    let sql: string;
    if (isPrivileged) {
      sql = 'SELECT * FROM user_profiles ORDER BY created_at DESC';
    } else {
      sql = `
        SELECT id, full_name, roll_number, gender, email, department, program_designation, 
               supervisor, joining_date, tenure_ending_date, user_role, is_active, 
               profile_picture_url, is_profile_completed, designation, project_name, project_code,
               project_start_date, project_end_date, project_tenure, staff_contract_start_date,
               staff_contract_end_date, contract_tenure, project_role_responsibility,
               project_pi_coordinator, reporting_manager, current_status, contract_status, remarks_staff,
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
        SELECT id, full_name, roll_number, gender, email, department, program_designation, 
               supervisor, joining_date, tenure_ending_date, user_role, is_active, 
               profile_picture_url, is_profile_completed, designation, project_name, project_code,
               project_start_date, project_end_date, project_tenure, staff_contract_start_date,
               staff_contract_end_date, contract_tenure, project_role_responsibility,
               project_pi_coordinator, reporting_manager, current_status, contract_status, remarks_staff,
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
router.put('/:id', authenticate, validateBody(updateUserProfileSchema), async (req: Request, res: Response) => {
  try {
    // Users can update their own profile; admins can update anyone
    if (req.user!.id !== req.params.id && req.user!.user_role !== 'admin' && req.user!.user_role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const fields = req.body;

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

    // Only admin/super_admin can change user_role and is_active
    if (req.user!.user_role !== 'admin' && req.user!.user_role !== 'super_admin') {
      delete fields.user_role;
      delete fields.is_active;
    }
    delete fields.id;
    delete fields.created_at;

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
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
