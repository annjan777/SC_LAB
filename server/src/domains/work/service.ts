import { workRepository, WorkProgressUpdate } from './repository.js';
import { logAuditEvent } from '../../services/auditLogger.js';

export class WorkService {
  async recordProgress(workId: string, percentage: number, actorUserId: string, summary?: string, status?: string): Promise<WorkProgressUpdate> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Completion percentage must be between 0 and 100');
    }

    const update = await workRepository.createProgressUpdate(workId, percentage, summary, status);

    await logAuditEvent({
      userId: actorUserId,
      action: 'UPDATE_PROGRESS',
      entityType: 'progress_updates',
      entityId: update.id,
      newValue: update,
      remarks: `WorkService: Updated progress to ${percentage}% for work ${workId}`,
    });

    return update;
  }
}

export const workService = new WorkService();
