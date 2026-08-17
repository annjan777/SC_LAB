import { WorkProgressUpdate } from './repository.js';
export declare class WorkService {
    recordProgress(workId: string, percentage: number, actorUserId: string, summary?: string, status?: string): Promise<WorkProgressUpdate>;
}
export declare const workService: WorkService;
