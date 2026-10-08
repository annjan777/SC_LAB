import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { authenticate, AuthUser } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { logAuditEvent } from '../services/auditLogger.js';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
const DOCUMENTS_DIR = path.join(UPLOAD_DIR, 'documents');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_VISIBILITIES = ['all_members', 'admin_only', 'private', 'shared'];

function isRepoAdmin(user: AuthUser): boolean {
  return user.user_role === 'admin' || user.user_role === 'super_admin';
}

/** Parses a tags / shared_with_users value (array or JSON-encoded array). Returns null when malformed. */
function parseStringArray(raw: unknown): string[] | null {
  if (raw === undefined || raw === null || raw === '') return [];
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) return null;
  return value as string[];
}

function parseUuidArray(raw: unknown): string[] | null {
  const arr = parseStringArray(raw);
  if (!arr || arr.some(v => !UUID_RE.test(v))) return null;
  return arr;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function checkDocumentAccess(doc: any, user: AuthUser): boolean {
  const isAdmin = user.user_role === 'admin' || user.user_role === 'super_admin';
  if (isAdmin) return true;
  if (doc.is_admin_only_category) return false;
  if (doc.uploaded_by === user.id) return true;
  if (doc.visibility === 'all_members') return true;
  if (Array.isArray(doc.shared_with_users) && doc.shared_with_users.includes(user.id)) return true;
  return false;
}

function normalizeVisibilityInput(rawVisibility: unknown): string {
  const visibility = typeof rawVisibility === 'string' ? rawVisibility : 'all_members';
  if (visibility === 'public_to_admins') return 'admin_only';
  if (visibility === 'public') return 'all_members';
  return visibility;
}

function visibilityForResponse(rawVisibility: string): string {
  return rawVisibility === 'admin_only' ? 'public_to_admins' : rawVisibility;
}

function mapDocumentForResponse(doc: any, user?: AuthUser) {
  const mapped = {
    ...doc,
    uploaded_at: doc.created_at,
    visibility: visibilityForResponse(doc.visibility),
  };
  // Never expose the on-disk storage path to members. The UI only checks whether a file
  // exists (file_path truthy vs. link-only document), so keep a non-revealing marker.
  if (!user || !isRepoAdmin(user)) {
    mapped.file_path = doc.file_path ? 'stored' : null;
  }
  return mapped;
}

/** Resolves a stored relative path and requires it to stay inside the documents upload dir. */
function resolveDocumentPath(relativePath: unknown): string | null {
  if (typeof relativePath !== 'string' || !relativePath) return null;
  const safePath = path.resolve(UPLOAD_DIR, relativePath);
  if (!safePath.startsWith(DOCUMENTS_DIR + path.sep)) {
    return null;
  }
  return safePath;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, 'documents');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + safeOriginal);
  },
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const blocked = ['.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.exe', '.sh', '.bat', '.cmd', '.php', '.py', '.svg'];
    if (blocked.includes(ext)) {
      return cb(Object.assign(new Error('File type not allowed for security reasons'), { statusCode: 400 }));
    }
    cb(null, true);
  }
});

const router = Router();

// GET /api/repository
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.user_role === 'admin' || req.user!.user_role === 'super_admin';
    let sql: string;
    let params: any[];

    if (isAdmin) {
      sql = `SELECT rd.*, up.full_name as uploader_name, up.user_role as uploader_role
             FROM repository_documents rd
             LEFT JOIN user_profiles up ON up.id = rd.uploaded_by
             ORDER BY rd.created_at DESC`;
      params = [];
    } else {
      sql = `SELECT rd.*, up.full_name as uploader_name, up.user_role as uploader_role
             FROM repository_documents rd
             LEFT JOIN user_profiles up ON up.id = rd.uploaded_by
             WHERE (rd.visibility = 'all_members'
                    OR rd.uploaded_by = $1
                    OR $1 = ANY(rd.shared_with_users))
               AND rd.is_admin_only_category = false
             ORDER BY rd.created_at DESC`;
      params = [req.user!.id];
    }

    const result = await query(sql, params);
    res.json(result.rows.map((doc: any) => mapDocumentForResponse(doc, req.user!)));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  const cleanHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.corp') ||
    cleanHost.endsWith('.lan') ||
    cleanHost.endsWith('.home') ||
    cleanHost.endsWith('.localdomain') ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'instance-data'
  ) {
    return true;
  }

  // Check IPv4 dotted-decimal
  const ipv4Match = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = Number(ipv4Match[1]);
    const o2 = Number(ipv4Match[2]);
    const o3 = Number(ipv4Match[3]);
    const o4 = Number(ipv4Match[4]);
    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) return true;

    if (o1 === 0) return true; // 0.0.0.0/8
    if (o1 === 10) return true; // 10.0.0.0/8 (Private)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true; // 100.64.0.0/10 (Carrier-grade NAT)
    if (o1 === 127) return true; // 127.0.0.0/8 (Loopback)
    if (o1 === 169 && o2 === 254) return true; // 169.254.0.0/16 (Link-local & Cloud metadata e.g. 169.254.169.254)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12 (Private)
    if (o1 === 192 && o2 === 0 && o3 === 0) return true; // 192.0.0.0/24
    if (o1 === 192 && o2 === 0 && o3 === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
    if (o1 === 192 && o2 === 168) return true; // 192.168.0.0/16 (Private)
    if (o1 === 198 && o2 === 51 && o3 === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (o1 === 203 && o2 === 0 && o3 === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (o1 >= 224) return true; // Multicast & Reserved
    return false;
  }

  // Check IPv6
  if (cleanHost.includes(':')) {
    if (cleanHost === '::1' || cleanHost === '0:0:0:0:0:0:0:1') return true;
    if (cleanHost === '::' || cleanHost === '0:0:0:0:0:0:0:0') return true;
    if (/^fe[89ab]/i.test(cleanHost)) return true; // fe80::/10 link-local
    if (/^f[cd]/i.test(cleanHost)) return true; // fc00::/7 unique local
    if (cleanHost.startsWith('::ffff:')) {
      return isPrivateOrReservedHost(cleanHost.slice(7));
    }
    return true; // Disallow raw IPv6 addresses
  }

  // Must have at least one dot in hostname to avoid internal single-label hosts
  if (!cleanHost.includes('.')) {
    return true;
  }

  return false;
}

function isValidSafeUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (!parsed.hostname) return false;
    if (isPrivateOrReservedHost(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// POST /api/repository/upload
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { title, category, description, tags, visibility, shared_with_users, is_admin_only_category, document_url, link_url } = req.body;
    const rawLink = typeof (document_url || link_url) === 'string' ? (document_url || link_url).trim() : '';

    const discardUpload = () => {
      if (req.file) fs.unlink(path.join(DOCUMENTS_DIR, req.file.filename), () => {});
    };
    const parsedTags = parseStringArray(tags);
    if (!parsedTags) {
      discardUpload();
      return res.status(400).json({ error: 'tags must be an array of strings' });
    }
    const parsedSharedWith = parseUuidArray(shared_with_users);
    if (!parsedSharedWith) {
      discardUpload();
      return res.status(400).json({ error: 'shared_with_users must be an array of user ids' });
    }
    const normalizedVisibility = normalizeVisibilityInput(visibility) || 'all_members';
    if (!VALID_VISIBILITIES.includes(normalizedVisibility)) {
      discardUpload();
      return res.status(400).json({ error: `visibility must be one of: ${VALID_VISIBILITIES.join(', ')}` });
    }

    if (!req.file && !rawLink) {
      return res.status(400).json({ error: 'Please provide either a document file or a document link' });
    }

    if (rawLink && !isValidSafeUrl(rawLink)) {
      return res.status(400).json({ error: 'Invalid URL. Only HTTP and HTTPS protocols to public destinations are allowed.' });
    }

    let filePath: string | null = null;
    let filename: string;
    let fileType: string | null = null;
    let fileSize: number | null = null;
    const docUrl: string | null = rawLink || null;

    if (req.file) {
      // SCL-14: Magic Byte Validation
      const fullPath = path.join(UPLOAD_DIR, 'documents', req.file.filename);
      try {
        const fd = fs.openSync(fullPath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        // If it claims to be a PDF, verify it starts with '%PDF'
        if (ext === '.pdf' && buffer.toString('hex') !== '25504446') {
          fs.unlinkSync(fullPath);
          return res.status(400).json({ error: 'Invalid file signature for PDF' });
        }
        
        // Prevent bash scripts masquerading as documents (e.g. '#!/')
        if (buffer.toString('hex').startsWith('2321')) { // #!
          fs.unlinkSync(fullPath);
          return res.status(400).json({ error: 'Executable scripts are not allowed' });
        }
      } catch (err) {
        // Ignore read errors, let it pass or fail later
      }

      filePath = 'documents/' + req.file.filename;
      filename = req.file.originalname;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
    } else {
      // Document Link provided
      filename = title?.trim() || 'External Document';
      fileType = rawLink.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'link';
      fileSize = null;
    }

    const result = await query(
      `INSERT INTO repository_documents
        (filename, file_path, document_url, file_type, category, title, description, tags,
         uploaded_by, file_size, visibility, shared_with_users, is_admin_only_category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        filename, filePath, docUrl, fileType,
        category || 'other_documents', title || filename,
        description || null,
        parsedTags,
        req.user!.id, fileSize,
        normalizedVisibility,
        parsedSharedWith,
        // Only administrators may file documents into admin-only categories
        (['admin', 'super_admin'].includes(req.user!.user_role) || req.user!.permissions.has('edit_repository_all')) &&
          (is_admin_only_category === 'true' || is_admin_only_category === true),
      ]
    );
    const created = result.rows[0];
    await logAuditEvent({
      userId: req.user!.id,
      action: 'CREATE',
      entityType: 'repository_document',
      entityId: created.id,
      newValue: { title: created.title, filename: created.filename, category: created.category, visibility: created.visibility, document_url: created.document_url },
      remarks: `Uploaded repository document "${created.title}"`,
    });
    res.status(201).json(mapDocumentForResponse(created, req.user!));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/repository/download/:id
router.get('/download/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
    const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (!checkDocumentAccess(doc, req.user!)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (doc.document_url && !doc.file_path) {
      if (!isValidSafeUrl(doc.document_url)) {
        return res.status(400).json({ error: 'Invalid external document link destination' });
      }
      return res.redirect(doc.document_url);
    }

    const fullPath = resolveDocumentPath(doc.file_path);
    if (!fullPath || !fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found on disk' });

    res.download(fullPath, doc.filename);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/repository/url/:id - get a URL for viewing
router.get('/url/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
    const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const doc = result.rows[0];
    if (!checkDocumentAccess(doc, req.user!)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (doc.document_url && !doc.file_path) {
      if (!isValidSafeUrl(doc.document_url)) {
        return res.status(400).json({ error: 'Invalid external document link destination' });
      }
      return res.json({ url: doc.document_url, is_external: true });
    }
    if (!resolveDocumentPath(doc.file_path)) return res.status(404).json({ error: 'File not found on disk' });
    res.json({ url: `/api/repository/download/${doc.id}`, is_external: false });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/repository/:id
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
    const check = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = check.rows[0];
    if (doc.uploaded_by !== req.user!.id && !req.user!.permissions.has('edit_repository_all')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Allowlist of editable metadata. Storage fields (file_path, filename, file_type, file_size,
    // uploaded_by) are never client-writable — a member could otherwise point their own record at
    // another user's file and then download or delete it.
    const body = req.body || {};
    const fields: Record<string, any> = {};

    for (const key of ['title', 'category'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || !body[key].trim()) {
          return res.status(400).json({ error: `${key} must be a non-empty string` });
        }
        fields[key] = body[key].trim();
      }
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' });
      }
      fields.description = body.description;
    }
    if (body.tags !== undefined) {
      const parsedTags = parseStringArray(body.tags);
      if (!parsedTags) return res.status(400).json({ error: 'tags must be an array of strings' });
      fields.tags = parsedTags;
    }
    if (body.shared_with_users !== undefined) {
      const parsedSharedWith = parseUuidArray(body.shared_with_users);
      if (!parsedSharedWith) return res.status(400).json({ error: 'shared_with_users must be an array of user ids' });
      fields.shared_with_users = parsedSharedWith;
    }
    if (body.visibility !== undefined) {
      const normalized = normalizeVisibilityInput(body.visibility);
      if (!VALID_VISIBILITIES.includes(normalized)) {
        return res.status(400).json({ error: `visibility must be one of: ${VALID_VISIBILITIES.join(', ')}` });
      }
      fields.visibility = normalized;
    }
    if (body.document_url !== undefined) {
      // Only link documents (no stored file) carry an editable URL.
      if (doc.file_path) {
        return res.status(400).json({ error: 'document_url can only be set on link documents' });
      }
      if (typeof body.document_url !== 'string' || !isValidSafeUrl(body.document_url)) {
        return res.status(400).json({ error: 'Invalid URL. External document links must point to a valid public web destination.' });
      }
      fields.document_url = body.document_url.trim();
    }
    if (body.is_admin_only_category !== undefined) {
      // Same rule as upload: only administrators may file documents into admin-only categories.
      if (!isRepoAdmin(req.user!) && !req.user!.permissions.has('edit_repository_all')) {
        return res.status(403).json({ error: 'Only administrators can change admin-only categories' });
      }
      if (typeof body.is_admin_only_category !== 'boolean') {
        return res.status(400).json({ error: 'is_admin_only_category must be a boolean' });
      }
      fields.is_admin_only_category = body.is_admin_only_category;
    }

    const rawKeys = Object.keys(fields);
    if (rawKeys.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
    const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = rawKeys.map(k => fields[k]);
    values.push(req.params.id);

    const result = await query(
      `UPDATE repository_documents SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    const updated = result.rows[0];
    await logAuditEvent({
      userId: req.user!.id,
      action: 'UPDATE',
      entityType: 'repository_document',
      entityId: updated.id,
      oldValue: Object.fromEntries(rawKeys.map(k => [k, doc[k]])),
      newValue: fields,
      remarks: `Updated repository document "${updated.title}"`,
    });
    res.json(mapDocumentForResponse(updated, req.user!));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/repository/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid document id' });
    const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (doc.uploaded_by !== req.user!.id && !req.user!.permissions.has('delete_repository_all')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (doc.file_path) {
      const fullPath = resolveDocumentPath(doc.file_path);
      if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await query('DELETE FROM repository_documents WHERE id = $1', [req.params.id]);
    await logAuditEvent({
      userId: req.user!.id,
      action: 'DELETE',
      entityType: 'repository_document',
      entityId: doc.id,
      oldValue: { title: doc.title, filename: doc.filename, category: doc.category, uploaded_by: doc.uploaded_by },
      remarks: `Deleted repository document "${doc.title}"`,
    });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
