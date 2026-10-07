import { query, pool } from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

interface StepResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: StepResult[] = [];

function record(suite: string, name: string, condition: boolean, details = '') {
  results.push({ suite, name, passed: condition, details });
  const icon = condition ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`  ${icon} [${suite}] ${name} ${details ? '(' + details + ')' : ''}`);
  if (!condition) {
    console.error(`      ERROR DETAILS: ${details}`);
  }
}

async function runUATSuite() {
  console.log('========================================================================');
  console.log('   SC LAB PORTAL — REAL HTTP / RBAC SECURITY ACCEPTANCE TEST (UAT)      ');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 0. Setup: Real Authenticated Users & Role IDs
    // -------------------------------------------------------------------------
    console.log('--- 0. Test Fixtures & Authentication Setup ---');

    // Admin user profile
    const adminRes = await query("SELECT id, email, user_role, role_id FROM user_profiles WHERE user_role = 'admin' LIMIT 1");
    if (adminRes.rows.length === 0) {
      throw new Error('No admin user found in database');
    }
    const admin = adminRes.rows[0];

    // Normal user profile
    const userRes = await query("SELECT id, email, user_role, role_id, full_name, department, require_password_change, is_profile_completed FROM user_profiles WHERE user_role = 'user' LIMIT 1");
    if (userRes.rows.length === 0) {
      throw new Error('No regular user found in database');
    }
    const regularUser = userRes.rows[0];

    // Admin role
    const adminRoleRes = await query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    const adminRoleId = adminRoleRes.rows[0]?.id;
    if (!adminRoleId) {
      throw new Error('No admin role found in database');
    }

    // User role
    const userRoleRes = await query("SELECT id FROM roles WHERE name = 'user' LIMIT 1");
    const userRoleId = userRoleRes.rows[0]?.id;

    const adminToken = jwt.sign({ userId: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '1h' });
    const userToken = jwt.sign({ userId: regularUser.id, email: regularUser.email }, JWT_SECRET, { expiresIn: '1h' });

    // Verify /api/auth/me for both
    const meAdminRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meAdmin = await meAdminRes.json();
    record('SETUP', 'Admin authenticates via /api/auth/me', meAdminRes.status === 200 && meAdmin.profile?.user_role === 'admin', `Status: ${meAdminRes.status}`);

    const meUserRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meUser = await meUserRes.json();
    const initialUserPermCount = meUser.permissions?.length || 0;
    record('SETUP', 'Normal user authenticates via /api/auth/me', meUserRes.status === 200 && meUser.profile?.user_role === 'user', `Permissions: ${initialUserPermCount}`);

    // -------------------------------------------------------------------------
    // BUG-01: Privilege escalation via role_id mass assignment
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-01: Privilege Escalation via role_id Mass Assignment ---');

    // Step 1: Normal user attempts to escalate own role to admin via PUT /api/users/:id
    const escalateRes = await fetch(`${BASE_URL}/users/${regularUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        role_id: adminRoleId,
        user_role: 'admin',
        full_name: 'Regular User Attacking',
      }),
    });
    const escalateBody = await escalateRes.json();

    // Verify response does not have admin role_id
    const responseProtected = escalateBody.role_id !== adminRoleId && escalateBody.user_role !== 'admin';
    record('BUG-01', 'Normal user role_id assignment ignored or rejected in response', responseProtected, `role_id: ${escalateBody.role_id}, user_role: ${escalateBody.user_role}`);

    // Step 2: Call /api/auth/me and verify permissions did NOT elevate
    const checkMeEscalate = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const checkMeData = await checkMeEscalate.json();
    const permissionsElevated = checkMeData.permissions?.length > initialUserPermCount || checkMeData.profile?.user_role === 'admin';
    record('BUG-01', 'Normal user permissions NOT elevated on /api/auth/me', !permissionsElevated, `Perm count: ${checkMeData.permissions?.length}`);

    // Step 3: Verify database state was NOT changed
    const dbCheckUser = await query('SELECT role_id, user_role FROM user_profiles WHERE id = $1', [regularUser.id]);
    const dbRoleMatchesOld = dbCheckUser.rows[0].role_id === regularUser.role_id && dbCheckUser.rows[0].user_role === 'user';
    record('BUG-01', 'Database user role_id remains unchanged', dbRoleMatchesOld, `DB role_id: ${dbCheckUser.rows[0].role_id}`);

    // Step 4: Normal user attempts to update ANOTHER user's profile
    const attackOtherRes = await fetch(`${BASE_URL}/users/${admin.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        full_name: 'Hacked Name',
      }),
    });
    record('BUG-01', 'Normal user blocked (403) from updating another user', attackOtherRes.status === 403, `Status: ${attackOtherRes.status}`);

    // Step 5: Admin legitimately updates user profile
    const adminLegitUpdate = await fetch(`${BASE_URL}/users/${regularUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        department: 'Verified Testing Dept',
      }),
    });
    record('BUG-01', 'Admin can legitimately update user profile (200)', adminLegitUpdate.status === 200, `Status: ${adminLegitUpdate.status}`);

    // -------------------------------------------------------------------------
    // BUG-02: Unauthorized role information disclosure
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-02: Unauthorized Role Information Disclosure ---');

    const normalUserRolesRes = await fetch(`${BASE_URL}/settings/roles`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    record('BUG-02', 'Normal user blocked (403 Forbidden) from /api/settings/roles', normalUserRolesRes.status === 403, `Status: ${normalUserRolesRes.status}`);

    const adminRolesRes = await fetch(`${BASE_URL}/settings/roles`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminRolesData = await adminRolesRes.json();
    const adminGotRoles = adminRolesRes.status === 200 && Array.isArray(adminRolesData) && adminRolesData.length > 0;
    record('BUG-02', 'Admin receives legitimate role data (200 OK) from /api/settings/roles', adminGotRoles, `Status: ${adminRolesRes.status}, count: ${adminRolesData?.length}`);

    // -------------------------------------------------------------------------
    // BUG-03: Unauthorized permission information disclosure
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-03: Unauthorized Permission Information Disclosure ---');

    const normalUserPermsRes = await fetch(`${BASE_URL}/settings/permissions`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    record('BUG-03', 'Normal user blocked (403 Forbidden) from /api/settings/permissions', normalUserPermsRes.status === 403, `Status: ${normalUserPermsRes.status}`);

    const adminPermsRes = await fetch(`${BASE_URL}/settings/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminPermsData = await adminPermsRes.json();
    const adminGotPerms = adminPermsRes.status === 200 && Array.isArray(adminPermsData) && adminPermsData.length > 0;
    record('BUG-03', 'Admin receives permission definitions (200 OK) from /api/settings/permissions', adminGotPerms, `Status: ${adminPermsRes.status}, count: ${adminPermsData?.length}`);

    // -------------------------------------------------------------------------
    // BUG-04: Security-sensitive fields mass assigned
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-04: Security-Sensitive Fields Mass Assignment ---');

    const freshUserRes = await query('SELECT require_password_change, is_profile_completed FROM user_profiles WHERE id = $1', [regularUser.id]);
    const origReqPw = freshUserRes.rows[0].require_password_change ?? false;
    const origProfileComp = freshUserRes.rows[0].is_profile_completed ?? false;

    // Normal user attempts to flip require_password_change and is_profile_completed
    const secFieldsAttack = await fetch(`${BASE_URL}/users/${regularUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        require_password_change: !origReqPw,
        is_profile_completed: !origProfileComp,
        phone_number: '1234567890',
      }),
    });

    // Verify DB columns remain unchanged
    const dbSecCheck = await query('SELECT require_password_change, is_profile_completed FROM user_profiles WHERE id = $1', [regularUser.id]);
    const secFieldsUntouched = dbSecCheck.rows[0].require_password_change === origReqPw && dbSecCheck.rows[0].is_profile_completed === origProfileComp;
    record('BUG-04', 'Security fields (require_password_change, is_profile_completed) stripped from normal user update', secFieldsUntouched, `require_pw: ${dbSecCheck.rows[0].require_password_change}, is_profile_comp: ${dbSecCheck.rows[0].is_profile_completed}`);

    // -------------------------------------------------------------------------
    // BUG-05: User deletion crashes due to reviewer foreign keys + self-deletion guard
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-05: User Deletion Reviewer FKs & Self-Deletion Guard ---');

    // Subtest 1: Admin self-deletion guard
    const selfDeleteRes = await fetch(`${BASE_URL}/users/${admin.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('BUG-05', 'Admin self-deletion blocked with 400 Bad Request', selfDeleteRes.status === 400, `Status: ${selfDeleteRes.status}`);

    const adminStillExists = await query('SELECT id FROM users WHERE id = $1', [admin.id]);
    record('BUG-05', 'Admin account intact in database after self-deletion attempt', adminStillExists.rows.length === 1);

    // Subtest 2: User deletion with reviewer foreign keys
    // Create a temporary reviewer user
    const tempId = crypto.randomUUID();
    const tempEmail = `reviewer_test_${Date.now()}@example.com`;
    await query(`
      INSERT INTO users (id, email, password_hash)
      VALUES ($1, $2, 'dummy_hash')
    `, [tempId, tempEmail]);
    await query(`
      INSERT INTO user_profiles (id, email, full_name, user_role, role_id, is_active)
      VALUES ($1, $2, 'Temp Reviewer', 'user', $3, true)
    `, [tempId, tempEmail, userRoleId]);

    // Create a temporary work item
    const tempWorkRes = await query(`
      INSERT INTO assigned_works (user_id, project_name, assigned_by, work_title)
      VALUES ($1, 'Reviewer Test Project', 'Admin', 'Reviewer FK Test Work')
      RETURNING id
    `, [admin.id]);
    const tempWorkId = tempWorkRes.rows[0].id;

    // Create a work_milestone with justification_reviewed_by = tempId
    const tempMilestoneRes = await query(`
      INSERT INTO work_milestones (work_id, title, status, justification_reviewed_by, justification_reviewed_at)
      VALUES ($1, 'FK Milestone Test', 'completed', $2, NOW())
      RETURNING id
    `, [tempWorkId, tempId]);
    const tempMilestoneId = tempMilestoneRes.rows[0].id;

    // Create a milestone_change_request with reviewed_by = tempId
    const tempChangeReqRes = await query(`
      INSERT INTO milestone_change_requests (work_id, requested_by, reason, proposed_milestones, previous_milestones, status, reviewed_by, reviewed_at)
      VALUES ($1, $2, 'Testing FK review deletion', '[]', '[]', 'approved', $3, NOW())
      RETURNING id
    `, [tempWorkId, admin.id, tempId]);
    const tempChangeReqId = tempChangeReqRes.rows[0].id;

    // Now Admin deletes the temporary reviewer user via DELETE /api/users/:id
    const deleteReviewerRes = await fetch(`${BASE_URL}/users/${tempId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record('BUG-05', 'User deletion with reviewer foreign keys succeeds (200 OK, no 500)', deleteReviewerRes.status === 200, `Status: ${deleteReviewerRes.status}`);

    // Verify temp reviewer user is gone
    const checkDeletedUser = await query('SELECT id FROM users WHERE id = $1', [tempId]);
    record('BUG-05', 'Deleted user completely removed from users table', checkDeletedUser.rows.length === 0);

    // Verify milestone and change request records remain intact and reviewer FK is nullified
    const checkMilestone = await query('SELECT id, justification_reviewed_by FROM work_milestones WHERE id = $1', [tempMilestoneId]);
    const milestoneIntactAndNullified = checkMilestone.rows.length === 1 && checkMilestone.rows[0].justification_reviewed_by === null;
    record('BUG-05', 'Work milestone intact with justification_reviewed_by nullified', milestoneIntactAndNullified);

    const checkChangeReq = await query('SELECT id, reviewed_by FROM milestone_change_requests WHERE id = $1', [tempChangeReqId]);
    const changeReqIntactAndNullified = checkChangeReq.rows.length === 1 && checkChangeReq.rows[0].reviewed_by === null;
    record('BUG-05', 'Milestone change request intact with reviewed_by nullified', changeReqIntactAndNullified);

    // Clean up temporary fixtures
    await query('DELETE FROM milestone_change_requests WHERE id = $1', [tempChangeReqId]);
    await query('DELETE FROM work_milestones WHERE id = $1', [tempMilestoneId]);
    await query('DELETE FROM assigned_works WHERE id = $1', [tempWorkId]);

    // -------------------------------------------------------------------------
    // BUG-06: Open redirect / untrusted URL injection in repository
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-06: Open Redirect / Untrusted URL Injection in Repository ---');

    // Test malicious schemes on upload
    const maliciousUrls = [
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'not-a-valid-url-format',
      'ftp://untrusted.server/file.exe',
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8080/secret',
      'http://localhost/admin',
      'http://10.0.0.1/internal',
    ];

    for (const badUrl of maliciousUrls) {
      const badUploadRes = await fetch(`${BASE_URL}/repository/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          title: 'Malicious Payload Test',
          document_url: badUrl,
          category: 'Papers',
        }),
      });
      record('BUG-06', `Repository upload rejects unsafe scheme/URL: "${badUrl}" with 400`, badUploadRes.status === 400, `Status: ${badUploadRes.status}`);
    }

    // Test valid HTTPS URL upload
    const safeUploadRes = await fetch(`${BASE_URL}/repository/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Legitimate Lab Research Paper',
        document_url: 'https://arxiv.org/abs/2301.00001',
        category: 'Papers',
      }),
    });
    const safeDoc = await safeUploadRes.json();
    record('BUG-06', 'Repository upload accepts legitimate HTTPS URL with 201 Created', safeUploadRes.status === 201 && !!safeDoc.id, `Status: ${safeUploadRes.status}`);

    // Test download/redirect on safe item
    if (safeDoc.id) {
      const redirectRes = await fetch(`${BASE_URL}/repository/download/${safeDoc.id}`, {
        headers: { Authorization: `Bearer ${userToken}` },
        redirect: 'manual', // do not follow redirect to verify 302 location
      });
      const location = redirectRes.headers.get('location');
      record('BUG-06', 'Repository download redirects (302) to safe external destination', redirectRes.status === 302 && location === 'https://arxiv.org/abs/2301.00001', `Status: ${redirectRes.status}, Location: ${location}`);

      // Clean up test repository item
      await query('DELETE FROM repository_documents WHERE id = $1', [safeDoc.id]);
    }

    // -------------------------------------------------------------------------
    // BUG-07: Generic CRUD missing required fields pre-validation (400 vs 500)
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-07: Generic CRUD Missing Fields Pre-Validation ---');

    // 1. Purchase request without category
    const badPurchaseRes = await fetch(`${BASE_URL}/purchase-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        item_name: 'Oscilloscope Probe',
        // missing category!
      }),
    });
    const badPurchaseBody = await badPurchaseRes.json();
    record('BUG-07', 'Purchase request missing required category returns 400 Bad Request (not 500)', badPurchaseRes.status === 400, `Status: ${badPurchaseRes.status}, error: ${badPurchaseBody.error}`);

    // 2. Leave request without required dates
    const badLeaveRes1 = await fetch(`${BASE_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        leave_type: 'Sick Leave',
        // missing from_date and to_date!
      }),
    });
    const badLeaveBody1 = await badLeaveRes1.json();
    record('BUG-07', 'Leave request missing dates returns 400 Bad Request (not 500)', badLeaveRes1.status === 400, `Status: ${badLeaveRes1.status}, error: ${badLeaveBody1.error}`);

    // 3. Leave request with inverted dates (from_date > to_date)
    const badLeaveRes2 = await fetch(`${BASE_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        leave_type: 'Sick Leave',
        from_date: '2026-12-10',
        to_date: '2026-12-05',
      }),
    });
    record('BUG-07', 'Leave request with inverted dates returns 400 Bad Request', badLeaveRes2.status === 400, `Status: ${badLeaveRes2.status}`);

    // 4. Valid leave request returns 201 Created
    const goodLeaveRes = await fetch(`${BASE_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        leave_type: 'Casual Leave',
        from_date: '2026-12-01',
        to_date: '2026-12-02',
        reason: 'Attending symposium',
      }),
    });
    const goodLeaveBody = await goodLeaveRes.json();
    record('BUG-07', 'Valid leave request returns 201 Created', goodLeaveRes.status === 201 && !!goodLeaveBody.id, `Status: ${goodLeaveRes.status}`);

    if (goodLeaveBody.id) {
      await query('DELETE FROM leave_requests WHERE id = $1', [goodLeaveBody.id]);
    }

    // -------------------------------------------------------------------------
    // BUG-08: Work Authorization & Name-Collision Protection on assigned_by
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-08: Work Authorization & Name Collision Protection ---');

    // 1. Create a victim work item assigned to admin by "Target Supervisor Name"
    const victimWorkRes = await query(
      `INSERT INTO assigned_works (user_id, project_name, assigned_by, work_title, priority, admin_status)
       VALUES ($1, 'Security Test Project', 'Target Supervisor Name', 'Target Work Title', 'medium', 'pending')
       RETURNING id`,
      [admin.id]
    );
    const victimWorkId = victimWorkRes.rows[0].id;

    // 2. Attacker changes full_name to match victim's assigned_by
    await query("UPDATE user_profiles SET full_name = 'Target Supervisor Name' WHERE id = $1", [regularUser.id]);

    // 3. Attacker attempts to read victim's work
    const collReadRes = await fetch(`${BASE_URL}/work/${victimWorkId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    record('BUG-08', 'Name-collision read attack blocked with 403 Forbidden', collReadRes.status === 403, `Status: ${collReadRes.status}`);

    // 4. Attacker attempts to overwrite victim's work
    const collWriteRes = await fetch(`${BASE_URL}/work/${victimWorkId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ work_title: 'PWNED' }),
    });
    record('BUG-08', 'Name-collision write attack blocked with 403 Forbidden', collWriteRes.status === 403, `Status: ${collWriteRes.status}`);

    // Verify DB integrity
    const dbCheckRes = await query('SELECT work_title FROM assigned_works WHERE id = $1', [victimWorkId]);
    record('BUG-08', 'Database record remained untouched by failed attack', dbCheckRes.rows[0]?.work_title === 'Target Work Title', `Title: ${dbCheckRes.rows[0]?.work_title}`);

    // 5. Attacker work list query must NOT leak victim work
    const attackerListRes = await fetch(`${BASE_URL}/work`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const attackerListData = await attackerListRes.json();
    const leaked = Array.isArray(attackerListData) && attackerListData.some((w: any) => w.id === victimWorkId);
    record('BUG-08', 'Work list does not leak victim work on name collision', !leaked, `Leaked: ${leaked}`);

    // 6. Legitimate supervisor using verified assigned_by_user_id CAN access work
    await query('UPDATE assigned_works SET assigned_by_user_id = $1 WHERE id = $2', [regularUser.id, victimWorkId]);
    const legitReadRes = await fetch(`${BASE_URL}/work/${victimWorkId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    record('BUG-08', 'Verified supervisor with assigned_by_user_id foreign key can read work (200)', legitReadRes.status === 200, `Status: ${legitReadRes.status}`);

    // Cleanup
    await query('DELETE FROM assigned_works WHERE id = $1', [victimWorkId]);
    await query("UPDATE user_profiles SET full_name = 'Annjan Member' WHERE id = $1", [regularUser.id]);

    // -------------------------------------------------------------------------
    // BUG-09: Robustness Gaps (SCL-23)
    // -------------------------------------------------------------------------
    console.log('\n--- BUG-09: Robustness Gaps (SCL-23) ---');

    // Part A: Progress update input validation & check constraint error mapping
    const testProgWorkRes = await query(
      `INSERT INTO assigned_works (user_id, project_name, assigned_by, work_title, priority, admin_status)
       VALUES ($1, 'Progress Robustness Test', 'Supervisor', 'Check Progress Validation', 'medium', 'pending')
       RETURNING id`,
      [regularUser.id]
    );
    const testProgWorkId = testProgWorkRes.rows[0].id;

    // Bad input 1: completion_percentage = 999
    const badPctRes1 = await fetch(`${BASE_URL}/work/${testProgWorkId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ completion_percentage: 999, summary: 'Out of bounds test' }),
    });
    record('BUG-09', 'Progress update with completion_percentage: 999 returns 400 Bad Request (not 500)', badPctRes1.status === 400, `Status: ${badPctRes1.status}`);

    // Bad input 2: completion_percentage = -10
    const badPctRes2 = await fetch(`${BASE_URL}/work/${testProgWorkId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ completion_percentage: -10, summary: 'Negative percentage test' }),
    });
    record('BUG-09', 'Progress update with negative completion_percentage returns 400 Bad Request', badPctRes2.status === 400, `Status: ${badPctRes2.status}`);

    // Bad input 3: invalid status
    const badStatusRes = await fetch(`${BASE_URL}/work/${testProgWorkId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ completion_percentage: 50, status: 'invalid_status_xyz' }),
    });
    record('BUG-09', 'Progress update with invalid status returns 400 Bad Request', badStatusRes.status === 400, `Status: ${badStatusRes.status}`);

    // Valid progress update succeeds
    const goodProgRes = await fetch(`${BASE_URL}/work/${testProgWorkId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ completion_percentage: 45, status: 'on_track', summary: 'Sprint 1 on track' }),
    });
    record('BUG-09', 'Valid progress update returns 201 Created', goodProgRes.status === 201, `Status: ${goodProgRes.status}`);

    // Cleanup progress test work
    await query('DELETE FROM assigned_works WHERE id = $1', [testProgWorkId]);

    // Part B: Equipment booking concurrent double-booking race condition (TOCTOU)
    const equipRes = await query("SELECT id, item_name FROM inventory_items WHERE classification = 'Equipment' LIMIT 1");
    if (equipRes.rows.length > 0) {
      const equipId = equipRes.rows[0].id;
      const startTime = '2099-06-01T14:00:00.000Z';
      const endTime = '2099-06-01T16:00:00.000Z';

      // Send two simultaneous requests for the EXACT same equipment slot
      const [raceRes1, raceRes2] = await Promise.all([
        fetch(`${BASE_URL}/inventory/${equipId}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ title: 'Concurrent Reservation A', start_time: startTime, end_time: endTime }),
        }),
        fetch(`${BASE_URL}/inventory/${equipId}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ title: 'Concurrent Reservation B', start_time: startTime, end_time: endTime }),
        }),
      ]);

      const statuses = [raceRes1.status, raceRes2.status].sort();
      const racePrevented = statuses[0] === 201 && statuses[1] === 409;
      record('BUG-09', 'Simultaneous equipment booking race condition prevented: exactly one 201 and one 409', racePrevented, `Statuses: ${statuses.join(', ')}`);

      // Cleanup test booking
      await query('DELETE FROM equipment_bookings WHERE inventory_item_id = $1 AND start_time = $2', [equipId, startTime]);
    }


    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`UAT ACCEPTANCE SUITE COMPLETE: ${passedCount}/${results.length} assertions passed.`);
    console.log('========================================================================\n');

    if (passedCount !== results.length) {
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('Fatal UAT error:', err);
    process.exitCode = 1;
  } finally {
    try {
      const userRes = await query("SELECT id, full_name FROM user_profiles WHERE user_role = 'user' AND email = 'annjan7777@gmail.com' LIMIT 1");
      if (userRes.rows.length > 0 && userRes.rows[0].full_name === 'Regular User Attacking') {
        await query("UPDATE user_profiles SET full_name = 'Annjan Member', department = NULL WHERE id = $1", [userRes.rows[0].id]);
      }
    } catch (_) {}
    await pool.end();
  }
}

runUATSuite();
