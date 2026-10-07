// Admin route aliases + additional admin-specific endpoints
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { sendTempPasswordEmail, generateTempPassword } from '../utils/email.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { createNotification } from '../services/notificationService.js';
import { notifyWorkComment } from '../services/workNotificationService.js';
import { extractIndianPhone, validateEmail } from '../utils/userValidation.js';
import { syncOverdueMilestones } from './work.js';
const router = Router();
function isValidPassword(password) {
    return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}
// --- Admin Users ---
// POST /api/admin/users - create user (admin creating a user)
router.post('/users', authenticate, requirePermission('manage_users'), async (req, res) => {
    try {
        const { email, password, full_name, role, role_id, phone } = req.body;
        // Validate email domain and format
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({ error: emailValidation.error });
        }
        const cleanEmail = emailValidation.email;
        // Validate and extract 10-digit Indian contact number
        const phoneValidation = extractIndianPhone(phone, true);
        if (!phoneValidation.isValid) {
            return res.status(400).json({ error: phoneValidation.error });
        }
        const cleanPhone = phoneValidation.phone;
        // Check if user already exists
        const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'A user with this email address already exists' });
        }
        if (password && !isValidPassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long and contain uppercase, lowercase, and numbers' });
        }
        const generatedPassword = password || generateTempPassword();
        const hash = await bcrypt.hash(generatedPassword, 10);
        const requestedRole = role || 'user';
        // Resolve the role name from role_id when provided
        let resolvedRoleId = role_id;
        let resolvedRoleName = requestedRole;
        if (resolvedRoleId) {
            const r = await query('SELECT name FROM roles WHERE id = $1', [resolvedRoleId]);
            if (r.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid role_id: role does not exist in the system.' });
            }
            resolvedRoleName = r.rows[0].name;
        }
        else {
            const r = await query('SELECT id, name FROM roles WHERE LOWER(name) = $1', [requestedRole.toLowerCase()]);
            if (r.rows.length === 0) {
                return res.status(400).json({ error: `Invalid role: '${requestedRole}'. Role does not exist in the system.` });
            }
            resolvedRoleId = r.rows[0].id;
            resolvedRoleName = r.rows[0].name;
        }
        if (resolvedRoleName.toLowerCase() === 'admin') {
            return res.status(400).json({ error: 'Admin accounts cannot be created directly. Create the user first, then promote them to Admin from Settings.' });
        }
        const userResult = await query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [cleanEmail, hash]);
        const userId = userResult.rows[0].id;
        await query(`INSERT INTO user_profiles (id, full_name, email, phone, user_role, role_id, require_password_change, is_profile_completed, temp_password_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, NOW() + INTERVAL '24 hours')`, [userId, full_name || 'New User', cleanEmail, cleanPhone, resolvedRoleName.toLowerCase(), resolvedRoleId]);
        sendTempPasswordEmail(cleanEmail, full_name || 'New User', generatedPassword).then(emailResult => {
            if (!emailResult.success) {
                console.warn(`[ADMIN] Failed to dispatch temporary password email to ${cleanEmail}`);
            }
        }).catch(err => console.error('Background email error:', err));
        const profileResult = await query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
        res.status(201).json({
            ...profileResult.rows[0],
            password: generatedPassword,
            email_sent: true,
            email_error: undefined,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
function parseDateForDb(val) {
    if (!val || typeof val !== 'string')
        return null;
    const trimmed = val.trim();
    if (!trimmed || ['n/a', 'na', '-', 'nil', 'null', 'none'].includes(trimmed.toLowerCase())) {
        return null;
    }
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
        const d = new Date(trimmed);
        return isNaN(d.getTime()) ? null : trimmed;
    }
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
        const [_, d, m, y] = dmyMatch;
        const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        const parsed = new Date(iso);
        return isNaN(parsed.getTime()) ? null : iso;
    }
    const general = new Date(trimmed);
    if (!isNaN(general.getTime())) {
        return general.toISOString().split('T')[0];
    }
    return null;
}
// POST /api/admin/users/bulk-import-single
router.post('/users/bulk-import-single', authenticate, requirePermission('manage_users'), async (req, res) => {
    try {
        const { email, password, full_name, role, ...extraFields } = req.body;
        // Validate email domain and format
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({ error: emailValidation.error });
        }
        const cleanEmail = emailValidation.email;
        // Validate and extract 10-digit Indian contact number if provided
        if (extraFields.phone) {
            const phoneValidation = extractIndianPhone(extraFields.phone, false);
            if (!phoneValidation.isValid) {
                return res.status(400).json({ error: phoneValidation.error });
            }
            extraFields.phone = phoneValidation.phone;
        }
        else {
            extraFields.phone = null;
        }
        const generatedPassword = password || generateTempPassword();
        const hash = await bcrypt.hash(generatedPassword, 10);
        const userRole = role || 'user';
        if (userRole.toLowerCase() === 'admin') {
            return res.status(400).json({ error: 'Admin accounts cannot be created via bulk import. Import the user first, then promote them to Admin from Settings.' });
        }
        const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
        if (existingUser.rows.length > 0) {
            const existingUserId = existingUser.rows[0].id;
            const currentProfileResult = await query('SELECT * FROM user_profiles WHERE id = $1', [existingUserId]);
            const currentProfile = currentProfileResult.rows[0] || {};
            // Prepare fields to update: ONLY update columns that are currently null or empty string in DB,
            // and ONLY if the incoming CSV has a non-empty value!
            // Do NOT replace or change any data that is already present in the database!
            const fieldsToConsider = {
                full_name: full_name || null,
                designation: extraFields.designation || null,
                program_designation: extraFields.program_designation || extraFields.designation || null,
                phone: extraFields.phone || null,
                project_name: extraFields.project_name || null,
                project_code: extraFields.project_code || null,
                project_start_date: parseDateForDb(extraFields.project_start_date),
                project_end_date: parseDateForDb(extraFields.project_end_date),
                project_tenure: extraFields.project_tenure || null,
                staff_contract_start_date: parseDateForDb(extraFields.staff_contract_start_date),
                staff_contract_end_date: parseDateForDb(extraFields.staff_contract_end_date),
                contract_tenure: extraFields.contract_tenure || null,
                project_role_responsibility: extraFields.project_role_responsibility || null,
                project_pi_coordinator: extraFields.project_pi_coordinator || null,
                reporting_manager: extraFields.reporting_manager || extraFields.supervisor || null,
                supervisor: extraFields.supervisor || extraFields.reporting_manager || null,
                current_status: extraFields.current_status || null,
                contract_status: extraFields.contract_status || null,
                remarks_staff: extraFields.remarks_staff || null,
                remarks_manager: extraFields.remarks_manager || null,
                roll_number: extraFields.roll_number || null,
                employee_id: extraFields.employee_id || null,
                department: extraFields.department || null,
            };
            const updateKeys = [];
            const updateValues = [];
            for (const [key, val] of Object.entries(fieldsToConsider)) {
                if (val !== null && val !== undefined && val !== '') {
                    const currentVal = currentProfile[key];
                    // Check if current value in DB is missing (null, undefined, empty string, or default placeholder 'New User' for full_name)
                    const isMissing = currentVal === null || currentVal === undefined || currentVal === '' || (key === 'full_name' && currentVal === 'New User');
                    if (isMissing) {
                        updateKeys.push(key);
                        updateValues.push(val);
                    }
                }
            }
            if (updateKeys.length > 0) {
                const safeKeys = updateKeys.map(k => sanitizeIdentifier(k));
                const setClauses = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
                updateValues.push(existingUserId);
                await query(`UPDATE user_profiles SET ${setClauses}, updated_at = now() WHERE id = $${updateValues.length}`, updateValues);
            }
            const updatedProfile = await query('SELECT * FROM user_profiles WHERE id = $1', [existingUserId]);
            return res.status(200).json({
                ...updatedProfile.rows[0],
                is_existing: true,
                fields_updated: updateKeys,
                message: updateKeys.length > 0
                    ? `Updated missing fields for existing user: ${updateKeys.join(', ')}`
                    : 'Existing user already has all provided data (no fields overwritten)',
            });
        }
        // NEW USER CREATION
        const userResult = await query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [cleanEmail, hash]);
        const userId = userResult.rows[0].id;
        const roleResult = await query('SELECT id FROM roles WHERE LOWER(name) = $1', [userRole.toLowerCase()]);
        const roleId = roleResult.rows[0]?.id || null;
        if (extraFields.designation && !extraFields.program_designation) {
            extraFields.program_designation = extraFields.designation;
        }
        else if (extraFields.program_designation && !extraFields.designation) {
            extraFields.designation = extraFields.program_designation;
        }
        if (extraFields.reporting_manager && !extraFields.supervisor) {
            extraFields.supervisor = extraFields.reporting_manager;
        }
        else if (extraFields.supervisor && !extraFields.reporting_manager) {
            extraFields.reporting_manager = extraFields.supervisor;
        }
        // Clean dates
        if (extraFields.project_start_date !== undefined)
            extraFields.project_start_date = parseDateForDb(extraFields.project_start_date);
        if (extraFields.project_end_date !== undefined)
            extraFields.project_end_date = parseDateForDb(extraFields.project_end_date);
        if (extraFields.staff_contract_start_date !== undefined)
            extraFields.staff_contract_start_date = parseDateForDb(extraFields.staff_contract_start_date);
        if (extraFields.staff_contract_end_date !== undefined)
            extraFields.staff_contract_end_date = parseDateForDb(extraFields.staff_contract_end_date);
        if (extraFields.joining_date !== undefined)
            extraFields.joining_date = parseDateForDb(extraFields.joining_date);
        // Convert empty strings to null
        for (const key of Object.keys(extraFields)) {
            if (extraFields[key] === '') {
                extraFields[key] = null;
            }
        }
        const profileFields = {
            id: userId,
            full_name: full_name || 'New User',
            email: cleanEmail,
            user_role: userRole.toLowerCase(),
            role_id: roleId,
            require_password_change: true,
            is_profile_completed: false,
            ...extraFields,
        };
        const rawKeys = Object.keys(profileFields);
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const placeholders = safeKeys.map((_, i) => `$${i + 1}`);
        const values = rawKeys.map(k => profileFields[k]);
        // Add temp_password_expires_at manually
        safeKeys.push('temp_password_expires_at');
        placeholders.push(`NOW() + INTERVAL '24 hours'`);
        await query(`INSERT INTO user_profiles (${safeKeys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders.join(',')})`, values);
        // Email will be sent in the background
        sendTempPasswordEmail(email, full_name || 'New User', generatedPassword).then(emailResult => {
            if (!emailResult.success) {
                console.warn(`[ADMIN] Failed to dispatch temporary password email to ${email}`);
            }
        }).catch(err => console.error('Background email error:', err));
        const profile = await query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
        res.status(201).json({
            ...profile.rows[0],
            password: generatedPassword,
            email_sent: true,
            email_error: undefined,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/admin/users/:id/permissions
router.get('/users/:id/permissions', authenticate, requirePermission('manage_roles'), async (req, res) => {
    try {
        const profile = await query('SELECT role_id FROM user_profiles WHERE id = $1', [req.params.id]);
        const direct = await query(`SELECT p.id as permission_id, p.name, p.display_name, p.category
       FROM get_user_permissions($1) up 
       JOIN permissions p ON p.name = up.permission_name`, [req.params.id]);
        res.json({
            role_id: profile.rows[0]?.role_id,
            direct_permissions: direct.rows,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
import { logAuditEvent } from '../services/auditLogger.js';
// PUT /api/admin/users/:id/permissions
router.put('/users/:id/permissions', authenticate, requirePermission('manage_roles'), async (req, res) => {
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
        }
        else if (role_id !== undefined) {
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
                await query('INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.params.id, pid, req.user.id]);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- Leave Requests ---
router.get('/leave-requests', authenticate, requirePermission('view_leaves'), async (req, res) => {
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
        const params = [];
        if (!isPrivileged) {
            sql += ` WHERE lr.requested_by = $1`;
            params.push(req.user.id);
        }
        sql += ` ORDER BY lr.created_at DESC`;
        const result = await query(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- Purchase Requests ---
router.get('/purchase-requests', authenticate, requirePermission('view_procurement'), async (req, res) => {
    try {
        const role = req.user?.user_role?.toLowerCase();
        const isPrivileged = role === 'admin' || role === 'super_admin' || role === 'superadmin';
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
        const params = [];
        if (!isPrivileged) {
            sql += ` WHERE pr.requested_by = $1`;
            params.push(req.user.id);
        }
        sql += ` ORDER BY pr.created_at DESC`;
        const result = await query(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/purchase-requests/:id/approve', authenticate, requirePermission('approve_procurement'), async (req, res) => {
    try {
        const result = await query(`UPDATE purchase_requests
       SET status = 'approved', approved_by = $1, approved_at = now(), rejection_reason = NULL
       WHERE id = $2
       RETURNING *`, [req.user.id, req.params.id]);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/purchase-requests/:id/reject', authenticate, requirePermission('approve_procurement'), async (req, res) => {
    try {
        const result = await query(`UPDATE purchase_requests
       SET status = 'rejected', approved_by = $1, approved_at = now(), rejection_reason = $2
       WHERE id = $3
       RETURNING *`, [req.user.id, req.body.rejection_reason || null, req.params.id]);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/purchase-requests/:id/status', authenticate, requirePermission('approve_procurement'), async (req, res) => {
    try {
        const result = await query(`UPDATE purchase_requests
       SET status = $1, approved_by = $2, approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END
       WHERE id = $3
       RETURNING *`, [req.body.status, req.user.id, req.params.id]);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/purchase-requests/:id/procurement', authenticate, requirePermission('view_procurement'), async (req, res) => {
    try {
        const result = await query('SELECT * FROM procurement_details WHERE purchase_request_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]);
        res.json(result.rows[0] || null);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/purchase-requests/:id/procurement', authenticate, requirePermission('manage_procurement'), async (req, res) => {
    try {
        const existing = await query('SELECT id FROM procurement_details WHERE purchase_request_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.id]);
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
            const result = await query(`UPDATE procurement_details
         SET approved_cost = $1, vendor_contact = $2, po_number = $3, order_date = $4,
             expected_delivery_date = $5, dispatch_date = $6, tracking_id = $7, remarks = $8
         WHERE id = $9
         RETURNING *`, [
                fields.approved_cost, fields.vendor_contact, fields.po_number, fields.order_date,
                fields.expected_delivery_date, fields.dispatch_date, fields.tracking_id, fields.remarks,
                existing.rows[0].id,
            ]);
            return res.json(result.rows[0]);
        }
        const result = await query(`INSERT INTO procurement_details
         (purchase_request_id, approved_cost, vendor_contact, po_number, order_date, expected_delivery_date, dispatch_date, tracking_id, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`, [
            req.params.id, fields.approved_cost, fields.vendor_contact, fields.po_number, fields.order_date,
            fields.expected_delivery_date, fields.dispatch_date, fields.tracking_id, fields.remarks,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/leave-requests/:id/approve', authenticate, requirePermission('approve_leaves'), async (req, res) => {
    try {
        const result = await query(`UPDATE leave_requests
       SET status = 'approved', approved_by = $1, approved_at = now(), admin_remarks = NULL
       WHERE id = $2
       RETURNING *`, [req.user.id, req.params.id]);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/leave-requests/:id/reject', authenticate, requirePermission('approve_leaves'), async (req, res) => {
    try {
        const result = await query(`UPDATE leave_requests
       SET status = 'rejected', approved_by = $1, approved_at = now(), admin_remarks = $2
       WHERE id = $3
       RETURNING *`, [req.user.id, req.body.admin_remarks || null, req.params.id]);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- Admin Reports ---
router.get('/reports/:type', authenticate, requirePermission('view_reports'), async (req, res) => {
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
          SELECT i.*, f.name as facility_name, f.project_code as facility_project_code,
                 up.full_name as assigned_to_name, up.email as assigned_to_email
          FROM inventory_items i
          LEFT JOIN facilities f ON f.id = i.facility_id
          LEFT JOIN user_profiles up ON up.id = i.assigned_to_user_id
          ORDER BY i.classification, i.item_name`);
                break;
            case 'inventory-requests':
            case 'inventory-transactions':
                result = await query(`
          SELECT 
            ir.*,
            ii.item_name, ii.category, ii.classification, ii.asset_tag, ii.serial_number, ii.location,
            ii.po_number, ii.vendor_name, ii.purchased_by,
            f.name as facility_name,
            req_u.full_name as requester_name, req_u.email as requester_email,
            app_u.full_name as approver_name,
            iss_u.full_name as issuer_name,
            rec_u.full_name as receiver_name
          FROM inventory_requests ir
          JOIN inventory_items ii ON ii.id = ir.inventory_item_id
          LEFT JOIN facilities f ON f.id = ii.facility_id
          JOIN user_profiles req_u ON req_u.id = ir.requested_by
          LEFT JOIN user_profiles app_u ON app_u.id = ir.approved_by
          LEFT JOIN user_profiles iss_u ON iss_u.id = ir.issued_by
          LEFT JOIN user_profiles rec_u ON rec_u.id = ir.received_by
          ORDER BY ir.created_at DESC`);
                break;
            case 'inventory-consumables':
                result = await query(`
          SELECT 
            ir.*,
            ii.item_name, ii.category, ii.classification, ii.quantity as current_stock, ii.location,
            ii.po_number, ii.vendor_name,
            req_u.full_name as requester_name,
            iss_u.full_name as issuer_name
          FROM inventory_requests ir
          JOIN inventory_items ii ON ii.id = ir.inventory_item_id
          JOIN user_profiles req_u ON req_u.id = ir.requested_by
          LEFT JOIN user_profiles iss_u ON iss_u.id = ir.issued_by
          WHERE ii.classification = 'Consumables' OR ir.is_returnable = false
          ORDER BY ir.issue_date DESC NULLS LAST, ir.created_at DESC`);
                break;
            case 'inventory-equipment':
                result = await query(`
          SELECT 
            ii.*,
            f.name as facility_name, f.project_code as facility_project_code,
            up.full_name as assigned_to_name, up.email as assigned_to_email,
            ir.id as active_request_id, ir.expected_return_date, ir.issue_date
          FROM inventory_items ii
          LEFT JOIN facilities f ON f.id = ii.facility_id
          LEFT JOIN user_profiles up ON up.id = ii.assigned_to_user_id
          LEFT JOIN inventory_requests ir ON ir.inventory_item_id = ii.id AND ir.status IN ('issued', 'overdue')
          WHERE ii.classification = 'Equipment'
          ORDER BY ii.item_name`);
                break;
            case 'inventory-returns':
                result = await query(`
          SELECT 
            ir.*,
            ii.item_name, ii.asset_tag, ii.serial_number, ii.classification,
            req_u.full_name as requester_name,
            rec_u.full_name as received_by_name
          FROM inventory_requests ir
          JOIN inventory_items ii ON ii.id = ir.inventory_item_id
          JOIN user_profiles req_u ON req_u.id = ir.requested_by
          LEFT JOIN user_profiles rec_u ON rec_u.id = ir.received_by
          WHERE ir.status = 'returned'
          ORDER BY ir.actual_return_date DESC`);
                break;
            case 'inventory-overdue':
                result = await query(`
          SELECT 
            ir.*,
            ii.item_name, ii.asset_tag, ii.serial_number,
            f.name as facility_name,
            req_u.full_name as requester_name, req_u.email as requester_email
          FROM inventory_requests ir
          JOIN inventory_items ii ON ii.id = ir.inventory_item_id
          LEFT JOIN facilities f ON f.id = ii.facility_id
          JOIN user_profiles req_u ON req_u.id = ir.requested_by
          WHERE ir.is_returnable = true AND (ir.status = 'overdue' OR (ir.status = 'issued' AND ir.expected_return_date < CURRENT_DATE))
          ORDER BY ir.expected_return_date ASC`);
                break;
            case 'facility-equipment':
                result = await query(`
          SELECT 
            f.id as facility_id, f.name as facility_name, f.location as facility_location,
            f.project_code, f.funded_by,
            ii.id as item_id, ii.item_name, ii.asset_tag, ii.serial_number, ii.classification, ii.status as item_status,
            up.full_name as assigned_to_name
          FROM facilities f
          JOIN inventory_items ii ON ii.facility_id = f.id
          LEFT JOIN user_profiles up ON up.id = ii.assigned_to_user_id
          ORDER BY f.name, ii.item_name`);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// --- Admin Work Overview ---
router.get('/work/overview', authenticate, requirePermission('view_work'), async (req, res) => {
    try {
        await syncOverdueMilestones();
        let sql = `
      SELECT
        aw.id AS work_id,
        aw.*,
        up.full_name as user_name,
        up.department,
        (SELECT completion_percentage FROM progress_updates
         WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1) as completion_percentage,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM work_milestones wm
            WHERE wm.work_id = aw.id
              AND wm.status = 'delayed'
              AND (wm.justification_status IS NULL OR wm.justification_status != 'approved')
          ) THEN 'delayed'
          ELSE COALESCE(
            (SELECT status FROM progress_updates WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1),
            'not_started'
          )
        END as latest_status,
        (
          SELECT COUNT(*)::int FROM work_milestones wm
          WHERE wm.work_id = aw.id
            AND wm.status = 'delayed'
            AND (wm.justification_status IS NULL OR wm.justification_status != 'approved')
        ) as unapproved_delayed_milestones_count,
        (SELECT COUNT(*) FROM work_problems
         WHERE work_id = aw.id AND status IN ('open','in_progress'))::int as open_problems_count,
        (SELECT COUNT(*)::int FROM milestone_change_requests WHERE work_id = aw.id AND status = 'pending') AS pending_milestone_requests_count,
        (SELECT COUNT(*)::int FROM work_dependencies wd JOIN assigned_works dep ON dep.id = wd.depends_on_work_id WHERE wd.work_id = aw.id AND dep.priority = 'code_red' AND dep.admin_status NOT IN ('completed', 'approved')) AS blocked_by_code_red_count,
        (SELECT MAX(created_at) FROM progress_updates WHERE work_id = aw.id) as last_updated
      FROM assigned_works aw
      LEFT JOIN user_profiles up ON up.id = aw.user_id`;
        const params = [];
        const conditions = [];
        const canReadAll = req.user.permissions.has('manage_work_cycles') || req.user.permissions.has('manage_users');
        if (!canReadAll) {
            params.push(req.user.id);
            conditions.push(`aw.user_id = $${params.length}`);
        }
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY up.full_name, aw.project_name';
        const result = await query(sql, params);
        const workData = result.rows.map((row) => {
            const lastUpdated = row.last_updated ? new Date(row.last_updated) : null;
            const daysSinceUpdate = lastUpdated
                ? Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
                : 999;
            return {
                ...row,
                days_since_update: daysSinceUpdate,
                completion_percentage: Number(row.completion_percentage || 0),
                pending_milestone_requests_count: Number(row.pending_milestone_requests_count || 0),
                blocked_by_code_red_count: Number(row.blocked_by_code_red_count || 0),
                unapproved_delayed_milestones_count: Number(row.unapproved_delayed_milestones_count || 0),
            };
        });
        const usersResult = await query('SELECT id, full_name, department FROM user_profiles ORDER BY full_name');
        const usersWithWork = new Set(workData.map((row) => row.user_id));
        const usersWithoutWork = usersResult.rows.filter((user) => !usersWithWork.has(user.id));
        const myProfile = await query('SELECT full_name FROM user_profiles WHERE id = $1', [req.user.id]);
        const myFullName = myProfile.rows[0]?.full_name;
        const myWorkRows = workData.filter((row) => row.user_id === req.user.id || (myFullName && row.assigned_by === myFullName));
        const myWorkSummary = {
            totalWorks: myWorkRows.length,
            avgCompletion: myWorkRows.length
                ? Math.round(myWorkRows.reduce((sum, row) => sum + Number(row.completion_percentage || 0), 0) / myWorkRows.length)
                : 0,
            openProblems: myWorkRows.reduce((sum, row) => sum + Number(row.open_problems_count || 0), 0),
        };
        const highImpactProblemsResult = await query(`SELECT COUNT(*)::int AS count
       FROM work_problems wp
       JOIN assigned_works aw ON aw.id = wp.work_id
       WHERE wp.severity = 'high'
         AND wp.status IN ('open', 'in_progress')
         ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}`, params);
        const supportRequestsResult = await query(`SELECT
         COALESCE(ma.support_required_from, 'unspecified') AS support_required_from,
         COUNT(*)::int AS count
       FROM mitigation_actions ma
       JOIN work_problems wp ON wp.id = ma.problem_id
       JOIN assigned_works aw ON aw.id = wp.work_id
       ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
       GROUP BY COALESCE(ma.support_required_from, 'unspecified')`, params);
        const openSupportRequests = {
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
        // Pending milestone change requests for admin review
        const pendingMilestoneRequestsResult = await query(`SELECT mcr.*,
              aw.work_title,
              aw.issue_key,
              aw.project_name,
              up.full_name as requester_name,
              up.email as requester_email,
              up.department as requester_department
       FROM milestone_change_requests mcr
       JOIN assigned_works aw ON aw.id = mcr.work_id
       JOIN user_profiles up ON up.id = mcr.requested_by
       WHERE mcr.status = 'pending'
       ORDER BY mcr.created_at ASC`);
        // Active Code-Red works
        const activeCodeRedResult = await query(`SELECT aw.id, aw.issue_key, aw.work_title, aw.priority, aw.issue_type,
              aw.code_red_activated_at, aw.start_date, aw.end_date, aw.admin_status,
              up.full_name as user_name, up.email as user_email
       FROM assigned_works aw
       JOIN user_profiles up ON up.id = aw.user_id
       WHERE aw.priority = 'code_red' AND aw.admin_status NOT IN ('completed', 'approved')
       ORDER BY aw.code_red_activated_at DESC`);
        res.json({
            workData,
            usersWithoutWork,
            myWorkSummary,
            pendingMilestoneRequests: pendingMilestoneRequestsResult.rows,
            activeCodeRedWorks: activeCodeRedResult.rows,
            statistics: {
                totalUsers: usersResult.rows.length,
                usersWithWork: usersWithWork.size,
                usersWithoutWork: usersWithoutWork.length,
                delayedWorkCount: workData.filter((row) => row.latest_status === 'delayed' || Number(row.unapproved_delayed_milestones_count || 0) > 0).length,
                highImpactProblemsCount: highImpactProblemsResult.rows[0]?.count || 0,
                openSupportRequests,
                codeRedCount: activeCodeRedResult.rows.length,
                pendingMilestoneRequestsCount: pendingMilestoneRequestsResult.rows.length,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.get('/work/:id/comments', authenticate, requirePermission('view_work'), async (req, res) => {
    try {
        const result = await query(`SELECT
         ac.id,
         ac.comment AS comment_text,
         ac.created_at,
         ac.commented_by AS admin_id,
         json_build_object('full_name', up.full_name) AS user_profiles
       FROM admin_comments ac
       LEFT JOIN user_profiles up ON up.id = ac.commented_by
       WHERE ac.work_id = $1
       ORDER BY ac.created_at DESC`, [req.params.id]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/work/:id/comments', authenticate, requirePermission('create_work'), async (req, res) => {
    try {
        const comment = req.body.comment_text || req.body.comment;
        const result = await query(`INSERT INTO admin_comments (work_id, comment, commented_by)
       VALUES ($1,$2,$3)
       RETURNING *`, [req.params.id, comment, req.user.id]);
        // Send notifications to assignee, supervisor, and admins
        await notifyWorkComment(req.params.id, req.user.id, comment);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/work/:id/status', authenticate, requirePermission('edit_work'), async (req, res) => {
    try {
        const result = await query(`UPDATE assigned_works
       SET admin_status = $1
       WHERE id = $2
       RETURNING *`, [req.body.admin_status, req.params.id]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
