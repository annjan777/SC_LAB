import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Strict Authentication: All endpoints require a valid user token
router.use(authenticate);

// Helper to validate YYYY-MM-DD format
function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  // Round-trip so impossible dates like 2026-02-30 are rejected instead of rolling over.
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reject malformed item / tracker ids with a 400 instead of letting Postgres throw (500).
router.param('id', (_req: Request, res: Response, next, value) => {
  if (!UUID_RE.test(value)) return res.status(400).json({ error: 'Invalid id' });
  next();
});

/**
 * GET /api/daily-todos/dates
 * Returns all dates for which the authenticated user has a tracker,
 * along with task counts, preview items, and completion stats.
 * Strictly scoped to req.user.id.
 */
router.get('/dates', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT 
         t.id as tracker_id,
         t.date,
         t.created_at,
         t.updated_at,
         COUNT(i.id)::int as total_tasks,
         COUNT(i.id) FILTER (WHERE i.is_completed = true)::int as completed_tasks,
         COALESCE(
           json_agg(
             json_build_object(
               'id', i.id,
               'title', i.title,
               'is_completed', i.is_completed,
               'order_index', i.order_index
             ) ORDER BY i.order_index ASC, i.created_at ASC
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'::json
         ) as items_preview
       FROM daily_todo_trackers t
       LEFT JOIN daily_todo_items i ON i.tracker_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id, t.date
       ORDER BY t.date DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching daily todo dates:', error);
    res.status(500).json({ error: 'Failed to fetch todo dates' });
  }
});

/**
 * GET /api/daily-todos/today/summary
 * Returns quick task statistics for the floating button badge.
 * Accepts optional ?date=YYYY-MM-DD (defaults to server today).
 */
router.get('/today/summary', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];

  if (!isValidDateString(dateParam)) {
    return res.status(400).json({ error: 'Invalid date parameter. Use YYYY-MM-DD.' });
  }

  try {
    const result = await query(
      `SELECT 
         t.id as tracker_id,
         COUNT(i.id)::int as total_tasks,
         COUNT(i.id) FILTER (WHERE i.is_completed = true)::int as completed_tasks,
         COUNT(i.id) FILTER (WHERE i.is_completed = false)::int as pending_tasks
       FROM daily_todo_trackers t
       LEFT JOIN daily_todo_items i ON i.tracker_id = t.id
       WHERE t.user_id = $1 AND t.date = $2
       GROUP BY t.id`,
      [userId, dateParam]
    );

    if (result.rows.length === 0) {
      return res.json({
        date: dateParam,
        total_tasks: 0,
        completed_tasks: 0,
        pending_tasks: 0,
      });
    }

    const row = result.rows[0];
    res.json({
      date: dateParam,
      total_tasks: row.total_tasks,
      completed_tasks: row.completed_tasks,
      pending_tasks: row.pending_tasks,
    });
  } catch (error: any) {
    console.error('Error fetching today summary:', error);
    res.status(500).json({ error: 'Failed to fetch today summary' });
  }
});

/**
 * GET /api/daily-todos/day/:date
 * Gets or automatically creates a tracker for the specified date.
 * Returns the tracker information and all tasks ordered by order_index.
 * Strictly scoped to req.user.id.
 */
router.get('/day/:date', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { date } = req.params;

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    // 1. Get or create tracker for this user and date
    const trackerRes = await query(
      `INSERT INTO daily_todo_trackers (user_id, date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, date) DO UPDATE SET updated_at = NOW()
       RETURNING id, user_id, date, created_at, updated_at`,
      [userId, date]
    );

    const tracker = trackerRes.rows[0];

    // 2. Fetch items for this tracker and user
    const itemsRes = await query(
      `SELECT id, tracker_id, user_id, title, is_completed, completed_at, order_index, created_at, updated_at
       FROM daily_todo_items
       WHERE tracker_id = $1 AND user_id = $2
       ORDER BY order_index ASC, created_at ASC`,
      [tracker.id, userId]
    );

    res.json({
      tracker,
      items: itemsRes.rows,
    });
  } catch (error: any) {
    console.error(`Error fetching daily todo for date ${date}:`, error);
    res.status(500).json({ error: 'Failed to fetch tasks for date' });
  }
});

/**
 * POST /api/daily-todos/day/:date/items
 * Adds a new task item to the tracker for the specified date.
 * Creates tracker automatically if not already existing.
 */
router.post('/day/:date/items', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { date } = req.params;
  const { title } = req.body;

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const cleanTitle = title.trim();

  try {
    // 1. Ensure tracker exists
    const trackerRes = await query(
      `INSERT INTO daily_todo_trackers (user_id, date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, date) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [userId, date]
    );
    const trackerId = trackerRes.rows[0].id;

    // 2. Compute next order_index
    const maxOrderRes = await query(
      `SELECT COALESCE(MAX(order_index) + 1, 0) as next_order
       FROM daily_todo_items
       WHERE tracker_id = $1 AND user_id = $2`,
      [trackerId, userId]
    );
    const nextOrder = maxOrderRes.rows[0].next_order;

    // 3. Insert new task item
    const newItemRes = await query(
      `INSERT INTO daily_todo_items (tracker_id, user_id, title, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tracker_id, user_id, title, is_completed, completed_at, order_index, created_at, updated_at`,
      [trackerId, userId, cleanTitle, nextOrder]
    );

    // 4. Update tracker timestamp
    await query(`UPDATE daily_todo_trackers SET updated_at = NOW() WHERE id = $1`, [trackerId]);

    res.status(201).json(newItemRes.rows[0]);
  } catch (error: any) {
    console.error(`Error creating daily todo item for ${date}:`, error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/daily-todos/items/:id
 * Updates a task (title, is_completed, order_index).
 * Strictly checks that the item belongs to req.user.id.
 */
router.put('/items/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { title, is_completed, order_index } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
    return res.status(400).json({ error: 'Task title cannot be empty' });
  }
  if (order_index !== undefined && (!Number.isInteger(order_index) || order_index < 0)) {
    return res.status(400).json({ error: 'order_index must be a non-negative integer' });
  }

  try {
    // Check if item exists and belongs to this user
    const existing = await query(
      `SELECT * FROM daily_todo_items WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const current = existing.rows[0];
    const newTitle = title !== undefined && typeof title === 'string' ? title.trim() : current.title;
    const newCompleted = typeof is_completed === 'boolean' ? is_completed : current.is_completed;
    const newOrder = typeof order_index === 'number' ? order_index : current.order_index;
    const completedAt =
      newCompleted !== current.is_completed
        ? newCompleted
          ? new Date()
          : null
        : current.completed_at;

    const updateRes = await query(
      `UPDATE daily_todo_items
       SET title = $1, is_completed = $2, completed_at = $3, order_index = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING id, tracker_id, user_id, title, is_completed, completed_at, order_index, created_at, updated_at`,
      [newTitle, newCompleted, completedAt, newOrder, id, userId]
    );

    // Update parent tracker's updated_at
    await query(`UPDATE daily_todo_trackers SET updated_at = NOW() WHERE id = $1`, [current.tracker_id]);

    res.json(updateRes.rows[0]);
  } catch (error: any) {
    console.error(`Error updating daily todo item ${id}:`, error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/daily-todos/items/:id
 * Deletes a task.
 * Strictly checks that the item belongs to req.user.id.
 */
router.delete('/items/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const deleteRes = await query(
      `DELETE FROM daily_todo_items
       WHERE id = $1 AND user_id = $2
       RETURNING id, tracker_id`,
      [id, userId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const trackerId = deleteRes.rows[0].tracker_id;
    await query(`UPDATE daily_todo_trackers SET updated_at = NOW() WHERE id = $1`, [trackerId]);

    res.json({ message: 'Task deleted successfully', id });
  } catch (error: any) {
    console.error(`Error deleting daily todo item ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * DELETE /api/daily-todos/day/:date
 * Deletes an entire day's tracker and all its associated tasks.
 * Strictly checks that the tracker belongs to req.user.id.
 */
router.delete('/day/:date', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { date } = req.params;

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const deleteRes = await query(
      `DELETE FROM daily_todo_trackers
       WHERE date = $1 AND user_id = $2
       RETURNING id, date`,
      [date, userId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tracker not found or access denied' });
    }

    res.json({ message: 'Tracker deleted successfully', date, id: deleteRes.rows[0].id });
  } catch (error: any) {
    console.error(`Error deleting tracker for ${date}:`, error);
    res.status(500).json({ error: 'Failed to delete tracker' });
  }
});

/**
 * DELETE /api/daily-todos/trackers/:id
 * Deletes a tracker by tracker ID and all its associated tasks.
 * Strictly checks that the tracker belongs to req.user.id.
 */
router.delete('/trackers/:id', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const deleteRes = await query(
      `DELETE FROM daily_todo_trackers
       WHERE id = $1 AND user_id = $2
       RETURNING id, date`,
      [id, userId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tracker not found or access denied' });
    }

    res.json({ message: 'Tracker deleted successfully', id, date: deleteRes.rows[0].date });
  } catch (error: any) {
    console.error(`Error deleting tracker ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete tracker' });
  }
});

/**
 * PUT /api/daily-todos/day/:date/reorder
 * Reorders task items for a given date.
 * Accepts { item_ids: string[] }.
 */
router.put('/day/:date/reorder', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { date } = req.params;
  const { item_ids } = req.body;

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  if (!Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ error: 'item_ids must be a non-empty array of task IDs' });
  }
  if (item_ids.some((itemId: any) => typeof itemId !== 'string' || !UUID_RE.test(itemId))) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    // 1. Get tracker
    const trackerRes = await query(
      `SELECT id FROM daily_todo_trackers WHERE user_id = $1 AND date = $2`,
      [userId, date]
    );

    if (trackerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tracker not found for this date' });
    }

    const trackerId = trackerRes.rows[0].id;

    // 2. Update order_index for each item
    for (let i = 0; i < item_ids.length; i++) {
      await query(
        `UPDATE daily_todo_items
         SET order_index = $1, updated_at = NOW()
         WHERE id = $2 AND tracker_id = $3 AND user_id = $4`,
        [i, item_ids[i], trackerId, userId]
      );
    }

    // 3. Fetch reordered items
    const updatedItems = await query(
      `SELECT id, tracker_id, user_id, title, is_completed, completed_at, order_index, created_at, updated_at
       FROM daily_todo_items
       WHERE tracker_id = $1 AND user_id = $2
       ORDER BY order_index ASC, created_at ASC`,
      [trackerId, userId]
    );

    res.json({ items: updatedItems.rows });
  } catch (error: any) {
    console.error(`Error reordering tasks for ${date}:`, error);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

/**
 * POST /api/daily-todos/day/:date/carry-forward
 * Finds uncompleted tasks from the most recent previous day and copies them
 * to the target date's tracker.
 */
router.post('/day/:date/carry-forward', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { date } = req.params;

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    // 1. Find the most recent date before `date` that has uncompleted items
    const prevDateRes = await query(
      `SELECT t.id as tracker_id, t.date
       FROM daily_todo_trackers t
       JOIN daily_todo_items i ON i.tracker_id = t.id AND i.is_completed = false
       WHERE t.user_id = $1 AND t.date < $2
       GROUP BY t.id, t.date
       ORDER BY t.date DESC
       LIMIT 1`,
      [userId, date]
    );

    if (prevDateRes.rows.length === 0) {
      return res.json({
        copied_count: 0,
        message: 'No uncompleted tasks found from previous dates',
        items: [],
      });
    }

    const prevTracker = prevDateRes.rows[0];

    // 2. Fetch uncompleted items from that previous tracker
    const uncompletedRes = await query(
      `SELECT title FROM daily_todo_items
       WHERE tracker_id = $1 AND user_id = $2 AND is_completed = false
       ORDER BY order_index ASC, created_at ASC`,
      [prevTracker.tracker_id, userId]
    );

    // 3. Ensure target tracker exists
    const targetTrackerRes = await query(
      `INSERT INTO daily_todo_trackers (user_id, date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, date) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [userId, date]
    );
    const targetTrackerId = targetTrackerRes.rows[0].id;

    // 4. Fetch existing items on target date to avoid duplicating exact titles
    const existingTitlesRes = await query(
      `SELECT lower(title) as title FROM daily_todo_items WHERE tracker_id = $1 AND user_id = $2`,
      [targetTrackerId, userId]
    );
    const existingTitles = new Set(existingTitlesRes.rows.map((r: any) => r.title));

    // 5. Get current max order_index on target tracker
    const maxOrderRes = await query(
      `SELECT COALESCE(MAX(order_index) + 1, 0) as next_order
       FROM daily_todo_items
       WHERE tracker_id = $1 AND user_id = $2`,
      [targetTrackerId, userId]
    );
    let nextOrder = parseInt(maxOrderRes.rows[0].next_order, 10);

    const insertedItems: any[] = [];
    for (const item of uncompletedRes.rows) {
      if (!existingTitles.has(item.title.toLowerCase())) {
        const ins = await query(
          `INSERT INTO daily_todo_items (tracker_id, user_id, title, is_completed, order_index)
           VALUES ($1, $2, $3, false, $4)
           RETURNING id, tracker_id, user_id, title, is_completed, completed_at, order_index, created_at, updated_at`,
          [targetTrackerId, userId, item.title, nextOrder++]
        );
        insertedItems.push(ins.rows[0]);
      }
    }

    await query(`UPDATE daily_todo_trackers SET updated_at = NOW() WHERE id = $1`, [targetTrackerId]);

    res.json({
      copied_count: insertedItems.length,
      from_date: prevTracker.date,
      message:
        insertedItems.length > 0
          ? `Carried forward ${insertedItems.length} incomplete tasks from ${prevTracker.date}`
          : 'All pending tasks from previous date are already on today’s list',
      items: insertedItems,
    });
  } catch (error: any) {
    console.error(`Error carrying forward tasks to ${date}:`, error);
    res.status(500).json({ error: 'Failed to carry forward tasks' });
  }
});

export default router;
