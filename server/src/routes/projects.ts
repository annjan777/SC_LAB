import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditLogger.js';

const router = Router();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolveSafePath(baseDir: string, relativePath: string): string | null {
  const safePath = path.resolve(baseDir, relativePath);
  if (!safePath.startsWith(baseDir + path.sep)) {
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

/**
 * Content type for serving a stored proposal, derived ONLY from an allow-listed extension.
 * The client-supplied mimetype stored at upload time is never trusted. Returns null for any
 * other extension — callers then serve application/octet-stream as an attachment.
 */
function getDocumentContentType(filename: string): string | null {
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
      return null;
  }
}

// Leading-byte signatures per extension (hex). A file claiming one of these extensions must
// start with one of the listed signatures.
const FILE_SIGNATURES: Record<string, string[]> = {
  '.pdf': ['25504446'],                 // %PDF
  '.docx': ['504b0304'],                // ZIP (OOXML)
  '.xlsx': ['504b0304'],
  '.pptx': ['504b0304'],
  '.doc': ['d0cf11e0a1b11ae1'],         // OLE2 compound file
  '.xls': ['d0cf11e0a1b11ae1'],
  '.ppt': ['d0cf11e0a1b11ae1'],
  '.png': ['89504e470d0a1a0a'],
  '.jpg': ['ffd8ff'],
  '.jpeg': ['ffd8ff'],
};

/** Returns an error message when the file's magic bytes do not match its extension. */
function checkFileSignature(fullPath: string, originalName: string): string | null {
  const buffer = Buffer.alloc(512);
  let bytesRead = 0;
  const fd = fs.openSync(fullPath, 'r');
  try {
    bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  const head = buffer.subarray(0, bytesRead);
  const hex = head.toString('hex');

  // Prevent scripts masquerading as documents (e.g. '#!/')
  if (hex.startsWith('2321')) return 'Executable scripts are not allowed';

  const ext = path.extname(originalName).toLowerCase();
  const expected = FILE_SIGNATURES[ext];
  if (expected && !expected.some(sig => hex.startsWith(sig))) {
    return `File content does not match its ${ext} extension`;
  }
  if (ext === '.txt' && head.includes(0)) {
    return 'File content does not match its .txt extension';
  }
  return null;
}

/** Sets safe content headers for serving a stored proposal file. */
function setProposalHeaders(res: Response, filename: string, disposition: 'inline' | 'attachment') {
  const contentType = getDocumentContentType(filename);
  res.setHeader('Content-Type', contentType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Unknown types are always forced to download, never rendered inline.
  const finalDisposition = contentType ? disposition : 'attachment';
  res.setHeader('Content-Disposition', `${finalDisposition}; filename="${encodeURIComponent(filename)}"`);
}

function isValidIsoDate(v: any): boolean {
  if (v === undefined || v === null || v === '') return true;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  // Round-trip check rejects roll-over dates such as 2026-02-30.
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// varchar column sizes for projects (schema.sql / ensureOperationalSchema.ts)
const PROJECT_FIELD_MAX: Record<string, number> = {
  project_title: 255,
  project_code: 100,
  category: 100,
  funding_agency: 255,
  status: 50,
  update_status: 50,
  faculty_lead_pi: 255,
  accountable_owner_poc: 255,
  staff_on_payroll: 100,
};
const PROJECT_TEXT_FIELDS = ['proposal_link', 'overview', 'plan_next_phase', 'data_gaps_flags'];

// Strict Authentication: All project tracker endpoints require a valid authenticated user
router.use(authenticate);

/**
 * GET /api/projects
 * List all projects with computed fields (days_to_close, days_since_update, achievement counts).
 * Supports search and filters by status, rag_status, and category.
 */

const RAG_VALUES = ['Green', 'Amber', 'Red', 'Grey'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validation shared by create and update. `current` = stored row when updating.
async function validateProject(body: any, current: any | null): Promise<string | null> {
  for (const [k, max] of Object.entries(PROJECT_FIELD_MAX)) {
    const v = body[k];
    if (v === undefined || v === null) continue;
    if (k === 'staff_on_payroll' && typeof v === 'number') {
      if (String(v).length > max) return `${k.replace(/_/g, ' ')} must be ${max} characters or fewer`;
      continue;
    }
    if (typeof v !== 'string') return `${k.replace(/_/g, ' ')} must be text`;
    if (v.trim().length > max) return `${k.replace(/_/g, ' ')} must be ${max} characters or fewer`;
  }
  for (const k of PROJECT_TEXT_FIELDS) {
    if (body[k] !== undefined && body[k] !== null && typeof body[k] !== 'string') return `${k.replace(/_/g, ' ')} must be text`;
  }
  for (const k of ['open_actions', 'overdue_actions']) {
    const v = body[k];
    if (v === undefined || v === null || v === '') continue;
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 2147483647) {
      return `${k.replace(/_/g, ' ')} must be a non-negative whole number`;
    }
  }
  for (const k of ['start_date', 'closing_date', 'last_funder_review', 'last_weekly_update']) {
    if (!isValidIsoDate(body[k])) return `${k.replace(/_/g, ' ')} is not a valid date (use YYYY-MM-DD)`;
  }
  const start = body.start_date !== undefined ? body.start_date : current?.start_date;
  const close = body.closing_date !== undefined ? body.closing_date : current?.closing_date;
  if (start && close && String(close).slice(0, 10) < String(start).slice(0, 10)) return 'Closing date cannot be earlier than the start date';
  if (body.rag_status !== undefined && body.rag_status !== null && body.rag_status !== '' && !RAG_VALUES.includes(body.rag_status)) {
    return `RAG status must be one of: ${RAG_VALUES.join(', ')}`;
  }
  const code = typeof body.project_code === 'string' ? body.project_code.trim() : '';
  if (code) {
    const dup = await query('SELECT id FROM projects WHERE LOWER(project_code) = LOWER($1) AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1', [code, current?.id || null]);
    if (dup.rows.length > 0) return `Project code "${code}" is already used by another project`;
  }
  return null;
}

function canManageProjects(req: Request): boolean {
  return ['admin', 'super_admin'].includes(req.user!.user_role) || req.user!.permissions.has('edit_projects');
}

/**
 * True when the user is on the project's team. Lab members are stored with their user id
 * (and email); older entries and the PI / accountable-owner fields only carry a name.
 */
function isProjectMember(project: any, user: { id: string; email?: string | null; full_name?: string | null }): boolean {
  const team = Array.isArray(project.team) ? project.team : [];
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.full_name || '').trim().toLowerCase();
  if (team.some((m: any) => m?.id === user.id || (email && String(m?.email || '').trim().toLowerCase() === email))) return true;
  if (!name) return false;
  return [
    // Name matching only for older entries that carry no id or email (otherwise a namesake would match).
    ...team.filter((m: any) => !m?.id && !m?.email).map((m: any) => String(m?.name || '').trim().toLowerCase()),
    String(project.faculty_lead_pi || '').trim().toLowerCase(),
    String(project.accountable_owner_poc || '').trim().toLowerCase(),
  ].includes(name);
}

async function loadMemberIdentity(userId: string) {
  const r = await query('SELECT id, email, full_name FROM user_profiles WHERE id = $1', [userId]);
  return r.rows[0] || { id: userId };
}

/**
 * GET /api/projects/mine
 * The projects the signed-in user is on, with their achievement timeline. Available to every
 * member, even without view_projects, so they can post their progress updates.
 */
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const me = await loadMemberIdentity(req.user!.id);
    const all = await query(
      `SELECT id, tracker_id, project_code, project_title, category, status, start_date, closing_date,
              faculty_lead_pi, accountable_owner_poc, team, rag_status, last_weekly_update
       FROM projects ORDER BY project_title`
    );
    const mine = all.rows.filter((p: any) => isProjectMember(p, me));
    if (mine.length === 0) return res.json([]);
    const ach = await query(
      `SELECT id, project_id, user_id, author_name, message, created_at
       FROM project_achievements WHERE project_id = ANY($1::uuid[]) ORDER BY created_at DESC`,
      [mine.map((p: any) => p.id)]
    );
    res.json(mine.map((p: any) => ({
      ...p,
      team: (Array.isArray(p.team) ? p.team : []).map((m: any) => ({ name: m?.name, is_external: !!m?.is_external })),
      achievements: ach.rows.filter((a: any) => a.project_id === p.id),
    })));
  } catch (err: any) {
    console.error('[PROJECTS] GET mine error:', err);
    res.status(500).json({ error: 'Failed to load your projects' });
  }
});

router.param('id', (req: Request, res: Response, next, id) => {
  if (!UUID_RE.test(String(id))) return res.status(400).json({ error: 'Invalid project id' });
  next();
});

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
    const createError = await validateProject(req.body, null);
    if (createError) return res.status(400).json({ error: createError });

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

    await logAuditEvent({
      userId: req.user!.id,
      action: 'CREATE',
      entityType: 'project',
      entityId: createdProject.id,
      newValue: { tracker_id: createdProject.tracker_id, project_code: createdProject.project_code, project_title: createdProject.project_title, status: createdProject.status },
      remarks: `Created project ${createdProject.tracker_id} "${createdProject.project_title}"`,
    });

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
    const existing = await query(
      `SELECT id, tracker_id, project_code, project_title, status, rag_status,
              start_date::text AS start_date, closing_date::text AS closing_date
       FROM projects WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const updateError = await validateProject(req.body, existing.rows[0]);
    if (updateError) return res.status(400).json({ error: updateError });

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
      open_actions !== undefined && open_actions !== null && open_actions !== '' ? Number(open_actions) : null,
      overdue_actions !== undefined && overdue_actions !== null && overdue_actions !== '' ? Number(overdue_actions) : null,
      staff_on_payroll !== undefined ? String(staff_on_payroll).trim() : null,
    ];

    const result = await query(updateSql, params);
    const updated = result.rows[0];
    const before = existing.rows[0];
    await logAuditEvent({
      userId: req.user!.id,
      action: 'UPDATE',
      entityType: 'project',
      entityId: id,
      oldValue: before,
      newValue: { project_code: updated.project_code, project_title: updated.project_title, status: updated.status, rag_status: updated.rag_status, start_date: updated.start_date, closing_date: updated.closing_date },
      remarks: `Updated project ${updated.tracker_id} "${updated.project_title}"`,
    });
    res.json(updated);
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
    const existing = await query('SELECT id, tracker_id, project_title, proposal_file_path FROM projects WHERE id = $1', [id]);
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
    await logAuditEvent({
      userId: req.user!.id,
      action: 'DELETE',
      entityType: 'project',
      entityId: id,
      oldValue: { tracker_id: existing.rows[0].tracker_id, project_title: existing.rows[0].project_title },
      remarks: `Deleted project ${existing.rows[0].tracker_id} "${existing.rows[0].project_title}"`,
    });
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

    const tempPath = path.join(UPLOAD_DIR, 'proposals', req.file.filename);
    try {
      const signatureError = checkFileSignature(tempPath, req.file.originalname);
      if (signatureError) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return res.status(400).json({ error: signatureError });
      }

      const projResult = await query('SELECT id, proposal_file_path FROM projects WHERE id = $1', [id]);
      if (projResult.rows.length === 0) {
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
      // Never store the client-supplied mimetype; derive it from the allow-listed extension.
      const mimeType = getDocumentContentType(originalName) || 'application/octet-stream';
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
      await logAuditEvent({
        userId: req.user!.id,
        action: 'UPLOAD_PROPOSAL',
        entityType: 'project',
        entityId: id,
        oldValue: oldFilePath ? { proposal_file_path: oldFilePath } : null,
        newValue: { proposal_filename: originalName, proposal_file_size: fileSize },
        remarks: `Uploaded proposal document "${originalName}"`,
      });
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

    const filename = proj.proposal_filename || 'proposal.pdf';

    res.removeHeader('X-Frame-Options');
    setProposalHeaders(res, filename, 'inline');
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

    const filename = proj.proposal_filename || 'proposal.pdf';
    // Explicit, extension-derived type (res.download keeps an already-set Content-Type).
    setProposalHeaders(res, filename, 'attachment');
    res.download(fullPath, filename);
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
      'SELECT id, proposal_filename, proposal_file_path FROM projects WHERE id = $1',
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

    await logAuditEvent({
      userId: req.user!.id,
      action: 'DELETE_PROPOSAL',
      entityType: 'project',
      entityId: id,
      oldValue: { proposal_filename: projResult.rows[0].proposal_filename },
      remarks: `Deleted proposal document "${projResult.rows[0].proposal_filename || ''}"`,
    });
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
router.get('/:id/achievements', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!canManageProjects(req) && !req.user!.permissions.has('view_projects')) {
      const proj = await query('SELECT id, team, faculty_lead_pi, accountable_owner_poc FROM projects WHERE id = $1', [id]);
      if (proj.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
      if (!isProjectMember(proj.rows[0], await loadMemberIdentity(req.user!.id))) {
        return res.status(403).json({ error: 'Only members of this project team can view its achievements' });
      }
    }
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
router.post('/:id/achievements', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Achievement message cannot be empty' });
  }

  try {
    // Verify project exists
    const projCheck = await query('SELECT id, team, faculty_lead_pi, accountable_owner_poc FROM projects WHERE id = $1', [id]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Determine author name
    const userProfile = await query('SELECT full_name, email FROM user_profiles WHERE id = $1', [req.user!.id]);

    // Only the project's own team posts updates (project managers and admins may post anywhere).
    if (!canManageProjects(req) && !isProjectMember(projCheck.rows[0], { id: req.user!.id, ...userProfile.rows[0] })) {
      return res.status(403).json({ error: 'Only members of this project team can post achievements to it' });
    }
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

    await logAuditEvent({
      userId: req.user!.id,
      action: 'CREATE',
      entityType: 'project_achievement',
      entityId: insertAch.rows[0].id,
      newValue: { project_id: id, message: insertAch.rows[0].message },
      remarks: `Posted achievement on project ${id}`,
    });
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

  if (!UUID_RE.test(String(achievementId))) {
    return res.status(400).json({ error: 'Invalid achievement id' });
  }

  try {
    const achCheck = await query('SELECT id, user_id, message FROM project_achievements WHERE id = $1 AND project_id = $2', [achievementId, id]);
    if (achCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Achievement record not found' });
    }

    const isAuthor = achCheck.rows[0].user_id === userId;
    if (!isAdmin && !hasEditPerm && !isAuthor) {
      return res.status(403).json({ error: 'Permission denied to delete this achievement' });
    }

    await query('DELETE FROM project_achievements WHERE id = $1', [achievementId]);
    await logAuditEvent({
      userId,
      action: 'DELETE',
      entityType: 'project_achievement',
      entityId: achievementId,
      oldValue: { project_id: id, user_id: achCheck.rows[0].user_id, message: achCheck.rows[0].message },
      remarks: `Deleted achievement on project ${id}`,
    });
    res.json({ message: 'Achievement deleted successfully' });
  } catch (err: any) {
    console.error('[PROJECTS] DELETE achievement error:', err);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

export default router;
