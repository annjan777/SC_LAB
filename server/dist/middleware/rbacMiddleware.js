import { evaluateRbacPolicy } from './rbacEvaluator.js';
export function enforceRbac(req, res, next) {
    // Allow public static assets or health checks if needed
    if (req.path.startsWith('/uploads') || req.path === '/health') {
        return next();
    }
    const userRole = req.user?.user_role;
    const userPermissions = req.user?.permissions;
    const result = evaluateRbacPolicy(userRole, req.baseUrl + req.path, req.method, userPermissions);
    if (!result.allowed) {
        console.log(`[RBAC DENY] role=${userRole}, path=${req.baseUrl + req.path}, method=${req.method}, reason=${result.reason}`);
        const statusCode = !req.user ? 401 : 403;
        return res.status(statusCode).json({
            error: !req.user ? 'Authentication required' : 'Access denied!',
            details: result.reason,
        });
    }
    // console.log(`[RBAC ALLOW] role=${userRole}, path=${req.baseUrl + req.path}, method=${req.method}`);
    next();
}
