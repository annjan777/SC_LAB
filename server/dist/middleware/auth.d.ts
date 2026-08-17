import { Request, Response, NextFunction } from 'express';
export interface AuthUser {
    id: string;
    email: string;
    user_role: string;
    permissions: Set<string>;
    auth_purpose?: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare function generateToken(userId: string, email: string): string;
export declare function generatePasswordResetToken(userId: string, email: string): string;
export declare function generateRefreshToken(userId: string): string;
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void>;
export declare function authenticateResetToken(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function requirePermission(...perms: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
