export interface AuditLogOptions {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: any;
    newValue?: any;
    remarks?: string;
}
export declare function sanitizePayload(payload: any): any;
export declare function logAuditEvent(options: AuditLogOptions): Promise<void>;
