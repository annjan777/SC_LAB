export interface BackgroundJob<T = any> {
    id: string;
    type: string;
    payload: T;
    createdAt: Date;
    attempts: number;
}
export type JobHandler<T = any> = (payload: T) => Promise<void>;
export declare class JobQueue {
    private handlers;
    private queue;
    private isProcessing;
    registerHandler<T>(type: string, handler: JobHandler<T>): void;
    enqueue<T>(type: string, payload: T): string;
    private processQueue;
    getPendingCount(): number;
}
export declare const globalJobQueue: JobQueue;
