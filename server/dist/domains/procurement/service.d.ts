import { PurchaseRequest } from './repository.js';
export declare const HIGH_VALUE_APPROVAL_THRESHOLD = 50000;
export declare class ProcurementService {
    approveRequest(requestId: string, actorUserId: string, remarks?: string): Promise<PurchaseRequest>;
}
export declare const procurementService: ProcurementService;
