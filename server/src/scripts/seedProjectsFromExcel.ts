import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { query, pool } from '../config/database.js';

function excelDateToString(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    // Check if format like "3-Mar-2026" or "10-Jun"
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return s;
  }
  if (typeof val === 'number') {
    // Excel date serial number (days since 1899-12-30)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return null;
}

export async function importProjectsFromExcel(filePath?: string) {
  const excelPath = filePath || '/Users/annjan/Downloads/CRTDH_Project_Tracker.xlsx';
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at: ${excelPath}`);
  }

  console.log(`Loading workbook from: ${excelPath}...`);
  const wb = xlsx.readFile(excelPath);

  // 1. Fetch existing user profiles to match team members
  const usersRes = await query('SELECT id, full_name, email FROM user_profiles');
  const labUsers = usersRes.rows;
  const adminId = labUsers.find((u: any) => u.email === 'annjan0077@gmail.com')?.id || labUsers[0]?.id;

  // 2. Read Projects sheet
  const projectSheet = wb.Sheets['Projects'];
  if (!projectSheet) {
    throw new Error('Projects sheet not found in workbook');
  }
  const rawProjects: any[] = xlsx.utils.sheet_to_json(projectSheet);
  console.log(`Read ${rawProjects.length} rows from Projects sheet.`);

  // 3. Read Weekly Log sheet
  const weeklyLogSheet = wb.Sheets['Weekly Log'];
  const rawWeeklyLogs: any[] = weeklyLogSheet ? xlsx.utils.sheet_to_json(weeklyLogSheet) : [];
  console.log(`Read ${rawWeeklyLogs.length} rows from Weekly Log sheet.`);

  // Group weekly logs by Tracker ID
  const weeklyLogsByTracker: Record<string, any[]> = {};
  for (const log of rawWeeklyLogs) {
    const tid = String(log['Tracker ID'] || '').trim();
    if (tid) {
      if (!weeklyLogsByTracker[tid]) weeklyLogsByTracker[tid] = [];
      weeklyLogsByTracker[tid].push(log);
    }
  }

  let importedCount = 0;
  let achievementsCount = 0;

  for (const row of rawProjects) {
    const trackerId = String(row['Tracker ID'] || '').trim();
    const title = String(row['Project title'] || '').trim();
    if (!trackerId || !title) continue;

    const projectCode = row['Project code'] ? String(row['Project code']).trim() : null;
    const fundingAgency = row['Funding agency'] ? String(row['Funding agency']).trim() : null;
    const proposalLink = row['Project Proposal Link'] ? String(row['Project Proposal Link']).trim() : null;
    const category = row['Category'] ? String(row['Category']).trim() : 'General';
    const status = row['Status'] ? String(row['Status']).trim() : 'Active';
    const overview = row['Overview'] ? String(row['Overview']).trim() : null;
    const planNextPhase = row['Plan (next 3–6 months)'] ? String(row['Plan (next 3–6 months)']).trim() : null;
    const startDate = excelDateToString(row['Start date']);
    const closingDate = excelDateToString(row['Closing date']);
    const facultyLeadPi = row['Faculty lead / PI'] ? String(row['Faculty lead / PI']).trim() : null;
    const accountableOwnerPoc = row['Accountable owner (POC)'] ? String(row['Accountable owner (POC)']).trim() : null;
    const ragStatus = row['RAG'] ? String(row['RAG']).trim() : 'Green';
    const lastFunderReview = row['Last funder review'] ? String(row['Last funder review']).trim() : null;
    const dataGapsFlags = row['Data gaps / flags'] ? String(row['Data gaps / flags']).trim() : null;
    const lastWeeklyUpdate = excelDateToString(row['Last weekly update']);
    const updateStatus = row['Update status'] ? String(row['Update status']).trim() : 'On Track';
    const openActions = Number(row['Open actions']) || 0;
    const overdueActions = Number(row['Overdue actions']) || 0;
    const staffOnPayroll = row['Staff on payroll'] !== undefined ? String(row['Staff on payroll']).trim() : '0';

    // Parse team string: e.g. "Arijit, Subham (SNST), Sathi Roy, Anshita, Debayan, Pulasta, Saikat"
    const rawTeamStr = row['Team'] ? String(row['Team']).trim() : '';
    const teamMembers: any[] = [];
    if (rawTeamStr) {
      const names = rawTeamStr.split(',').map(n => n.trim()).filter(Boolean);
      for (const name of names) {
        const matchedLabUser = labUsers.find(
          (u: any) => u.full_name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(u.full_name.toLowerCase())
        );
        if (matchedLabUser) {
          teamMembers.push({
            id: matchedLabUser.id,
            name: matchedLabUser.full_name,
            email: matchedLabUser.email,
            is_external: false,
          });
        } else {
          teamMembers.push({
            name,
            is_external: true,
          });
        }
      }
    }

    // Insert or update project
    const upsertSql = `
      INSERT INTO projects (
        tracker_id, project_code, project_title, funding_agency, proposal_link,
        category, status, overview, plan_next_phase, start_date, closing_date,
        faculty_lead_pi, team, accountable_owner_poc, rag_status, last_funder_review,
        data_gaps_flags, last_weekly_update, update_status, open_actions, overdue_actions,
        staff_on_payroll, created_by, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, NOW()
      )
      ON CONFLICT (tracker_id) DO UPDATE SET
        project_code = EXCLUDED.project_code,
        project_title = EXCLUDED.project_title,
        funding_agency = EXCLUDED.funding_agency,
        proposal_link = EXCLUDED.proposal_link,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        overview = EXCLUDED.overview,
        plan_next_phase = EXCLUDED.plan_next_phase,
        start_date = EXCLUDED.start_date,
        closing_date = EXCLUDED.closing_date,
        faculty_lead_pi = EXCLUDED.faculty_lead_pi,
        team = EXCLUDED.team,
        accountable_owner_poc = EXCLUDED.accountable_owner_poc,
        rag_status = EXCLUDED.rag_status,
        last_funder_review = EXCLUDED.last_funder_review,
        data_gaps_flags = EXCLUDED.data_gaps_flags,
        last_weekly_update = EXCLUDED.last_weekly_update,
        update_status = EXCLUDED.update_status,
        open_actions = EXCLUDED.open_actions,
        overdue_actions = EXCLUDED.overdue_actions,
        staff_on_payroll = EXCLUDED.staff_on_payroll,
        updated_at = NOW()
      RETURNING id, tracker_id
    `;

    const projectRes = await query(upsertSql, [
      trackerId,
      projectCode,
      title,
      fundingAgency,
      proposalLink,
      category,
      status,
      overview,
      planNextPhase,
      startDate,
      closingDate,
      facultyLeadPi,
      JSON.stringify(teamMembers),
      accountableOwnerPoc,
      ragStatus,
      lastFunderReview,
      dataGapsFlags,
      lastWeeklyUpdate,
      updateStatus,
      openActions,
      overdueActions,
      staffOnPayroll,
      adminId,
    ]);

    const projectId = projectRes.rows[0].id;
    importedCount++;

    // 4. Insert Achieved to date from Projects sheet into project_achievements (if not exists)
    const achievedToDateText = row['Achieved to date'] ? String(row['Achieved to date']).trim() : '';
    if (achievedToDateText) {
      const existingAch = await query(
        'SELECT id FROM project_achievements WHERE project_id = $1 AND message = $2',
        [projectId, achievedToDateText]
      );
      if (existingAch.rows.length === 0) {
        const achDate = lastWeeklyUpdate ? new Date(lastWeeklyUpdate) : new Date();
        await query(
          `INSERT INTO project_achievements (project_id, user_id, author_name, message, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [
            projectId,
            adminId,
            accountableOwnerPoc || 'Project Team',
            achievedToDateText,
            achDate,
          ]
        );
        achievementsCount++;
      }
    }

    // 5. Insert historical Weekly Logs into project_achievements
    const weeklyLogs = weeklyLogsByTracker[trackerId] || [];
    // Sort weekly logs chronologically
    weeklyLogs.sort((a, b) => (Number(a['Week / review date']) || 0) - (Number(b['Week / review date']) || 0));

    for (const log of weeklyLogs) {
      const progressText = log['Progress this week'] ? String(log['Progress this week']).trim() : '';
      if (!progressText) continue;

      const existingLog = await query(
        'SELECT id FROM project_achievements WHERE project_id = $1 AND message = $2',
        [projectId, progressText]
      );
      if (existingLog.rows.length === 0) {
        const logDateStr = excelDateToString(log['Week / review date']);
        const logDate = logDateStr ? new Date(logDateStr) : new Date();
        const submitter = log['Submitted by'] || accountableOwnerPoc || 'Review Meeting';

        await query(
          `INSERT INTO project_achievements (project_id, user_id, author_name, message, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [
            projectId,
            adminId,
            submitter,
            progressText,
            logDate,
          ]
        );
        achievementsCount++;
      }
    }
  }

  // Adjust sequence so future creations start after max imported ID
  await query(`SELECT setval('project_tracker_seq', GREATEST(25, (SELECT nextval('project_tracker_seq'))))`);

  console.log(`\n🎉 Successfully imported ${importedCount} projects and ${achievementsCount} achievement timeline entries!`);
  return { importedCount, achievementsCount };
}

// Direct execution
if (process.argv[1]?.endsWith('seedProjectsFromExcel.ts') || process.argv[1]?.endsWith('seedProjectsFromExcel.js')) {
  importProjectsFromExcel()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Import error:', err);
      pool.end().then(() => process.exit(1));
    });
}
