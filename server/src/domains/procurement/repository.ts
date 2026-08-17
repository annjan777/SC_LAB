import { query } from '../../config/database.js';

export interface PurchaseRequest {
  id: string;
  item_name: string;
  category: string | null;
  estimated_cost: number;
  status: string;
  requested_by: string;
  created_at: string;
}

export class ProcurementRepository {
  async findById(id: string): Promise<PurchaseRequest | null> {
    const res = await query('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async updateStatus(id: string, status: string, approvedBy?: string, remarks?: string): Promise<PurchaseRequest> {
    const res = await query(
      `UPDATE purchase_requests
       SET status = $1, approved_by = $2, admin_remarks = $3, approved_at = now(), updated_at = now()
       WHERE id = $4 RETURNING *`,
      [status, approvedBy || null, remarks || null, id]
    );
    return res.rows[0];
  }
}

export const procurementRepository = new ProcurementRepository();
