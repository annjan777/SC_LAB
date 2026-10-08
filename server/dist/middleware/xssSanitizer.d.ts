import { Request, Response, NextFunction } from 'express';
export declare function sanitizeString(val: string): string;
export declare const xssSanitizer: (req: Request, _res: Response, next: NextFunction) => void;
