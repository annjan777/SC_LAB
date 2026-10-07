import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { authenticate, AuthUser } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

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

function mapDocumentForResponse(doc: any) {
  return {
    ...doc,
    uploaded_at: doc.created_at,
    visibility: visibilityForResponse(doc.visibility),
  };
}

function resolveSafePath(baseDir: string, relativePath: string): string | null {
  const safePath = path.resolve(baseDir, relativePath);
  if (!safePath.startsWith(baseDir)) {
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
    res.json(result.rows.map(mapDocumentForResponse));
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
        tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
        req.user!.id, fileSize,
        normalizeVisibilityInput(visibility) || 'all_members',
        shared_with_users ? (typeof shared_with_users === 'string' ? JSON.parse(shared_with_users) : shared_with_users) : [],
        is_admin_only_category === 'true' || is_admin_only_category === true,
      ]
    );
    res.status(201).json(mapDocumentForResponse(result.rows[0]));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/repository/download/:id
router.get('/download/:id', authenticate, async (req: Request, res: Response) => {
  try {
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

    const fullPath = resolveSafePath(UPLOAD_DIR, doc.file_path);
    if (!fullPath || !fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found on disk' });

    res.download(fullPath, doc.filename);
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/repository/url/:id - get a URL for viewing
router.get('/url/:id', authenticate, async (req: Request, res: Response) => {
  try {
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
    res.json({ url: `/api/repository/download/${doc.id}`, is_external: false });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/repository/:id
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const check = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = check.rows[0];
    if (doc.uploaded_by !== req.user!.id && !req.user!.permissions.has('edit_repository_all')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const fields = { ...req.body };
    delete fields.id;
    delete fields.created_at;
    delete fields.uploaded_by;
    if (fields.visibility) {
      fields.visibility = normalizeVisibilityInput(fields.visibility);
    }
    if (fields.document_url !== undefined && fields.document_url !== null && fields.document_url !== '') {
      if (!isValidSafeUrl(fields.document_url)) {
        return res.status(400).json({ error: 'Invalid URL. External document links must point to a valid public web destination.' });
      }
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
    res.json(mapDocumentForResponse(result.rows[0]));
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/repository/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (doc.uploaded_by !== req.user!.id && !req.user!.permissions.has('delete_repository_all')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (doc.file_path) {
      const fullPath = resolveSafePath(UPLOAD_DIR, doc.file_path);
      if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await query('DELETE FROM repository_documents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
