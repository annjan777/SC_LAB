const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sclab',
  user: process.env.DB_USER || 'annjan',
  password: process.env.DB_PASSWORD || undefined,
});

async function runProductionCleanup() {
  const client = await pool.connect();
  console.log('========================================================================');
  console.log('   SC LAB PORTAL — PRODUCTION DATA & ARTIFACT CLEANUP RUNNER            ');
  console.log('========================================================================\n');

  try {
    await client.query('BEGIN');

    // 1. Delete repository documents uploaded by test users
    const docDel = await client.query(`
      DELETE FROM repository_documents 
      WHERE uploaded_by = '5c0cae8b-1dc3-4888-afda-fe2a428c1e53' 
      RETURNING id, title, document_url
    `);
    console.log(`[1] Removed ${docDel.rows.length} test repository document(s):`);
    docDel.rows.forEach(r => console.log(`    - ID: ${r.id} | Title: "${r.title}" | URL: ${r.document_url}`));

    // 2. Delete test user daily todos
    const todoDel = await client.query(`
      DELETE FROM daily_todo_trackers 
      WHERE user_id = 'c346e8d0-5811-4c05-a91e-47ad1ecef43d' 
      RETURNING id, date
    `);
    console.log(`[2] Removed ${todoDel.rows.length} test daily todo tracker(s):`);
    todoDel.rows.forEach(r => console.log(`    - ID: ${r.id} | Date: ${r.date}`));

    // 3. Delete notifications for test user
    const notifUserDel = await client.query(`
      DELETE FROM notifications 
      WHERE user_id = 'c346e8d0-5811-4c05-a91e-47ad1ecef43d' 
      RETURNING id
    `);
    console.log(`[3] Removed ${notifUserDel.rows.length} notification(s) addressed to test user.`);

    // 4. Delete QA/test notifications
    const notifDel = await client.query(`
      DELETE FROM notifications 
      WHERE message LIKE '%Digital Oscilloscope 200MHz HTTP%'
         OR message LIKE '%Acetone 99.5% HPLC Grade HTTP%'
         OR message LIKE '%Spectrophotometer Due Today E2E%'
         OR message LIKE '%Laser Interferometer Overdue E2E%'
         OR message LIKE '%Test_user commented%'
      RETURNING id, title
    `);
    console.log(`[4] Removed ${notifDel.rows.length} test notification(s) generated during QA runs.`);

    // 5. Delete audit logs by test users
    const auditDel = await client.query(`
      DELETE FROM audit_logs 
      WHERE performed_by IN ('5c0cae8b-1dc3-4888-afda-fe2a428c1e53', 'c346e8d0-5811-4c05-a91e-47ad1ecef43d')
      RETURNING id, entity_type, action
    `);
    console.log(`[5] Removed ${auditDel.rows.length} test audit log entry(ies).`);

    // 6. Delete test user profiles and users
    const upDel = await client.query(`
      DELETE FROM user_profiles 
      WHERE id IN ('5c0cae8b-1dc3-4888-afda-fe2a428c1e53', 'c346e8d0-5811-4c05-a91e-47ad1ecef43d') 
      RETURNING id, email, full_name
    `);
    console.log(`[6] Removed ${upDel.rows.length} test user profile(s):`);
    upDel.rows.forEach(r => console.log(`    - Email: ${r.email} | Name: "${r.full_name}"`));

    const uDel = await client.query(`
      DELETE FROM users 
      WHERE id IN ('5c0cae8b-1dc3-4888-afda-fe2a428c1e53', 'c346e8d0-5811-4c05-a91e-47ad1ecef43d') 
      RETURNING id, email
    `);
    console.log(`    Removed ${uDel.rows.length} test auth user record(s).`);

    // 7. Restore annjan7777 user profile to clean production state
    const upRestore = await client.query(`
      UPDATE user_profiles 
      SET full_name = 'Annjan Member', department = NULL 
      WHERE id = '6e6852d5-3505-461e-839a-e60b1c781083' 
      RETURNING id, full_name, email, user_role
    `);
    console.log(`[7] Restored real member profile:`);
    upRestore.rows.forEach(r => console.log(`    - Email: ${r.email} | Full Name: "${r.full_name}" | Role: ${r.user_role}`));

    // 8. Verification query
    const remainingUsers = await client.query(`
      SELECT u.id, u.email, up.full_name, up.user_role, up.is_active 
      FROM users u 
      JOIN user_profiles up ON up.id = u.id 
      ORDER BY u.created_at
    `);
    console.log(`\n[8] Active Production Users Verified:`);
    console.table(remainingUsers.rows);

    await client.query('COMMIT');
    console.log('\n✅ DATABASE CLEANUP COMMITTED SUCCESSFULLY.');

    // 9. Clean up unreferenced duplicate facility images in server/uploads/facility-images
    const facilityImgDir = path.join(__dirname, '../uploads/facility-images');
    if (fs.existsSync(facilityImgDir)) {
      const activeImgs = await pool.query('SELECT image_url FROM facilities WHERE image_url IS NOT NULL');
      const activeBasenames = new Set(activeImgs.rows.map(r => path.basename(r.image_url)));
      const filesOnDisk = fs.readdirSync(facilityImgDir);
      let removedFilesCount = 0;
      for (const file of filesOnDisk) {
        if (!activeBasenames.has(file)) {
          const filePath = path.join(facilityImgDir, file);
          fs.unlinkSync(filePath);
          console.log(`[9] Removed unreferenced duplicate facility image: ${file}`);
          removedFilesCount++;
        }
      }
      console.log(`    Removed ${removedFilesCount} duplicate upload file(s). Active image files preserved.`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Cleanup failed, transaction rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runProductionCleanup();
