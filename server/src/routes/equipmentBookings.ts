import { Router, Request, Response } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

for (const param of ['id', 'bookingId']) {
  router.param(param, (req: Request, res: Response, next, value) => {
    if (!UUID_RE.test(String(value))) return res.status(400).json({ error: 'Invalid id' });
    next();
  });
}

// GET /api/inventory/:id/bookings - Get confirmed bookings for an equipment item
router.get('/:id/bookings', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, status, upcoming } = req.query;

    let sql = `
      SELECT eb.*,
             up.full_name as user_name,
             up.email as user_email,
             up.user_role as user_role,
             ii.item_name,
             ii.category,
             ii.asset_tag,
             f.name as facility_name
      FROM equipment_bookings eb
      JOIN user_profiles up ON up.id = eb.user_id
      JOIN inventory_items ii ON ii.id = eb.inventory_item_id
      LEFT JOIN facilities f ON f.id = ii.facility_id
      WHERE eb.inventory_item_id = $1
    `;
    const params: any[] = [id];

    if (status && typeof status === 'string') {
      params.push(status);
      sql += ` AND eb.status = $${params.length}`;
    } else {
      sql += ` AND eb.status = 'confirmed'`;
    }

    if (date && typeof date === 'string') {
      params.push(date);
      sql += ` AND eb.start_time::date = $${params.length}::date`;
    } else if (upcoming === 'true') {
      sql += ` AND eb.end_time >= NOW()`;
    }

    sql += ` ORDER BY eb.start_time ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching equipment bookings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/inventory/:id/bookings - Book an equipment item independently
router.post('/:id/bookings', authenticate, async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;
    const userId = req.user!.id;
    const { title, purpose, notes, quantity, start_time, end_time } = req.body;
    const finalTitle = String(title || purpose || 'Equipment Reservation').trim();

    if (!finalTitle) {
      return res.status(400).json({ error: 'Booking title or reservation purpose is required' });
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
      // 1. Lock equipment row to serialize concurrent booking requests for this item
      const itemCheck = await client.query('SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [itemId]);
      if (itemCheck.rows.length === 0) {
        throw Object.assign(new Error('Equipment item not found'), { statusCode: 404 });
      }
      const item = itemCheck.rows[0];
      if (item.condition === 'damaged') {
        throw Object.assign(new Error('Cannot book equipment: item is marked as damaged'), { statusCode: 400 });
      }

      // 2. CRITICAL: Prevent overlapping equipment bookings under lock
      const conflictCheck = await client.query(
        `SELECT eb.*, up.full_name as booked_by_name
         FROM equipment_bookings eb
         JOIN user_profiles up ON up.id = eb.user_id
         WHERE eb.inventory_item_id = $1
           AND eb.status = 'confirmed'
           AND (eb.start_time < $3 AND eb.end_time > $2)`,
        [itemId, startDate.toISOString(), endDate.toISOString()]
      );

      if (conflictCheck.rows.length > 0) {
        const conflict = conflictCheck.rows[0];
        const conflictStart = new Date(conflict.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const conflictEnd = new Date(conflict.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        throw Object.assign(
          new Error(`Equipment conflict: "${item.item_name}" is already booked from ${conflictStart} to ${conflictEnd} by ${conflict.booked_by_name} for "${conflict.title}".`),
          { statusCode: 409, conflicts: conflictCheck.rows }
        );
      }

      // 3. Atomically insert equipment booking
      const insertResult = await client.query(
        `INSERT INTO equipment_bookings (inventory_item_id, user_id, title, purpose, notes, quantity, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
         RETURNING *`,
        [
          itemId,
          userId,
          finalTitle,
          purpose?.trim() || finalTitle,
          notes?.trim() || null,
          parseInt(quantity, 10) || 1,
          startDate.toISOString(),
          endDate.toISOString()
        ]
      );

      const created = insertResult.rows[0];
      const userProfile = await client.query('SELECT full_name, email, user_role FROM user_profiles WHERE id = $1', [userId]);
      created.user_name = userProfile.rows[0]?.full_name;
      created.user_email = userProfile.rows[0]?.email;
      created.user_role = userProfile.rows[0]?.user_role;
      created.item_name = item.item_name;
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
      return res.status(409).json({ error: 'Equipment conflict: overlapping reservation detected' });
    }
    console.error('Error creating equipment booking:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/inventory/bookings/:bookingId/cancel - Cancel an equipment booking
router.put('/bookings/:bookingId/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;
    const isManager = req.user!.permissions.has('manage_equipment_bookings') ||
                      ['admin', 'super_admin', 'lab_manager'].includes(req.user!.user_role);

    const bookingCheck = await query('SELECT * FROM equipment_bookings WHERE id = $1', [bookingId]);
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment booking not found' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.user_id !== userId && !isManager) {
      return res.status(403).json({ error: 'You do not have permission to cancel this equipment booking' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'This booking is already cancelled' });
    }

    await query(
      `UPDATE equipment_bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [bookingId]
    );

    res.json({ message: 'Equipment booking cancelled successfully' });
  } catch (err: any) {
    console.error('Error cancelling equipment booking:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
