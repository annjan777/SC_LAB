import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { logAuditEvent } from '../services/auditLogger.js';

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
    defaultOrder,
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
      const params: any[] = [];
      const conditions: string[] = [];

      // Non-admins without blanket read permission only see their own rows (if the table supports ownership)
      if (!canReadAll) {
        if (safeOwnerCol) {
          conditions.push(`"${safeOwnerCol}" = $${params.length + 1}`);
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
          conditions.push(`"${safeKey}" = $${params.length + 1}`);
          params.push(val);
        }
      }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');

      let safeOrder = safeDefaultOrder;
      if (typeof req.query.order === 'string' && req.query.order.trim()) {
        safeOrder = sanitizeIdentifier(req.query.order.trim());
      }
      const asc = req.query.ascending === 'true' ? 'ASC' : 'DESC';
      sql += ` ORDER BY "${safeOrder}" ${asc}`;

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
        let countSql = `SELECT COUNT(*) FROM ${safeTable}`;
        if (conditions.length > 0) countSql += ' WHERE ' + conditions.join(' AND ');
        const countResult = await query(countSql, params);
        return res.json({ count: parseInt(countResult.rows[0].count, 10) });
      }

      const result = await query(sql, params);
      res.json(result.rows);
    } catch (err: any) {
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET - single
  router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const result = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const row = result.rows[0];
      const isOwner = safeOwnerCol ? row[safeOwnerCol] === req.user!.id : false;
      const canReadAll = hasPerm(req, readPermission);
      if (!isOwner && !canReadAll && (readPermission || !safeOwnerCol)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      res.json(row);
    } catch (err: any) {
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  if (readOnly) return router;

  // POST - create
  router.post('/', authenticate, async (req: Request, res: Response) => {
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
      await logAuditEvent({
        userId: req.user?.id,
        action: 'CREATE',
        entityType: table,
        entityId: newRow?.id,
        newValue: newRow,
      });

      res.status(201).json(newRow);
    } catch (err: any) {
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // PUT - update
  router.put('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const existing = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const isOwner = safeOwnerCol ? existing.rows[0][safeOwnerCol] === req.user!.id : false;
      const hasManagerPerm = hasPerm(req, updatePermission);
      if (!isOwner && !hasManagerPerm) {
        return res.status(403).json({ error: 'Insufficient permissions' });
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
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // DELETE
  router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const existing = await query(`SELECT * FROM ${safeTable} WHERE id = $1`, [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const isOwner = safeOwnerCol ? existing.rows[0][safeOwnerCol] === req.user!.id : false;
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
    } catch (err: any) {
      console.error(err); res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}
