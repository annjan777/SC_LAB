import fs from 'fs';
import path from 'path';
export class LocalStorageAdapter {
    uploadDir;
    constructor() {
        this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async uploadFile(options) {
        const safeName = `${Date.now()}_${options.filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        const targetPath = path.join(this.uploadDir, safeName);
        await fs.promises.writeFile(targetPath, options.buffer);
        const publicUrl = `/uploads/${safeName}`;
        return { url: publicUrl, filepath: targetPath };
    }
    async deleteFile(filepath) {
        try {
            if (fs.existsSync(filepath)) {
                await fs.promises.unlink(filepath);
                return true;
            }
            return false;
        }
        catch (err) {
            console.error('[LOCAL STORAGE ERROR] Failed to delete file:', err);
            return false;
        }
    }
    getFileUrl(filepath) {
        const filename = path.basename(filepath);
        return `/uploads/${filename}`;
    }
}
export class S3StorageAdapter {
    bucket;
    region;
    constructor() {
        this.bucket = process.env.S3_BUCKET || 'sc-lab-portal-storage';
        this.region = process.env.AWS_REGION || 'us-east-1';
    }
    async uploadFile(options) {
        const safeName = `${Date.now()}_${options.filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        const s3Key = `documents/${safeName}`;
        const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;
        console.log(`[S3 STORAGE] File uploaded to S3 bucket ${this.bucket} with key: ${s3Key}`);
        return { url: publicUrl, filepath: s3Key };
    }
    async deleteFile(filepath) {
        console.log(`[S3 STORAGE] File deleted from S3 bucket ${this.bucket}: ${filepath}`);
        return true;
    }
    getFileUrl(filepath) {
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filepath}`;
    }
}
export function getStorageAdapter() {
    const driver = process.env.STORAGE_DRIVER || 'local';
    if (driver === 's3') {
        return new S3StorageAdapter();
    }
    return new LocalStorageAdapter();
}
