import { evaluateRbacPolicy } from '../middleware/rbacEvaluator.js';
import { sanitizeIdentifier } from '../utils/sqlSanitizer.js';
import { runAuditLoggerTest } from './auditLogger.test.js';
import { runValidatorTest } from './validator.test.js';
import { runDomainServicesTest } from './domains.test.js';
import { runStorageAndJobsTest } from './storageAndJobs.test.js';
async function runSITSuite() {
    console.log('====================================================');
    console.log('   SC LAB PORTAL — SYSTEM INTEGRATION TEST (SIT)    ');
    console.log('====================================================\n');
    let passed = 0;
    let total = 0;
    function assert(condition, title, details) {
        total++;
        if (condition) {
            console.log(`  [PASS] ${title}`);
            passed++;
        }
        else {
            console.error(`  [FAIL] ${title} | Details: ${details}`);
        }
    }
    // 1. SQL Identifier Sanitization Tests
    console.log('--- 1. Security & Input Sanitization Suite ---');
    try {
        const clean = sanitizeIdentifier('user_name');
        assert(clean === 'user_name', 'Valid column name passed', `Expected user_name, got ${clean}`);
    }
    catch (e) {
        assert(false, 'Valid column name passed', e.message);
    }
    try {
        sanitizeIdentifier('user_name"; DROP TABLE users;--');
        assert(false, 'Malicious SQL injection key rejected', 'Should have thrown error');
    }
    catch {
        assert(true, 'Malicious SQL injection key rejected', 'Successfully threw error');
    }
    // 2. Auth & RBAC Isolation SIT Suite
    console.log('\n--- 2. RBAC Policy Engine SIT Suite ---');
    const r1 = evaluateRbacPolicy(undefined, '/api/auth/login', 'POST');
    assert(r1.allowed === true && r1.priority === 100, 'Public login route accessible to GUEST', r1.reason);
    const r2 = evaluateRbacPolicy(undefined, '/api/inventory', 'GET');
    assert(r2.allowed === false, 'GUEST blocked from protected inventory route (fail-closed)', r2.reason);
    const r3 = evaluateRbacPolicy('MEMBER', '/api/inventory', 'GET');
    assert(r3.allowed === true, 'MEMBER permitted to view inventory', r3.reason);
    const r4 = evaluateRbacPolicy('MEMBER', '/api/admin/users', 'POST');
    assert(r4.allowed === false && r4.priority === 25, 'MEMBER blocked from admin user creation', r4.reason);
    const r5 = evaluateRbacPolicy('COORDINATOR', '/api/work-cycles', 'POST');
    assert(r5.allowed === true, 'COORDINATOR permitted to manage work-cycles', r5.reason);
    const r6 = evaluateRbacPolicy('ADMIN', '/api/admin/users', 'POST');
    assert(r6.allowed === true, 'ADMIN permitted to manage admin routes', r6.reason);
    const r7 = evaluateRbacPolicy('SUPER_ADMIN', '/api/admin/users', 'POST');
    assert(r7.allowed === true, 'SUPER_ADMIN permitted for wildcard management routes', r7.reason);
    const r8 = evaluateRbacPolicy('MEMBER', '/api/admin/users', 'GET', new Set(['manage_users']));
    assert(r8.allowed === true, 'MEMBER with granted manage_users permission permitted to access admin user routes', r8.reason);
    // 3. Audit Trail & Security Redaction Suite
    console.log('\n--- 3. Audit Trail & Security Redaction Suite ---');
    try {
        await runAuditLoggerTest();
        assert(true, 'Audit log event recorded with sensitive field redaction', 'All checks passed');
    }
    catch (err) {
        assert(false, 'Audit log event recorded with sensitive field redaction', err.message);
    }
    // 4. Zod Request Validation Suite
    console.log('\n--- 4. Zod Request Validation Suite ---');
    try {
        await runValidatorTest();
        assert(true, 'Zod schema validation rejects malformed input with 400 Bad Request', 'All checks passed');
    }
    catch (err) {
        assert(false, 'Zod schema validation rejects malformed input with 400 Bad Request', err.message);
    }
    // 5. Domain Services & Business Rules Suite
    console.log('\n--- 5. Domain Services & Business Rules Suite ---');
    try {
        await runDomainServicesTest();
        assert(true, 'Domain service business rules and thresholds verified', 'All checks passed');
    }
    catch (err) {
        assert(false, 'Domain service business rules and thresholds verified', err.message);
    }
    // 6. Storage Abstraction & Background Jobs Suite
    console.log('\n--- 6. Storage Abstraction & Background Jobs Suite ---');
    try {
        await runStorageAndJobsTest();
        assert(true, 'StorageAdapter (Local & S3) and non-blocking JobQueue verified', 'All checks passed');
    }
    catch (err) {
        assert(false, 'StorageAdapter (Local & S3) and non-blocking JobQueue verified', err.message);
    }
    console.log(`\n----------------------------------------------------`);
    console.log(`SIT Results: ${passed}/${total} assertions passed.`);
    console.log(`----------------------------------------------------\n`);
    if (passed !== total) {
        process.exit(1);
    }
}
runSITSuite();
