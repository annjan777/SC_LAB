import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolveSafePath(baseDir: string, relativePath: string): string | null {
  const safePath = path.resolve(baseDir, relativePath);
  if (!safePath.startsWith(baseDir)) {
    return null;
  }
  return safePath;
}

const proposalStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, 'proposals');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + safeOriginal);
  },
});

const uploadProposal = multer({
  storage: proposalStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const blocked = ['.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.exe', '.sh', '.bat', '.cmd', '.php', '.py', '.svg'];
    if (blocked.includes(ext)) {
      return cb(Object.assign(new Error('File type not allowed for security reasons'), { statusCode: 400 }));
    }
    cb(null, true);
  },
});

function getDocumentContentType(filename: string, dbType?: string | null): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return dbType || 'application/octet-stream';
  }
}

// Strict Authentication: All project tracker endpoints require a valid authenticated user
router.use(authenticate);

/**
 * GET /api/projects
 * List all projects with computed fields (days_to_close, days_since_update, achievement counts).
 * Supports search and filters by status, rag_status, and category.
 */
router.get('/', requirePermission('view_projects'), async (req: Request, res: Response) => {
  try {
    const { search, status, rag_status, category } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (search && typeof search === 'string' && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(p.project_title) LIKE $${pIdx} OR 
        LOWER(COALESCE(p.project_code, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(p.tracker_id, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(p.funding_agency, '')) LIKE $${pIdx} OR 
        LOWER(COALESCE(p.faculty_lead_pi, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(p.accountable_owner_poc, '')) LIKE $${pIdx}
      )`);
      params.push(s);
      pIdx++;
    }

    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(`p.status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    if (rag_status && typeof rag_status === 'string' && rag_status !== 'all') {
      conditions.push(`p.rag_status = $${pIdx}`);
      params.push(rag_status);
      pIdx++;
    }

    if (category && typeof category === 'string' && category !== 'all') {
      conditions.push(`p.category = $${pIdx}`);
      params.push(category);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.*,
        p.start_date::text AS start_date,
        p.closing_date::text AS closing_date,
        p.last_funder_review::text AS last_funder_review,
        p.last_weekly_update::text AS last_weekly_update,
        CASE 
          WHEN p.closing_date IS NOT NULL THEN (p.closing_date - CURRENT_DATE)
          ELSE NULL 
        END AS days_to_close,
        CASE 
          WHEN p.last_weekly_update IS NOT NULL THEN (CURRENT_DATE - p.last_weekly_update)
          ELSE NULL 
        END AS days_since_update,
        COALESCE(ach_stat.achievement_count, 0)::int AS achievement_count,
        ach_stat.latest_achievement_text,
        ach_stat.latest_achievement_date
      FROM projects p
      LEFT JOIN (
        SELECT 
          project_id,
          COUNT(id) AS achievement_count,
          (ARRAY_AGG(message ORDER BY created_at DESC))[1] AS latest_achievement_text,
          (ARRAY_AGG(created_at ORDER BY created_at DESC))[1]::text AS latest_achievement_date
        FROM project_achievements
        GROUP BY project_id
      ) ach_stat ON ach_stat.project_id = p.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[PROJECTS] GET list error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:id
 * Retrieve a single project by ID with its historical achievements.
 */
router.get('/:id', requirePermission('view_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const projResult = await query(
      `SELECT 
        p.*,
        p.start_date::text AS start_date,
        p.closing_date::text AS closing_date,
        p.last_funder_review::text AS last_funder_review,
        p.last_weekly_update::text AS last_weekly_update,
        CASE 
          WHEN p.closing_date IS NOT NULL THEN (p.closing_date - CURRENT_DATE)
          ELSE NULL 
        END AS days_to_close,
        CASE 
          WHEN p.last_weekly_update IS NOT NULL THEN (CURRENT_DATE - p.last_weekly_update)
          ELSE NULL 
        END AS days_since_update
      FROM projects p
      WHERE p.id = $1`,
      [id]
    );

    if (projResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const achResult = await query(
      `SELECT id, project_id, user_id, author_name, message, created_at, updated_at
       FROM project_achievements
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      ...projResult.rows[0],
      achievements: achResult.rows,
    });
  } catch (err: any) {
    console.error('[PROJECTS] GET by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

/**
 * POST /api/projects
 * Create a new project.
 * Automatically generates Tracker ID in sequence (TRK-001, TRK-002, etc.).
 * Users never supply tracker_id manually.
 */
router.post('/', requirePermission('create_projects'), async (req: Request, res: Response) => {
  try {
    const {
      project_code,
      project_title,
      funding_agency,
      proposal_link,
      category,
      status = 'Active',
      overview,
      plan_next_phase,
      start_date,
      closing_date,
      faculty_lead_pi,
      team = [],
      accountable_owner_poc,
      rag_status = 'Green',
      last_funder_review,
      data_gaps_flags,
      last_weekly_update,
      update_status = 'On Track',
      open_actions = 0,
      overdue_actions = 0,
      staff_on_payroll = '0',
    } = req.body;

    if (!project_title || typeof project_title !== 'string' || project_title.trim() === '') {
      return res.status(400).json({ error: 'Project title is required' });
    }

    // Generate unique Tracker ID from sequence: TRK-001, TRK-002, ...
    const seqRes = await query("SELECT nextval('project_tracker_seq') AS seq");
    const seqNum = seqRes.rows[0].seq;
    const tracker_id = `TRK-${String(seqNum).padStart(3, '0')}`;

    // Normalize team JSON array
    const teamJson = JSON.stringify(Array.isArray(team) ? team : []);

    const insertSql = `
      INSERT INTO projects (
        tracker_id, project_code, project_title, funding_agency, proposal_link,
        category, status, overview, plan_next_phase, start_date, closing_date,
        faculty_lead_pi, team, accountable_owner_poc, rag_status, last_funder_review,
        data_gaps_flags, last_weekly_update, update_status, open_actions, overdue_actions,
        staff_on_payroll, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23
      )
      RETURNING *,
        start_date::text AS start_date,
        closing_date::text AS closing_date,
        last_funder_review::text AS last_funder_review,
        last_weekly_update::text AS last_weekly_update
    `;

    const params = [
      tracker_id,
      project_code?.trim() || null,
      project_title.trim(),
      funding_agency?.trim() || null,
      proposal_link?.trim() || null,
      category?.trim() || null,
      status || 'Active',
      overview?.trim() || null,
      plan_next_phase?.trim() || null,
      start_date || null,
      closing_date || null,
      faculty_lead_pi?.trim() || null,
      teamJson,
      accountable_owner_poc?.trim() || null,
      rag_status || 'Green',
      last_funder_review || null,
      data_gaps_flags?.trim() || null,
      last_weekly_update || null,
      update_status || 'On Track',
      Number(open_actions) || 0,
      Number(overdue_actions) || 0,
      String(staff_on_payroll || '0').trim(),
      req.user!.id,
    ];

    const result = await query(insertSql, params);
    const createdProject = result.rows[0];

    res.status(201).json(createdProject);
  } catch (err: any) {
    console.error('[PROJECTS] POST create error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * PUT /api/projects/:id
 * Update project fields.
 * tracker_id is strictly immutable.
 */
router.put('/:id', requirePermission('edit_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await query('SELECT id, tracker_id FROM projects WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const {
      project_code,
      project_title,
      funding_agency,
      proposal_link,
      category,
      status,
      overview,
      plan_next_phase,
      start_date,
      closing_date,
      faculty_lead_pi,
      team,
      accountable_owner_poc,
      rag_status,
      last_funder_review,
      data_gaps_flags,
      last_weekly_update,
      update_status,
      open_actions,
      overdue_actions,
      staff_on_payroll,
    } = req.body;

    if (!project_title || typeof project_title !== 'string' || project_title.trim() === '') {
      return res.status(400).json({ error: 'Project title is required' });
    }

    const teamJson = team !== undefined ? JSON.stringify(Array.isArray(team) ? team : []) : undefined;

    const updateSql = `
      UPDATE projects SET
        project_code = COALESCE($2, project_code),
        project_title = $3,
        funding_agency = $4,
        proposal_link = $5,
        category = $6,
        status = COALESCE($7, status),
        overview = $8,
        plan_next_phase = $9,
        start_date = $10,
        closing_date = $11,
        faculty_lead_pi = $12,
        team = CASE WHEN $13::jsonb IS NOT NULL THEN $13::jsonb ELSE team END,
        accountable_owner_poc = $14,
        rag_status = COALESCE($15, rag_status),
        last_funder_review = $16,
        data_gaps_flags = $17,
        last_weekly_update = $18,
        update_status = COALESCE($19, update_status),
        open_actions = COALESCE($20, open_actions),
        overdue_actions = COALESCE($21, overdue_actions),
        staff_on_payroll = COALESCE($22, staff_on_payroll),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *,
        start_date::text AS start_date,
        closing_date::text AS closing_date,
        last_funder_review::text AS last_funder_review,
        last_weekly_update::text AS last_weekly_update
    `;

    const params = [
      id,
      project_code !== undefined ? (project_code?.trim() || null) : null,
      project_title.trim(),
      funding_agency !== undefined ? (funding_agency?.trim() || null) : null,
      proposal_link !== undefined ? (proposal_link?.trim() || null) : null,
      category !== undefined ? (category?.trim() || null) : null,
      status || null,
      overview !== undefined ? (overview?.trim() || null) : null,
      plan_next_phase !== undefined ? (plan_next_phase?.trim() || null) : null,
      start_date || null,
      closing_date || null,
      faculty_lead_pi !== undefined ? (faculty_lead_pi?.trim() || null) : null,
      teamJson || null,
      accountable_owner_poc !== undefined ? (accountable_owner_poc?.trim() || null) : null,
      rag_status || null,
      last_funder_review || null,
      data_gaps_flags !== undefined ? (data_gaps_flags?.trim() || null) : null,
      last_weekly_update || null,
      update_status || null,
      open_actions !== undefined ? Number(open_actions) : null,
      overdue_actions !== undefined ? Number(overdue_actions) : null,
      staff_on_payroll !== undefined ? String(staff_on_payroll).trim() : null,
    ];

    const result = await query(updateSql, params);
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[PROJECTS] PUT update error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and cascade delete achievements.
 */
router.delete('/:id', requirePermission('delete_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await query('SELECT id, tracker_id, proposal_file_path FROM projects WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const oldFilePath = existing.rows[0].proposal_file_path;
    if (oldFilePath) {
      const safeOld = resolveSafePath(UPLOAD_DIR, oldFilePath);
      if (safeOld && fs.existsSync(safeOld)) {
        try { fs.unlinkSync(safeOld); } catch (e) { console.error('Failed to unlink proposal file:', e); }
      }
    }

    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id, tracker_id', [id]);
    res.json({ message: 'Project deleted successfully', id: result.rows[0].id, tracker_id: result.rows[0].tracker_id });
  } catch (err: any) {
    console.error('[PROJECTS] DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * POST /api/projects/:id/proposal-document
 * Upload or replace a proposal document (PDF, DOCX, etc.) for a project.
 */
router.post(
  '/:id/proposal-document',
  requirePermission('edit_projects'),
  uploadProposal.single('file'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const projResult = await query('SELECT id, proposal_file_path FROM projects WHERE id = $1', [id]);
      if (projResult.rows.length === 0) {
        const tempPath = path.join(UPLOAD_DIR, 'proposals', req.file.filename);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return res.status(404).json({ error: 'Project not found' });
      }

      const oldFilePath = projResult.rows[0].proposal_file_path;
      if (oldFilePath) {
        const safeOld = resolveSafePath(UPLOAD_DIR, oldFilePath);
        if (safeOld && fs.existsSync(safeOld)) {
          try { fs.unlinkSync(safeOld); } catch (e) { console.error('Failed to unlink old proposal file:', e); }
        }
      }

      const relativePath = `proposals/${req.file.filename}`;
      const originalName = req.file.originalname;
      const fileSize = req.file.size;
      const mimeType = req.file.mimetype || getDocumentContentType(originalName);
      const viewUrl = `/api/projects/${id}/proposal-document/view`;

      const updateSql = `
        UPDATE projects SET
          proposal_filename = $2,
          proposal_file_path = $3,
          proposal_file_size = $4,
          proposal_file_type = $5,
          proposal_link = COALESCE(proposal_link, $6),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *,
          start_date::text AS start_date,
          closing_date::text AS closing_date,
          last_funder_review::text AS last_funder_review,
          last_weekly_update::text AS last_weekly_update
      `;

      const updateResult = await query(updateSql, [id, originalName, relativePath, fileSize, mimeType, viewUrl]);
      res.json(updateResult.rows[0]);
    } catch (err: any) {
      console.error('[PROJECTS] Proposal upload error:', err);
      res.status(500).json({ error: 'Failed to upload proposal document' });
    }
  }
);

/**
 * GET /api/projects/:id/proposal-document/view
 * View proposal document inline inside SC Lab.
 */
router.get('/:id/proposal-document/view', requirePermission('view_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const projResult = await query(
      'SELECT id, project_title, proposal_filename, proposal_file_path, proposal_file_type FROM projects WHERE id = $1',
      [id]
    );

    if (projResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const proj = projResult.rows[0];
    if (!proj.proposal_file_path) {
      return res.status(404).json({ error: 'No proposal document uploaded for this project' });
    }

    const fullPath = resolveSafePath(UPLOAD_DIR, proj.proposal_file_path);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Proposal file not found on disk' });
    }

    const mimeType = getDocumentContentType(proj.proposal_filename || 'proposal.pdf', proj.proposal_file_type);
    const filename = proj.proposal_filename || 'proposal.pdf';

    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    res.sendFile(fullPath);
  } catch (err: any) {
    console.error('[PROJECTS] Proposal view error:', err);
    res.status(500).json({ error: 'Failed to view proposal document' });
  }
});

/**
 * GET /api/projects/:id/proposal-document/download
 * Download proposal document.
 */
router.get('/:id/proposal-document/download', requirePermission('view_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const projResult = await query(
      'SELECT id, proposal_filename, proposal_file_path FROM projects WHERE id = $1',
      [id]
    );

    if (projResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const proj = projResult.rows[0];
    if (!proj.proposal_file_path) {
      return res.status(404).json({ error: 'No proposal document uploaded for this project' });
    }

    const fullPath = resolveSafePath(UPLOAD_DIR, proj.proposal_file_path);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Proposal file not found on disk' });
    }

    res.download(fullPath, proj.proposal_filename || 'proposal.pdf');
  } catch (err: any) {
    console.error('[PROJECTS] Proposal download error:', err);
    res.status(500).json({ error: 'Failed to download proposal document' });
  }
});

/**
 * DELETE /api/projects/:id/proposal-document
 * Remove uploaded proposal document for a project.
 */
router.delete('/:id/proposal-document', requirePermission('edit_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const projResult = await query(
      'SELECT id, proposal_file_path FROM projects WHERE id = $1',
      [id]
    );

    if (projResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const oldFilePath = projResult.rows[0].proposal_file_path;
    if (oldFilePath) {
      const safeOld = resolveSafePath(UPLOAD_DIR, oldFilePath);
      if (safeOld && fs.existsSync(safeOld)) {
        try { fs.unlinkSync(safeOld); } catch (e) { console.error('Failed to unlink proposal file:', e); }
      }
    }

    const updateRes = await query(
      `UPDATE projects SET
        proposal_filename = NULL,
        proposal_file_path = NULL,
        proposal_file_size = NULL,
        proposal_file_type = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id]
    );

    res.json({ message: 'Proposal document deleted successfully', project: updateRes.rows[0] });
  } catch (err: any) {
    console.error('[PROJECTS] Proposal delete error:', err);
    res.status(500).json({ error: 'Failed to delete proposal document' });
  }
});

/**
 * GET /api/projects/:id/achievements
 * Retrieve full chronological list of achievements for the project.
 */
router.get('/:id/achievements', requirePermission('view_projects'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT pa.id, pa.project_id, pa.user_id, pa.author_name, pa.message, pa.created_at, pa.updated_at,
              up.email, up.profile_picture_url
       FROM project_achievements pa
       LEFT JOIN user_profiles up ON up.id = pa.user_id
       WHERE pa.project_id = $1
       ORDER BY pa.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('[PROJECTS] GET achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch project achievements' });
  }
});

/**
 * POST /api/projects/:id/achievements
 * Post a new achievement update in chat/timeline style.
 * Automatically stamps with current timestamp and logged-in author name.
 * Previous achievements remain permanently visible in chronological history.
 * Automatically updates project last_weekly_update = CURRENT_DATE.
 */
router.post('/:id/achievements', requirePermission('add_project_achievement'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Achievement message cannot be empty' });
  }

  try {
    // Verify project exists
    const projCheck = await query('SELECT id FROM projects WHERE id = $1', [id]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Determine author name
    const userProfile = await query('SELECT full_name, email FROM user_profiles WHERE id = $1', [req.user!.id]);
    const authorName = userProfile.rows[0]?.full_name || req.user!.email || 'Lab Member';

    // Insert new achievement record
    const insertAch = await query(
      `INSERT INTO project_achievements (project_id, user_id, author_name, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [id, req.user!.id, authorName, message.trim()]
    );

    // Update project last_weekly_update date and updated_at
    await query(
      `UPDATE projects
       SET last_weekly_update = CURRENT_DATE, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.status(201).json(insertAch.rows[0]);
  } catch (err: any) {
    console.error('[PROJECTS] POST achievement error:', err);
    res.status(500).json({ error: 'Failed to post achievement update' });
  }
});

/**
 * DELETE /api/projects/:id/achievements/:achievementId
 * Delete a specific achievement record.
 * Allowed for project editors/admins or the original author.
 */
router.delete('/:id/achievements/:achievementId', async (req: Request, res: Response) => {
  const { id, achievementId } = req.params;
  const userId = req.user!.id;
  const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
  const hasEditPerm = req.user!.permissions.has('edit_projects') || req.user!.permissions.has('delete_projects');

  try {
    const achCheck = await query('SELECT id, user_id FROM project_achievements WHERE id = $1 AND project_id = $2', [achievementId, id]);
    if (achCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Achievement record not found' });
    }

    const isAuthor = achCheck.rows[0].user_id === userId;
    if (!isAdmin && !hasEditPerm && !isAuthor) {
      return res.status(403).json({ error: 'Permission denied to delete this achievement' });
    }

    await query('DELETE FROM project_achievements WHERE id = $1', [achievementId]);
    res.json({ message: 'Achievement deleted successfully' });
  } catch (err: any) {
    console.error('[PROJECTS] DELETE achievement error:', err);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

export default router;
