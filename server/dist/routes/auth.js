import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { generateToken, generatePasswordResetToken, authenticate, authenticateResetToken } from '../middleware/auth.js';
import { sendPasswordResetLinkEmail, sendTempPasswordEmail } from '../utils/email.js';
import { validateBody } from '../middleware/validateRequest.js';
import { loginSchema, changePasswordSchema, forgotPasswordSchema } from '../validators/authValidator.js';
import { recordFailedLogin, resetFailedLogin } from '../middleware/progressiveRateLimiter.js';
function isValidPassword(password) {
    return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const router = Router();
// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        const userResult = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            recordFailedLogin(req.ip || req.socket.remoteAddress || 'unknown');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = userResult.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            recordFailedLogin(req.ip || req.socket.remoteAddress || 'unknown');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Login successful, reset the rate limit tracker for this IP
        resetFailedLogin(req.ip || req.socket.remoteAddress || 'unknown');
        const profileResult = await query('SELECT * FROM user_profiles WHERE id = $1', [user.id]);
        const profile = profileResult.rows[0] || null;
        if (profile?.require_password_change) {
            if (profile.temp_password_expires_at && new Date(profile.temp_password_expires_at) < new Date()) {
                return res.status(403).json({ error: 'Temporary password expired. Please contact an administrator.' });
            }
            // Issue a restricted token instead of a full session token
            const token = generatePasswordResetToken(user.id, user.email);
            return res.json({
                token,
                user: { id: user.id, email: user.email },
                profile,
                permissions: [],
                restricted: true
            });
        }
        const permResult = await query('SELECT * FROM get_user_permissions($1)', [user.id]);
        const permissions = permResult.rows.map((r) => r.permission_name);
        const token = generateToken(user.id, user.email);
        res.json({
            token,
            user: { id: user.id, email: user.email },
            profile,
            permissions,
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/change-password
router.post('/change-password', authenticateResetToken, validateBody(changePasswordSchema), async (req, res) => {
    try {
        const { password, currentPassword } = req.body;
        if (!isValidPassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long and contain uppercase, lowercase, and numbers' });
        }
        if (req.user.auth_purpose !== 'password_reset') {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required to change your password.' });
            }
            const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
            if (userResult.rows.length === 0)
                return res.status(404).json({ error: 'User not found' });
            const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
            if (!valid) {
                return res.status(401).json({ error: 'Incorrect current password' });
            }
        }
        const hash = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, req.user.id]);
        await query('UPDATE user_profiles SET last_password_changed_at = now(), require_password_change = false WHERE id = $1', [req.user.id]);
        res.json({ message: 'Password changed successfully' });
    }
    catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    try {
        const profileResult = await query('SELECT * FROM user_profiles WHERE id = $1', [req.user.id]);
        const permResult = await query('SELECT * FROM get_user_permissions($1)', [req.user.id]);
        res.json({
            user: { id: req.user.id, email: req.user.email },
            profile: profileResult.rows[0] || null,
            permissions: permResult.rows.map((r) => r.permission_name),
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/auth/verify-reset-token
router.get('/verify-reset-token', authenticateResetToken, async (req, res) => {
    // If the middleware passes, the token is valid
    res.json({ valid: true, user: { id: req.user.id, email: req.user.email } });
});
// POST /api/auth/forgot-password (self-service: user requests a reset link)
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res) => {
    const genericResponse = { message: 'If an account exists with that email, a password reset link has been sent.' };
    try {
        const { email } = req.body;
        const userResult = await query('SELECT u.id, u.email, up.full_name FROM users u LEFT JOIN user_profiles up ON up.id = u.id WHERE u.email = $1', [email]);
        // Always respond the same way whether or not the account exists, to avoid disclosing registered emails
        if (userResult.rows.length === 0) {
            return res.json(genericResponse);
        }
        const user = userResult.rows[0];
        const token = generatePasswordResetToken(user.id, user.email);
        const resetUrl = `${APP_URL}/reset-password?token=${token}`;
        const sendResult = await sendPasswordResetLinkEmail(user.email, user.full_name || 'there', resetUrl);
        if (!sendResult.success) {
            console.log(`\n======================================================`);
            console.log(`[DEV MODE PASSWORD RESET LINK FOR ${user.email}]:`);
            console.log(`   ${resetUrl}`);
            console.log(`======================================================\n`);
        }
        res.json(genericResponse);
    }
    catch (err) {
        console.error('Forgot password error:', err);
        // Still return the generic response so we never leak whether the request failed due to a bad email
        res.json(genericResponse);
    }
});
// POST /api/auth/admin-reset-password (admin resets another user's password)
router.post('/admin-reset-password', authenticate, async (req, res) => {
    if (req.user.user_role !== 'admin' && req.user.user_role !== 'super_admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const { userId, newPassword: providedPassword } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'userId is required' });
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
        const password = providedPassword || Array.from(crypto.randomBytes(12)).map(b => chars[b % chars.length]).join('');
        const hash = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
        await query('UPDATE user_profiles SET require_password_change = true WHERE id = $1', [userId]);
        // Fetch user info for email
        const userInfo = await query('SELECT up.full_name, u.email FROM user_profiles up JOIN users u ON u.id = up.id WHERE up.id = $1', [userId]);
        let emailSent = false;
        if (userInfo.rows.length > 0) {
            const { full_name, email } = userInfo.rows[0];
            const result = await sendTempPasswordEmail(email, full_name, password);
            emailSent = result.success;
            if (!result.success) {
                console.log(`[DEV MODE] Password for ${email} reset to: ${password}`);
            }
        }
        res.json({ message: 'Password reset successfully', password, email_sent: emailSent });
    }
    catch (err) {
        console.error('Admin reset password error:', err);
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
