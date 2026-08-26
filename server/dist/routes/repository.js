import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
function ensureDir(dir) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
function checkDocumentAccess(doc, user) {
    const isAdmin = user.user_role === 'admin' || user.user_role === 'super_admin';
    if (isAdmin)
        return true;
    if (doc.is_admin_only_category)
        return false;
    if (doc.uploaded_by === user.id)
        return true;
    if (doc.visibility === 'all_members')
        return true;
    if (Array.isArray(doc.shared_with_users) && doc.shared_with_users.includes(user.id))
        return true;
    return false;
}
function normalizeVisibilityInput(rawVisibility) {
    const visibility = typeof rawVisibility === 'string' ? rawVisibility : 'all_members';
    if (visibility === 'public_to_admins')
        return 'admin_only';
    if (visibility === 'public')
        return 'all_members';
    return visibility;
}
function visibilityForResponse(rawVisibility) {
    return rawVisibility === 'admin_only' ? 'public_to_admins' : rawVisibility;
}
function mapDocumentForResponse(doc) {
    return {
        ...doc,
        uploaded_at: doc.created_at,
        visibility: visibilityForResponse(doc.visibility),
    };
}
function resolveSafePath(baseDir, relativePath) {
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
router.get('/', authenticate, async (req, res) => {
    try {
        const isAdmin = req.user.user_role === 'admin' || req.user.user_role === 'super_admin';
        let sql;
        let params;
        if (isAdmin) {
            sql = `SELECT rd.*, up.full_name as uploader_name, up.user_role as uploader_role
             FROM repository_documents rd
             LEFT JOIN user_profiles up ON up.id = rd.uploaded_by
             ORDER BY rd.created_at DESC`;
            params = [];
        }
        else {
            sql = `SELECT rd.*, up.full_name as uploader_name, up.user_role as uploader_role
             FROM repository_documents rd
             LEFT JOIN user_profiles up ON up.id = rd.uploaded_by
             WHERE (rd.visibility = 'all_members'
                    OR rd.uploaded_by = $1
                    OR $1 = ANY(rd.shared_with_users))
               AND rd.is_admin_only_category = false
             ORDER BY rd.created_at DESC`;
            params = [req.user.id];
        }
        const result = await query(sql, params);
        res.json(result.rows.map(mapDocumentForResponse));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /api/repository/upload
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file' });
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
        }
        catch (err) {
            // Ignore read errors, let it pass or fail later
        }
        const { title, category, description, tags, visibility, shared_with_users, is_admin_only_category } = req.body;
        const filePath = 'documents/' + req.file.filename;
        const result = await query(`INSERT INTO repository_documents
        (filename, file_path, file_type, category, title, description, tags,
         uploaded_by, file_size, visibility, shared_with_users, is_admin_only_category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [
            req.file.originalname, filePath, req.file.mimetype,
            category || 'other_documents', title || req.file.originalname,
            description || null,
            tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
            req.user.id, req.file.size,
            normalizeVisibilityInput(visibility) || 'all_members',
            shared_with_users ? (typeof shared_with_users === 'string' ? JSON.parse(shared_with_users) : shared_with_users) : [],
            is_admin_only_category === 'true' || is_admin_only_category === true,
        ]);
        res.status(201).json(mapDocumentForResponse(result.rows[0]));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/repository/download/:id
router.get('/download/:id', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Not found' });
        const doc = result.rows[0];
        if (!checkDocumentAccess(doc, req.user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const fullPath = resolveSafePath(UPLOAD_DIR, doc.file_path);
        if (!fullPath || !fs.existsSync(fullPath))
            return res.status(404).json({ error: 'File not found on disk' });
        res.download(fullPath, doc.filename);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/repository/url/:id - get a URL for viewing
router.get('/url/:id', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Not found' });
        const doc = result.rows[0];
        if (!checkDocumentAccess(doc, req.user)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        res.json({ url: `/api/repository/download/${doc.id}` });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// PUT /api/repository/:id
router.put('/:id', authenticate, async (req, res) => {
    try {
        const check = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0)
            return res.status(404).json({ error: 'Not found' });
        const doc = check.rows[0];
        if (doc.uploaded_by !== req.user.id && !req.user.permissions.has('edit_repository_all')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const fields = { ...req.body };
        delete fields.id;
        delete fields.created_at;
        delete fields.uploaded_by;
        if (fields.visibility) {
            fields.visibility = normalizeVisibilityInput(fields.visibility);
        }
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields to update' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.id);
        const result = await query(`UPDATE repository_documents SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
        res.json(mapDocumentForResponse(result.rows[0]));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// DELETE /api/repository/:id
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT * FROM repository_documents WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Not found' });
        const doc = result.rows[0];
        if (doc.uploaded_by !== req.user.id && !req.user.permissions.has('delete_repository_all')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const fullPath = resolveSafePath(UPLOAD_DIR, doc.file_path);
        if (fullPath && fs.existsSync(fullPath))
            fs.unlinkSync(fullPath);
        await query('DELETE FROM repository_documents WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
