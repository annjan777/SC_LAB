import { query, transaction, pool } from '../config/database.js';
import jwt from 'jsonwebtoken';
import { checkAndTriggerEquipmentReturnReminders } from '../services/equipmentReturnReminderService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface TestResult {
  step: string;
  category: 'ADMIN' | 'USER' | 'DATABASE' | 'REMINDERS';
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(step: string, category: 'ADMIN' | 'USER' | 'DATABASE' | 'REMINDERS', condition: boolean, details = '') {
  results.push({ step, category, passed: condition, details });
  const icon = condition ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${category}] ${step} ${details ? '(' + details + ')' : ''}`);
  if (!condition) {
    console.error(`   FAILURE DETAILS: ${details}`);
  }
}

async function runComprehensiveVerification() {
  console.log('\n================================================================');
  console.log('   SC LAB PORTAL — FULL SYSTEM END-TO-END VERIFICATION SUITE    ');
  console.log('================================================================\n');

  const adminId = '00000000-0000-0000-0000-000000000001';
  const adminEmail = 'annjan0077@gmail.com';
  const userId = '6e6852d5-3505-461e-839a-e60b1c781083';
  const userEmail = 'annjan7777@gmail.com';

  const adminToken = jwt.sign({ userId: adminId, email: adminEmail }, JWT_SECRET, { expiresIn: '2h' });
  const userToken = jwt.sign({ userId, email: userEmail }, JWT_SECRET, { expiresIn: '2h' });

  const BASE_URL = 'http://localhost:3001/api';

  try {
    // -------------------------------------------------------------------------
    // 1. INVENTORY: CATALOG CREATION SHOULD GENERATE ZERO NOTIFICATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Inventory Catalog Management (Zero-Notification Rule) ---');

    const notifCountBeforeRes = await query('SELECT COUNT(*) FROM notifications');
    const notifCountBefore = parseInt(notifCountBeforeRes.rows[0].count, 10);

    // Create a new catalog equipment item directly via API with assigned_to_user_id
    const catalogItemRes = await fetch(`${BASE_URL}/inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        item_name: 'Precision Micrometer E2E Test',
        category: 'Electronics',
        classification: 'Equipment',
        quantity: 1,
        location: 'Calibrated Tool Bay 1',
        condition: 'good',
        purchased_by: 'Annjan',
        assigned_to_user_id: adminId, // Assigning to admin during creation
        is_returnable: false,
      }),
    });

    const catalogItem = await catalogItemRes.json();
    recordTest(
      'Admin creates new inventory item in catalog with assigned_to_user_id',
      'ADMIN',
      catalogItemRes.status === 201 && !!catalogItem.id,
      `Status: ${catalogItemRes.status}, ID: ${catalogItem.id}`
    );

    const notifCountAfterCreate = await query('SELECT COUNT(*) FROM notifications');
    const diffCreate = parseInt(notifCountAfterCreate.rows[0].count, 10) - notifCountBefore;
    recordTest(
      'Catalog item creation sends 0 notifications (No spam to creator)',
      'DATABASE',
      diffCreate === 0,
      `Notifications added: ${diffCreate} (Expected: 0)`
    );

    // Update catalog item
    const updateItemRes = await fetch(`${BASE_URL}/inventory/${catalogItem.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        condition: 'new',
        location: 'Calibrated Tool Bay 2',
      }),
    });

    recordTest(
      'Admin updates inventory catalog item attributes',
      'ADMIN',
      updateItemRes.status === 200,
      `Status: ${updateItemRes.status}`
    );

    const notifCountAfterUpdate = await query('SELECT COUNT(*) FROM notifications');
    const diffUpdate = parseInt(notifCountAfterUpdate.rows[0].count, 10) - notifCountBefore;
    recordTest(
      'Catalog item update sends 0 notifications (No spam)',
      'DATABASE',
      diffUpdate === 0,
      `Notifications added: ${diffUpdate} (Expected: 0)`
    );

    // -------------------------------------------------------------------------
    // 2. INVENTORY REQUESTS WORKFLOW (USER REQUEST -> ADMIN APPROVE -> ISSUE)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Inventory Request Lifecycle & User-Specific Notifications ---');

    // User requests an item
    const userReqResponse = await fetch(`${BASE_URL}/inventory/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        inventory_item_id: catalogItem.id,
        quantity: 1,
        purpose: 'E2E Testing of request flow',
      }),
    });

    const userReqData = await userReqResponse.json();
    recordTest(
      'User submits inventory request for equipment item',
      'USER',
      userReqResponse.status === 201 && !!userReqData.id,
      `Request ID: ${userReqData.id}`
    );

    // Check user was NOT notified about their own request
    const userSelfNotifRes = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND related_entity_id = $2`,
      [userId, userReqData.id]
    );
    recordTest(
      'User does NOT receive self-notification for submitting their own request',
      'USER',
      parseInt(userSelfNotifRes.rows[0].count, 10) === 0,
      `Self-notifications: ${userSelfNotifRes.rows[0].count} (Expected: 0)`
    );

    // Check admin DID receive notification about new request
    const adminNotifRes = await query(
      `SELECT title, message FROM notifications WHERE user_id = $1 AND related_entity_id = $2`,
      [adminId, userReqData.id]
    );
    recordTest(
      'Admin receives notification about incoming inventory request',
      'ADMIN',
      adminNotifRes.rows.length > 0 && adminNotifRes.rows[0].title === 'New Inventory Request',
      adminNotifRes.rows[0]?.message
    );

    // Admin approves request
    const approveRes = await fetch(`${BASE_URL}/inventory/requests/${userReqData.id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    recordTest(
      'Admin approves user inventory request',
      'ADMIN',
      approveRes.status === 200,
      `Status: ${approveRes.status}`
    );

    // Check User received approval notification
    const userApproveNotif = await query(
      `SELECT title FROM notifications WHERE user_id = $1 AND related_entity_id = $2 AND type = 'inventory_request_approved'`,
      [userId, userReqData.id]
    );
    recordTest(
      'Requester receives "Inventory Request Approved" notification',
      'USER',
      userApproveNotif.rows.length > 0,
      userApproveNotif.rows[0]?.title
    );

    // Admin issues request
    const adminNotifsBeforeIssue = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1`,
      [adminId]
    );
    const adminNotifCountBeforeIssue = parseInt(adminNotifsBeforeIssue.rows[0].count, 10);

    const issueRes = await fetch(`${BASE_URL}/inventory/requests/${userReqData.id}/issue`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        is_returnable: false,
        remarks: 'Issued during E2E verification',
      }),
    });

    recordTest(
      'Admin issues inventory request to user',
      'ADMIN',
      issueRes.status === 200,
      `Status: ${issueRes.status}`
    );

    // Check user received issuance notification
    const userIssueNotif = await query(
      `SELECT title, message FROM notifications WHERE user_id = $1 AND related_entity_id = $2 AND type = 'inventory_item_issued'`,
      [userId, userReqData.id]
    );
    recordTest(
      'Requester receives "Inventory Item Issued" notification',
      'USER',
      userIssueNotif.rows.length > 0,
      userIssueNotif.rows[0]?.title
    );

    // Check Admin did NOT receive self-echo notification ("Item Assignment Recorded")
    const adminNotifsAfterIssue = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1`,
      [adminId]
    );
    const adminNotifDiffIssue = parseInt(adminNotifsAfterIssue.rows[0].count, 10) - adminNotifCountBeforeIssue;
    recordTest(
      'Admin receives NO self-echo notification upon issuing item',
      'ADMIN',
      adminNotifDiffIssue === 0,
      `Admin notifications received: ${adminNotifDiffIssue} (Expected: 0)`
    );

    // -------------------------------------------------------------------------
    // 3. EQUIPMENT RETURN REMINDERS (DUE TODAY & ASSIGNER NOTICES)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Equipment Return Reminders (Borrower & Assigner Dual Notification) ---');

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueDateStr = '2026-10-01'; // past date

    // Create a returnable item due TODAY: assigner = Admin, borrower = User
    const returnableDueToday = await query(`
      INSERT INTO inventory_items (
        item_name, category, classification, quantity, location, condition, is_returnable, expected_return_date, assigned_to_user_id, status
      ) VALUES (
        'Spectrophotometer Due Today E2E', 'Instruments', 'Equipment', 1, 'Lab 3', 'good', true, $1, $2, 'assigned'
      ) RETURNING id
    `, [todayStr, userId]);

    const reqDueToday = await query(`
      INSERT INTO inventory_requests (
        inventory_item_id, requested_by, issued_by, quantity, purpose, status, is_returnable, expected_return_date, issue_date
      ) VALUES (
        $1, $2, $3, 1, 'Research due today', 'issued', true, $4, NOW()
      ) RETURNING id
    `, [returnableDueToday.rows[0].id, userId, adminId, todayStr]);

    // Create a returnable item OVERDUE: assigner = Admin, borrower = User
    const returnableOverdue = await query(`
      INSERT INTO inventory_items (
        item_name, category, classification, quantity, location, condition, is_returnable, expected_return_date, assigned_to_user_id, status
      ) VALUES (
        'Laser Interferometer Overdue E2E', 'Instruments', 'Equipment', 1, 'Lab 1', 'good', true, $1, $2, 'assigned'
      ) RETURNING id
    `, [overdueDateStr, userId]);

    const reqOverdue = await query(`
      INSERT INTO inventory_requests (
        inventory_item_id, requested_by, issued_by, quantity, purpose, status, is_returnable, expected_return_date, issue_date
      ) VALUES (
        $1, $2, $3, 1, 'Testing overdue reminder', 'issued', true, $4, NOW()
      ) RETURNING id
    `, [returnableOverdue.rows[0].id, userId, adminId, overdueDateStr]);

    // Trigger the automated return reminder service (skipEmailSend: true prevents test email spam)
    const reminderResult = await checkAndTriggerEquipmentReturnReminders({ skipEmailSend: true });
    recordTest(
      'Equipment return reminder service executed successfully',
      'REMINDERS',
      reminderResult.dueTodayCount >= 1 && reminderResult.overdueCount >= 1,
      `Due today: ${reminderResult.dueTodayCount}, Overdue: ${reminderResult.overdueCount}`
    );

    // Verify Borrower got "Equipment Return Due Today"
    const borrowerDueNotif = await query(`
      SELECT title, message FROM notifications
      WHERE user_id = $1 AND related_entity_id = $2 AND type = 'inventory_return_due'
    `, [userId, reqDueToday.rows[0].id]);
    recordTest(
      'Borrower received "Equipment Return Due Today" notification',
      'USER',
      borrowerDueNotif.rows.length > 0 && borrowerDueNotif.rows[0].title === 'Equipment Return Due Today',
      borrowerDueNotif.rows[0]?.message
    );

    // Verify Assigner got "Equipment Return Due Today (Assigner Notice)"
    const assignerDueNotif = await query(`
      SELECT title, message FROM notifications
      WHERE user_id = $1 AND related_entity_id = $2 AND type = 'inventory_return_due'
    `, [adminId, reqDueToday.rows[0].id]);
    recordTest(
      'Assigner received "Equipment Return Due Today (Assigner Notice)"',
      'ADMIN',
      assignerDueNotif.rows.length > 0 && assignerDueNotif.rows[0].title.includes('Assigner Notice'),
      assignerDueNotif.rows[0]?.message
    );

    // Verify Borrower got "Equipment Return Overdue"
    const borrowerOverdueNotif = await query(`
      SELECT title, message FROM notifications
      WHERE user_id = $1 AND related_entity_id = $2 AND type = 'inventory_return_overdue'
    `, [userId, reqOverdue.rows[0].id]);
    recordTest(
      'Borrower received "Equipment Return Overdue" notification',
      'USER',
      borrowerOverdueNotif.rows.length > 0 && borrowerOverdueNotif.rows[0].title === 'Equipment Return Overdue',
      borrowerOverdueNotif.rows[0]?.message
    );

    // Verify Assigner got "Equipment Return Overdue (Assigner Notice)"
    const assignerOverdueNotif = await query(`
      SELECT title, message FROM notifications
      WHERE user_id = $1 AND related_entity_id = $2 AND type = 'inventory_return_overdue'
    `, [adminId, reqOverdue.rows[0].id]);
    recordTest(
      'Assigner received "Equipment Return Overdue (Assigner Notice)"',
      'ADMIN',
      assignerOverdueNotif.rows.length > 0 && assignerOverdueNotif.rows[0].title.includes('Assigner Notice'),
      assignerOverdueNotif.rows[0]?.message
    );

    // Verify status was updated to overdue in database
    const reqOverdueCheck = await query(`SELECT status FROM inventory_requests WHERE id = $1`, [reqOverdue.rows[0].id]);
    recordTest(
      'Overdue item request status automatically transitioned to "overdue"',
      'DATABASE',
      reqOverdueCheck.rows[0].status === 'overdue',
      `Status: ${reqOverdueCheck.rows[0].status}`
    );

    // Verify sent dates were recorded in database to prevent repeated spam
    const sentDatesCheck = await query(`
      SELECT last_borrower_reminder_sent_date, last_assigner_reminder_sent_date
      FROM inventory_requests WHERE id = $1
    `, [reqDueToday.rows[0].id]);
    recordTest(
      'Database recorded last reminder sent date for borrower and assigner',
      'DATABASE',
      !!sentDatesCheck.rows[0]?.last_borrower_reminder_sent_date && !!sentDatesCheck.rows[0]?.last_assigner_reminder_sent_date,
      `Borrower date: ${sentDatesCheck.rows[0]?.last_borrower_reminder_sent_date}, Assigner date: ${sentDatesCheck.rows[0]?.last_assigner_reminder_sent_date}`
    );

    // Clean up E2E reminder test data so no unreturned items linger
    await query(`DELETE FROM notifications WHERE related_entity_id IN ($1, $2)`, [reqDueToday.rows[0].id, reqOverdue.rows[0].id]);
    await query(`DELETE FROM inventory_requests WHERE id IN ($1, $2)`, [reqDueToday.rows[0].id, reqOverdue.rows[0].id]);
    await query(`DELETE FROM inventory_items WHERE id IN ($1, $2)`, [returnableDueToday.rows[0].id, returnableOverdue.rows[0].id]);

    // -------------------------------------------------------------------------
    // 4. WORK OVERVIEW: PROGRESS SPAM PREVENTION & ACTIVITY FEED
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Work Management: Progress Deduping & Activity Feed ---');

    // Create a work entry assigned to user with milestones
    const workItemRes = await query(`
      INSERT INTO assigned_works (
        work_title, description, project_name, issue_key, user_id, assigned_by, priority, admin_status
      ) VALUES (
        'E2E Real-time Mapping Pipeline', 'Detailed verification test work item', 'E2E Project', 'E2E-TEST-01', $1, 'Annjan', 'high', 'pending'
      ) RETURNING id
    `, [userId]);
    const workId = workItemRes.rows[0].id;

    // Add 4 milestones
    const m1 = await query(`
      INSERT INTO work_milestones (work_id, title, target_date, status)
      VALUES ($1, 'Schema design', CURRENT_DATE + 5, 'completed') RETURNING id
    `, [workId]);
    const m2 = await query(`
      INSERT INTO work_milestones (work_id, title, target_date, status)
      VALUES ($1, 'API scaffolding', CURRENT_DATE + 10, 'pending') RETURNING id
    `, [workId]);
    const m3 = await query(`
      INSERT INTO work_milestones (work_id, title, target_date, status)
      VALUES ($1, 'UI integration', CURRENT_DATE + 15, 'pending') RETURNING id
    `, [workId]);
    const m4 = await query(`
      INSERT INTO work_milestones (work_id, title, target_date, status)
      VALUES ($1, 'Final deployment', CURRENT_DATE + 20, 'pending') RETURNING id
    `, [workId]);

    // Initial progress update via work update endpoint with milestones
    const testMilestonesPayload = [
      { id: m1.rows[0].id, title: 'Schema design', target_date: '2026-10-15', is_completed: true, status: 'completed' },
      { id: m2.rows[0].id, title: 'API scaffolding', target_date: '2026-10-20', is_completed: false, status: 'pending' },
      { id: m3.rows[0].id, title: 'UI integration', target_date: '2026-10-25', is_completed: false, status: 'pending' },
      { id: m4.rows[0].id, title: 'Final deployment', target_date: '2026-11-05', is_completed: false, status: 'pending' },
    ];

    await fetch(`${BASE_URL}/work/${workId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        priority: 'high',
        description: 'Updated once',
        milestones: testMilestonesPayload,
      }),
    });

    const progressCountAfterFirstSave = await query(
      `SELECT completion_percentage, summary FROM progress_updates WHERE work_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [workId]
    );

    recordTest(
      'Progress update accurately computed from completed milestone (1 of 4 = 25%)',
      'DATABASE',
      parseInt(progressCountAfterFirstSave.rows[0]?.completion_percentage, 10) === 25,
      `Percentage: ${progressCountAfterFirstSave.rows[0]?.completion_percentage}%, Summary: ${progressCountAfterFirstSave.rows[0]?.summary}`
    );

    // Save work item 5 consecutive times with same milestones without progress movement
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/work/${workId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          priority: 'high',
          description: `Updated repeat ${i}`,
          milestones: testMilestonesPayload,
        }),
      });
    }

    const progressRowsTotal = await query(
      `SELECT COUNT(*) FROM progress_updates WHERE work_id = $1`,
      [workId]
    );
    const totalProgCount = parseInt(progressRowsTotal.rows[0].count, 10);
    recordTest(
      'Repeated work saves do NOT spam duplicate progress update rows (Deduping verified)',
      'DATABASE',
      totalProgCount === 1,
      `Total progress updates logged: ${totalProgCount} (Expected: exactly 1)`
    );

    // -------------------------------------------------------------------------
    // 5. MILESTONE CHANGE REQUEST & ACTIVITY FEED AUDIT TRAIL
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Milestone Change Requests & Activity Feed Trail ---');

    // User submits milestone change request
    const proposed = [
      { id: m1.rows[0].id, title: 'Schema design', target_date: '2026-10-15', is_completed: true },
      { id: m2.rows[0].id, title: 'API scaffolding', target_date: '2026-10-20', is_completed: false },
      { id: m3.rows[0].id, title: 'UI integration', target_date: '2026-10-25', is_completed: false },
      { id: m4.rows[0].id, title: 'Final deployment', target_date: '2026-11-05', is_completed: false },
    ];

    const changeReqRes = await fetch(`${BASE_URL}/work/${workId}/milestone-change-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        reason: 'Adjusting timeline due to hardware delivery delay',
        proposed_milestones: proposed,
      }),
    });

    const changeReqData = await changeReqRes.json();
    recordTest(
      'User submits milestone change request for work item',
      'USER',
      changeReqRes.status === 201 && !!changeReqData.id,
      `Change Request ID: ${changeReqData.id}`
    );

    // Admin reviews and approves milestone change request with notes
    const adminReviewRes = await fetch(`${BASE_URL}/work/${workId}/milestone-change-requests/${changeReqData.id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'approved',
        admin_notes: 'Approved. Ensure SIT testing starts on time.',
      }),
    });

    recordTest(
      'Admin approves milestone change request with administrative remarks',
      'ADMIN',
      adminReviewRes.status === 200,
      `Status: ${adminReviewRes.status}`
    );

    // User receives notification of milestone request approval
    const userMilestoneNotif = await query(`
      SELECT title, message FROM notifications
      WHERE user_id = $1 AND related_entity_id = $2 AND title LIKE 'Milestone Request APPROVED%'
    `, [userId, workId]);
    recordTest(
      'User receives notification of approved milestone changes with admin remarks',
      'USER',
      userMilestoneNotif.rows.length > 0,
      userMilestoneNotif.rows[0]?.message
    );

    // Check GET /api/work/:id/activity (Activity Feed & Audit Trail)
    const activityRes = await fetch(`${BASE_URL}/work/${workId}/activity`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const activityLogs = await activityRes.json();

    recordTest(
      'GET /api/work/:id/activity returns valid JSON array of audit logs',
      'DATABASE',
      Array.isArray(activityLogs) && activityLogs.length >= 2,
      `Logs returned: ${Array.isArray(activityLogs) ? activityLogs.length : 'none'}`
    );

    const approveLog = activityLogs.find((l: any) => l.action === 'change_request_approved');
    recordTest(
      'Activity feed displays performer name ("Annjan") and role ("admin")',
      'ADMIN',
      approveLog && approveLog.user_name === 'Annjan' && approveLog.user_role === 'admin',
      `Performer: ${approveLog?.user_name} [${approveLog?.user_role}]`
    );

    recordTest(
      'Activity feed displays remarks with supervisor notes',
      'ADMIN',
      approveLog && approveLog.remarks.includes('Ensure SIT testing starts on time'),
      approveLog?.remarks
    );

    // -------------------------------------------------------------------------
    // 6. ACCESS CONTROL & ROLE-BASED INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Access Control & Role Boundary Tests ---');

    // Standard User cannot review milestone change requests
    const userForbiddenReview = await fetch(`${BASE_URL}/work/${workId}/milestone-change-requests/${changeReqData.id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ status: 'approved' }),
    });

    recordTest(
      'Standard user is blocked (403 Forbidden) from reviewing milestone requests',
      'USER',
      userForbiddenReview.status === 403,
      `Status: ${userForbiddenReview.status}`
    );

    // Standard User cannot access admin users list
    const userBlockedAdmin = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    recordTest(
      'Standard user is blocked from viewing admin management endpoints',
      'USER',
      userBlockedAdmin.status === 403,
      `Status: ${userBlockedAdmin.status}`
    );

    // Clean up temporary E2E test rows
    await query('DELETE FROM notifications WHERE related_entity_id IN ($1, $2, $3, $4)', [
      userReqData.id, reqDueToday.rows[0].id, reqOverdue.rows[0].id, workId
    ]);
    await query('DELETE FROM inventory_requests WHERE id IN ($1, $2, $3)', [
      userReqData.id, reqDueToday.rows[0].id, reqOverdue.rows[0].id
    ]);
    await query('DELETE FROM inventory_items WHERE id IN ($1, $2, $3)', [
      catalogItem.id, returnableDueToday.rows[0].id, returnableOverdue.rows[0].id
    ]);
    await query('DELETE FROM audit_logs WHERE entity_id = $1', [workId]);
    await query('DELETE FROM milestone_change_requests WHERE work_id = $1', [workId]);
    await query('DELETE FROM progress_updates WHERE work_id = $1', [workId]);
    await query('DELETE FROM work_milestones WHERE work_id = $1', [workId]);
    await query('DELETE FROM assigned_works WHERE id = $1', [workId]);

    console.log('\n================================================================');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`E2E SUITE COMPLETE: ${passedCount}/${results.length} assertions passed.`);
    console.log('================================================================\n');

    if (passedCount !== results.length) {
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('Fatal E2E error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runComprehensiveVerification();
