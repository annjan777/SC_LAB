export const SC_LAB_RBAC_CONFIG = {
    roles: {
        SUPER_ADMIN: { inherits: ['ADMIN'] },
        ADMIN: { inherits: ['COORDINATOR'] },
        COORDINATOR: { inherits: ['MEMBER'] },
        MEMBER: { inherits: [] },
        // Backward-compatibility role mappings
        LAB_MANAGER: { inherits: ['COORDINATOR'] },
        RESEARCHER: { inherits: ['COORDINATOR'] },
        STUDENT: { inherits: ['MEMBER'] },
        GUEST: { inherits: [] },
    },
    policies: [
        // ═══════════════════════════════════════════════════════════════════════════
        // Public Auth endpoints (login, signup, forgot password)
        // ═══════════════════════════════════════════════════════════════════════════
        {
            role: 'GUEST',
            resource: [
                '/api/auth/login',
                '/api/auth/forgot-password',
                '/api/auth/change-password',
                '/api/auth/verify-reset-token',
            ],
            action: ['read', 'write'],
            effect: 'allow',
            priority: 100,
        },
        // ═══════════════════════════════════════════════════════════════════════════
        // GUEST — catch-all deny for unauthenticated requests (fail-closed contract)
        // ═══════════════════════════════════════════════════════════════════════════
        {
            role: 'GUEST',
            resource: '/api/**',
            action: ['read', 'write', 'delete'],
            effect: 'deny',
            priority: 5,
        },
        // ═══════════════════════════════════════════════════════════════════════════
        // MEMBER baseline access
        // ═══════════════════════════════════════════════════════════════════════════
        {
            role: 'MEMBER',
            resource: [
                '/api/inventory',
                '/api/inventory/**',
                '/api/facilities',
                '/api/facilities/**',
                '/api/repository',
                '/api/repository/**',
                '/api/expertise',
                '/api/expertise/**',
                '/api/notifications',
                '/api/notifications/**',
                '/api/dashboard',
                '/api/dashboard/**',
                '/api/procurement-details',
                '/api/procurement-details/**',
            ],
            action: ['read'],
            effect: 'allow',
            priority: 10,
        },
        // Member self-service requests, profile management, and work tracking
        {
            role: 'MEMBER',
            resource: [
                '/api/auth/me',
                '/api/auth/change-password',
                '/api/auth/verify-reset-token',
                '/api/users',
                '/api/users/**',
                '/api/purchase-requests',
                '/api/purchase-requests/**',
                '/api/leave-requests',
                '/api/leave-requests/**',
                '/api/work',
                '/api/work/**',
                '/api/assigned-works',
                '/api/assigned-works/**',
                '/api/progress-updates',
                '/api/progress-updates/**',
                '/api/work-problems',
                '/api/work-problems/**',
                '/api/expertise',
                '/api/expertise/**',
                '/api/notifications',
                '/api/notifications/**',
                '/api/repository',
                '/api/repository/**',
            ],
            action: ['read', 'write', 'delete'],
            effect: 'allow',
            priority: 10,
        },
        // Block MEMBER from Admin management & auditing endpoints
        {
            role: 'MEMBER',
            resource: [
                '/api/admin/**',
                '/api/settings/**',
                '/api/audit-logs/**',
            ],
            action: ['read', 'write', 'delete'],
            effect: 'deny',
            priority: 25,
        },
        // ═══════════════════════════════════════════════════════════════════════════
        // COORDINATOR operations access (inherits MEMBER)
        // ═══════════════════════════════════════════════════════════════════════════
        {
            role: 'COORDINATOR',
            resource: [
                '/api/work-cycles',
                '/api/work-cycles/**',
                '/api/work-milestones',
                '/api/work-milestones/**',
                '/api/mitigation-actions',
                '/api/mitigation-actions/**',
                '/api/procurement-details',
                '/api/procurement-details/**',
                '/api/work-dependencies',
                '/api/work-dependencies/**',
            ],
            action: ['read', 'write'],
            effect: 'allow',
            priority: 15,
        },
        {
            role: 'COORDINATOR',
            resource: [
                '/api/inventory',
                '/api/inventory/**',
                '/api/facilities',
                '/api/facilities/**',
            ],
            action: ['read', 'write', 'delete'],
            effect: 'allow',
            priority: 20,
        },
        // ═══════════════════════════════════════════════════════════════════════════
        // ADMIN / SUPER_ADMIN full management access (inherits COORDINATOR)
        // ═══════════════════════════════════════════════════════════════════════════
        {
            role: 'ADMIN',
            resource: [
                '/api/admin/**',
                '/api/settings/**',
                '/api/users/**',
                '/api/audit-logs/**',
                '/api/purchase-requests/**',
                '/api/leave-requests/**',
                '/api/admin-comments/**',
            ],
            action: ['read', 'write', 'delete'],
            effect: 'allow',
            priority: 30,
        },
        {
            role: 'SUPER_ADMIN',
            resource: '/api/**',
            action: ['read', 'write', 'delete'],
            effect: 'allow',
            priority: 40,
        },
    ],
};
// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC PERMISSION POLICIES
// Maps granular database permissions to specific PolicyRules.
// ═══════════════════════════════════════════════════════════════════════════
export const PERMISSION_POLICIES = {
    // Users & Roles
    'view_users': [{ role: '*', resource: ['/api/admin/users', '/api/users/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'manage_users': [{ role: '*', resource: ['/api/admin/users', '/api/users/**'], action: ['read', 'write', 'delete'], effect: 'allow', priority: 90 }],
    'manage_roles': [{ role: '*', resource: ['/api/admin/roles', '/api/roles/**'], action: ['read', 'write', 'delete'], effect: 'allow', priority: 90 }],
    // Facilities
    'view_facilities': [{ role: '*', resource: ['/api/facilities', '/api/facilities/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'create_facilities': [{ role: '*', resource: '/api/facilities', action: ['write'], effect: 'allow', priority: 90 }],
    'edit_facilities': [{ role: '*', resource: '/api/facilities/**', action: ['write'], effect: 'allow', priority: 90 }],
    'delete_facilities': [{ role: '*', resource: '/api/facilities/**', action: ['delete'], effect: 'allow', priority: 90 }],
    // Procurement
    'view_procurement': [{ role: '*', resource: ['/api/purchase-requests', '/api/purchase-requests/**', '/api/procurement-details/**', '/api/admin/purchase-requests', '/api/admin/purchase-requests/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'create_purchase_request': [{ role: '*', resource: ['/api/purchase-requests', '/api/admin/purchase-requests'], action: ['write'], effect: 'allow', priority: 90 }],
    'approve_procurement': [{ role: '*', resource: ['/api/purchase-requests/**', '/api/admin/purchase-requests/**'], action: ['write'], effect: 'allow', priority: 90 }],
    'manage_procurement': [{ role: '*', resource: ['/api/purchase-requests', '/api/purchase-requests/**', '/api/procurement-details', '/api/procurement-details/**', '/api/admin/purchase-requests', '/api/admin/purchase-requests/**'], action: ['read', 'write', 'delete'], effect: 'allow', priority: 90 }],
    // Leaves
    'view_leaves': [{ role: '*', resource: ['/api/leave-requests', '/api/leave-requests/**', '/api/admin/leave-requests', '/api/admin/leave-requests/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'create_leave_request': [{ role: '*', resource: ['/api/leave-requests', '/api/admin/leave-requests'], action: ['write'], effect: 'allow', priority: 90 }],
    'approve_leaves': [{ role: '*', resource: ['/api/leave-requests/**', '/api/admin/leave-requests', '/api/admin/leave-requests/**'], action: ['read', 'write'], effect: 'allow', priority: 90 }],
    // Work
    'view_work': [{ role: '*', resource: ['/api/work-cycles', '/api/work-cycles/**', '/api/work-milestones/**', '/api/mitigation-actions/**', '/api/progress-updates/**', '/api/admin-comments/**', '/api/admin/work/**', '/api/admin/work/overview'], action: ['read'], effect: 'allow', priority: 90 }],
    'create_work': [{ role: '*', resource: ['/api/work-cycles', '/api/work-milestones', '/api/mitigation-actions', '/api/progress-updates', '/api/admin-comments', '/api/admin/work/**'], action: ['write'], effect: 'allow', priority: 90 }],
    'edit_work': [{ role: '*', resource: ['/api/work-cycles/**', '/api/work-milestones/**', '/api/mitigation-actions/**', '/api/progress-updates/**', '/api/admin-comments/**', '/api/admin/work/**'], action: ['write'], effect: 'allow', priority: 90 }],
    'delete_work': [{ role: '*', resource: ['/api/work-cycles/**', '/api/work-milestones/**', '/api/mitigation-actions/**', '/api/progress-updates/**', '/api/admin-comments/**', '/api/admin/work/**'], action: ['delete'], effect: 'allow', priority: 90 }],
    'manage_work_cycles': [{ role: '*', resource: ['/api/work-cycles', '/api/work-cycles/**', '/api/work-milestones/**', '/api/mitigation-actions/**', '/api/progress-updates/**', '/api/admin-comments/**', '/api/admin/work/**', '/api/admin/work/overview'], action: ['read', 'write', 'delete'], effect: 'allow', priority: 90 }],
    // Inventory
    'view_inventory': [{ role: '*', resource: ['/api/inventory', '/api/inventory/**', '/api/repository/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'create_inventory': [{ role: '*', resource: ['/api/inventory', '/api/repository'], action: ['write'], effect: 'allow', priority: 90 }],
    'edit_inventory': [{ role: '*', resource: ['/api/inventory/**', '/api/repository/**'], action: ['write'], effect: 'allow', priority: 90 }],
    'delete_inventory': [{ role: '*', resource: ['/api/inventory/**', '/api/repository/**'], action: ['delete'], effect: 'allow', priority: 90 }],
    // Repository
    'view_repository': [{ role: '*', resource: ['/api/admin/repository', '/api/admin/repository/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'edit_repository_all': [{ role: '*', resource: ['/api/admin/repository', '/api/admin/repository/**'], action: ['write'], effect: 'allow', priority: 90 }],
    'delete_repository_all': [{ role: '*', resource: ['/api/admin/repository', '/api/admin/repository/**'], action: ['delete'], effect: 'allow', priority: 90 }],
    'share_repository_documents': [{ role: '*', resource: ['/api/admin/repository/share', '/api/admin/repository/**'], action: ['write'], effect: 'allow', priority: 90 }],
    // Reports
    'view_reports': [{ role: '*', resource: ['/api/admin/reports', '/api/admin/reports/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'generate_reports': [{ role: '*', resource: ['/api/admin/reports', '/api/admin/reports/**'], action: ['write'], effect: 'allow', priority: 90 }],
    // Settings
    'view_settings': [{ role: '*', resource: ['/api/settings', '/api/settings/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'manage_settings': [{ role: '*', resource: ['/api/settings', '/api/settings/**'], action: ['read', 'write', 'delete'], effect: 'allow', priority: 90 }],
    // Notifications
    'view_notifications': [{ role: '*', resource: ['/api/notifications', '/api/notifications/**'], action: ['read'], effect: 'allow', priority: 90 }],
    'manage_notifications': [{ role: '*', resource: ['/api/notifications', '/api/notifications/**'], action: ['read', 'write', 'delete'], effect: 'allow', priority: 90 }],
};
