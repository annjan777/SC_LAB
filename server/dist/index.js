import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import expertiseRoutes from './routes/expertise.js';
import { createCrudRouter } from './routes/crud.js';
import notificationRoutes from './routes/notifications.js';
import repositoryRoutes from './routes/repository.js';
import facilitiesRoutes from './routes/facilities.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import workRoutes from './routes/work.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { progressiveLoginLimiter } from './middleware/progressiveRateLimiter.js';
import { xssSanitizer } from './middleware/xssSanitizer.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs from 'fs';
const app = express();
// Trust the first proxy (e.g. nginx or Docker bridge) to get the real client IP
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3001');
// Validate environment variables in production
if (process.env.NODE_ENV === 'production') {
    const requiredEnv = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
    const missing = requiredEnv.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`[FATAL] Missing required environment variables in production: ${missing.join(', ')}`);
        process.exit(1);
    }
}
// Security headers
app.use(helmet({
    contentSecurityPolicy: true, // Re-enabled for defense-in-depth against XSS
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Rate limiting on sensitive auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin === '*' && process.env.NODE_ENV === 'production' ? false : corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use(xssSanitizer);
app.use(express.urlencoded({ extended: true }));
// Serve uploaded files
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
// Static serving of documents is disabled for security. All files must be accessed via /api/repository/download/:id
// However, facility images are public thumbnails and can be served statically.
app.use('/uploads/facility-images', express.static(path.join(uploadDir, 'facility-images')));
// In dev mode, redirect all non-API browser traffic to the Vite dev server
if (process.env.NODE_ENV !== 'production') {
    app.get(/^(?!\/api\/)/, (req, res, next) => {
        // Only redirect browser navigation, not file assets just in case
        if (req.accepts('html')) {
            return res.redirect('http://localhost:5173' + req.originalUrl);
        }
        next();
    });
}
// Serve frontend build (in production)
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, '../../dist');
app.use(express.static(frontendDist));
import { optionalAuthenticate, authenticate, requirePermission } from './middleware/auth.js';
import { enforceRbac } from './middleware/rbacMiddleware.js';
import { query as dbQuery } from './config/database.js';
// Apply rate limiting to auth endpoints
app.use('/api/auth/login', progressiveLoginLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/signup', authLimiter);
// Apply optional auth & SETU-style RBAC policy enforcement across all /api routes
app.use('/api', optionalAuthenticate, enforceRbac);
// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expertise', expertiseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/repository', repositoryRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/work', workRoutes);
// /api/admin/roles → CRUD on roles table
app.get('/api/admin/roles', authenticate, requirePermission('manage_roles'), async (_req, res) => {
    const roles = await dbQuery('SELECT * FROM roles ORDER BY created_at');
    const rolesWithPermissions = await Promise.all(roles.rows.map(async (role) => {
        const perms = await dbQuery(`SELECT p.* FROM permissions p 
         JOIN role_permissions rp ON rp.permission_id = p.id 
         WHERE rp.role_id = $1`, [role.id]);
        return { ...role, permissions: perms.rows };
    }));
    res.json(rolesWithPermissions);
});
app.post('/api/admin/roles', authenticate, requirePermission('manage_roles'), async (req, res) => {
    const { name, description, permission_ids, permissions } = req.body;
    const pids = permission_ids || permissions;
    const r = await dbQuery('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING *', [name, description]);
    if (pids?.length) {
        for (const pid of pids) {
            await dbQuery('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, pid]);
        }
    }
    res.status(201).json(r.rows[0]);
});
app.put('/api/admin/roles/:id', authenticate, requirePermission('manage_roles'), async (req, res) => {
    const { name, description, permission_ids, permissions } = req.body;
    const pids = permission_ids || permissions;
    await dbQuery('UPDATE roles SET name=$1, description=$2 WHERE id=$3', [name, description, req.params.id]);
    if (pids) {
        await dbQuery('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);
        for (const pid of pids) {
            await dbQuery('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, pid]);
        }
    }
    const r = await dbQuery('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    res.json(r.rows[0]);
});
app.delete('/api/admin/roles/:id', authenticate, requirePermission('manage_roles'), async (req, res) => {
    const check = await dbQuery('SELECT is_system_role FROM roles WHERE id = $1', [req.params.id]);
    if (check.rows[0]?.is_system_role)
        return res.status(400).json({ error: 'Cannot delete system role' });
    await dbQuery('DELETE FROM roles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
});
// /api/admin/permissions
app.get('/api/admin/permissions', authenticate, requirePermission('manage_roles'), async (_req, res) => {
    const r = await dbQuery('SELECT * FROM permissions ORDER BY category, display_name');
    res.json(r.rows);
});
// CRUD aliases for admin paths - these back the admin approval/overview screens,
// so they always operate across every user's records (admin-only).
app.use('/api/admin/purchase-requests', createCrudRouter({
    table: 'purchase_requests',
    defaultOrder: 'created_at',
    readPermission: 'view_procurement',
    createPermission: 'create_purchase_request',
    updatePermission: 'approve_procurement',
    deletePermission: 'manage_procurement'
}));
app.use('/api/admin/leave-requests', createCrudRouter({
    table: 'leave_requests',
    defaultOrder: 'created_at',
    ownerCol: 'requested_by',
    readPermission: 'view_leaves',
    createPermission: 'create_leave_request',
    updatePermission: 'approve_leaves',
    deletePermission: 'approve_leaves'
}));
app.use('/api/admin/repository', repositoryRoutes);
// CRUD routes for standard entities.
// Permission names below map to the rows seeded into the `permissions` table
// (server/schema.sql) and mirror what used to be enforced via Supabase RLS policies.
app.use('/api/inventory', createCrudRouter({
    table: 'inventory_items',
    defaultOrder: 'created_at',
    readPermission: 'view_inventory',
    createPermission: 'create_inventory',
    updatePermission: 'edit_inventory',
    deletePermission: 'delete_inventory',
}));
app.use('/api/purchase-requests', createCrudRouter({
    table: 'purchase_requests',
    ownerCol: 'requested_by',
    defaultOrder: 'created_at',
    readPermission: 'view_procurement',
    createPermission: 'create_purchase_request',
    updatePermission: 'manage_procurement',
    deletePermission: 'manage_procurement',
}));
app.use('/api/procurement-details', createCrudRouter({
    table: 'procurement_details',
    defaultOrder: 'created_at',
    readPermission: 'view_procurement',
    createPermission: 'manage_procurement',
    updatePermission: 'manage_procurement',
    deletePermission: 'manage_procurement',
}));
app.use('/api/leave-requests', createCrudRouter({
    table: 'leave_requests',
    ownerCol: 'requested_by',
    defaultOrder: 'created_at',
    readPermission: 'view_leaves',
    createPermission: 'create_leave_request',
    updatePermission: 'approve_leaves',
    deletePermission: 'approve_leaves',
}));
app.use('/api/work-cycles', createCrudRouter({
    table: 'work_cycles',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/assigned-works', createCrudRouter({
    table: 'assigned_works',
    ownerCol: 'user_id',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'create_work',
    updatePermission: 'edit_work',
    deletePermission: 'delete_work',
}));
app.use('/api/work-milestones', createCrudRouter({
    table: 'work_milestones',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'edit_work',
    updatePermission: 'edit_work',
    deletePermission: 'edit_work',
}));
app.use('/api/progress-updates', createCrudRouter({
    table: 'progress_updates',
    defaultOrder: 'update_date',
    readPermission: 'view_work',
    createPermission: 'edit_work',
    updatePermission: 'edit_work',
    deletePermission: 'edit_work',
}));
app.use('/api/work-problems', createCrudRouter({
    table: 'work_problems',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'edit_work',
    updatePermission: 'edit_work',
    deletePermission: 'edit_work',
}));
app.use('/api/mitigation-actions', createCrudRouter({
    table: 'mitigation_actions',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'edit_work',
    updatePermission: 'edit_work',
    deletePermission: 'edit_work',
}));
app.use('/api/admin-comments', createCrudRouter({
    table: 'admin_comments',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'edit_work',
    updatePermission: 'edit_work',
    deletePermission: 'edit_work',
}));
app.use('/api/work-dependencies', createCrudRouter({
    table: 'work_dependencies',
    defaultOrder: 'created_at',
    readPermission: 'view_work',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/audit-logs', createCrudRouter({
    table: 'audit_logs',
    defaultOrder: 'performed_at',
    adminOnly: true,
    readOnly: true,
}));
// Global Error Handler for API routes
app.use('/api', (err, req, res, next) => {
    console.error('[API Error]', err);
    // PostgreSQL constraint violation codes
    if (err.code) {
        switch (err.code) {
            case '23505': return res.status(400).json({ error: 'Resource already exists (duplicate key)' });
            case '23514': return res.status(400).json({ error: 'Invalid data (check constraint violated)' });
            case '22P02': return res.status(400).json({ error: 'Invalid data format (e.g., malformed UUID)' });
            case '23502': return res.status(400).json({ error: 'Missing required field (not null constraint)' });
        }
    }
    // Handle JSON parse errors
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON payload' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
});
// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).json({ error: 'Frontend not built yet. Run: npm run build in root.' });
    }
});
import { initializeSuperAdmin } from './scripts/initAdmin.js';
import { ensureOperationalSchema } from './scripts/ensureOperationalSchema.js';
import { verifyEmailTransport } from './utils/email.js';
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`SC Lab Server running on port ${PORT}`);
    await verifyEmailTransport().catch(err => {
        console.error('Email transport verification failed:', err);
    });
    await ensureOperationalSchema();
    await initializeSuperAdmin();
});
