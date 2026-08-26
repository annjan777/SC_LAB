import { Archiver } from 'archiver';
/**
 * Builds a backup archive (Postgres dump + uploaded files + manifest) and returns the
 * archiver instance. The caller pipes it wherever it needs to go (an HTTP response for a
 * user-triggered export, or a file for an automatic pre-import safety snapshot).
 */
export declare function createBackupArchive(): Archiver;
/** Writes a full backup archive to disk (used for the automatic pre-import safety snapshot). */
export declare function saveBackupToDisk(): Promise<string>;
/**
 * Restores the database and uploaded files from a previously exported backup zip.
 * Always takes an automatic safety snapshot of the current state first — if anything here
 * fails, that snapshot is how the pre-import state gets recovered.
 */
export declare function restoreFromBackup(zipPath: string): Promise<{
    preImportBackupPath: string;
}>;
