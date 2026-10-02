import nodemailer from 'nodemailer';
export declare function getEmailConfig(): {
    host: string;
    port: number;
    user: string | undefined;
    pass: string | undefined;
    fromEmail: string;
    appName: string;
    appUrl: string;
};
export declare function getTransporter(): nodemailer.Transporter<import("nodemailer/lib/smtp-transport").SentMessageInfo, import("nodemailer/lib/smtp-transport").Options>;
interface SendResult {
    success: boolean;
    error?: string;
}
export declare function verifyEmailTransport(): Promise<void>;
export declare function generateTempPassword(): string;
export declare function sendTempPasswordEmail(to: string, recipientName: string, tempPassword: string, loginUrl?: string): Promise<SendResult>;
export declare function sendPasswordResetLinkEmail(to: string, fullName: string, resetUrl: string): Promise<SendResult>;
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
export declare function sendBroadcastEmails(options: BroadcastEmailOptions): Promise<{
    sentCount: number;
    failCount: number;
}>;
export declare function sendSkillReminderEmail(to: string, recipientName: string, profileUrl?: string): Promise<SendResult>;
export {};
