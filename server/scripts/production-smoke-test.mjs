import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sclab',
  user: process.env.DB_USER || 'annjan',
  password: process.env.DB_PASSWORD || undefined,
});

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const adminId = '00000000-0000-0000-0000-000000000001';
const adminEmail = 'annjan0077@gmail.com';
const memberId = '6e6852d5-3505-461e-839a-e60b1c781083';
const memberEmail = 'annjan7777@gmail.com';

const adminToken = jwt.sign({ userId: adminId, email: adminEmail }, JWT_SECRET, { expiresIn: '1h' });
const memberToken = jwt.sign({ userId: memberId, email: memberEmail }, JWT_SECRET, { expiresIn: '1h' });

let passCount = 0;
let failCount = 0;

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName} ${extra ? '(' + extra + ')' : ''}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${extra ? '(' + extra + ')' : ''}`);
    failCount++;
  }
}

async function runSmokeTest() {
  console.log('========================================================================');
  console.log('   SC LAB PORTAL — PRODUCTION READINESS SMOKE TEST                      ');
  console.log('========================================================================\n');

  // 1. Guest Fail-Closed
  const guestRes = await fetch(`${BASE_URL}/dashboard/stats`);
  assert(guestRes.status === 401, 'Guest request without token is rejected with 401', `Status: ${guestRes.status}`);

  // 2. Auth & Profiles
  const adminMe = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const adminData = await adminMe.json();
  assert(adminMe.status === 200 && adminData.profile?.user_role === 'admin', 'Admin token authenticated on /api/auth/me', `Role: ${adminData.profile?.user_role}`);

  const memberMe = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const memberData = await memberMe.json();
  assert(memberMe.status === 200 && memberData.profile?.user_role === 'user', 'Member token authenticated on /api/auth/me', `Role: ${memberData.profile?.user_role}`);

  // 3. RBAC Boundaries
  const memberAdminUsers = await fetch(`${BASE_URL}/admin/users`, { headers: { Authorization: `Bearer ${memberToken}` } });
  assert(memberAdminUsers.status === 403, 'Member blocked (403) from accessing /api/admin/users', `Status: ${memberAdminUsers.status}`);

  const memberSettings = await fetch(`${BASE_URL}/settings/roles`, { headers: { Authorization: `Bearer ${memberToken}` } });
  assert(memberSettings.status === 403, 'Member blocked (403) from accessing /api/settings/roles', `Status: ${memberSettings.status}`);

  const memberAudit = await fetch(`${BASE_URL}/audit-logs`, { headers: { Authorization: `Bearer ${memberToken}` } });
  assert(memberAudit.status === 403, 'Member blocked (403) from accessing /api/audit-logs', `Status: ${memberAudit.status}`);

  // 4. Core Module Reads
  const projectsRes = await fetch(`${BASE_URL}/projects`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const projectsData = await projectsRes.json();
  assert(projectsRes.status === 200 && Array.isArray(projectsData) && projectsData.length >= 20, 'Projects list retrieved successfully', `Count: ${projectsData.length}`);

  const facilitiesRes = await fetch(`${BASE_URL}/facilities`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const facilitiesData = await facilitiesRes.json();
  assert(facilitiesRes.status === 200 && Array.isArray(facilitiesData) && facilitiesData.length === 2, 'Facilities catalog retrieved successfully', `Count: ${facilitiesData.length}`);

  const inventoryRes = await fetch(`${BASE_URL}/inventory`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const inventoryData = await inventoryRes.json();
  assert(inventoryRes.status === 200 && Array.isArray(inventoryData) && inventoryData.length === 2, 'Inventory catalog retrieved successfully', `Count: ${inventoryData.length}`);

  const workRes = await fetch(`${BASE_URL}/work`, { headers: { Authorization: `Bearer ${memberToken}` } });
  assert(workRes.status === 200, 'Work overview retrieved successfully', `Status: ${workRes.status}`);

  const milestonesRes = await fetch(`${BASE_URL}/work-milestones`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const milestonesData = await milestonesRes.json();
  assert(milestonesRes.status === 200 && Array.isArray(milestonesData), 'Work milestones retrieved successfully', `Count: ${milestonesData.length}`);

  const notifsRes = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const notifsData = await notifsRes.json();
  assert(notifsRes.status === 200 && Array.isArray(notifsData), 'Clean production notifications retrieved', `Count: ${notifsData.length}`);

  const adminDashboardRes = await fetch(`${BASE_URL}/dashboard/stats`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const adminDashboardData = await adminDashboardRes.json();
  assert(adminDashboardRes.status === 200 && adminDashboardData.totalUsers === 2, 'Admin dashboard aggregated stats retrieved', `Total Users: ${adminDashboardData.totalUsers}, Facilities: ${adminDashboardData.facilitiesCount}, Inventory: ${adminDashboardData.inventoryCount}`);

  const memberDashboardRes = await fetch(`${BASE_URL}/dashboard/stats`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const memberDashboardData = await memberDashboardRes.json();
  assert(memberDashboardRes.status === 200 && memberDashboardData.inventoryCount === 2, 'Member dashboard personal stats retrieved', `Inventory Count: ${memberDashboardData.inventoryCount}`);

  // 5. Security Fixes Intact
  // BUG-01 Mass assignment protection
  const massAssign = await fetch(`${BASE_URL}/users/${memberId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
    body: JSON.stringify({ role: 'admin', is_admin: true, user_role: 'admin' }),
  });
  const massAssignData = await massAssign.json();
  assert(massAssignData.user_role !== 'admin', 'Mass assignment on user_role prevented on PUT /api/users/:id', `Role remains: ${massAssignData.user_role}`);

  // BUG-04 Admin self-deletion guard
  const selfDel = await fetch(`${BASE_URL}/users/${adminId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(selfDel.status === 400, 'Admin self-deletion blocked with 400 Bad Request', `Status: ${selfDel.status}`);

  // BUG-06 Safe repository URL validation
  const badUrlRes = await fetch(`${BASE_URL}/repository/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
    body: JSON.stringify({ title: 'XSS Attack', document_url: 'javascript:alert(1)', category: 'Papers' }),
  });
  assert(badUrlRes.status === 400, 'Unsafe javascript: protocol rejected in repository upload with 400', `Status: ${badUrlRes.status}`);

  // Account Lockout Prevention (Unauthenticated forgot-password does NOT change password_hash)
  const initialHashRes = await pool.query('SELECT password_hash FROM users WHERE email = $1', [memberEmail]);
  const initialHash = initialHashRes.rows[0]?.password_hash;

  const forgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: memberEmail }),
  });
  assert(forgotRes.status === 200, 'Unauthenticated forgot-password request succeeds with 200', `Status: ${forgotRes.status}`);

  const afterForgotRes = await pool.query('SELECT password_hash, reset_password_token, reset_password_expires FROM users WHERE email = $1', [memberEmail]);
  const afterHash = afterForgotRes.rows[0]?.password_hash;
  const resetToken = afterForgotRes.rows[0]?.reset_password_token;

  assert(initialHash === afterHash, 'Account lockout prevented: password_hash untouched on forgot-password request', 'Hash unchanged');
  assert(Boolean(resetToken), 'Short-lived reset_password_token stored in database', 'Token present');

  // Cleanup the generated reset token so no lingering token remains in DB
  await pool.query('UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE email = $1', [memberEmail]);

  // Name Collision Protection: Verify user cannot gain access by changing full_name to match assigned_by
  const collisionWorkRes = await pool.query(
    `INSERT INTO assigned_works (user_id, project_name, assigned_by, work_title, priority, admin_status)
     VALUES ($1, 'Smoke Test Project', 'Fake Supervisor Name', 'Protected Work Item', 'medium', 'pending')
     RETURNING id`,
    [adminId]
  );
  const smokeWorkId = collisionWorkRes.rows[0].id;

  // Temporarily set member's full_name to match the work's assigned_by
  await pool.query("UPDATE user_profiles SET full_name = 'Fake Supervisor Name' WHERE id = $1", [memberId]);

  const collisionGetRes = await fetch(`${BASE_URL}/work/${smokeWorkId}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  assert(collisionGetRes.status === 403, 'Name collision read blocked with 403: full_name matching assigned_by cannot read work', `Status: ${collisionGetRes.status}`);

  const collisionPutRes = await fetch(`${BASE_URL}/work/${smokeWorkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
    body: JSON.stringify({ work_title: 'PWNED' }),
  });
  assert(collisionPutRes.status === 403, 'Name collision write blocked with 403: full_name matching assigned_by cannot update work', `Status: ${collisionPutRes.status}`);

  // Restore member's real name and delete smoke work item
  await pool.query("UPDATE user_profiles SET full_name = 'Annjan Member' WHERE id = $1", [memberId]);
  await pool.query('DELETE FROM assigned_works WHERE id = $1', [smokeWorkId]);
  await pool.end();

  console.log('\n========================================================================');
  console.log(`PRODUCTION SMOKE TEST COMPLETE: ${passCount}/${passCount + failCount} tests passed.`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSmokeTest().catch(err => {
  console.error('Smoke test uncaught error:', err);
  pool.end();
  process.exit(1);
});
