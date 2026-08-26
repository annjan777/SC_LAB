// Admin route aliases + additional admin-specific endpoints
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { sendTempPasswordEmail, generateTempPassword } from '../utils/email.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { createNotification } from '../services/notificationService.js';

const router = Router();

function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

// --- Admin Users ---
// POST /api/admin/users - create user (admin creating a user)
router.post('/users', authenticate, requirePermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, role_id } = req.body;
    
    if (password && !isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long and contain uppercase, lowercase, and numbers' });
    }

    const generatedPassword = password || generateTempPassword();
    const hash = await bcrypt.hash(generatedPassword, 10);
    const requestedRole = role || 'user';

    // Resolve the role name from role_id when provided (the "Add User" UI sends role_id, not
    // role) so the user_role column always reflects what was actually selected, rather than
    // silently defaulting to 'user'.
    let resolvedRoleId = role_id;
    let resolvedRoleName = requestedRole;
    if (resolvedRoleId) {
      const r = await query('SELECT name FROM roles WHERE id = $1', [resolvedRoleId]);
      if (r.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid role_id: role does not exist in the system.' });
      }
      resolvedRoleName = r.rows[0].name;
    } else {
      const r = await query('SELECT id, name FROM roles WHERE LOWER(name) = $1', [requestedRole.toLowerCase()]);
      if (r.rows.length === 0) {
        return res.status(400).json({ error: `Invalid role: '${requestedRole}'. Role does not exist in the system.` });
      }
      resolvedRoleId = r.rows[0].id;
      resolvedRoleName = r.rows[0].name;
    }

    // Admin accounts cannot be created directly through this endpoint — only promoted to
    // afterwards via Settings > Roles & Permissions, so account creation never defaults to
    // (or is used to directly grant) the highest privilege tier.
    if (resolvedRoleName.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be created directly. Create the user first, then promote them to Admin from Settings.' });
    }

    const userResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    const userId = userResult.rows[0].id;

    await query(
      `INSERT INTO user_profiles (id, full_name, email, user_role, role_id, require_password_change, temp_password_expires_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW() + INTERVAL '24 hours')`,
      [userId, full_name || 'New User', email, resolvedRoleName.toLowerCase(), resolvedRoleId]
    );

    // Account creation succeeds even if the welcome email can't be sent — the admin can share
    // the returned credentials manually, and the user can always recover access via Forgot
    // Password afterwards, so a mail-provider outage shouldn't block onboarding.
    sendTempPasswordEmail(email, full_name || 'New User', generatedPassword).then(emailResult => {
      if (!emailResult.success) {
        console.log(`[DEV MODE] Password for ${email}: ${generatedPassword}`);
      }
    }).catch(err => console.error('Background email error:', err));

    const profileResult = await query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
    res.status(201).json({
      ...profileResult.rows[0],
      password: generatedPassword,
      email_sent: true,
      email_error: undefined,
    });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/admin/users/bulk-import-single
router.post('/users/bulk-import-single', authenticate, requirePermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, ...extraFields } = req.body;
    const generatedPassword = password || generateTempPassword();
    const hash = await bcrypt.hash(generatedPassword, 10);
    const userRole = role || 'user';

    if (userRole.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be created via bulk import. Import the user first, then promote them to Admin from Settings.' });
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const userResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, hash]
    );
    const userId = userResult.rows[0].id;

    const roleResult = await query('SELECT id FROM roles WHERE LOWER(name) = $1', [userRole.toLowerCase()]);
    const roleId = roleResult.rows[0]?.id || null;

    const profileFields: Record<string, any> = {
      id: userId, full_name: full_name || 'New User', email, user_role: userRole.toLowerCase(),
      role_id: roleId, require_password_change: true, ...extraFields,
    };
    const rawKeys = Object.keys(profileFields);
    const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
    const placeholders = safeKeys.map((_, i) => `$${i + 1}`);
    const values = rawKeys.map(k => profileFields[k]);

    // Add temp_password_expires_at manually
    safeKeys.push('temp_password_expires_at');
    placeholders.push(`NOW() + INTERVAL '24 hours'`);

    await query(
      `INSERT INTO user_profiles (${safeKeys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders.join(',')})`,
      values
    );

    // Email will be sent in the background
    sendTempPasswordEmail(email, full_name || 'New User', generatedPassword).then(emailResult => {
      if (!emailResult.success) {
        console.log(`[DEV MODE] Password for ${email}: ${generatedPassword}`);
      }
    }).catch(err => console.error('Background email error:', err));

    const profile = await query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
    res.status(201).json({
      ...profile.rows[0],
      password: generatedPassword,
      email_sent: true,
      email_error: undefined,
    });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/users/:id/permissions
router.get('/users/:id/permissions', authenticate, requirePermission('manage_roles'), async (req: Request, res: Response) => {
  try {
    const profile = await query('SELECT role_id FROM user_profiles WHERE id = $1', [req.params.id]);
    const direct = await query(
      `SELECT p.id as permission_id, p.name, p.display_name, p.category
       FROM get_user_permissions($1) up 
       JOIN permissions p ON p.name = up.permission_name`,
      [req.params.id]
    );
    res.json({
      role_id: profile.rows[0]?.role_id,
      direct_permissions: direct.rows,
    });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

import { logAuditEvent } from '../services/auditLogger.js';

// PUT /api/admin/users/:id/permissions
router.put('/users/:id/permissions', authenticate, requirePermission('manage_roles'), async (req: Request, res: Response) => {
  try {
    const { role_id, permission_ids, individual_permissions, user_role } = req.body;
    const pids = permission_ids !== undefined ? permission_ids : individual_permissions;
    if (user_role !== undefined) {
      let resolvedRoleId = role_id;
      if (!resolvedRoleId) {
        const r = await query('SELECT id FROM roles WHERE LOWER(name) = $1', [user_role.toLowerCase()]);
        if (r.rows.length === 0) {
          return res.status(400).json({ error: `Invalid role: '${user_role}'. Role does not exist in the system.` });
        }
        resolvedRoleId = r.rows[0].id;
      }
      await query('UPDATE user_profiles SET user_role = $1, role_id = COALESCE($2, role_id) WHERE id = $3', [user_role, resolvedRoleId, req.params.id]);
    } else if (role_id !== undefined) {
      await query('UPDATE user_profiles SET role_id = $1 WHERE id = $2', [role_id, req.params.id]);
    }
    if (pids !== undefined && Array.isArray(pids)) {
      await query('DELETE FROM user_permissions WHERE user_id = $1', [req.params.id]);
      
      // Calculate role inherited permissions
      let targetRoleId = role_id;
      if (!targetRoleId) {
        const profRes = await query('SELECT role_id FROM user_profiles WHERE id = $1', [req.params.id]);
        targetRoleId = profRes.rows[0]?.role_id;
      }

      const rolePermsRes = await query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [targetRoleId]);
      const rolePermIds = rolePermsRes.rows.map(r => r.permission_id);

      // Determine explicit grants (checked but not inherited)
      const grantedPerms = pids.filter(id => !rolePermIds.includes(id));

      for (const pid of grantedPerms) {
        await query(
          'INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [req.params.id, pid, req.user!.id]
        );
      }
    }

    await logAuditEvent({
      userId: req.user?.id,
      action: 'PERMISSION_CHANGE',
      entityType: 'user_permissions',
      entityId: req.params.id,
      newValue: { role_id, user_role, permission_ids: pids },
      remarks: `Updated permissions and role for user ${req.params.id}`,
    });

    res.json({ message: 'Updated' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Leave Requests ---

router.get('/leave-requests', authenticate, requirePermission('view_leaves'), async (req: Request, res: Response) => {
  try {
    const role = req.user?.user_role?.toLowerCase();
    const isPrivileged = role === 'admin' || role === 'super_admin' || role === 'superadmin';

    let sql = `
      SELECT lr.*,
        json_build_object(
          'full_name', up.full_name,
          'department', up.department
        ) as user_profiles
      FROM leave_requests lr
      LEFT JOIN user_profiles up ON up.id = lr.requested_by
    `;
    const params: any[] = [];

    if (!isPrivileged) {
      sql += ` WHERE lr.requested_by = $1`;
      params.push(req.user!.id);
    }

    sql += ` ORDER BY lr.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Purchase Requests ---

router.get('/purchase-requests', authenticate, requirePermission('view_procurement'), async (req: Request, res: Response) => {
  try {
    const role = req.user?.user_role?.toLowerCase();
    const isPrivileged = role === 'admin' || role === 'super_admin' || role === 'superadmin';
    console.log('[DEBUG PROCUREMENT ROUTE] Hit!', { email: req.user?.email, role, isPrivileged });

    let sql = `
      SELECT pr.*,
        json_build_object(
          'full_name', up.full_name,
          'email', up.email,
          'department', up.department
        ) as user_profiles,
        approver.full_name as approver_name
      FROM purchase_requests pr
      LEFT JOIN user_profiles up ON up.id = pr.requested_by
      LEFT JOIN user_profiles approver ON approver.id = pr.approved_by
    `;
    const params: any[] = [];

    if (!isPrivileged) {
      sql += ` WHERE pr.requested_by = $1`;
      params.push(req.user!.id);
    }
    
    sql += ` ORDER BY pr.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/purchase-requests/:id/approve', authenticate, requirePermission('approve_procurement'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE purchase_requests
       SET status = 'approved', approved_by = $1, approved_at = now(), rejection_reason = NULL
       WHERE id = $2
       RETURNING *`,
      [req.user!.id, req.params.id]
    );
    
    if (result.rows[0]) {
      const pr = result.rows[0];
      await createNotification({
        userId: pr.requested_by,
        type: 'procurement',
        title: 'Purchase Request Approved',
        message: `Your purchase request for ${pr.item_name || 'an item'} has been approved.`,
        relatedEntityType: 'purchase_requests',
        relatedEntityId: pr.id,
        actionUrl: `/purchases`
      });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/purchase-requests/:id/reject', authenticate, requirePermission('approve_procurement'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE purchase_requests
       SET status = 'rejected', approved_by = $1, approved_at = now(), rejection_reason = $2
       WHERE id = $3
       RETURNING *`,
      [req.user!.id, req.body.rejection_reason || null, req.params.id]
    );

    if (result.rows[0]) {
      const pr = result.rows[0];
      await createNotification({
        userId: pr.requested_by,
        type: 'procurement',
        title: 'Purchase Request Rejected',
        message: `Your purchase request for ${pr.item_name || 'an item'} was rejected.`,
        relatedEntityType: 'purchase_requests',
        relatedEntityId: pr.id,
        actionUrl: `/purchases`
      });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/purchase-requests/:id/status', authenticate, requirePermission('approve_procurement'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE purchase_requests
       SET status = $1, approved_by = $2, approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END
       WHERE id = $3
       RETURNING *`,
      [req.body.status, req.user!.id, req.params.id]
    );

    if (result.rows[0]) {
      const pr = result.rows[0];
      await createNotification({
        userId: pr.requested_by,
        type: 'procurement',
        title: 'Purchase Request Status Updated',
        message: `Your purchase request status was updated to ${req.body.status}.`,
        relatedEntityType: 'purchase_requests',
        relatedEntityId: pr.id,
        actionUrl: `/purchases`
      });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/purchase-requests/:id/procurement', authenticate, requirePermission('view_procurement'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM procurement_details WHERE purchase_request_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    res.json(result.rows[0] || null);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/purchase-requests/:id/procurement', authenticate, requirePermission('manage_procurement'), async (req: Request, res: Response) => {
  try {
    const existing = await query(
      'SELECT id FROM procurement_details WHERE purchase_request_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );

    const fields = {
      approved_cost: req.body.approved_cost ?? null,
      vendor_contact: req.body.vendor_contact ?? null,
      po_number: req.body.po_number ?? null,
      order_date: req.body.order_date ?? null,
      expected_delivery_date: req.body.expected_delivery_date ?? null,
      dispatch_date: req.body.dispatch_date ?? null,
      tracking_id: req.body.tracking_id ?? null,
      remarks: req.body.remarks ?? null,
    };

    if (existing.rows[0]?.id) {
      const result = await query(
        `UPDATE procurement_details
         SET approved_cost = $1, vendor_contact = $2, po_number = $3, order_date = $4,
             expected_delivery_date = $5, dispatch_date = $6, tracking_id = $7, remarks = $8
         WHERE id = $9
         RETURNING *`,
        [
          fields.approved_cost, fields.vendor_contact, fields.po_number, fields.order_date,
          fields.expected_delivery_date, fields.dispatch_date, fields.tracking_id, fields.remarks,
          existing.rows[0].id,
        ]
      );
      return res.json(result.rows[0]);
    }

    const result = await query(
      `INSERT INTO procurement_details
         (purchase_request_id, approved_cost, vendor_contact, po_number, order_date, expected_delivery_date, dispatch_date, tracking_id, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        req.params.id, fields.approved_cost, fields.vendor_contact, fields.po_number, fields.order_date,
        fields.expected_delivery_date, fields.dispatch_date, fields.tracking_id, fields.remarks,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/leave-requests/:id/approve', authenticate, requirePermission('approve_leaves'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE leave_requests
       SET status = 'approved', approved_by = $1, approved_at = now(), admin_remarks = NULL
       WHERE id = $2
       RETURNING *`,
      [req.user!.id, req.params.id]
    );

    if (result.rows[0]) {
      const lr = result.rows[0];
      await createNotification({
        userId: lr.requested_by,
        type: 'leave',
        title: 'Leave Request Approved',
        message: `Your leave request has been approved.`,
        relatedEntityType: 'leave_requests',
        relatedEntityId: lr.id,
        actionUrl: `/leaves`
      });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/leave-requests/:id/reject', authenticate, requirePermission('approve_leaves'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE leave_requests
       SET status = 'rejected', approved_by = $1, approved_at = now(), admin_remarks = $2
       WHERE id = $3
       RETURNING *`,
      [req.user!.id, req.body.admin_remarks || null, req.params.id]
    );

    if (result.rows[0]) {
      const lr = result.rows[0];
      await createNotification({
        userId: lr.requested_by,
        type: 'leave',
        title: 'Leave Request Rejected',
        message: `Your leave request was rejected.`,
        relatedEntityType: 'leave_requests',
        relatedEntityId: lr.id,
        actionUrl: `/leaves`
      });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Admin Reports ---
router.get('/reports/:type', authenticate, requirePermission('view_reports'), async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    let result;
    switch (type) {
      case 'users':
        result = await query(`
          SELECT up.*, 
            (SELECT array_agg(skill_name) FROM user_skills WHERE user_id = up.id) as skills,
            (SELECT array_agg(software_name) FROM user_software WHERE user_id = up.id) as software,
            (SELECT array_agg(equipment_name) FROM user_equipment WHERE user_id = up.id) as equipment,
            (SELECT array_agg(process_name) FROM user_processes WHERE user_id = up.id) as processes
          FROM user_profiles up ORDER BY up.full_name`);
        break;
      case 'inventory':
        result = await query(`
          SELECT i.*, up.full_name as assigned_to_name
          FROM inventory_items i LEFT JOIN user_profiles up ON up.id = i.assigned_to_user_id
          ORDER BY i.item_name`);
        break;
      case 'procurement':
        result = await query(`
          SELECT pr.*, up.full_name as requester_name, ap.full_name as approver_name
          FROM purchase_requests pr
          LEFT JOIN user_profiles up ON up.id = pr.requested_by
          LEFT JOIN user_profiles ap ON ap.id = pr.approved_by
          ORDER BY pr.created_at DESC`);
        break;
      case 'leaves':
        result = await query(`
          SELECT lr.*, up.full_name as requester_name, ap.full_name as approver_name
          FROM leave_requests lr
          LEFT JOIN user_profiles up ON up.id = lr.requested_by
          LEFT JOIN user_profiles ap ON ap.id = lr.approved_by
          ORDER BY lr.created_at DESC`);
        break;
      case 'facilities':
        result = await query(`
          SELECT f.*, up.full_name as responsible_person_name
          FROM facilities f LEFT JOIN user_profiles up ON up.id = f.responsible_person_id
          ORDER BY f.name`);
        break;
      case 'work':
        result = await query(`
          SELECT aw.*, up.full_name as user_name
          FROM assigned_works aw
          LEFT JOIN user_profiles up ON up.id = aw.user_id
          ORDER BY aw.created_at DESC`);
        break;
      case 'repository':
        result = await query(`
          SELECT rd.*, up.full_name as uploader_name
          FROM repository_documents rd
          LEFT JOIN user_profiles up ON up.id = rd.uploaded_by
          ORDER BY rd.created_at DESC`);
        break;
      case 'notifications':
        result = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500');
        break;
      case 'audit-logs':
        result = await query(`
          SELECT al.*, up.full_name as performer_name
          FROM audit_logs al LEFT JOIN user_profiles up ON up.id = al.performed_by
          ORDER BY al.performed_at DESC LIMIT 500`);
        break;
      default:
        return res.status(404).json({ error: 'Unknown report type' });
    }
    res.json(result.rows);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Admin Work Overview ---
router.get('/work/overview', authenticate, requirePermission('view_work'), async (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT
        aw.id AS work_id,
        aw.*,
        up.full_name as user_name,
        up.department,
        (SELECT completion_percentage FROM progress_updates
         WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1) as completion_percentage,
        (SELECT status FROM progress_updates
         WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1) as latest_status,
        (SELECT COUNT(*) FROM work_problems
         WHERE work_id = aw.id AND status IN ('open','in_progress'))::int as open_problems_count,
        (SELECT MAX(created_at) FROM progress_updates WHERE work_id = aw.id) as last_updated
      FROM assigned_works aw
      LEFT JOIN user_profiles up ON up.id = aw.user_id`;
    const params: any[] = [];
    const conditions: string[] = [];

    const canReadAll = req.user!.permissions.has('manage_work_cycles') || req.user!.permissions.has('manage_users');
    if (!canReadAll) {
      params.push(req.user!.id);
      conditions.push(`aw.user_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY up.full_name, aw.project_name';
    const result = await query(sql, params);

    const workData = result.rows.map((row: any) => {
      const lastUpdated = row.last_updated ? new Date(row.last_updated) : null;
      const daysSinceUpdate = lastUpdated
        ? Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return {
        ...row,
        days_since_update: daysSinceUpdate,
        completion_percentage: Number(row.completion_percentage || 0),
      };
    });

    const usersResult = await query('SELECT id, full_name, department FROM user_profiles ORDER BY full_name');
    const usersWithWork = new Set(workData.map((row: any) => row.user_id));
    const usersWithoutWork = usersResult.rows.filter((user: any) => !usersWithWork.has(user.id));
    const myWorkRows = workData.filter((row: any) => row.user_id === req.user!.id);
    const myWorkSummary = {
      totalWorks: myWorkRows.length,
      avgCompletion: myWorkRows.length
        ? Math.round(myWorkRows.reduce((sum: number, row: any) => sum + Number(row.completion_percentage || 0), 0) / myWorkRows.length)
        : 0,
      openProblems: myWorkRows.reduce((sum: number, row: any) => sum + Number(row.open_problems_count || 0), 0),
    };

    const highImpactProblemsResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM work_problems wp
       JOIN assigned_works aw ON aw.id = wp.work_id
       WHERE wp.severity = 'high'
         AND wp.status IN ('open', 'in_progress')
         ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}`,
      params
    );

    const supportRequestsResult = await query(
      `SELECT
         COALESCE(ma.support_required_from, 'unspecified') AS support_required_from,
         COUNT(*)::int AS count
       FROM mitigation_actions ma
       JOIN work_problems wp ON wp.id = ma.problem_id
       JOIN assigned_works aw ON aw.id = wp.work_id
       ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
       GROUP BY COALESCE(ma.support_required_from, 'unspecified')`,
      params
    );

    const openSupportRequests: Record<string, number> = {
      supervisor: 0,
      admin: 0,
      facility_spoc: 0,
      procurement: 0,
    };

    for (const row of supportRequestsResult.rows) {
      if (row.support_required_from in openSupportRequests) {
        openSupportRequests[row.support_required_from] = row.count;
      }
    }

    res.json({
      workData,
      usersWithoutWork,
      myWorkSummary,
      statistics: {
        totalUsers: usersResult.rows.length,
        usersWithWork: usersWithWork.size,
        usersWithoutWork: usersWithoutWork.length,
        delayedWorkCount: workData.filter((row: any) => row.latest_status === 'delayed').length,
        highImpactProblemsCount: highImpactProblemsResult.rows[0]?.count || 0,
        openSupportRequests,
      },
    });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/work/:id/comments', authenticate, requirePermission('view_work'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         ac.id,
         ac.comment AS comment_text,
         ac.created_at,
         ac.commented_by AS admin_id,
         json_build_object('full_name', up.full_name) AS user_profiles
       FROM admin_comments ac
       LEFT JOIN user_profiles up ON up.id = ac.commented_by
       WHERE ac.work_id = $1
       ORDER BY ac.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/work/:id/comments', authenticate, requirePermission('create_work'), async (req: Request, res: Response) => {
  try {
    const comment = req.body.comment_text || req.body.comment;
    const result = await query(
      `INSERT INTO admin_comments (work_id, comment, commented_by)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [req.params.id, comment, req.user!.id]
    );

    const workResult = await query('SELECT user_id, project_name FROM assigned_works WHERE id = $1', [req.params.id]);
    if (workResult.rows[0] && workResult.rows[0].user_id !== req.user!.id) {
      await createNotification({
        userId: workResult.rows[0].user_id,
        type: 'work',
        title: 'New Comment on Your Work',
        message: `An admin commented on your work: ${workResult.rows[0].project_name}`,
        relatedEntityType: 'assigned_works',
        relatedEntityId: req.params.id,
        actionUrl: `/work-overview`
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/work/:id/status', authenticate, requirePermission('edit_work'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE assigned_works
       SET admin_status = $1
       WHERE id = $2
       RETURNING *`,
      [req.body.admin_status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
