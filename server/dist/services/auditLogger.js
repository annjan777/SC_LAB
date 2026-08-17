import { query } from '../config/database.js';
const SENSITIVE_FIELDS = new Set(['password', 'password_hash', 'token', 'jwt_secret', 'secret']);
export function sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object')
        return payload;
    if (Array.isArray(payload))
        return payload.map(sanitizePayload);
    const clean = {};
    for (const [key, val] of Object.entries(payload)) {
        if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
            clean[key] = '[REDACTED]';
        }
        else if (val && typeof val === 'object') {
            clean[key] = sanitizePayload(val);
        }
        else {
            clean[key] = val;
        }
    }
    return clean;
}
export async function logAuditEvent(options) {
    try {
        const { userId, action, entityType, entityId, oldValue, newValue, remarks } = options;
        const sanitizedOld = oldValue ? sanitizePayload(oldValue) : null;
        const sanitizedNew = newValue ? sanitizePayload(newValue) : null;
        // Validate entityId format if provided
        const validEntityId = (entityId && typeof entityId === 'string' && entityId.includes('-')) ? entityId : null;
        await query(`INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, performed_by, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            entityType,
            validEntityId,
            action,
            sanitizedOld ? JSON.stringify(sanitizedOld) : null,
            sanitizedNew ? JSON.stringify(sanitizedNew) : null,
            userId || null,
            remarks || `${action} on ${entityType}`,
        ]);
    }
    catch (err) {
        console.error('[AUDIT LOG ERROR] Failed to record audit event:', err.message);
    }
}
