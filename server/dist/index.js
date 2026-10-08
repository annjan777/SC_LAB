import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load server .env first, then root .env as fallback for shared variables like SMTP
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import expertiseRoutes from './routes/expertise.js';
import { createCrudRouter } from './routes/crud.js';
import notificationRoutes from './routes/notifications.js';
import repositoryRoutes from './routes/repository.js';
import facilitiesRoutes from './routes/facilities.js';
import equipmentBookingRoutes from './routes/equipmentBookings.js';
import inventoryRequestRoutes from './routes/inventoryRequests.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import workRoutes from './routes/work.js';
import backupRoutes from './routes/backup.js';
import dailyTodoRoutes from './routes/dailyTodos.js';
import projectRoutes from './routes/projects.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { progressiveLoginLimiter } from './middleware/progressiveRateLimiter.js';
import { xssSanitizer } from './middleware/xssSanitizer.js';
import { mountMcp } from './mcp/index.js';
import { ensureMcpSchema } from './mcp/store.js';
import fs from 'fs';
const app = express();
// Number of reverse proxies in front of the app (Caddy/nginx = 1), so req.ip is the real client IP for
// rate limits. Set TRUST_PROXY=0 when the server is exposed directly, otherwise a client could spoof
// X-Forwarded-For to dodge the login lockout.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY ?? '1', 10) || false);
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
// Security headers. HSTS and upgrade-insecure-requests are only sent when the app is served over HTTPS;
// on a plain-HTTP LAN deployment they would upgrade asset requests to https and leave a blank page.
const servedOverHttps = (process.env.APP_URL || '').startsWith('https://') || process.env.FORCE_HTTPS === 'true';
app.use(helmet({
    contentSecurityPolicy: servedOverHttps ? true : { directives: { upgradeInsecureRequests: null } },
    hsts: servedOverHttps,
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
// AI connector (MCP). Mounted before the sanitizer: its tools call the /api routes below,
// which sanitize their own input, and before the dev redirect so /authorize is not sent to Vite.
mountMcp(app);
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
import { query as dbQuery, transaction } from './config/database.js';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
app.use('/api/admin/repository', repositoryRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/work', workRoutes);
app.use('/api/admin/backup', backupRoutes);
app.use('/api/daily-todos', dailyTodoRoutes);
app.use('/api/projects', projectRoutes);
// /api/admin/roles → CRUD on roles table
const SYSTEM_ROLE_NAMES = ['admin', 'user'];
const roleError = (res, err) => {
    if (err?.code === '23505')
        return res.status(409).json({ error: 'A role with this name already exists' });
    if (err?.code === '22P02')
        return res.status(400).json({ error: 'Invalid role or permission id' });
    if (err?.code === '23503')
        return res.status(400).json({ error: 'Referenced permission does not exist' });
    console.error('[roles]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
};
const cleanRoleName = (name) => (typeof name === 'string' ? name.trim() : '');
app.get('/api/admin/roles', authenticate, requirePermission('manage_roles'), async (_req, res) => {
    try {
        const roles = await dbQuery(`SELECT r.*, (SELECT COUNT(*)::int FROM user_profiles up WHERE up.role_id = r.id) AS user_count
       FROM roles r ORDER BY r.created_at`);
        const rolesWithPermissions = await Promise.all(roles.rows.map(async (role) => {
            const perms = await dbQuery(`SELECT p.* FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = $1`, [role.id]);
            return { ...role, permissions: perms.rows };
        }));
        res.json(rolesWithPermissions);
    }
    catch (err) {
        roleError(res, err);
    }
});
app.post('/api/admin/roles', authenticate, requirePermission('manage_roles'), async (req, res) => {
    try {
        const { description, permission_ids, permissions } = req.body;
        const name = cleanRoleName(req.body.name);
        if (!name)
            return res.status(400).json({ error: 'Role name is required' });
        if (name.length > 60)
            return res.status(400).json({ error: 'Role name must be 60 characters or fewer' });
        const dup = await dbQuery('SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
        if (dup.rows.length)
            return res.status(409).json({ error: 'A role with this name already exists' });
        const pids = permission_ids || permissions;
        if (pids !== undefined && (!Array.isArray(pids) || pids.some((p) => typeof p !== 'string' || !UUID_PATTERN.test(p)))) {
            return res.status(400).json({ error: 'permission_ids must be a list of permission ids' });
        }
        // Role and its permissions are created together, so a bad permission id leaves no half-made role behind.
        const role = await transaction(async (client) => {
            const r = await client.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING *', [name, description]);
            for (const pid of pids || []) {
                await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, pid]);
            }
            return r.rows[0];
        });
        res.status(201).json(role);
    }
    catch (err) {
        roleError(res, err);
    }
});
app.put('/api/admin/roles/:id', authenticate, requirePermission('manage_roles'), async (req, res) => {
    try {
        const { description, permission_ids, permissions } = req.body;
        const pids = permission_ids || permissions;
        const current = await dbQuery('SELECT * FROM roles WHERE id = $1', [req.params.id]);
        if (current.rows.length === 0)
            return res.status(404).json({ error: 'Role not found' });
        const role = current.rows[0];
        const isSystem = role.is_system_role || SYSTEM_ROLE_NAMES.includes(String(role.name).toLowerCase());
        let name = req.body.name === undefined ? role.name : cleanRoleName(req.body.name);
        if (!name)
            return res.status(400).json({ error: 'Role name is required' });
        if (isSystem && name.toLowerCase() !== String(role.name).toLowerCase()) {
            return res.status(400).json({ error: 'System roles cannot be renamed' });
        }
        if (name.toLowerCase() !== String(role.name).toLowerCase()) {
            const dup = await dbQuery('SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1) AND id <> $2', [name, req.params.id]);
            if (dup.rows.length)
                return res.status(409).json({ error: 'A role with this name already exists' });
        }
        if (String(role.name).toLowerCase() === 'admin' && Array.isArray(pids)) {
            const required = await dbQuery("SELECT id FROM permissions WHERE name IN ('manage_roles','manage_users','manage_settings')");
            const missing = required.rows.filter((r) => !pids.includes(r.id));
            if (missing.length) {
                return res.status(400).json({ error: 'The admin role must keep manage_roles, manage_users and manage_settings (otherwise administrators lock themselves out)' });
            }
        }
        await dbQuery('UPDATE roles SET name=$1, description=$2 WHERE id=$3', [name, description ?? role.description, req.params.id]);
        if (Array.isArray(pids)) {
            await dbQuery('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);
            for (const pid of pids) {
                await dbQuery('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, pid]);
            }
        }
        const r = await dbQuery('SELECT * FROM roles WHERE id = $1', [req.params.id]);
        res.json(r.rows[0]);
    }
    catch (err) {
        roleError(res, err);
    }
});
app.delete('/api/admin/roles/:id', authenticate, requirePermission('manage_roles'), async (req, res) => {
    try {
        const check = await dbQuery('SELECT name, is_system_role FROM roles WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0)
            return res.status(404).json({ error: 'Role not found' });
        if (check.rows[0].is_system_role || SYSTEM_ROLE_NAMES.includes(String(check.rows[0].name).toLowerCase())) {
            return res.status(400).json({ error: 'Cannot delete system role' });
        }
        const inUse = await dbQuery('SELECT count(*)::int AS n FROM user_profiles WHERE role_id = $1', [req.params.id]);
        if (inUse.rows[0].n > 0) {
            return res.status(409).json({ error: `This role is still assigned to ${inUse.rows[0].n} user(s). Move them to another role first.` });
        }
        await dbQuery('DELETE FROM roles WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted' });
    }
    catch (err) {
        roleError(res, err);
    }
});
// /api/admin/permissions
app.get('/api/admin/permissions', authenticate, requirePermission('manage_roles'), async (_req, res) => {
    try {
        const r = await dbQuery('SELECT * FROM permissions ORDER BY category, display_name');
        res.json(r.rows);
    }
    catch (err) {
        roleError(res, err);
    }
});
// CRUD aliases for admin paths - these back the admin approval/overview screens,
// so they always operate across every user's records (admin-only).
app.use('/api/admin/purchase-requests', createCrudRouter({
    table: 'purchase_requests',
    defaultOrder: 'created_at',
    ownerCol: 'requested_by',
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
app.use('/api/inventory/requests', inventoryRequestRoutes);
app.use('/api/inventory', equipmentBookingRoutes);
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
// Read-only: procurement details are written through /api/admin/purchase-requests/:id/procurement,
// which only allows it once the request is approved.
app.use('/api/procurement-details', createCrudRouter({
    table: 'procurement_details',
    readOnly: true,
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
// Generic work CRUD aliases bypass the validation, ownership and change-request rules in routes/work.ts.
// The UI never calls them, so they are limited to work managers; owners may only read their own rows here.
app.use('/api/assigned-works', createCrudRouter({
    table: 'assigned_works',
    ownerCol: 'user_id',
    defaultOrder: 'created_at',
    readPermission: 'manage_work_cycles',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
    ownerWrite: false,
}));
app.use('/api/work-milestones', createCrudRouter({
    table: 'work_milestones',
    defaultOrder: 'created_at',
    readPermission: 'manage_work_cycles',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/progress-updates', createCrudRouter({
    table: 'progress_updates',
    defaultOrder: 'update_date',
    readPermission: 'manage_work_cycles',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/work-problems', createCrudRouter({
    table: 'work_problems',
    defaultOrder: 'created_at',
    readPermission: 'manage_work_cycles',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/mitigation-actions', createCrudRouter({
    table: 'mitigation_actions',
    defaultOrder: 'created_at',
    readPermission: 'manage_work_cycles',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/admin-comments', createCrudRouter({
    table: 'admin_comments',
    defaultOrder: 'created_at',
    readPermission: 'manage_work_cycles',
    createPermission: 'manage_work_cycles',
    updatePermission: 'manage_work_cycles',
    deletePermission: 'manage_work_cycles',
}));
app.use('/api/work-dependencies', createCrudRouter({
    table: 'work_dependencies',
    defaultOrder: 'created_at',
    readPermission: 'manage_work_cycles',
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
    // Upload validation errors (file type/size rejected before hitting a route handler)
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }
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
// Unknown API paths answer JSON 404 instead of the web app's HTML
app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
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
import { ensureSecuritySchema } from './scripts/securityMigrations.js';
import { verifyEmailTransport } from './utils/email.js';
import { startSkillReminderCron } from './services/skillReminderService.js';
import { startEquipmentReturnReminderCron } from './services/equipmentReturnReminderService.js';
import { syncOverdueMilestones } from './routes/work.js';
// A missed async error must never take the whole portal down (Express 4 does not catch rejected promises).
process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});
async function start() {
    await verifyEmailTransport().catch(err => {
        console.error('Email transport verification failed:', err);
    });
    // Run migrations and superadmin initialisation BEFORE accepting traffic, so early
    // logins never hit a half-initialised database. Retry while the database is still starting.
    for (let attempt = 1;; attempt++) {
        try {
            await ensureOperationalSchema();
            await ensureSecuritySchema();
            await initializeSuperAdmin();
            await ensureMcpSchema();
            break;
        }
        catch (bootErr) {
            const transient = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P03'].includes(bootErr?.code);
            if (transient && attempt < 20) {
                console.warn(`Database not ready (${bootErr.code}); retrying boot in 3s (attempt ${attempt}/20)`);
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            console.error('CRITICAL: Server boot migration/initialization failed:', bootErr);
            process.exit(1);
        }
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SC Lab Server running on port ${PORT}`);
        startSkillReminderCron();
        startEquipmentReturnReminderCron();
        // Run initial overdue milestone check to automatically flag milestones past target date as delayed
        syncOverdueMilestones().catch(err => {
            console.error('Initial overdue milestones sync failed:', err);
        });
        // Check periodically every 60 seconds
        setInterval(() => {
            syncOverdueMilestones().catch(err => {
                console.error('Interval overdue milestones sync failed:', err);
            });
        }, 60 * 1000);
    });
}
start();
