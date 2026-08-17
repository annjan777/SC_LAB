import { evaluateRbacPolicy } from '../middleware/rbacEvaluator.js';
function runRbacTests() {
    console.log('=== Running RBAC Policy Evaluator Unit Tests ===\n');
    const testCases = [
        {
            name: 'Unauthenticated GUEST accessing public login endpoint',
            userRole: undefined,
            path: '/api/auth/login',
            method: 'POST',
            expectedAllowed: true,
        },
        {
            name: 'Unauthenticated GUEST accessing protected /api/inventory (fail-closed)',
            userRole: undefined,
            path: '/api/inventory',
            method: 'GET',
            expectedAllowed: false,
        },
        {
            name: 'STUDENT reading /api/inventory (allowed priority 10)',
            userRole: 'STUDENT',
            path: '/api/inventory',
            method: 'GET',
            expectedAllowed: true,
        },
        {
            name: 'STUDENT attempting write on /api/admin/users (blocked priority 25 deny)',
            userRole: 'STUDENT',
            path: '/api/admin/users',
            method: 'POST',
            expectedAllowed: false,
        },
        {
            name: 'ADMIN accessing /api/admin/users (allowed priority 30)',
            userRole: 'ADMIN',
            path: '/api/admin/users',
            method: 'GET',
            expectedAllowed: true,
        },
        {
            name: 'SUPER_ADMIN accessing /api/anything (allowed priority 40)',
            userRole: 'SUPER_ADMIN',
            path: '/api/admin/system-settings',
            method: 'DELETE',
            expectedAllowed: true,
        },
        {
            name: 'RESEARCHER writing work cycles (allowed priority 15 via inheritance)',
            userRole: 'RESEARCHER',
            path: '/api/work-cycles',
            method: 'POST',
            expectedAllowed: true,
        },
    ];
    let passed = 0;
    for (const tc of testCases) {
        const res = evaluateRbacPolicy(tc.userRole, tc.path, tc.method);
        const ok = res.allowed === tc.expectedAllowed;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] ${tc.name}`);
        console.log(`       Path: ${tc.method} ${tc.path} | Role: ${tc.userRole || 'GUEST'} | Result: ${res.allowed} | Reason: ${res.reason}\n`);
        if (ok)
            passed++;
    }
    console.log(`Tests finished: ${passed}/${testCases.length} passed.`);
    if (passed !== testCases.length) {
        process.exit(1);
    }
}
runRbacTests();
