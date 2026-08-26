import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { authenticate } from '../middleware/auth.js';
import { createBackupArchive, restoreFromBackup } from '../services/backupService.js';
import { logAuditEvent } from '../services/auditLogger.js';
const router = Router();
function requireSuperAdmin(req, res) {
    if (req.user.user_role !== 'super_admin') {
        res.status(403).json({ error: 'Only Super Admin can export or import portal data' });
        return false;
    }
    return true;
}
// GET /api/admin/backup/export — streams a zip of the database + uploaded files
router.get('/export', authenticate, async (req, res) => {
    if (!requireSuperAdmin(req, res))
        return;
    try {
        const filename = `sclab-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const archive = createBackupArchive();
        archive.on('error', (err) => {
            console.error('Backup export failed:', err);
            if (!res.headersSent)
                res.status(500).json({ error: 'Export failed' });
            else
                res.destroy();
        });
        archive.pipe(res);
        await logAuditEvent({
            userId: req.user.id,
            action: 'EXPORT',
            entityType: 'full_backup',
            remarks: 'Full data export (database + uploaded files)',
        });
    }
    catch (err) {
        console.error('Backup export failed:', err);
        if (!res.headersSent)
            res.status(500).json({ error: 'Export failed' });
    }
});
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sclab-import-'));
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
    fileFilter: (_req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.zip') {
            return cb(new Error('Only .zip backup files are accepted'));
        }
        cb(null, true);
    },
});
// POST /api/admin/backup/import — restores the database + uploaded files from a backup zip.
// Always takes an automatic safety snapshot of the current state first.
router.post('/import', authenticate, upload.single('backup'), async (req, res) => {
    if (!requireSuperAdmin(req, res))
        return;
    if (!req.file) {
        return res.status(400).json({ error: 'No backup file provided' });
    }
    try {
        await logAuditEvent({
            userId: req.user.id,
            action: 'IMPORT_START',
            entityType: 'full_backup',
            remarks: `Data import started from uploaded file: ${req.file.originalname}`,
        });
        const { preImportBackupPath } = await restoreFromBackup(req.file.path);
        await logAuditEvent({
            userId: req.user.id,
            action: 'IMPORT_COMPLETE',
            entityType: 'full_backup',
            remarks: `Data import completed. Pre-import safety snapshot: ${preImportBackupPath}`,
        });
        res.json({
            message: 'Data restored successfully. All existing sessions have been invalidated — please log in again.',
            preImportBackupPath,
        });
    }
    catch (err) {
        console.error('Backup import failed:', err);
        res.status(500).json({ error: `Import failed: ${err.message}` });
    }
    finally {
        fs.unlink(req.file.path, () => { });
    }
});
export default router;
