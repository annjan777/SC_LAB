interface SendResult {
    success: boolean;
    error?: string;
}
export declare function verifyEmailTransport(): Promise<void>;
export declare function generateTempPassword(): string;
export declare function sendTempPasswordEmail(to: string, recipientName: string, tempPassword: string, loginUrl?: string): Promise<SendResult>;
export declare function sendPasswordResetLinkEmail(to: string, fullName: string, resetUrl: string): Promise<SendResult>;
export {};
