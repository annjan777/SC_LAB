import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { logAuditEvent } from '../services/auditLogger.js';
function handleDbError(err, res) {
    console.error(err);
    if (err?.code === '23502') {
        return res.status(400).json({ error: `Missing required field: ${err.column || 'mandatory field not provided'}` });
    }
    if (err?.code === '23503') {
        return res.status(400).json({ error: 'Referenced entity does not exist' });
    }
    if (err?.code === '23505') {
        return res.status(409).json({ error: 'A duplicate record already exists' });
    }
    if (err?.code === '22007' || err?.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data format provided' });
    }
    if (err?.code === '23514') {
        return res.status(400).json({ error: `Value violates validation constraint: ${err.constraint || 'check constraint failed'}` });
    }
    res.status(500).json({ error: 'Internal Server Error' });
}
function hasPerm(req, perm) {
    if (!perm)
        return false;
    return req.user.permissions.has(perm);
}
export function createCrudRouter(opts) {
    const router = Router();
    const { table, ownerCol, adminOnly, readOnly, readPermission, createPermission, updatePermission, deletePermission, defaultOrder, } = opts;
    const safeTable = sanitizeIdentifier(table);
    const safeOwnerCol = ownerCol ? sanitizeIdentifier(ownerCol) : undefined;
    const safeDefaultOrder = defaultOrder ? sanitizeIdentifier(defaultOrder) : 'created_at';
    if (adminOnly) {
        router.use(authenticate, (req, res, next) => {
            // For completely admin-only routes (if any), fallback to checking permissions like manage_settings
            if (!hasPerm(req, 'manage_settings') && !hasPerm(req, 'manage_roles')) {
                return res.status(403).json({ error: 'Administrative access required' });
            }
            next();
        });
    }
    // GET - list
    router.get('/', authenticate, async (req, res) => {
        try {
            const canReadAll = hasPerm(req, readPermission);
            let sql = `SELECT * FROM ${safeTable}`;
            if (table === 'inventory_items') {
                sql = `SELECT "${safeTable}".*, f.name AS facility_name, f.location AS facility_location, u.full_name AS assigned_to_name, u.email AS assigned_to_email FROM "${safeTable}" LEFT JOIN facilities f ON f.id = "${safeTable}".facility_id LEFT JOIN user_profiles u ON u.id = "${safeTable}".assigned_to_user_id`;
            }
            const params = [];
            const conditions = [];
            // Non-admins without blanket read permission only see their own rows (if the table supports ownership)
            if (!canReadAll) {
                if (safeOwnerCol) {
                    conditions.push(`"${safeTable}"."${safeOwnerCol}" = $${params.length + 1}`);
                    params.push(req.user.id);
                }
                else if (readPermission) {
                    return res.status(403).json({ error: 'Insufficient permissions' });
                }
            }
            // Support query filters
            for (const [key, val] of Object.entries(req.query)) {
                if (['order', 'ascending', 'limit', 'offset', 'count', 'head'].includes(key))
                    continue;
                if (typeof val === 'string' && val) {
                    const safeKey = sanitizeIdentifier(key);
                    conditions.push(`"${safeTable}"."${safeKey}" = $${params.length + 1}`);
                    params.push(val);
                }
            }
            if (conditions.length > 0)
                sql += ' WHERE ' + conditions.join(' AND ');
            let safeOrder = safeDefaultOrder;
            if (typeof req.query.order === 'string' && req.query.order.trim()) {
                safeOrder = sanitizeIdentifier(req.query.order.trim());
            }
            const asc = req.query.ascending === 'true' ? 'ASC' : 'DESC';
            sql += ` ORDER BY "${safeTable}"."${safeOrder}" ${asc}`;
            let limit = 100;
            if (req.query.limit) {
                const parsed = parseInt(req.query.limit, 10);
                if (!isNaN(parsed) && parsed > 0 && parsed <= 1000)
                    limit = parsed;
            }
            sql += ` LIMIT ${limit}`;
            if (req.query.offset) {
                const offset = parseInt(req.query.offset, 10);
                if (!isNaN(offset) && offset > 0)
                    sql += ` OFFSET ${offset}`;
            }
            // If count-only (head mode)
            if (req.query.head === 'true' || req.query.count === 'true') {
                let countSql = `SELECT COUNT(*) FROM ${safeTable} "${safeTable}"`;
                if (conditions.length > 0)
                    countSql += ' WHERE ' + conditions.join(' AND ');
                const countResult = await query(countSql, params);
                return res.json({ count: parseInt(countResult.rows[0].count, 10) });
            }
            const result = await query(sql, params);
            res.json(result.rows);
        }
        catch (err) {
            handleDbError(err, res);
        }
    });
    // GET - single
    router.get('/:id', authenticate, async (req, res) => {
        try {
            let singleSql = `SELECT * FROM ${safeTable} WHERE id = $1`;
            if (table === 'inventory_items') {
                singleSql = `SELECT "${safeTable}".*, f.name AS facility_name, f.location AS facility_location, u.full_name AS assigned_to_name, u.email AS assigned_to_email FROM "${safeTable}" LEFT JOIN facilities f ON f.id = "${safeTable}".facility_id LEFT JOIN user_profiles u ON u.id = "${safeTable}".assigned_to_user_id WHERE "${safeTable}".id = $1`;
            }
            const result = await query(singleSql, [req.params.id]);
            if (result.rows.length === 0)
                return res.status(404).json({ error: 'Not found' });
            const row = result.rows[0];
            const isOwner = safeOwnerCol ? row[safeOwnerCol] === req.user.id : false;
            const canReadAll = hasPerm(req, readPermission);
            if (!isOwner && !canReadAll && (readPermission || !safeOwnerCol)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            res.json(row);
        }
        catch (err) {
            handleDbError(err, res);
        }
    });
    if (readOnly)
        return router;
    // POST - create
    router.post('/', authenticate, async (req, res) => {
        try {
            // Owner-scoped resources are self-service by default; blanket permissions
            // widen access beyond the caller's own rows.
            if (createPermission && !hasPerm(req, createPermission) && !safeOwnerCol) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            const fields = { ...req.body };
            delete fields.id;
            delete fields.created_at;
            delete fields.updated_at;
            // Force ownership to the requesting user to prevent spoofing another user's records.
            // If the user has updatePermission (manager), they can spoof if they explicitly provide the field.
            // Otherwise, it defaults to their own ID.
            if (safeOwnerCol) {
                if (!hasPerm(req, updatePermission) || fields[safeOwnerCol] === undefined) {
                    fields[safeOwnerCol] = req.user.id;
                }
            }
            // Prevent mass assignment: non-managers cannot set system-controlled fields
            const hasManagerPerm = hasPerm(req, updatePermission);
            if (!hasManagerPerm) {
                const systemFields = ['approved_by', 'approved_at', 'admin_remarks', 'rejection_reason', 'admin_status', 'admin_feedback'];
                for (const sysField of systemFields) {
                    delete fields[sysField];
                }
                if (fields.status && !['draft', 'submitted'].includes(fields.status)) {
                    delete fields.status;
                }
            }
            // Explicit Entity Validations:
            if (table === 'inventory_items') {
                if (!fields.location || (typeof fields.location === 'string' && !fields.location.trim())) {
                    return res.status(400).json({ error: 'Location is mandatory' });
                }
                if (!fields.classification) {
                    const cat = (fields.category || '').toLowerCase();
                    if (['chemicals', 'consumable', 'consumables'].includes(cat)) {
                        fields.classification = 'Consumables';
                    }
                    else {
                        fields.classification = 'Equipment';
                    }
                }
            }
            else if (table === 'purchase_requests') {
                if (!fields.item_name || (typeof fields.item_name === 'string' && !fields.item_name.trim())) {
                    return res.status(400).json({ error: 'Item name is required' });
                }
                if (!fields.category || (typeof fields.category === 'string' && !fields.category.trim())) {
                    return res.status(400).json({ error: 'Category is required' });
                }
            }
            else if (table === 'leave_requests') {
                if (!fields.leave_type || (typeof fields.leave_type === 'string' && !fields.leave_type.trim())) {
                    return res.status(400).json({ error: 'Leave type is required' });
                }
                if (typeof fields.leave_type === 'string') {
                    const lt = fields.leave_type.trim().toLowerCase();
                    if (['casual', 'medical', 'academic'].includes(lt)) {
                        fields.leave_type = lt;
                    }
                    else if (lt.includes('casual')) {
                        fields.leave_type = 'casual';
                    }
                    else if (lt.includes('med') || lt.includes('sick')) {
                        fields.leave_type = 'medical';
                    }
                    else if (lt.includes('acad')) {
                        fields.leave_type = 'academic';
                    }
                    else {
                        return res.status(400).json({ error: 'Leave type must be one of: casual, medical, academic' });
                    }
                }
                if (!fields.from_date || (typeof fields.from_date === 'string' && !fields.from_date.trim())) {
                    return res.status(400).json({ error: 'From date is required' });
                }
                if (!fields.to_date || (typeof fields.to_date === 'string' && !fields.to_date.trim())) {
                    return res.status(400).json({ error: 'To date is required' });
                }
                if (String(fields.to_date) < String(fields.from_date)) {
                    return res.status(400).json({ error: 'To date cannot be earlier than from date' });
                }
            }
            const rawKeys = Object.keys(fields);
            if (rawKeys.length === 0)
                return res.status(400).json({ error: 'No fields provided' });
            const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
            const placeholders = safeKeys.map((_, i) => `$${i + 1}`);
            const values = rawKeys.map(k => fields[k]);
            const result = await query(`INSERT INTO ${safeTable} (${safeKeys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, values);
            const newRow = result.rows[0];
            if (table === 'inventory_items' && 'facility_id' in fields) {
                await query('DELETE FROM facility_equipment WHERE inventory_item_id = $1', [newRow.id]);
                if (fields.facility_id) {
                    await query('INSERT INTO facility_equipment (facility_id, inventory_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fields.facility_id, newRow.id]);
                }
            }
            // Handle direct item assignment on creation (catalog tracking only - no notification spam)
            if (table === 'inventory_items' && newRow.assigned_to_user_id) {
                const isReturnable = newRow.is_returnable === true || newRow.is_returnable === 'true';
                const expDate = isReturnable && newRow.expected_return_date ? String(newRow.expected_return_date).split('T')[0] : null;
                await query("UPDATE inventory_items SET status = 'assigned' WHERE id = $1", [newRow.id]);
                if (isReturnable && expDate) {
                    await query(`
            INSERT INTO inventory_requests (
              inventory_item_id, requested_by, quantity, purpose, status,
              issued_by, issue_date, is_returnable, expected_return_date, remarks
            ) VALUES ($1, $2, 1, 'Assigned upon item catalog creation', 'issued', $3, NOW(), true, $4, 'Direct assignment')
          `, [
                        newRow.id,
                        newRow.assigned_to_user_id,
                        req.user?.id || null,
                        expDate,
                    ]);
                }
                // No notifications or emails sent on adding a new catalog item
            }
            await logAuditEvent({
                userId: req.user?.id,
                action: 'CREATE',
                entityType: table,
                entityId: newRow?.id,
                newValue: newRow,
            });
            res.status(201).json(newRow);
        }
        catch (err) {
            handleDbError(err, res);
        }
    });
    // PUT - update
    router.put('/:id', authenticate, async (req, res) => {
        try {
            const existing = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
            if (existing.rows.length === 0)
                return res.status(404).json({ error: 'Not found' });
            const isOwner = safeOwnerCol ? existing.rows[0][safeOwnerCol] === req.user.id : false;
            const hasManagerPerm = hasPerm(req, updatePermission);
            if (!isOwner && !hasManagerPerm) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            const fields = { ...req.body };
            delete fields.id;
            delete fields.created_at;
            if (safeOwnerCol)
                delete fields[safeOwnerCol]; // ownership never changes via update
            // Prevent mass assignment: non-managers cannot set system-controlled fields
            if (!hasManagerPerm) {
                const systemFields = ['approved_by', 'approved_at', 'admin_remarks', 'rejection_reason', 'admin_status', 'admin_feedback'];
                for (const sysField of systemFields) {
                    delete fields[sysField];
                }
                if (fields.status && !['draft', 'submitted'].includes(fields.status)) {
                    delete fields.status;
                }
            }
            if (table === 'inventory_items' && 'location' in fields) {
                if (!fields.location || (typeof fields.location === 'string' && !fields.location.trim())) {
                    return res.status(400).json({ error: 'Location is mandatory' });
                }
            }
            else if (table === 'leave_requests') {
                const fromD = fields.from_date || existing.rows[0].from_date;
                const toD = fields.to_date || existing.rows[0].to_date;
                if (fromD && toD && String(toD) < String(fromD)) {
                    return res.status(400).json({ error: 'To date cannot be earlier than from date' });
                }
            }
            const rawKeys = Object.keys(fields);
            if (rawKeys.length === 0)
                return res.status(400).json({ error: 'No fields' });
            const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
            const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
            const values = rawKeys.map(k => fields[k]);
            values.push(req.params.id);
            const result = await query(`UPDATE ${safeTable} SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
            const updatedRow = result.rows[0];
            if (table === 'inventory_items' && 'facility_id' in fields) {
                await query('DELETE FROM facility_equipment WHERE inventory_item_id = $1', [updatedRow.id]);
                if (fields.facility_id) {
                    await query('INSERT INTO facility_equipment (facility_id, inventory_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fields.facility_id, updatedRow.id]);
                }
            }
            // Handle direct assignment changes on update
            if (table === 'inventory_items') {
                const oldAssignee = existing.rows[0].assigned_to_user_id;
                const newAssignee = updatedRow.assigned_to_user_id;
                if (newAssignee && (newAssignee !== oldAssignee || updatedRow.expected_return_date !== existing.rows[0].expected_return_date)) {
                    const isReturnable = updatedRow.is_returnable === true || updatedRow.is_returnable === 'true';
                    const expDate = isReturnable && updatedRow.expected_return_date ? String(updatedRow.expected_return_date).split('T')[0] : null;
                    await query("UPDATE inventory_items SET status = 'assigned' WHERE id = $1", [updatedRow.id]);
                    if (isReturnable && expDate) {
                        const existingReq = await query("SELECT id FROM inventory_requests WHERE inventory_item_id = $1 AND status IN ('issued', 'overdue') ORDER BY created_at DESC LIMIT 1", [updatedRow.id]);
                        if (existingReq.rows.length > 0) {
                            await query("UPDATE inventory_requests SET requested_by = $1, is_returnable = true, expected_return_date = $2, issued_by = COALESCE($3, issued_by), updated_at = NOW() WHERE id = $4", [newAssignee, expDate, req.user?.id || null, existingReq.rows[0].id]);
                        }
                        else {
                            await query(`
                INSERT INTO inventory_requests (
                  inventory_item_id, requested_by, quantity, purpose, status,
                  issued_by, issue_date, is_returnable, expected_return_date, remarks
                ) VALUES ($1, $2, 1, 'Assigned via inventory catalog update', 'issued', $3, NOW(), true, $4, 'Direct assignment')
              `, [
                                updatedRow.id,
                                newAssignee,
                                req.user?.id || null,
                                expDate,
                            ]);
                        }
                    }
                }
                else if (oldAssignee && !newAssignee) {
                    // Unassigned
                    await query("UPDATE inventory_items SET status = 'available', is_returnable = false, expected_return_date = NULL WHERE id = $1", [updatedRow.id]);
                    await query("UPDATE inventory_requests SET status = 'returned', return_date = NOW() WHERE inventory_item_id = $1 AND status IN ('issued', 'overdue')", [updatedRow.id]);
                }
            }
            await logAuditEvent({
                userId: req.user?.id,
                action: 'UPDATE',
                entityType: table,
                entityId: updatedRow?.id,
                oldValue: existing.rows[0],
                newValue: updatedRow,
            });
            res.json(updatedRow);
        }
        catch (err) {
            handleDbError(err, res);
        }
    });
    // DELETE
    router.delete('/:id', authenticate, async (req, res) => {
        try {
            const existing = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
            if (existing.rows.length === 0)
                return res.status(404).json({ error: 'Not found' });
            const isOwner = safeOwnerCol ? existing.rows[0][safeOwnerCol] === req.user.id : false;
            if (!isOwner && !hasPerm(req, deletePermission || updatePermission)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            await query(`DELETE FROM ${safeTable} WHERE id = $1`, [req.params.id]);
            await logAuditEvent({
                userId: req.user?.id,
                action: 'DELETE',
                entityType: table,
                entityId: existing.rows[0]?.id,
                oldValue: existing.rows[0],
            });
            res.json({ message: 'Deleted' });
        }
        catch (err) {
            handleDbError(err, res);
        }
    });
    return router;
}
