import nodemailer from 'nodemailer';
import crypto from 'crypto';
const SMTP_HOST = process.env.SMTP_HOST || 'smtpout.secureserver.net';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL;
const APP_NAME = process.env.APP_NAME;
const APP_URL = process.env.APP_URL;
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});
export async function verifyEmailTransport() {
    if (!SMTP_USER || !SMTP_PASS) {
        console.warn('⚠️ SMTP_USER or SMTP_PASS not set. Emails will not be sent.');
        return;
    }
    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified successfully.');
    }
    catch (err) {
        console.error('❌ SMTP connection failed:', err.message);
        throw new Error(`SMTP connection failed: ${err.message}`);
    }
}
export function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    // Use crypto.randomBytes to pick 12 characters randomly
    const bytes = crypto.randomBytes(12);
    let tempPassword = '';
    for (let i = 0; i < bytes.length; i++) {
        tempPassword += chars[bytes[i] % chars.length];
    }
    return tempPassword;
}
export async function sendTempPasswordEmail(to, recipientName, tempPassword, loginUrl = APP_URL) {
    if (!SMTP_USER || !SMTP_PASS) {
        console.warn(`\n[DEV MODE TEMP PASSWORD FOR ${to}]: ${tempPassword}\n`);
        return { success: true };
    }
    const subject = `Your ${APP_NAME} account — temporary password`;
    const text = `Hi ${recipientName},

Your account has been created. Here is your temporary password: ${tempPassword}

Please log in at ${loginUrl} to set your permanent password. This temporary password will expire in 24 hours.

Best regards,
${APP_NAME} Admin`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a56db;">Welcome to ${APP_NAME}</h2>
      <p>Hi ${recipientName},</p>
      <p>Your account has been created. Here is your temporary password:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Portal:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Password:</strong> ${tempPassword}</p>
      </div>
      <p style="color: #dc2626;">You will be required to change your password immediately upon login.</p>
      <p style="color: #6b7280; font-size: 13px;">This temporary password will expire in 24 hours.</p>
      <p>Best regards,<br>${APP_NAME} Admin</p>
    </div>
  `;
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to,
            subject,
            text,
            html,
        });
        console.log('Temp password email sent to:', to);
        return { success: true };
    }
    catch (err) {
        console.error('Email send failed:', err.message);
        return { success: false, error: err.message };
    }
}
export async function sendPasswordResetLinkEmail(to, fullName, resetUrl) {
    if (!SMTP_USER || !SMTP_PASS) {
        console.warn(`\n[DEV MODE RESET LINK FOR ${to}]: ${resetUrl}\n`);
        return { success: true };
    }
    const subject = `${APP_NAME} — Reset Your Password`;
    const text = `Hi ${fullName},

We received a request to reset the password for your account. Please visit the following link to choose a new password:
${resetUrl}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.

Best regards,
${APP_NAME} Admin`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a56db;">${APP_NAME} — Password Reset Requested</h2>
      <p>Hi ${fullName},</p>
      <p>We received a request to reset the password for your account (${to}). Click the button below to choose a new password. This link expires in 1 hour.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reset Password</a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
      <p style="color: #dc2626;">If you didn't request this, you can safely ignore this email — your password will not change.</p>
      <p>Best regards,<br>${APP_NAME} Admin</p>
    </div>
  `;
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to,
            subject,
            text,
            html,
        });
        console.log('Password reset email sent to:', to);
        return { success: true };
    }
    catch (err) {
        console.error('Email send failed:', err.message);
        return { success: false, error: err.message };
    }
}
