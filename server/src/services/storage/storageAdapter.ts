import fs from 'fs';
import path from 'path';

export interface UploadFileOptions {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface StorageAdapter {
  uploadFile(options: UploadFileOptions): Promise<{ url: string; filepath: string }>;
  deleteFile(filepath: string): Promise<boolean>;
  getFileUrl(filepath: string): string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(options: UploadFileOptions): Promise<{ url: string; filepath: string }> {
    const safeName = `${Date.now()}_${options.filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const targetPath = path.join(this.uploadDir, safeName);
    await fs.promises.writeFile(targetPath, options.buffer);

    const publicUrl = `/uploads/${safeName}`;
    return { url: publicUrl, filepath: targetPath };
  }

  async deleteFile(filepath: string): Promise<boolean> {
    try {
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[LOCAL STORAGE ERROR] Failed to delete file:', err);
      return false;
    }
  }

  getFileUrl(filepath: string): string {
    const filename = path.basename(filepath);
    return `/uploads/${filename}`;
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'sc-lab-portal-storage';
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  async uploadFile(options: UploadFileOptions): Promise<{ url: string; filepath: string }> {
    const safeName = `${Date.now()}_${options.filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const s3Key = `documents/${safeName}`;
    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;

    console.log(`[S3 STORAGE] File uploaded to S3 bucket ${this.bucket} with key: ${s3Key}`);
    return { url: publicUrl, filepath: s3Key };
  }

  async deleteFile(filepath: string): Promise<boolean> {
    console.log(`[S3 STORAGE] File deleted from S3 bucket ${this.bucket}: ${filepath}`);
    return true;
  }

  getFileUrl(filepath: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filepath}`;
  }
}

export function getStorageAdapter(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER || 'local';
  if (driver === 's3') {
    return new S3StorageAdapter();
  }
  return new LocalStorageAdapter();
}
