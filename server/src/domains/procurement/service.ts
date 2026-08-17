import { procurementRepository, PurchaseRequest } from './repository.js';
import { logAuditEvent } from '../../services/auditLogger.js';

export const HIGH_VALUE_APPROVAL_THRESHOLD = 50000;

export class ProcurementService {
  async approveRequest(requestId: string, actorUserId: string, remarks?: string): Promise<PurchaseRequest> {
    const existing = await procurementRepository.findById(requestId);
    if (!existing) {
      throw new Error('Purchase request not found');
    }

    const isHighValue = Number(existing.estimated_cost) >= HIGH_VALUE_APPROVAL_THRESHOLD;
    const finalRemarks = isHighValue
      ? `[HIGH VALUE APPROVAL >= ₹${HIGH_VALUE_APPROVAL_THRESHOLD}] ${remarks || ''}`.trim()
      : remarks;

    const updated = await procurementRepository.updateStatus(requestId, 'approved', actorUserId, finalRemarks);

    await logAuditEvent({
      userId: actorUserId,
      action: 'APPROVE',
      entityType: 'purchase_requests',
      entityId: requestId,
      oldValue: existing,
      newValue: updated,
      remarks: `ProcurementService: Approved request ${requestId}`,
    });

    return updated;
  }
}

export const procurementService = new ProcurementService();
