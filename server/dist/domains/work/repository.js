import { query } from '../../config/database.js';
export class WorkRepository {
    async createProgressUpdate(workId, percentage, summary, status) {
        const res = await query(`INSERT INTO progress_updates (work_id, completion_percentage, summary, status)
       VALUES ($1, $2, $3, $4) RETURNING *`, [workId, percentage, summary || 'Progress update', status || 'on_track']);
        // Synchronize overall completion percentage on assigned_works item
        await query(`UPDATE assigned_works SET completion_percentage = $1, updated_at = now() WHERE id = $2`, [percentage, workId]);
        return res.rows[0];
    }
}
export const workRepository = new WorkRepository();
