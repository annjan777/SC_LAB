export interface UploadFileOptions {
    filename: string;
    buffer: Buffer;
    mimeType: string;
}
export interface StorageAdapter {
    uploadFile(options: UploadFileOptions): Promise<{
        url: string;
        filepath: string;
    }>;
    deleteFile(filepath: string): Promise<boolean>;
    getFileUrl(filepath: string): string;
}
export declare class LocalStorageAdapter implements StorageAdapter {
    private uploadDir;
    constructor();
    uploadFile(options: UploadFileOptions): Promise<{
        url: string;
        filepath: string;
    }>;
    deleteFile(filepath: string): Promise<boolean>;
    getFileUrl(filepath: string): string;
}
export declare class S3StorageAdapter implements StorageAdapter {
    private bucket;
    private region;
    constructor();
    uploadFile(options: UploadFileOptions): Promise<{
        url: string;
        filepath: string;
    }>;
    deleteFile(filepath: string): Promise<boolean>;
    getFileUrl(filepath: string): string;
}
export declare function getStorageAdapter(): StorageAdapter;
