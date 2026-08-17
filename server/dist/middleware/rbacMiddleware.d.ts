import { Request, Response, NextFunction } from 'express';
export declare function enforceRbac(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
