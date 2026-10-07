import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { logAuditEvent } from '../services/auditLogger.js';
import { createNotification } from '../services/notificationService.js';
import { sendEquipmentReturnReminderEmail } from '../utils/email.js';

interface CrudOptions {
  table: string;
  ownerCol?: string;         // e.g. 'requested_by' - users can only see/edit/delete their own unless admin or granted permission
  adminOnly?: boolean;       // entire router restricted to admins
  readOnly?: boolean;        // disables POST/PUT/DELETE entirely (e.g. audit_logs)
  readPermission?: string;   // permission required to read rows that aren't the user's own
  createPermission?: string; // permission required to create (in addition to/instead of owning)
  updatePermission?: string; // permission required to update rows that aren't the user's own
  deletePermission?: string; // permission required to delete rows that aren't the user's own (falls back to updatePermission)
  defaultOrder?: string;
  ownerWrite?: boolean;      // when false, owning a row does NOT grant create/update/delete (manager permission required)
}

// Records an owner may still change/delete only while undecided
const OWNER_EDITABLE_STATUSES: Record<string, string[]> = {
  purchase_requests: ['draft', 'submitted'],
  leave_requests: ['pending'],
};

// Tables whose list/detail responses carry the requester's profile (the UI renders requester name/department)
const PROFILE_JOIN: Record<string, string> = {
  purchase_requests: 'requested_by',
  leave_requests: 'requested_by',
};

function isValidDateString(v: any): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
  return !isNaN(new Date(v.slice(0, 10)).getTime());
}

function nonNegativeNumber(v: any): boolean {
  if (v === undefined || v === null || v === '') return true;
  const n = Number(v);
  return !isNaN(n) && n >= 0;
}

// Field-level validation shared by create and update. Returns an error message or null.
async function validateEntity(table: string, fields: Record<string, any>, existing: any | null, userId: string): Promise<string | null> {
  if (table === 'purchase_requests') {
    if (fields.quantity !== undefined) {
      const q = Number(fields.quantity);
      if (!Number.isInteger(q) || q <= 0) return 'Quantity must be a whole number greater than 0';
    }
    for (const k of ['estimated_cost', 'unit_price', 'total_cost', 'approved_cost']) {
      if (!nonNegativeNumber(fields[k])) return `${k.replace(/_/g, ' ')} cannot be negative`;
    }
  } else if (table === 'inventory_items') {
    if (fields.quantity !== undefined && fields.quantity !== null && fields.quantity !== '') {
      const q = Number(fields.quantity);
      if (!Number.isInteger(q) || q < 0) return 'Quantity must be a whole number of 0 or more';
    }
  } else if (table === 'leave_requests') {
    const fromD = fields.from_date ?? existing?.from_date;
    const toD = fields.to_date ?? existing?.to_date;
    const fromS = fromD instanceof Date ? fromD.toISOString().slice(0, 10) : fromD;
    const toS = toD instanceof Date ? toD.toISOString().slice(0, 10) : toD;
    if (fields.from_date !== undefined && !isValidDateString(fromS)) return 'From date is not a valid date (use YYYY-MM-DD)';
    if (fields.to_date !== undefined && !isValidDateString(toS)) return 'To date is not a valid date (use YYYY-MM-DD)';
    if (fromS && toS) {
      if (String(toS).slice(0, 10) < String(fromS).slice(0, 10)) return 'To date cannot be earlier than from date';
      const owner = existing?.requested_by || userId;
      const overlap = await query(
        `SELECT id FROM leave_requests
         WHERE requested_by = $1 AND status IN ('pending','approved')
           AND from_date <= $3::date AND to_date >= $2::date
           AND ($4::uuid IS NULL OR id <> $4::uuid)
         LIMIT 1`,
        [owner, String(fromS).slice(0, 10), String(toS).slice(0, 10), existing?.id || null]
      );
      if (overlap.rows.length > 0) return 'These dates overlap an existing pending or approved leave request';
    }
  }
  return null;
}

function handleDbError(err: any, res: Response) {
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

function hasPerm(req: Request, perm?: string): boolean {
  if (!perm) return false;
  return req.user!.permissions.has(perm);
}

export function createCrudRouter(opts: CrudOptions) {
  const router = Router();
  const {
    table, ownerCol, adminOnly, readOnly,
    readPermission, createPermission, updatePermission, deletePermission,
    defaultOrder, ownerWrite = true,
  } = opts;

  const safeTable = sanitizeIdentifier(table);
  const safeOwnerCol = ownerCol ? sanitizeIdentifier(ownerCol) : undefined;
  const safeDefaultOrder = defaultOrder ? sanitizeIdentifier(defaultOrder) : 'created_at';

  if (adminOnly) {
    router.use(authenticate, (req: Request, res: Response, next) => {
      // For completely admin-only routes (if any), fallback to checking permissions like manage_settings
      if (!hasPerm(req, 'manage_settings') && !hasPerm(req, 'manage_roles')) {
        return res.status(403).json({ error: 'Administrative access required' });
      }
      next();
    });
  }

  // GET - list
  router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
      const canReadAll = hasPerm(req, readPermission);
      let sql = `SELECT * FROM ${safeTable}`;
      if (table === 'inventory_items') {
        sql = `SELECT "${safeTable}".*, f.name AS facility_name, f.location AS facility_location, u.full_name AS assigned_to_name, u.email AS assigned_to_email FROM "${safeTable}" LEFT JOIN facilities f ON f.id = "${safeTable}".facility_id LEFT JOIN user_profiles u ON u.id = "${safeTable}".assigned_to_user_id`;
      } else if (PROFILE_JOIN[table]) {
        const col = sanitizeIdentifier(PROFILE_JOIN[table]);
        sql = `SELECT "${safeTable}".*, json_build_object('full_name', rp.full_name, 'email', rp.email, 'department', rp.department) AS user_profiles FROM "${safeTable}" LEFT JOIN user_profiles rp ON rp.id = "${safeTable}"."${col}"`;
      }
      const params: any[] = [];
      const conditions: string[] = [];

      // Non-admins without blanket read permission only see their own rows (if the table supports ownership)
      if (!canReadAll) {
        if (safeOwnerCol) {
          conditions.push(`"${safeTable}"."${safeOwnerCol}" = $${params.length + 1}`);
          params.push(req.user!.id);
        } else if (readPermission) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      }

      // Support query filters
      for (const [key, val] of Object.entries(req.query)) {
        if (['order', 'ascending', 'limit', 'offset', 'count', 'head'].includes(key)) continue;
        if (typeof val === 'string' && val) {
          const safeKey = sanitizeIdentifier(key);
          conditions.push(`"${safeTable}"."${safeKey}" = $${params.length + 1}`);
          params.push(val);
        }
      }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');

      let safeOrder = safeDefaultOrder;
      if (typeof req.query.order === 'string' && req.query.order.trim()) {
        safeOrder = sanitizeIdentifier(req.query.order.trim());
      }
      const asc = req.query.ascending === 'true' ? 'ASC' : 'DESC';
      sql += ` ORDER BY "${safeTable}"."${safeOrder}" ${asc}`;

      let limit = 100;
      if (req.query.limit) {
        const parsed = parseInt(req.query.limit as string, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) limit = parsed;
      }
      sql += ` LIMIT ${limit}`;

      if (req.query.offset) {
        const offset = parseInt(req.query.offset as string, 10);
        if (!isNaN(offset) && offset > 0) sql += ` OFFSET ${offset}`;
      }

      // If count-only (head mode)
      if (req.query.head === 'true' || req.query.count === 'true') {
        let countSql = `SELECT COUNT(*) FROM ${safeTable} "${safeTable}"`;
        if (conditions.length > 0) countSql += ' WHERE ' + conditions.join(' AND ');
        const countResult = await query(countSql, params);
        return res.json({ count: parseInt(countResult.rows[0].count, 10) });
      }

      const result = await query(sql, params);
      res.json(result.rows);
    } catch (err: any) {
      handleDbError(err, res);
    }
  });

  // GET - single
  router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      let singleSql = `SELECT * FROM ${safeTable} WHERE id = $1`;
      if (PROFILE_JOIN[table]) {
        const col = sanitizeIdentifier(PROFILE_JOIN[table]);
        singleSql = `SELECT "${safeTable}".*, json_build_object('full_name', rp.full_name, 'email', rp.email, 'department', rp.department) AS user_profiles FROM "${safeTable}" LEFT JOIN user_profiles rp ON rp.id = "${safeTable}"."${col}" WHERE "${safeTable}".id = $1`;
      }
      if (table === 'inventory_items') {
        singleSql = `SELECT "${safeTable}".*, f.name AS facility_name, f.location AS facility_location, u.full_name AS assigned_to_name, u.email AS assigned_to_email FROM "${safeTable}" LEFT JOIN facilities f ON f.id = "${safeTable}".facility_id LEFT JOIN user_profiles u ON u.id = "${safeTable}".assigned_to_user_id WHERE "${safeTable}".id = $1`;
      }
      const result = await query(singleSql, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const row = result.rows[0];
      const isOwner = safeOwnerCol ? row[safeOwnerCol] === req.user!.id : false;
      const canReadAll = hasPerm(req, readPermission);
      if (!isOwner && !canReadAll && (readPermission || !safeOwnerCol)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      res.json(row);
    } catch (err: any) {
      handleDbError(err, res);
    }
  });

  if (readOnly) return router;

  // POST - create
  router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
      // Creating always requires the create permission (members get it through their role), so an
      // administrator can switch it off for one user with a per-user revocation.
      if (createPermission && !hasPerm(req, createPermission)) {
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
          fields[safeOwnerCol] = req.user!.id;
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
          } else {
            fields.classification = 'Equipment';
          }
        }
      } else if (table === 'purchase_requests') {
        if (!fields.item_name || (typeof fields.item_name === 'string' && !fields.item_name.trim())) {
          return res.status(400).json({ error: 'Item name is required' });
        }
        if (!fields.category || (typeof fields.category === 'string' && !fields.category.trim())) {
          return res.status(400).json({ error: 'Category is required' });
        }
      } else if (table === 'leave_requests') {
        if (!fields.leave_type || (typeof fields.leave_type === 'string' && !fields.leave_type.trim())) {
          return res.status(400).json({ error: 'Leave type is required' });
        }
        if (typeof fields.leave_type === 'string') {
          const lt = fields.leave_type.trim().toLowerCase();
          if (['casual', 'medical', 'academic'].includes(lt)) {
            fields.leave_type = lt;
          } else if (lt.includes('casual')) {
            fields.leave_type = 'casual';
          } else if (lt.includes('med') || lt.includes('sick')) {
            fields.leave_type = 'medical';
          } else if (lt.includes('acad')) {
            fields.leave_type = 'academic';
          } else {
            return res.status(400).json({ error: 'Leave type must be one of: casual, medical, academic' });
          }
        }
        if (!fields.from_date || (typeof fields.from_date === 'string' && !fields.from_date.trim())) {
          return res.status(400).json({ error: 'From date is required' });
        }
        if (!fields.to_date || (typeof fields.to_date === 'string' && !fields.to_date.trim())) {
          return res.status(400).json({ error: 'To date is required' });
        }
        // date validity, order and overlap are checked in validateEntity below
      }

      const entityError = await validateEntity(table, fields, null, req.user!.id);
      if (entityError) return res.status(400).json({ error: entityError });

      const rawKeys = Object.keys(fields);
      if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields provided' });
      const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));

      const placeholders = safeKeys.map((_, i) => `$${i + 1}`);
      const values = rawKeys.map(k => fields[k]);

      const result = await query(
        `INSERT INTO ${safeTable} (${safeKeys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );

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
    } catch (err: any) {
      handleDbError(err, res);
    }
  });

  // PUT - update
  router.put('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const existing = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const isOwner = safeOwnerCol ? existing.rows[0][safeOwnerCol] === req.user!.id : false;
      const hasManagerPerm = hasPerm(req, updatePermission);
      if (!hasManagerPerm && (!isOwner || !ownerWrite)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      if (!hasManagerPerm && OWNER_EDITABLE_STATUSES[table] && !OWNER_EDITABLE_STATUSES[table].includes(existing.rows[0].status)) {
        return res.status(403).json({ error: `This request has already been ${existing.rows[0].status} and can no longer be changed` });
      }

      const fields = { ...req.body };
      delete fields.id;
      delete fields.created_at;
      if (safeOwnerCol) delete fields[safeOwnerCol]; // ownership never changes via update

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
      const updateError = await validateEntity(table, fields, existing.rows[0], req.user!.id);
      if (updateError) return res.status(400).json({ error: updateError });

      const rawKeys = Object.keys(fields);
      if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields' });

      const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
      const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      const values = rawKeys.map(k => fields[k]);
      values.push(req.params.id);

      const result = await query(
        `UPDATE ${safeTable} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
        values
      );

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
            const existingReq = await query(
              "SELECT id FROM inventory_requests WHERE inventory_item_id = $1 AND status IN ('issued', 'overdue') ORDER BY created_at DESC LIMIT 1",
              [updatedRow.id]
            );
            if (existingReq.rows.length > 0) {
              await query(
                "UPDATE inventory_requests SET requested_by = $1, is_returnable = true, expected_return_date = $2, issued_by = COALESCE($3, issued_by), updated_at = NOW() WHERE id = $4",
                [newAssignee, expDate, req.user?.id || null, existingReq.rows[0].id]
              );
            } else {
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

        } else if (oldAssignee && !newAssignee) {
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
    } catch (err: any) {
      handleDbError(err, res);
    }
  });

  // DELETE
  router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const existing = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const isOwner = safeOwnerCol ? existing.rows[0][safeOwnerCol] === req.user!.id : false;
      const canDeleteAny = hasPerm(req, deletePermission || updatePermission);
      if (!canDeleteAny && (!isOwner || !ownerWrite)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      if (!canDeleteAny && OWNER_EDITABLE_STATUSES[table] && !OWNER_EDITABLE_STATUSES[table].includes(existing.rows[0].status)) {
        return res.status(403).json({ error: `This request has already been ${existing.rows[0].status} and is kept for the record` });
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
    } catch (err: any) {
      handleDbError(err, res);
    }
  });

  return router;
}
