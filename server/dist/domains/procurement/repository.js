import { query } from '../../config/database.js';
export class ProcurementRepository {
    async findById(id) {
        const res = await query('SELECT * FROM purchase_requests WHERE id = $1', [id]);
        return res.rows[0] || null;
    }
    async updateStatus(id, status, approvedBy, remarks) {
        const res = await query(`UPDATE purchase_requests
       SET status = $1, approved_by = $2, admin_remarks = $3, approved_at = now(), updated_at = now()
       WHERE id = $4 RETURNING *`, [status, approvedBy || null, remarks || null, id]);
        return res.rows[0];
    }
}
export const procurementRepository = new ProcurementRepository();
