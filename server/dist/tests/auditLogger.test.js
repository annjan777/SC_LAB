import { sanitizePayload, logAuditEvent } from '../services/auditLogger.js';
import { query } from '../config/database.js';
export async function runAuditLoggerTest() {
    console.log('--- Audit Logger Unit & Integration Test ---');
    // 1. Test payload sanitization
    const rawData = {
        user_name: 'test_user',
        password: 'secretpassword123',
        password_hash: '$2a$10$xyz',
        token: 'jwt.token.val',
        department: 'Robotics',
    };
    const clean = sanitizePayload(rawData);
    if (clean.password !== '[REDACTED]' || clean.password_hash !== '[REDACTED]' || clean.token !== '[REDACTED]') {
        throw new Error('Audit logger failed to redact sensitive fields!');
    }
    if (clean.user_name !== 'test_user' || clean.department !== 'Robotics') {
        throw new Error('Audit logger modified non-sensitive fields!');
    }
    console.log('  [PASS] Payload sensitive field redaction');
    // 2. Test audit event logging to DB
    await logAuditEvent({
        userId: '00000000-0000-0000-0000-000000000001',
        action: 'TEST_AUDIT',
        entityType: 'test_entity',
        entityId: '00000000-0000-0000-0000-000000000002',
        oldValue: { status: 'old' },
        newValue: { status: 'new', password: 'my-secret-pass' },
        remarks: 'Audit log verification test',
    });
    const check = await query(`SELECT * FROM audit_logs WHERE action = 'TEST_AUDIT' AND entity_type = 'test_entity' ORDER BY performed_at DESC LIMIT 1`);
    if (check.rows.length === 0) {
        throw new Error('Audit event was not inserted into audit_logs table!');
    }
    const row = check.rows[0];
    if (row.new_value?.password !== '[REDACTED]') {
        throw new Error('Persisted JSONB audit log contains unredacted password!');
    }
    console.log('  [PASS] Audit event database insertion and redaction verification');
}
