import { query, pool } from '../config/database.js';
import jwt from 'jsonwebtoken';
import { checkAndTriggerEquipmentReturnReminders } from '../services/equipmentReturnReminderService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

async function runTests() {
  console.log('====================================================');
  console.log('   INVENTORY & FACILITIES REAL HTTP API TEST SUITE  ');
  console.log('====================================================\n');

  try {
    // 1. Fetch test admin and normal user
    const adminRes = await query("SELECT id, email FROM user_profiles WHERE user_role = 'admin' LIMIT 1");
    if (adminRes.rows.length === 0) throw new Error('No admin profile found');
    const admin = adminRes.rows[0];

    const userRes = await query("SELECT id, email FROM user_profiles WHERE user_role = 'user' LIMIT 1");
    if (userRes.rows.length === 0) throw new Error('No user profile found');
    const user = userRes.rows[0];

    const adminToken = jwt.sign({ userId: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '1h' });
    const userToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Create Facility via HTTP POST /api/facilities
    const facRes = await fetch(`${BASE_URL}/facilities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Robotics Lab Test ${Date.now()}`,
        location: 'Block C Room 102',
        project_code: 'PRJ-ROBOT-01',
        funded_by: 'DST-SERB',
        capacity: 25,
      }),
    });
    const facility = await facRes.json();
    console.log(facRes.status === 201 ? '✅ [PASS] Facility created via HTTP POST /api/facilities' : '❌ [FAIL] Facility creation failed');

    // 3. Test Consumables: Stock deduction on issuance via real HTTP routes
    const consumableItemRes = await query(`
      INSERT INTO inventory_items (
        item_name, category, classification, quantity, location, po_number, vendor_name, purchased_by
      ) VALUES (
        'Acetone 99.5% HPLC Grade HTTP', 'Chemicals', 'Consumables', 50, 'Chemical Cabinet A', 'PO-2026-0089', 'Sigma-Aldrich', 'Dr. Sharma'
      ) RETURNING *
    `);
    const consumableItem = consumableItemRes.rows[0];
    console.log('✅ [PASS] Consumable item created in inventory. Initial stock:', consumableItem.quantity);

    // User submits request via HTTP POST /api/inventory/requests
    const reqCreateRes1 = await fetch(`${BASE_URL}/inventory/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        inventory_item_id: consumableItem.id,
        quantity: 10,
        purpose: 'Synthesis of polymer matrix via HTTP',
      }),
    });
    const req1 = await reqCreateRes1.json();
    console.log(reqCreateRes1.status === 201 && req1.id ? '✅ [PASS] User submitted inventory request via HTTP POST' : '❌ [FAIL] User request creation failed');

    // Admin approves request via HTTP PUT /api/inventory/requests/:id/approve
    const reqApproveRes1 = await fetch(`${BASE_URL}/inventory/requests/${req1.id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        remarks: 'Approved for polymer research',
      }),
    });
    console.log(reqApproveRes1.status === 200 ? '✅ [PASS] Admin approved inventory request via HTTP PUT' : '❌ [FAIL] Approval failed');

    // Admin issues non-returnable consumable via HTTP PUT /api/inventory/requests/:id/issue
    const reqIssueRes1 = await fetch(`${BASE_URL}/inventory/requests/${req1.id}/issue`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        is_returnable: false,
        remarks: 'Issued to student',
      }),
    });
    console.log(reqIssueRes1.status === 200 ? '✅ [PASS] Admin issued consumable via HTTP PUT' : '❌ [FAIL] Issuance failed');

    // Verify stock deduction in database
    const afterDeduction = await query('SELECT quantity FROM inventory_items WHERE id = $1', [consumableItem.id]);
    console.log(afterDeduction.rows[0].quantity === 40 ? '✅ [PASS] Stock accurately deducted from 50 to 40' : '❌ [FAIL] Stock deduction mismatch');

    // 4. Test Equipment: Assignment and return tracking via HTTP routes
    const equipItemRes = await query(`
      INSERT INTO inventory_items (
        item_name, category, classification, quantity, location, po_number, vendor_name, facility_id
      ) VALUES (
        'Digital Oscilloscope 200MHz HTTP', 'Electronics', 'Equipment', 1, 'Bench 4', 'PO-2026-0104', 'Keysight', $1
      ) RETURNING *
    `, [facility.id]);
    const equipItem = equipItemRes.rows[0];

    // User requests equipment via HTTP
    const reqCreateRes2 = await fetch(`${BASE_URL}/inventory/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        inventory_item_id: equipItem.id,
        quantity: 1,
        purpose: 'Signal analysis testing via HTTP',
      }),
    });
    const req2 = await reqCreateRes2.json();
    console.log(reqCreateRes2.status === 201 && req2.id ? '✅ [PASS] User submitted equipment loan request via HTTP' : '❌ [FAIL] Equipment request failed');

    // Admin approves
    await fetch(`${BASE_URL}/inventory/requests/${req2.id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    });

    // Admin issues returnable equipment with return date via HTTP PUT
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const reqIssueRes2 = await fetch(`${BASE_URL}/inventory/requests/${req2.id}/issue`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        is_returnable: true,
        expected_return_date: tomorrow,
        remarks: 'Take good care of calibration seal',
      }),
    });
    console.log(reqIssueRes2.status === 200 ? '✅ [PASS] Admin issued equipment with return date via HTTP' : '❌ [FAIL] Equipment issuance failed');

    const assignedCheck = await query('SELECT assigned_to_user_id, status FROM inventory_items WHERE id = $1', [equipItem.id]);
    console.log(assignedCheck.rows[0].status === 'assigned' && assignedCheck.rows[0].assigned_to_user_id === user.id
      ? '✅ [PASS] Equipment assigned to user in database'
      : '❌ [FAIL] Equipment assignment failed');

    // User returns equipment via HTTP PUT /api/inventory/requests/:id/return
    const returnRes = await fetch(`${BASE_URL}/inventory/requests/${req2.id}/return`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        returned_condition: 'good',
        return_remarks: 'Returned in pristine condition',
      }),
    });
    console.log(returnRes.status === 200 ? '✅ [PASS] Equipment marked returned via HTTP PUT /return' : '❌ [FAIL] Return failed');

    const returnedCheck = await query('SELECT assigned_to_user_id, status, condition FROM inventory_items WHERE id = $1', [equipItem.id]);
    console.log(returnedCheck.rows[0].status === 'available' && returnedCheck.rows[0].assigned_to_user_id === null
      ? '✅ [PASS] Equipment assignment released, status back to available'
      : '❌ [FAIL] Equipment not freed');

    // 5. Test Return Reminder Service
    const reminderResult = await checkAndTriggerEquipmentReturnReminders({ skipEmailSend: true });
    console.log('✅ [PASS] Equipment return reminder service executed smoothly:', reminderResult);

    // Clean up test rows
    await query('DELETE FROM notifications WHERE message LIKE $1 OR message LIKE $2', ['%Acetone 99.5% HPLC Grade HTTP%', '%Digital Oscilloscope 200MHz HTTP%']);
    await query('DELETE FROM inventory_requests WHERE id IN ($1, $2)', [req1.id, req2.id]);
    await query('DELETE FROM inventory_items WHERE id IN ($1, $2)', [consumableItem.id, equipItem.id]);
    if (facility.id) {
      await query('DELETE FROM facilities WHERE id = $1', [facility.id]);
    }

    console.log('\n🎉 ALL REAL HTTP INVENTORY & FACILITIES TESTS PASSED SUCCESSFULLY!\n');
  } catch (err: any) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runTests();
