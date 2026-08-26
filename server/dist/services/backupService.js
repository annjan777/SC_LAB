import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { ZipArchive } from 'archiver';
import AdmZip from 'adm-zip';
import { closePoolForRestore, reopenPool, query } from '../config/database.js';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
function dbEnv() {
    return {
        ...process.env,
        PGPASSWORD: process.env.DB_PASSWORD || '',
    };
}
function dbConnArgs() {
    return [
        '-h', process.env.DB_HOST || 'localhost',
        '-p', process.env.DB_PORT || '5432',
        '-U', process.env.DB_USER || 'postgres',
        // -d (not a bare trailing positional) — pg_restore reserves the positional argument for
        // the dump file, so the target database must always be passed as a named flag.
        '-d', process.env.DB_NAME || 'sclab',
    ];
}
/**
 * Builds a backup archive (Postgres dump + uploaded files + manifest) and returns the
 * archiver instance. The caller pipes it wherever it needs to go (an HTTP response for a
 * user-triggered export, or a file for an automatic pre-import safety snapshot).
 */
export function createBackupArchive() {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const dumpProcess = spawn('pg_dump', ['-Fc', ...dbConnArgs()], { env: dbEnv() });
    let stderr = '';
    dumpProcess.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    dumpProcess.on('error', (err) => archive.emit('error', err));
    dumpProcess.on('close', (code) => {
        if (code !== 0) {
            archive.emit('error', new Error(`pg_dump exited with code ${code}: ${stderr}`));
        }
    });
    archive.append(dumpProcess.stdout, { name: 'database.dump' });
    if (fs.existsSync(UPLOAD_DIR)) {
        archive.directory(UPLOAD_DIR, 'uploads');
    }
    archive.append(JSON.stringify({ created_at: new Date().toISOString(), app: 'sc-lab-portal' }, null, 2), { name: 'manifest.json' });
    archive.finalize();
    return archive;
}
/** Writes a full backup archive to disk (used for the automatic pre-import safety snapshot). */
export async function saveBackupToDisk() {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const filePath = path.join(BACKUP_DIR, `pre-import-${Date.now()}.zip`);
    const archive = createBackupArchive();
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(filePath);
        archive.on('error', reject);
        out.on('error', reject);
        out.on('close', () => resolve());
        archive.pipe(out);
    });
    return filePath;
}
function resolveSafeExtractPath(baseDir, entryName) {
    const target = path.resolve(baseDir, entryName);
    if (!target.startsWith(baseDir + path.sep) && target !== baseDir) {
        throw new Error(`Unsafe path in backup archive: ${entryName}`);
    }
    return target;
}
/**
 * Restores the database and uploaded files from a previously exported backup zip.
 * Always takes an automatic safety snapshot of the current state first — if anything here
 * fails, that snapshot is how the pre-import state gets recovered.
 */
export async function restoreFromBackup(zipPath) {
    const preImportBackupPath = await saveBackupToDisk();
    const extractDir = path.join(BACKUP_DIR, `restore-${Date.now()}`);
    await fsp.mkdir(extractDir, { recursive: true });
    try {
        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();
        const dumpEntry = entries.find((e) => e.entryName === 'database.dump');
        if (!dumpEntry) {
            throw new Error('Invalid backup file: missing database.dump');
        }
        for (const entry of entries) {
            if (entry.isDirectory)
                continue;
            const destPath = resolveSafeExtractPath(extractDir, entry.entryName);
            await fsp.mkdir(path.dirname(destPath), { recursive: true });
            await fsp.writeFile(destPath, entry.getData());
        }
        const dumpFilePath = path.join(extractDir, 'database.dump');
        // Close pooled connections so pg_restore can drop/recreate objects without lock conflicts.
        await closePoolForRestore();
        try {
            await new Promise((resolve, reject) => {
                const restoreProcess = spawn('pg_restore', ['--clean', '--if-exists', '--no-owner', '--single-transaction', ...dbConnArgs(), dumpFilePath], { env: dbEnv() });
                let stderr = '';
                restoreProcess.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
                restoreProcess.on('error', reject);
                restoreProcess.on('close', (code) => {
                    if (code !== 0)
                        reject(new Error(`pg_restore exited with code ${code}: ${stderr}`));
                    else
                        resolve();
                });
            });
        }
        finally {
            reopenPool();
        }
        // Sanity check the reopened pool actually works before touching files on disk.
        await query('SELECT 1');
        // The restored data may reflect a completely different point in time than what everyone's
        // current session was issued against — force every session app-wide to re-authenticate
        // rather than let people keep browsing on stale in-memory assumptions about the old data.
        await query('UPDATE user_profiles SET last_password_changed_at = now()');
        // Replace uploaded files with the ones from the backup.
        const extractedUploadsDir = path.join(extractDir, 'uploads');
        if (fs.existsSync(extractedUploadsDir)) {
            await fsp.rm(UPLOAD_DIR, { recursive: true, force: true });
            await fsp.mkdir(UPLOAD_DIR, { recursive: true });
            await fsp.cp(extractedUploadsDir, UPLOAD_DIR, { recursive: true });
        }
        return { preImportBackupPath };
    }
    finally {
        await fsp.rm(extractDir, { recursive: true, force: true }).catch(() => { });
    }
}
