import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
function resolveSafePath(baseDir, relativePath) {
    const safePath = path.resolve(baseDir, relativePath);
    if (!safePath.startsWith(baseDir)) {
        return null;
    }
    return safePath;
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(UPLOAD_DIR, 'facility-images');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, Date.now() + '-' + safeOriginal);
    },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
// GET /api/facilities
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await query(`SELECT f.*, up.full_name as responsible_person_name
       FROM facilities f
       LEFT JOIN user_profiles up ON up.id = f.responsible_person_id
       ORDER BY f.name`);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// GET /api/facilities/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const result = await query(`SELECT f.*, up.full_name as responsible_person_name
       FROM facilities f
       LEFT JOIN user_profiles up ON up.id = f.responsible_person_id
       WHERE f.id = $1`, [req.params.id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /api/facilities
router.post('/', authenticate, upload.single('image'), async (req, res) => {
    try {
        const fields = { ...req.body };
        if (req.file) {
            fields.image_url = `/uploads/facility-images/${req.file.filename}`;
        }
        delete fields.id;
        if (fields.specifications && typeof fields.specifications === 'string') {
            fields.specifications = JSON.parse(fields.specifications);
        }
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields to insert' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const placeholders = safeKeys.map((_, i) => `$${i + 1}`);
        const values = rawKeys.map(k => fields[k]);
        const result = await query(`INSERT INTO facilities (${safeKeys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`, values);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// PUT /api/facilities/:id
router.put('/:id', authenticate, upload.single('image'), async (req, res) => {
    try {
        const fields = { ...req.body };
        if (req.file) {
            fields.image_url = `/uploads/facility-images/${req.file.filename}`;
            // Remove old image safely
            const old = await query('SELECT image_url FROM facilities WHERE id = $1', [req.params.id]);
            if (old.rows[0]?.image_url) {
                const relative = old.rows[0].image_url.replace('/uploads/', '');
                const oldPath = resolveSafePath(UPLOAD_DIR, relative);
                if (oldPath && fs.existsSync(oldPath))
                    fs.unlinkSync(oldPath);
            }
        }
        delete fields.id;
        delete fields.created_at;
        if (fields.specifications && typeof fields.specifications === 'string') {
            fields.specifications = JSON.parse(fields.specifications);
        }
        const rawKeys = Object.keys(fields);
        if (rawKeys.length === 0)
            return res.status(400).json({ error: 'No fields to update' });
        const safeKeys = rawKeys.map(k => sanitizeIdentifier(k));
        const setClause = safeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const values = rawKeys.map(k => fields[k]);
        values.push(req.params.id);
        const result = await query(`UPDATE facilities SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// DELETE /api/facilities/:id
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const old = await query('SELECT image_url FROM facilities WHERE id = $1', [req.params.id]);
        if (old.rows[0]?.image_url) {
            const relative = old.rows[0].image_url.replace('/uploads/', '');
            const oldPath = resolveSafePath(UPLOAD_DIR, relative);
            if (oldPath && fs.existsSync(oldPath))
                fs.unlinkSync(oldPath);
        }
        await query('DELETE FROM facilities WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
