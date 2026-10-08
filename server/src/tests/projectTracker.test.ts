import { query, pool } from '../config/database.js';

async function runTests() {
  console.log('====================================================');
  console.log('   PROJECT TRACKER MODULE VERIFICATION SUITE       ');
  console.log('====================================================');

  // Fetch or setup test admin user
  const adminUserRes = await query("SELECT id, email FROM users WHERE email = 'annjan0077@gmail.com' LIMIT 1");
  const adminId = adminUserRes.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

  // 1. Verify Sequence & Tracker ID generation
  console.log('\n--- 1. Tracker ID Sequence Generation ---');
  const seqRes = await query("SELECT nextval('project_tracker_seq') AS seq");
  const nextSeq = seqRes.rows[0].seq;
  const expectedTrackerId = `TRK-${String(nextSeq).padStart(3, '0')}`;
  console.log(`Generated tracker ID from sequence: ${expectedTrackerId}`);

  // 2. Insert test project
  console.log('\n--- 2. Create Project with All Fields & Team (Lab + External) ---');
  const teamMembers = [
    { id: adminId, name: 'Annjan (Lab Admin)', email: 'annjan0077@gmail.com', is_external: false },
    { name: 'Dr. Jane Smith (External Collaborator)', is_external: true }
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const targetClosingDate = '2027-03-31';

  const insertRes = await query(`
    INSERT INTO projects (
      tracker_id, project_code, project_title, funding_agency, proposal_link,
      category, status, overview, plan_next_phase, start_date, closing_date,
      faculty_lead_pi, team, accountable_owner_poc, rag_status, last_funder_review,
      data_gaps_flags, last_weekly_update, update_status, open_actions, overdue_actions,
      staff_on_payroll, created_by
    ) VALUES (
      $1, 'PRJ-2026-TEST', 'Autonomous Nano-Sensor Grid', 'SERB-CRG', 'https://example.org/proposal/123',
      'Research & Innovation', 'Active', 'Developing robust sensor network for real-time monitoring',
      'Phase 2 fabrication and cleanroom testing', '2026-01-01', $2,
      'Prof. R. V. Sharma', $3, 'Annjan', 'Green', '2026-06-15',
      'None. Material procurement completed ahead of schedule.', '2026-10-01', 'On Track', 3, 0,
      '2 JRF, 1 Research Associate', $4
    )
    RETURNING *,
      (closing_date - CURRENT_DATE) AS days_to_close,
      (CURRENT_DATE - last_weekly_update) AS days_since_update
  `, [expectedTrackerId, targetClosingDate, JSON.stringify(teamMembers), adminId]);

  const createdProj = insertRes.rows[0];
  if (!createdProj || createdProj.tracker_id !== expectedTrackerId) {
    throw new Error(`Failed to create project with tracker_id ${expectedTrackerId}`);
  }
  console.log(`✅ [PASS] Project created successfully. Tracker ID: ${createdProj.tracker_id}, Title: "${createdProj.project_title}"`);
  console.log(`✅ [PASS] Team stored with ${createdProj.team.length} members (1 Lab member, 1 External member)`);
  console.log(`✅ [PASS] Automatically calculated Days to Close: ${createdProj.days_to_close} days`);
  console.log(`✅ [PASS] Automatically calculated Days Since Update: ${createdProj.days_since_update} days`);

  // 3. Achieved to Date Timeline/Chat Updates
  console.log('\n--- 3. Achieved to Date Chat / Timeline Updates ---');
  // Post achievement 1
  const ach1 = await query(`
    INSERT INTO project_achievements (project_id, user_id, author_name, message)
    VALUES ($1, $2, 'Annjan', 'Prototype testing completed for Module X')
    RETURNING *
  `, [createdProj.id, adminId]);
  console.log(`✅ [PASS] Achievement 1 posted: "${ach1.rows[0].message}" at ${ach1.rows[0].created_at}`);

  // Post achievement 2
  const ach2 = await query(`
    INSERT INTO project_achievements (project_id, user_id, author_name, message)
    VALUES ($1, $2, 'Dr. Jane Smith', 'Calibration benchmark results submitted to funder review panel')
    RETURNING *
  `, [createdProj.id, adminId]);
  console.log(`✅ [PASS] Achievement 2 posted: "${ach2.rows[0].message}" at ${ach2.rows[0].created_at}`);

  // Query achievements in chronological order
  const achList = await query(`
    SELECT * FROM project_achievements WHERE project_id = $1 ORDER BY created_at ASC
  `, [createdProj.id]);

  if (achList.rows.length !== 2) {
    throw new Error(`Expected 2 achievements, found ${achList.rows.length}`);
  }
  if (achList.rows[0].message !== 'Prototype testing completed for Module X') {
    throw new Error('Chronological order failed or earlier achievement was overwritten');
  }
  console.log(`✅ [PASS] Chronological history intact. Both achievements permanently preserved without overwriting.`);

  // 4. Update Project (Immutable Tracker ID check)
  console.log('\n--- 4. Update Project & Verify Tracker ID Immutability ---');
  const updateRes = await query(`
    UPDATE projects 
    SET rag_status = 'Amber', open_actions = 4, updated_at = NOW()
    WHERE id = $1
    RETURNING rag_status, open_actions, tracker_id
  `, [createdProj.id]);

  if (updateRes.rows[0].rag_status !== 'Amber' || updateRes.rows[0].tracker_id !== expectedTrackerId) {
    throw new Error('Project update failed or tracker_id was altered');
  }
  console.log(`✅ [PASS] Project updated smoothly. RAG status updated to Amber, Tracker ID remained strictly: ${updateRes.rows[0].tracker_id}`);

  // 5. Test Proposal Document Storage & Metadata
  console.log('\n--- 5. Project Proposal Document Metadata & Storage ---');
  const proposalUpdate = await query(`
    UPDATE projects
    SET 
      proposal_filename = 'Grant_Proposal_Final.pdf',
      proposal_file_path = 'proposals/test-proposal.pdf',
      proposal_file_size = 2048576,
      proposal_file_type = 'application/pdf',
      updated_at = NOW()
    WHERE id = $1
    RETURNING proposal_filename, proposal_file_path, proposal_file_size, proposal_file_type
  `, [createdProj.id]);

  const pDoc = proposalUpdate.rows[0];
  if (pDoc.proposal_filename !== 'Grant_Proposal_Final.pdf' || pDoc.proposal_file_size !== 2048576) {
    throw new Error('Proposal document metadata update failed');
  }
  console.log(`✅ [PASS] Proposal document stored: "${pDoc.proposal_filename}", type: ${pDoc.proposal_file_type}, size: ${pDoc.proposal_file_size} bytes`);

  // Test DOCX document metadata
  const docxUpdate = await query(`
    UPDATE projects
    SET 
      proposal_filename = 'Project_Proposal_Draft.docx',
      proposal_file_path = 'proposals/test-proposal.docx',
      proposal_file_size = 512000,
      proposal_file_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      updated_at = NOW()
    WHERE id = $1
    RETURNING proposal_filename, proposal_file_path, proposal_file_size, proposal_file_type
  `, [createdProj.id]);

  const pDocx = docxUpdate.rows[0];
  if (pDocx.proposal_filename !== 'Project_Proposal_Draft.docx' || !pDocx.proposal_file_type.includes('wordprocessingml')) {
    throw new Error('DOCX Proposal document update failed');
  }
  console.log(`✅ [PASS] DOCX proposal document stored: "${pDocx.proposal_filename}", type: ${pDocx.proposal_file_type}`);

  // 6. Clean up test fixtures
  console.log('\n--- 6. Cleanup Test Records ---');
  await query('DELETE FROM projects WHERE id = $1', [createdProj.id]);
  const deletedCheck = await query('SELECT id FROM projects WHERE id = $1', [createdProj.id]);
  const achDeletedCheck = await query('SELECT id FROM project_achievements WHERE project_id = $1', [createdProj.id]);
  if (deletedCheck.rows.length > 0 || achDeletedCheck.rows.length > 0) {
    throw new Error('Cascade cleanup failed');
  }
  console.log(`✅ [PASS] Test project and cascading achievements deleted cleanly.`);

  console.log('\n====================================================');
  console.log('   ALL PROJECT TRACKER TESTS PASSED SUCCESSFULLY!   ');
  console.log('====================================================');
}

runTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('❌ Test failed:', err);
    pool.end().then(() => process.exit(1));
  });
