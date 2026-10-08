import { Request, Response, NextFunction } from 'express';
export declare function getPenalty(failures: number): number;
export declare function formatTime(ms: number): string;
export declare const progressiveLoginLimiter: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/** Milliseconds until this IP may try to log in again (0 when not blocked). */
export declare function getLoginBlockRemainingMs(ip: string): number;
export declare function recordFailedLogin(ip: string, email?: string): void;
export declare function resetFailedLogin(ip: string): void;
/** Milliseconds until this account may try to log in again (0 when not blocked). */
export declare function getAccountBlockRemainingMs(email: string): number;
export declare function recordFailedLoginForAccount(email: string): void;
export declare function resetAccountFailures(email: string): void;
export declare function clearRateLimitTracker(): void;
