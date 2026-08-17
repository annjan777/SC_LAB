import { Request, Response, NextFunction } from 'express';
export declare function getPenalty(failures: number): number;
export declare function formatTime(ms: number): string;
export declare const progressiveLoginLimiter: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function recordFailedLogin(ip: string): void;
export declare function resetFailedLogin(ip: string): void;
export declare function clearRateLimitTracker(): void;
