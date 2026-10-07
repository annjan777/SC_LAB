import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, transaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

function resolveSafePath(baseDir: string, relativePath: string): string | null {
  const safePath = path.resolve(baseDir, relativePath);
  if (!safePath.startsWith(baseDir)) {
    return null;
  }
  return safePath;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, 'facility-images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + safeOriginal);
  },
});
const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXT.includes(ext) || !ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return cb(Object.assign(new Error('Facility image must be a JPG, PNG, WebP or GIF file'), { statusCode: 400 }));
    }
    cb(null, true);
  },
});

// Numeric limits and unique names, shared by create and update. Returns an error message or null.
async function validateFacilityFields(fields: Record<string, any>, currentId: string | null): Promise<string | null> {
  for (const k of ['max_booking_hours', 'capacity']) {
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== '') {
      const n = Number(fields[k]);
      if (isNaN(n) || n < 0) return `${k.replace(/_/g, ' ')} cannot be negative`;
    }
  }
  if (fields.name) {
    const dup = await query('SELECT id FROM facilities WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1', [String(fields.name), currentId]);
    if (dup.rows.length > 0) return 'A facility with this name already exists';
  }
  return null;
}

const router = Router();

const ALLOWED_COLUMNS = new Set([
  'name',
  'description',
  'location',
  'status',
  'responsible_person_id',
  'assigned_to_user_id',
  'image_url',
  'category',
  'model_number',
  'make_model',
  'manufacturer',
  'vendor_name',
  'vendor_contact',
  'installation_date',
  'last_maintenance_date',
  'next_maintenance_date',
  'warranty_end_date',
  'specifications',
  'usage_guidelines',
  'safety_requirements',
  'booking_required',
  'max_booking_hours',
  'serial_number',
  'asset_tag',
  'user_manual_url',
  'capacity',
  'features',
  'project_code',
  'funded_by'
]);

function cleanFacilityFields(input: Record<string, any>) {
  const fields: Record<string, any> = {};

  for (const [key, rawVal] of Object.entries(input)) {
    if (!ALLOWED_COLUMNS.has(key)) continue;

    let val = rawVal;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
        val = null;
      } else {
        val = trimmed;
      }
    }

    if (key === 'specifications') {
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch {
          val = { details: val };
        }
      } else if (!val || typeof val !== 'object') {
        val = {};
      }
    } else if (key === 'booking_required') {
      if (typeof val === 'string') {
        val = val === 'true';
      } else {
        val = Boolean(val);
      }
    } else if (key === 'max_booking_hours') {
      if (val !== null && val !== undefined) {
        const num = parseInt(val, 10);
        val = isNaN(num) ? null : num;
      }
    } else if (key === 'capacity') {
      if (val !== null && val !== undefined) {
        const num = parseInt(val, 10);
        val = isNaN(num) ? null : num;
      }
    } else if (key === 'features') {
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch {
          val = val.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(val)) {
        val = [];
      }
    }

    fields[key] = val;
  }

  // Bidirectional sync between alias columns:
  // 1. assigned_to_user_id <-> responsible_person_id
  if (fields.assigned_to_user_id !== undefined) {
    fields.responsible_person_id = fields.assigned_to_user_id;
  } else if (fields.responsible_person_id !== undefined) {
    fields.assigned_to_user_id = fields.responsible_person_id;
  }

  // 2. make_model <-> model_number
  if (fields.make_model !== undefined) {
    fields.model_number = fields.make_model;
  } else if (fields.model_number !== undefined) {
    fields.make_model = fields.model_number;
  }

  // 3. vendor_name <-> manufacturer
  if (fields.vendor_name !== undefined) {
    fields.manufacturer = fields.vendor_name;
  } else if (fields.manufacturer !== undefined) {
    fields.vendor_name = fields.manufacturer;
  }

  return fields;
}

async function getFacilityById(id: string) {
  const result = await query(
    `SELECT f.*,
            COALESCE(f.assigned_to_user_id, f.responsible_person_id) as assigned_to_user_id,
            COALESCE(f.make_model, f.model_number) as make_model,
            COALESCE(f.vendor_name, f.manufacturer) as vendor_name,
            up.full_name as responsible_person_name,
            CASE
              WHEN up.id IS NOT NULL THEN
                json_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email)
              ELSE NULL
            END as assigned_user,
            COALESCE(
              (SELECT json_agg(json_build_object(
                'id', ii.id,
                'item_name', ii.item_name,
                'category', ii.category,
                'serial_number', ii.serial_number,
                'asset_tag', ii.asset_tag,
                'condition', ii.condition,
                'quantity', ii.quantity
              ))
              FROM (
                SELECT DISTINCT ii.*
                FROM inventory_items ii
                LEFT JOIN facility_equipment fe ON fe.inventory_item_id = ii.id
                WHERE fe.facility_id = f.id OR ii.facility_id = f.id
              ) ii),
              '[]'::json
            ) as linked_equipment,
            (
              SELECT COUNT(DISTINCT ii.id)
              FROM inventory_items ii
              LEFT JOIN facility_equipment fe ON fe.inventory_item_id = ii.id
              WHERE fe.facility_id = f.id OR ii.facility_id = f.id
            ) as linked_equipment_count,
            (
              SELECT COUNT(*)
              FROM facility_bookings fb
              WHERE fb.facility_id = f.id
                AND fb.status = 'confirmed'
                AND fb.end_time >= NOW()
            ) as upcoming_bookings_count
     FROM facilities f
     LEFT JOIN user_profiles up ON up.id = COALESCE(f.assigned_to_user_id, f.responsible_person_id)
     WHERE f.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// GET /api/facilities
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT f.*,
              COALESCE(f.assigned_to_user_id, f.responsible_person_id) as assigned_to_user_id,
              COALESCE(f.make_model, f.model_number) as make_model,
              COALESCE(f.vendor_name, f.manufacturer) as vendor_name,
              up.full_name as responsible_person_name,
              CASE
                WHEN up.id IS NOT NULL THEN
                  json_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email)
                ELSE NULL
              END as assigned_user,
              (
                SELECT COUNT(DISTINCT ii.id)
                FROM inventory_items ii
                LEFT JOIN facility_equipment fe ON fe.inventory_item_id = ii.id
                WHERE fe.facility_id = f.id OR ii.facility_id = f.id
              ) as linked_equipment_count,
              (
                SELECT COUNT(*)
                FROM facility_bookings fb
                WHERE fb.facility_id = f.id
                  AND fb.status = 'confirmed'
                  AND fb.end_time >= NOW()
              ) as upcoming_bookings_count
       FROM facilities f
       LEFT JOIN user_profiles up ON up.id = COALESCE(f.assigned_to_user_id, f.responsible_person_id)
       ORDER BY f.name`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching facilities:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/facilities/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const facility = await getFacilityById(req.params.id);
    if (!facility) return res.status(404).json({ error: 'Not found' });
    res.json(facility);
  } catch (err: any) {
    console.error('Error fetching facility by id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/facilities/:id/equipment - Get all linked inventory equipment
router.get('/:id/equipment', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT ii.*,
              COALESCE(
                (SELECT COUNT(*) FROM equipment_bookings eb WHERE eb.inventory_item_id = ii.id AND eb.status = 'confirmed' AND eb.end_time >= NOW()),
                0
              ) as active_bookings_count
       FROM inventory_items ii
       LEFT JOIN facility_equipment fe ON fe.inventory_item_id = ii.id
       WHERE fe.facility_id = $1 OR ii.facility_id = $1
       ORDER BY ii.item_name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching facility equipment:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/facilities/:id/equipment - Link equipment to facility
router.post('/:id/equipment', authenticate, async (req: Request, res: Response) => {
  try {
    const facilityId = req.params.id;
    const { inventory_item_id, inventory_item_ids } = req.body;
    const ids: string[] = inventory_item_ids || (inventory_item_id ? [inventory_item_id] : []);

    if (ids.length === 0) {
      return res.status(400).json({ error: 'At least one inventory_item_id is required' });
    }

    for (const itemId of ids) {
      await query(
        `INSERT INTO facility_equipment (facility_id, inventory_item_id)
         VALUES ($1, $2)
         ON CONFLICT (facility_id, inventory_item_id) DO NOTHING`,
        [facilityId, itemId]
      );
      await query(
        `UPDATE inventory_items SET facility_id = $1 WHERE id = $2`,
        [facilityId, itemId]
      );
    }

    res.json({ message: 'Equipment linked successfully' });
  } catch (err: any) {
    console.error('Error linking facility equipment:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// DELETE /api/facilities/:id/equipment/:itemId - Unlink equipment from facility
router.delete('/:id/equipment/:itemId', authenticate, async (req: Request, res: Response) => {
  try {
    const { id: facilityId, itemId } = req.params;
    await query(
      `DELETE FROM facility_equipment WHERE facility_id = $1 AND inventory_item_id = $2`,
      [facilityId, itemId]
    );
    await query(
      `UPDATE inventory_items SET facility_id = NULL WHERE id = $1 AND facility_id = $2`,
      [itemId, facilityId]
    );
    res.json({ message: 'Equipment unlinked successfully' });
  } catch (err: any) {
    console.error('Error unlinking facility equipment:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/facilities/:id/bookings - Get bookings for facility
router.get('/:id/bookings', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, status, upcoming } = req.query;

    let sql = `
      SELECT fb.*,
             up.full_name as user_name,
             up.email as user_email,
             up.user_role as user_role,
             f.name as facility_name,
             f.location as facility_location
      FROM facility_bookings fb
      JOIN user_profiles up ON up.id = fb.user_id
      JOIN facilities f ON f.id = fb.facility_id
      WHERE fb.facility_id = $1
    `;
    const params: any[] = [id];

    if (status && typeof status === 'string') {
      params.push(status);
      sql += ` AND fb.status = $${params.length}`;
    } else {
      sql += ` AND fb.status = 'confirmed'`;
    }

    if (date && typeof date === 'string') {
      params.push(date);
      sql += ` AND fb.start_time::date = $${params.length}::date`;
    } else if (upcoming === 'true') {
      sql += ` AND fb.end_time >= NOW()`;
    }

    sql += ` ORDER BY fb.start_time ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching facility bookings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/facilities/:id/bookings - Reserve a complete facility (with overlap prevention)
router.post('/:id/bookings', authenticate, async (req: Request, res: Response) => {
  try {
    const facilityId = req.params.id;
    const userId = req.user!.id;
    const { title, purpose, start_time, end_time } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Reservation title or meeting subject is required' });
    }
    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date/time format' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }
    if (startDate.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ error: 'Bookings cannot start in the past' });
    }

    const booking = await transaction(async (client) => {
      // 1. Lock facility row to serialize concurrent booking requests for this facility
      const facilityCheck = await client.query('SELECT * FROM facilities WHERE id = $1 FOR UPDATE', [facilityId]);
      if (facilityCheck.rows.length === 0) {
        throw Object.assign(new Error('Facility not found'), { statusCode: 404 });
      }
      const facility = facilityCheck.rows[0];
      if (['out_of_order', 'decommissioned', 'under_maintenance'].includes(facility.status)) {
        throw Object.assign(new Error(`Cannot book facility: facility is currently ${facility.status.replace(/_/g, ' ')}`), { statusCode: 400 });
      }

      // Check maximum booking hours if configured
      if (facility.max_booking_hours) {
        const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        if (durationHours > facility.max_booking_hours) {
          throw Object.assign(
            new Error(`Booking duration (${durationHours.toFixed(1)} hrs) exceeds maximum allowed limit of ${facility.max_booking_hours} hrs for this facility`),
            { statusCode: 400 }
          );
        }
      }

      // 2. CRITICAL: Prevent double booking and overlapping reservations under lock
      const conflictCheck = await client.query(
        `SELECT fb.*, up.full_name as booked_by_name
         FROM facility_bookings fb
         JOIN user_profiles up ON up.id = fb.user_id
         WHERE fb.facility_id = $1
           AND fb.status = 'confirmed'
           AND (fb.start_time < $3 AND fb.end_time > $2)`,
        [facilityId, startDate.toISOString(), endDate.toISOString()]
      );

      if (conflictCheck.rows.length > 0) {
        const conflict = conflictCheck.rows[0];
        const conflictStart = new Date(conflict.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const conflictEnd = new Date(conflict.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        throw Object.assign(
          new Error(`Facility conflict: "${facility.name}" is already booked from ${conflictStart} to ${conflictEnd} by ${conflict.booked_by_name} for "${conflict.title}".`),
          { statusCode: 409, conflicts: conflictCheck.rows }
        );
      }

      // 3. Atomically insert facility booking
      const insertResult = await client.query(
        `INSERT INTO facility_bookings (facility_id, user_id, title, purpose, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
         RETURNING *`,
        [facilityId, userId, title.trim(), purpose?.trim() || null, startDate.toISOString(), endDate.toISOString()]
      );

      const created = insertResult.rows[0];
      const userProfile = await client.query('SELECT full_name, email, user_role FROM user_profiles WHERE id = $1', [userId]);
      created.user_name = userProfile.rows[0]?.full_name;
      created.user_email = userProfile.rows[0]?.email;
      created.user_role = userProfile.rows[0]?.user_role;
      created.facility_name = facility.name;
      return created;
    });

    res.status(201).json(booking);
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.conflicts ? { conflicts: err.conflicts } : {})
      });
    }
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Facility conflict: overlapping reservation detected' });
    }
    console.error('Error creating facility booking:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// PUT /api/facilities/bookings/:bookingId/cancel - Cancel a facility booking
router.put('/bookings/:bookingId/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;
    const isManager = req.user!.permissions.has('manage_facility_bookings') ||
                      ['admin', 'super_admin', 'lab_manager'].includes(req.user!.user_role);

    const bookingCheck = await query('SELECT * FROM facility_bookings WHERE id = $1', [bookingId]);
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.user_id !== userId && !isManager) {
      return res.status(403).json({ error: 'You do not have permission to cancel this booking' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'This booking is already cancelled' });
    }

    await query(
      `UPDATE facility_bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [bookingId]
    );

    res.json({ message: 'Facility booking cancelled successfully' });
  } catch (err: any) {
    console.error('Error cancelling facility booking:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/facilities
router.post('/', authenticate, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const rawInput = { ...req.body };
    if (req.file) {
      rawInput.image_url = `/uploads/facility-images/${req.file.filename}`;
    }
    delete rawInput.id;
    delete rawInput.created_at;
    delete rawInput.updated_at;

    const fields = cleanFacilityFields(rawInput);
    if (!fields.name || !String(fields.name).trim()) {
      return res.status(400).json({ error: 'Facility name is required' });
    }
    if (!fields.location || !String(fields.location).trim()) {
      return res.status(400).json({ error: 'Location is required' });
    }
    const facilityError = await validateFacilityFields(fields, null);
    if (facilityError) return res.status(400).json({ error: facilityError });

    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to insert' });

    const safeKeys = keys.map(k => sanitizeIdentifier(k));
    const placeholders = safeKeys.map((_, i) => `$${i + 1}`);
    const values = keys.map(k => fields[k]);

    const result = await query(
      `INSERT INTO facilities (${safeKeys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders.join(',')}) RETURNING id`,
      values
    );

    const newFacility = await getFacilityById(result.rows[0].id);
    res.status(201).json(newFacility);
  } catch (err: any) {
    console.error('Error creating facility:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// PUT /api/facilities/:id
router.put('/:id', authenticate, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const rawInput = { ...req.body };
    if (req.file) {
      rawInput.image_url = `/uploads/facility-images/${req.file.filename}`;
      // Remove old image safely
      const old = await query('SELECT image_url FROM facilities WHERE id = $1', [req.params.id]);
      if (old.rows[0]?.image_url) {
        const relative = old.rows[0].image_url.replace('/uploads/', '');
        const oldPath = resolveSafePath(UPLOAD_DIR, relative);
        if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    delete rawInput.id;
    delete rawInput.created_at;
    delete rawInput.updated_at;

    const fields = cleanFacilityFields(rawInput);
    if ('name' in fields && (!fields.name || !String(fields.name).trim())) {
      return res.status(400).json({ error: 'Facility name cannot be empty' });
    }
    if ('location' in fields && (!fields.location || !String(fields.location).trim())) {
      return res.status(400).json({ error: 'Location is required' });
    }
    const facilityUpdateError = await validateFacilityFields(fields, req.params.id);
    if (facilityUpdateError) return res.status(400).json({ error: facilityUpdateError });

    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const safeKeys = keys.map(k => sanitizeIdentifier(k));
    const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = keys.map(k => fields[k]);
    values.push(req.params.id);

    const result = await query(
      `UPDATE facilities SET ${setClause} WHERE id = $${values.length} RETURNING id`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    const updatedFacility = await getFacilityById(req.params.id);
    res.json(updatedFacility);
  } catch (err: any) {
    console.error('Error updating facility:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// DELETE /api/facilities/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const old = await query('SELECT image_url FROM facilities WHERE id = $1', [req.params.id]);
    if (old.rows[0]?.image_url) {
      const relative = old.rows[0].image_url.replace('/uploads/', '');
      const oldPath = resolveSafePath(UPLOAD_DIR, relative);
      if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await query('DELETE FROM facilities WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Error deleting facility:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

