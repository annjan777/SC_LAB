import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import nodemailer from 'nodemailer';
import crypto from 'crypto';

export function getEmailConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromEmail: process.env.FROM_EMAIL || '"SC Lab" <support@sclab.in>',
    appName: process.env.APP_NAME || 'SC Lab Portal',
    appUrl: process.env.APP_URL || 'https://erp.sclab.in',
  };
}

export function getTransporter() {
  const config = getEmailConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

interface SendResult {
  success: boolean;
  error?: string;
}

export async function verifyEmailTransport(): Promise<void> {
  const config = getEmailConfig();
  if (!config.user || !config.pass) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS not set. Emails will not be sent.');
    return;
  }
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully.');
  } catch (err: any) {
    console.error('❌ SMTP connection failed:', err.message);
    throw new Error(`SMTP connection failed: ${err.message}`);
  }
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  // Use crypto.randomBytes to pick 12 characters randomly
  const bytes = crypto.randomBytes(12);
  let tempPassword = '';
  for (let i = 0; i < bytes.length; i++) {
    tempPassword += chars[bytes[i] % chars.length];
  }
  return tempPassword;
}

export async function sendTempPasswordEmail(
  to: string,
  recipientName: string,
  tempPassword: string,
  loginUrl?: string
): Promise<SendResult> {
  const config = getEmailConfig();
  const portalUrl = loginUrl || config.appUrl;

  if (!config.user || !config.pass) {
    console.warn(`\n[DEV MODE TEMP PASSWORD FOR ${to}]: ${tempPassword}\n`);
    return { success: true };
  }

  const subject = `Your ${config.appName} account — temporary password`;
  const text = `Hi ${recipientName},

Your account has been created. Here is your temporary password: ${tempPassword}

Please log in at ${portalUrl} to set your permanent password. This temporary password will expire in 24 hours.

Best regards,
${config.appName} Admin`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a56db;">Welcome to ${config.appName}</h2>
      <p>Hi ${recipientName},</p>
      <p>Your account has been created. Here is your temporary password:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Password:</strong> ${tempPassword}</p>
      </div>
      <p style="color: #dc2626;">You will be required to change your password immediately upon login.</p>
      <p style="color: #6b7280; font-size: 13px;">This temporary password will expire in 24 hours.</p>
      <p>Best regards,<br>${config.appName} Admin</p>
    </div>
  `;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.fromEmail,
      to,
      subject,
      text,
      html,
    });
    console.log('Temp password email sent to:', to);
    return { success: true };
  } catch (err: any) {
    console.error('Email send failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendPasswordResetLinkEmail(
  to: string,
  fullName: string,
  resetUrl: string
): Promise<SendResult> {
  const config = getEmailConfig();

  if (!config.user || !config.pass) {
    console.warn(`\n[DEV MODE RESET LINK FOR ${to}]: ${resetUrl}\n`);
    return { success: true };
  }

  const subject = `${config.appName} — Reset Your Password`;
  const text = `Hi ${fullName},

We received a request to reset the password for your account. Please visit the following link to choose a new password:
${resetUrl}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.

Best regards,
${config.appName} Admin`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a56db;">${config.appName} — Password Reset Requested</h2>
      <p>Hi ${fullName},</p>
      <p>We received a request to reset the password for your account (${to}). Click the button below to choose a new password. This link expires in 1 hour.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reset Password</a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
      <p style="color: #dc2626;">If you didn't request this, you can safely ignore this email — your password will not change.</p>
      <p>Best regards,<br>${config.appName} Admin</p>
    </div>
  `;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.fromEmail,
      to,
      subject,
      text,
      html,
    });
    console.log('Password reset email sent to:', to);
    return { success: true };
  } catch (err: any) {
    console.error('Email send failed:', err.message);
    return { success: false, error: err.message };
  }
}

export interface BroadcastRecipient {
  id: string;
  full_name?: string;
  email: string;
}

export interface BroadcastEmailOptions {
  recipients: BroadcastRecipient[];
  title: string;
  message: string;
  adminName: string;
}

export async function sendBroadcastEmails(
  options: BroadcastEmailOptions
): Promise<{ sentCount: number; failCount: number }> {
  const { recipients, title, message, adminName } = options;
  const config = getEmailConfig();
  const appName = config.appName || 'SC Lab Portal';
  const loginUrl = config.appUrl || 'http://localhost:5173';

  console.log(`[BROADCAST EMAIL] Initiating broadcast email from "${adminName}" to ${recipients.length} recipients. Title: "${title}"`);

  if (!config.user || !config.pass) {
    console.warn(`\n[DEV MODE BROADCAST EMAIL] SMTP not configured in environment. Simulating email from "${adminName}" to ${recipients.length} users.`);
    for (const r of recipients) {
      console.log(`[DEV MODE BROADCAST] -> To: ${r.email} (${r.full_name || 'Member'}) | Subject: [${appName} Announcement] ${title}`);
    }
    return { sentCount: recipients.length, failCount: 0 };
  }

  let sentCount = 0;
  let failCount = 0;

  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br />');

  const transporter = getTransporter();

  // Send concurrently in small batches to preserve server throughput and avoid SMTP socket flooding
  const BATCH_SIZE = 10;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (recipient) => {
        const recipientName = recipient.full_name || 'Member';
        const subject = `[${appName} Announcement] ${title}`;

        const text = `Hi ${recipientName},

${message}

--------------------------------------------------
Broadcasted by: ${adminName}
${appName} Management Portal
Access portal: ${loginUrl}
`;

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
            <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
              <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px;">
                ${appName} Official Announcement
              </span>
              <h2 style="color: #111827; margin: 0; font-size: 20px; font-weight: 700;">${title}</h2>
            </div>
            
            <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">Dear ${recipientName},</p>
            
            <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 4px; font-size: 15px; line-height: 1.6; color: #1f2937; margin-bottom: 24px;">
              ${escapedMessage}
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">
                Broadcasted by: <span style="color: #2563eb;">${adminName}</span>
              </p>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">
                ${appName} Administrator
              </p>
            </div>

            <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #e5e7eb; text-align: center;">
              <a href="${loginUrl}" style="display: inline-block; font-size: 13px; font-weight: 600; color: #2563eb; text-decoration: none; margin-bottom: 8px;">
                Open ${appName} Portal &rarr;
              </a>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                This announcement was dispatched to all active members of ${appName}.
              </p>
            </div>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: config.fromEmail,
            to: recipient.email,
            subject,
            text,
            html,
          });
          sentCount++;
        } catch (err: any) {
          console.error(`[BROADCAST EMAIL] Failed sending to ${recipient.email}:`, err.message);
          failCount++;
        }
      })
    );
  }

  console.log(`[BROADCAST EMAIL] Complete. Successfully sent: ${sentCount}, Failed: ${failCount}`);
  return { sentCount, failCount };
}

export async function sendSkillReminderEmail(
  to: string,
  recipientName: string,
  profileUrl?: string
): Promise<SendResult> {
  const config = getEmailConfig();
  const targetUrl = profileUrl || `${config.appUrl}/profile?focus=skills`;
  const appName = config.appName || 'SC Lab Portal';

  console.log(`[SKILL REMINDER EMAIL] Preparing email to ${to} (${recipientName})`);

  if (!config.user || !config.pass) {
    console.warn(`\n[DEV MODE SKILL REMINDER EMAIL FOR ${to}]: Redirect to ${targetUrl}\n`);
    return { success: true };
  }

  const subject = `Action Required: Please update your skills profile on ${appName}`;
  const text = `Hi ${recipientName},

We noticed you haven't added your skills and expertise to your ${appName} profile yet.

Keeping your technical skills, software proficiencies, and equipment expertise updated helps lab coordinators allocate matching projects and fosters cross-team collaboration.

Please take a few moments to add your skills at:
${targetUrl}

Best regards,
${appName} Administration
${config.appUrl}
`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px;">
          ${appName} Profile Reminder
        </span>
        <h2 style="color: #111827; margin: 0; font-size: 20px; font-weight: 700;">Please Add Your Skills & Expertise</h2>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #374151;">Hi <strong>${recipientName}</strong>,</p>
      
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        We noticed that you have not added any skills to your SC Lab profile yet. While skill entry is not mandatory to access your account, keeping your skills, software, and equipment proficiencies up-to-date helps lab coordinators allocate work accurately and enables seamless collaboration across projects.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b; font-size: 14px;">Why update your skills?</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
          <li>Highlight your lab competencies, software proficiencies, and equipment experience</li>
          <li>Help coordinators assign matching research tasks and work cycles</li>
          <li>Facilitate peer collaboration and knowledge sharing across SC Lab</li>
        </ul>
      </div>

      <div style="margin: 28px 0; text-align: center;">
        <a href="${targetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
          Add Skills in My Profile &rarr;
        </a>
      </div>

      <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3f4f6;">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="${targetUrl}" style="color: #2563eb; word-break: break-all;">${targetUrl}</a>
      </p>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
        <p style="margin: 0;">Sent automatically by ${appName} &bull; <a href="${config.appUrl}" style="color: #6b7280;">${config.appUrl}</a></p>
      </div>
    </div>
  `;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.fromEmail,
      to,
      subject,
      text,
      html,
    });
    console.log(`[SKILL REMINDER EMAIL] Sent successfully to ${to}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[SKILL REMINDER EMAIL ERROR] Failed sending to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

