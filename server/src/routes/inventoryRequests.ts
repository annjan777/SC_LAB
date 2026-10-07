import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditLogger.js';
import { createNotification } from '../services/notificationService.js';
import { sendEquipmentReturnReminderEmail } from '../utils/email.js';
import { checkAndTriggerEquipmentReturnReminders } from '../services/equipmentReturnReminderService.js';

const router = Router();

function hasManagerPerm(req: Request): boolean {
  if (!req.user) return false;
  const role = req.user.user_role?.toLowerCase() || '';
  if (['admin', 'super_admin', 'lab_manager'].includes(role)) {
    return true;
  }
  return req.user.permissions?.has('manage_inventory_requests') || false;
}

// ---------------------------------------------------------------------------
// GET /api/inventory/requests - List requests & transaction history
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const isManager = hasManagerPerm(req);
    const { status, is_returnable, overdue, item_id, user_id, classification } = req.query;

    let sql = `
      SELECT 
        ir.id,
        ir.inventory_item_id,
        ir.requested_by,
        ir.quantity,
        ir.purpose,
        ir.request_date,
        ir.status,
        ir.approved_by,
        ir.approved_at,
        ir.rejection_reason,
        ir.issued_by,
        ir.issue_date,
        ir.is_returnable,
        ir.expected_return_date,
        ir.actual_return_date,
        ir.returned_condition,
        ir.return_remarks,
        ir.received_by,
        ir.remarks,
        ir.created_at,
        ir.updated_at,
        -- Inventory item details
        ii.item_name,
        ii.category,
        ii.classification,
        ii.asset_tag,
        ii.serial_number,
        ii.location,
        ii.quantity AS current_stock,
        ii.po_number,
        ii.vendor_name,
        ii.facility_id,
        f.name AS facility_name,
        -- Requester
        req_u.full_name AS requester_name,
        req_u.email AS requester_email,
        -- Approver
        app_u.full_name AS approver_name,
        -- Issuer
        iss_u.full_name AS issuer_name,
        -- Receiver
        rec_u.full_name AS receiver_name
      FROM inventory_requests ir
      JOIN inventory_items ii ON ii.id = ir.inventory_item_id
      LEFT JOIN facilities f ON f.id = ii.facility_id
      JOIN user_profiles req_u ON req_u.id = ir.requested_by
      LEFT JOIN user_profiles app_u ON app_u.id = ir.approved_by
      LEFT JOIN user_profiles iss_u ON iss_u.id = ir.issued_by
      LEFT JOIN user_profiles rec_u ON rec_u.id = ir.received_by
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Access control: regular users only view their own requests
    if (!isManager) {
      params.push(req.user!.id);
      conditions.push(`ir.requested_by = $${params.length}`);
    } else if (user_id) {
      params.push(user_id);
      conditions.push(`ir.requested_by = $${params.length}`);
    }

    if (item_id) {
      params.push(item_id);
      conditions.push(`ir.inventory_item_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`ir.status = $${params.length}`);
    }

    if (is_returnable !== undefined) {
      params.push(is_returnable === 'true');
      conditions.push(`ir.is_returnable = $${params.length}`);
    }

    if (classification) {
      params.push(classification);
      conditions.push(`ii.classification = $${params.length}`);
    }

    if (overdue === 'true') {
      conditions.push(`(ir.status = 'overdue' OR (ir.status = 'issued' AND ir.expected_return_date < CURRENT_DATE))`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY ir.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[INVENTORY REQUESTS GET ERROR]:', err);
    res.status(500).json({ error: 'Failed to fetch inventory requests' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/inventory/requests/assign - Directly assign an item to a user
// ---------------------------------------------------------------------------
router.post('/assign', authenticate, async (req: Request, res: Response) => {
  try {
    if (!hasManagerPerm(req)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const {
      inventory_item_id,
      assigned_to_user_id,
      quantity = 1,
      is_returnable,
      expected_return_date,
      remarks,
    } = req.body;

    if (!inventory_item_id || !assigned_to_user_id) {
      return res.status(400).json({ error: 'Item and Assigned User are required' });
    }

    const returnableBool = is_returnable === true || is_returnable === 'true';

    if (returnableBool && !expected_return_date) {
      return res.status(400).json({ error: 'Expected return date is required for returnable items' });
    }
    if (returnableBool && String(expected_return_date).slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Expected return date cannot be in the past' });
    }

    const itemRes = await query('SELECT * FROM inventory_items WHERE id = $1', [inventory_item_id]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = itemRes.rows[0];

    const reqQty = parseInt(quantity, 10) || 1;

    // Check stock if non-returnable
    if (!returnableBool) {
      if (item.quantity < reqQty) {
        return res.status(400).json({
          error: `Insufficient stock. Requested: ${reqQty}, Available: ${item.quantity}`,
        });
      }
      await query('UPDATE inventory_items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2', [reqQty, item.id]);
    } else {
      // Equipment returnable assignment
      if (item.assigned_to_user_id && item.assigned_to_user_id !== assigned_to_user_id) {
        const assignedUserRes = await query('SELECT full_name FROM user_profiles WHERE id = $1', [item.assigned_to_user_id]);
        return res.status(409).json({
          error: `Equipment is already assigned to ${assignedUserRes.rows[0]?.full_name || 'another user'}.`,
        });
      }
      await query(
        `UPDATE inventory_items
         SET assigned_to_user_id = $1, status = 'assigned', is_returnable = true, expected_return_date = $2, updated_at = NOW()
         WHERE id = $3`,
        [assigned_to_user_id, expected_return_date, item.id]
      );
    }

    // Insert into inventory_requests as 'issued'
    const insertRes = await query(
      `INSERT INTO inventory_requests (
        inventory_item_id, requested_by, quantity, purpose,
        status, approved_by, approved_at, issued_by, issue_date,
        is_returnable, expected_return_date, remarks
      ) VALUES ($1, $2, $3, $4, 'issued', $5, NOW(), $5, NOW(), $6, $7, $8)
      RETURNING *`,
      [
        inventory_item_id,
        assigned_to_user_id,
        reqQty,
        'Direct assignment by lab manager',
        req.user!.id,
        returnableBool,
        returnableBool ? expected_return_date : null,
        remarks || null,
      ]
    );

    const newRequest = insertRes.rows[0];

    // Fetch user details for notification
    const userRes = await query('SELECT full_name, email FROM user_profiles WHERE id = $1', [assigned_to_user_id]);
    const recipient = userRes.rows[0];
    const recipientName = recipient?.full_name || 'Lab Member';

    // Notify the person who took the item (recipient) only if not self-assigning
    if (req.user!.id !== assigned_to_user_id) {
      const msgRecipient = returnableBool
        ? `"${item.item_name}" has been assigned to you. Expected return date: ${expected_return_date}.`
        : `${reqQty} unit(s) of "${item.item_name}" have been assigned/issued to you (Non-returnable).`;

      await createNotification({
        userId: assigned_to_user_id,
        type: 'inventory_item_issued',
        title: 'Equipment Assigned to You',
        message: msgRecipient,
        relatedEntityType: 'inventory_request',
        relatedEntityId: newRequest.id,
        actionUrl: '/inventory',
      });
    }

    // 3. Email if returnable
    if (returnableBool && recipient?.email) {
      try {
        await sendEquipmentReturnReminderEmail({
          to: recipient.email,
          recipientName,
          itemName: item.item_name,
          dueDate: expected_return_date,
          isOverdue: false,
        });
      } catch (err: any) {
        console.error('[EMAIL ERROR]:', err.message);
      }
    }

    res.status(201).json(newRequest);
  } catch (err: any) {
    console.error('[ASSIGN INVENTORY ERROR]:', err);
    res.status(500).json({ error: 'Failed to assign inventory item' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/inventory/requests - Submit a new inventory request
// ---------------------------------------------------------------------------
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { inventory_item_id, quantity = 1, purpose, expected_return_date, remarks } = req.body;

    if (!inventory_item_id) {
      return res.status(400).json({ error: 'Item is required' });
    }

    const reqQty = parseInt(quantity, 10);
    if (isNaN(reqQty) || reqQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    // Verify item exists
    const itemRes = await query('SELECT * FROM inventory_items WHERE id = $1', [inventory_item_id]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const item = itemRes.rows[0];

    // Check available stock
    if (item.quantity <= 0) {
      return res.status(400).json({
        error: 'This item is currently out of stock.',
      });
    }

    if (item.quantity < reqQty) {
      return res.status(400).json({
        error: `Cannot request ${reqQty} units. Only ${item.quantity} units are currently in stock.`,
      });
    }

    const insertRes = await query(
      `INSERT INTO inventory_requests (
        inventory_item_id, requested_by, quantity, purpose,
        expected_return_date, remarks, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *`,
      [
        inventory_item_id,
        req.user!.id,
        reqQty,
        purpose || null,
        expected_return_date || null,
        remarks || null,
      ]
    );

    const newRequest = insertRes.rows[0];

    await logAuditEvent({
      userId: req.user!.id,
      action: 'CREATE',
      entityType: 'inventory_requests',
      entityId: newRequest.id,
      newValue: newRequest,
    });

    // Notify managers & admins
    try {
      const managersRes = await query(`
        SELECT u.id FROM user_profiles u
        JOIN roles r ON r.id = u.role_id
        WHERE LOWER(r.name) IN ('admin', 'super_admin', 'lab_manager')
      `);
      for (const mgr of managersRes.rows) {
        if (mgr.id !== req.user!.id) {
          await createNotification({
            userId: mgr.id,
            type: 'inventory_request_created',
            title: 'New Inventory Request',
            message: `${req.user!.email || 'A user'} requested ${reqQty}x "${item.item_name}".`,
            relatedEntityType: 'inventory_request',
            relatedEntityId: newRequest.id,
            actionUrl: '/inventory',
          });
        }
      }
    } catch (notifErr: any) {
      console.error('[NOTIF ERROR]:', notifErr.message);
    }

    res.status(201).json(newRequest);
  } catch (err: any) {
    console.error('[CREATE INVENTORY REQUEST ERROR]:', err);
    res.status(500).json({ error: 'Failed to create inventory request' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/inventory/requests/:id/approve - Approve an inventory request
// ---------------------------------------------------------------------------
router.put('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    if (!hasManagerPerm(req)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const reqRes = await query(
      `SELECT ir.*, ii.item_name FROM inventory_requests ir
       JOIN inventory_items ii ON ii.id = ir.inventory_item_id
       WHERE ir.id = $1`,
      [req.params.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const itemReq = reqRes.rows[0];
    if (itemReq.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve request with status '${itemReq.status}'` });
    }

    const updateRes = await query(
      `UPDATE inventory_requests
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user!.id, req.params.id]
    );

    await logAuditEvent({
      userId: req.user!.id,
      action: 'APPROVE',
      entityType: 'inventory_requests',
      entityId: req.params.id,
      oldValue: itemReq,
      newValue: updateRes.rows[0],
    });

    // Notify requester
    await createNotification({
      userId: itemReq.requested_by,
      type: 'inventory_request_approved',
      title: 'Inventory Request Approved',
      message: `Your request for "${itemReq.item_name}" has been approved. You can collect it once issued.`,
      relatedEntityType: 'inventory_request',
      relatedEntityId: req.params.id,
      actionUrl: '/inventory',
    });

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('[APPROVE INVENTORY REQUEST ERROR]:', err);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/inventory/requests/:id/reject - Reject an inventory request
// ---------------------------------------------------------------------------
router.put('/:id/reject', authenticate, async (req: Request, res: Response) => {
  try {
    if (!hasManagerPerm(req)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { rejection_reason } = req.body;

    const reqRes = await query(
      `SELECT ir.*, ii.item_name FROM inventory_requests ir
       JOIN inventory_items ii ON ii.id = ir.inventory_item_id
       WHERE ir.id = $1`,
      [req.params.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const itemReq = reqRes.rows[0];
    if (['issued', 'returned'].includes(itemReq.status)) {
      return res.status(400).json({ error: `Cannot reject request with status '${itemReq.status}'` });
    }

    const updateRes = await query(
      `UPDATE inventory_requests
       SET status = 'rejected', approved_by = $1, approved_at = NOW(),
           rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [req.user!.id, rejection_reason || null, req.params.id]
    );

    await logAuditEvent({
      userId: req.user!.id,
      action: 'REJECT',
      entityType: 'inventory_requests',
      entityId: req.params.id,
      oldValue: itemReq,
      newValue: updateRes.rows[0],
    });

    // Notify requester
    await createNotification({
      userId: itemReq.requested_by,
      type: 'inventory_request_rejected',
      title: 'Inventory Request Rejected',
      message: `Your request for "${itemReq.item_name}" was rejected.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`,
      relatedEntityType: 'inventory_request',
      relatedEntityId: req.params.id,
      actionUrl: '/inventory',
    });

    res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('[REJECT INVENTORY REQUEST ERROR]:', err);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/inventory/requests/:id/issue - Process issue / assignment
// ---------------------------------------------------------------------------
router.put('/:id/issue', authenticate, async (req: Request, res: Response) => {
  try {
    if (!hasManagerPerm(req)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { is_returnable, expected_return_date, remarks } = req.body;

    if (is_returnable === undefined || is_returnable === null) {
      return res.status(400).json({ error: 'Returnability option (Returnable or Non-returnable) is required' });
    }

    const returnableBool = is_returnable === true || is_returnable === 'true';

    if (returnableBool && !expected_return_date) {
      return res.status(400).json({ error: 'Expected return date is required for returnable equipment' });
    }
    if (returnableBool && String(expected_return_date).slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Expected return date cannot be in the past' });
    }

    // Begin lock & transaction
    const reqRes = await query(
      `SELECT ir.*, ii.item_name, ii.classification, ii.quantity AS current_stock, ii.assigned_to_user_id
       FROM inventory_requests ir
       JOIN inventory_items ii ON ii.id = ir.inventory_item_id
       WHERE ir.id = $1`,
      [req.params.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const itemReq = reqRes.rows[0];

    if (['issued', 'returned'].includes(itemReq.status)) {
      return res.status(400).json({ error: `Request has already been processed (status: ${itemReq.status})` });
    }
    if (itemReq.status !== 'approved') {
      return res.status(400).json({ error: `Only approved requests can be issued (current status: ${itemReq.status}). Approve the request first.` });
    }

    // 1. Non-returnable stock deduction logic
    if (!returnableBool) {
      if (itemReq.current_stock < itemReq.quantity) {
        return res.status(400).json({
          error: `Insufficient stock. Requested: ${itemReq.quantity}, Available: ${itemReq.current_stock}`,
        });
      }

      // Deduct quantity from inventory
      await query(
        `UPDATE inventory_items
         SET quantity = quantity - $1, updated_at = NOW()
         WHERE id = $2`,
        [itemReq.quantity, itemReq.inventory_item_id]
      );
    }

    // 2. Returnable equipment assignment logic
    if (returnableBool) {
      // Check if equipment is already actively assigned to someone else
      if (itemReq.assigned_to_user_id && itemReq.assigned_to_user_id !== itemReq.requested_by) {
        const assignedUserRes = await query('SELECT full_name FROM user_profiles WHERE id = $1', [itemReq.assigned_to_user_id]);
        const assignedName = assignedUserRes.rows[0]?.full_name || 'another user';
        return res.status(409).json({
          error: `Cannot issue equipment: it is already actively assigned to ${assignedName}.`,
        });
      }

      // Assign to requester and set status
      await query(
        `UPDATE inventory_items
         SET assigned_to_user_id = $1, status = 'assigned', updated_at = NOW()
         WHERE id = $2`,
        [itemReq.requested_by, itemReq.inventory_item_id]
      );
    }

    // Update request status to 'issued'
    const updateRes = await query(
      `UPDATE inventory_requests
       SET status = 'issued',
           issued_by = $1,
           issue_date = NOW(),
           is_returnable = $2,
           expected_return_date = $3,
           remarks = COALESCE($4, remarks),
           updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        req.user!.id,
        returnableBool,
        returnableBool ? expected_return_date : null,
        remarks || null,
        req.params.id,
      ]
    );

    const updatedRequest = updateRes.rows[0];

    await logAuditEvent({
      userId: req.user!.id,
      action: 'ISSUE',
      entityType: 'inventory_requests',
      entityId: req.params.id,
      oldValue: itemReq,
      newValue: updatedRequest,
    });

    // Fetch details of requester and assigner
    const requesterUserRes = await query('SELECT full_name, email FROM user_profiles WHERE id = $1', [itemReq.requested_by]);
    const requester = requesterUserRes.rows[0];
    const requesterName = requester?.full_name || 'Requester';

    // 1. Notify the person who took the item (requester / borrower)
    const msgRequester = returnableBool
      ? `"${itemReq.item_name}" has been issued to you. Expected return date: ${expected_return_date}.`
      : `${itemReq.quantity} unit(s) of "${itemReq.item_name}" have been issued to you (Non-returnable).`;

    await createNotification({
      userId: itemReq.requested_by,
      type: 'inventory_item_issued',
      title: 'Inventory Item Issued',
      message: msgRequester,
      relatedEntityType: 'inventory_request',
      relatedEntityId: req.params.id,
      actionUrl: '/inventory',
    });


    // 3. Email notification for returnable equipment
    if (returnableBool && requester?.email) {
      try {
        await sendEquipmentReturnReminderEmail({
          to: requester.email,
          recipientName: requesterName,
          itemName: itemReq.item_name,
          dueDate: expected_return_date,
          isOverdue: false,
        });
      } catch (emailErr: any) {
        console.error('[EMAIL NOTIF ERROR]:', emailErr.message);
      }
    }

    res.json(updatedRequest);
  } catch (err: any) {
    console.error('[ISSUE INVENTORY REQUEST ERROR]:', err);
    res.status(500).json({ error: 'Failed to issue inventory item' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/inventory/requests/:id/return - Process return of equipment
// ---------------------------------------------------------------------------
router.put('/:id/return', authenticate, async (req: Request, res: Response) => {
  try {
    if (!hasManagerPerm(req)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { returned_condition = 'good', return_remarks } = req.body;

    const validConditions = ['new', 'good', 'fair', 'poor', 'damaged'];
    if (!validConditions.includes(returned_condition)) {
      return res.status(400).json({ error: 'Invalid condition. Choose from: ' + validConditions.join(', ') });
    }

    const reqRes = await query(
      `SELECT ir.*, ii.item_name, ii.classification FROM inventory_requests ir
       JOIN inventory_items ii ON ii.id = ir.inventory_item_id
       WHERE ir.id = $1`,
      [req.params.id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const itemReq = reqRes.rows[0];

    if (!['issued', 'overdue'].includes(itemReq.status)) {
      return res.status(400).json({ error: `Cannot return request with status '${itemReq.status}'` });
    }
    if (itemReq.is_returnable === false) {
      return res.status(400).json({ error: 'This item was issued as non-returnable (consumed) and cannot be returned' });
    }

    // Update request
    const updateRes = await query(
      `UPDATE inventory_requests
       SET status = 'returned',
           actual_return_date = NOW(),
           returned_condition = $1,
           return_remarks = $2,
           received_by = $3,
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [returned_condition, return_remarks || null, req.user!.id, req.params.id]
    );

    // Free the equipment in inventory_items
    await query(
      `UPDATE inventory_items
       SET assigned_to_user_id = NULL,
           status = 'available',
           condition = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [returned_condition, itemReq.inventory_item_id]
    );

    const updatedRequest = updateRes.rows[0];

    await logAuditEvent({
      userId: req.user!.id,
      action: 'RETURN',
      entityType: 'inventory_requests',
      entityId: req.params.id,
      oldValue: itemReq,
      newValue: updatedRequest,
    });

    // Notify requester
    await createNotification({
      userId: itemReq.requested_by,
      type: 'inventory_item_returned',
      title: 'Equipment Return Completed',
      message: `Return recorded for "${itemReq.item_name}". Logged condition: ${returned_condition}.`,
      relatedEntityType: 'inventory_request',
      relatedEntityId: req.params.id,
      actionUrl: '/inventory',
    });

    res.json(updatedRequest);
  } catch (err: any) {
    console.error('[RETURN INVENTORY ITEM ERROR]:', err);
    res.status(500).json({ error: 'Failed to process return' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/inventory/requests/trigger-reminders - Manual reminder trigger
// ---------------------------------------------------------------------------
router.post('/trigger-reminders', authenticate, async (req: Request, res: Response) => {
  try {
    if (!hasManagerPerm(req)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const result = await checkAndTriggerEquipmentReturnReminders();
    res.json({ message: 'Return reminders triggered successfully', ...result });
  } catch (err: any) {
    console.error('[TRIGGER REMINDERS ERROR]:', err);
    res.status(500).json({ error: 'Failed to trigger reminders' });
  }
});

export default router;
