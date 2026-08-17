export interface WorkProgressUpdate {
    id: string;
    work_id: string;
    completion_percentage: number;
    summary: string | null;
    status: string;
    created_at: string;
}
export declare class WorkRepository {
    createProgressUpdate(workId: string, percentage: number, summary?: string, status?: string): Promise<WorkProgressUpdate>;
}
export declare const workRepository: WorkRepository;
