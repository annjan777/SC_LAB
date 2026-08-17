export interface PurchaseRequest {
    id: string;
    item_name: string;
    category: string | null;
    estimated_cost: number;
    status: string;
    requested_by: string;
    created_at: string;
}
export declare class ProcurementRepository {
    findById(id: string): Promise<PurchaseRequest | null>;
    updateStatus(id: string, status: string, approvedBy?: string, remarks?: string): Promise<PurchaseRequest>;
}
export declare const procurementRepository: ProcurementRepository;
