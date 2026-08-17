import { Action, Effect, PolicyRule } from '../config/rbacConfig.js';
export declare function mapMethodToAction(method: string): Action;
export declare function expandUserRoles(userRole?: string): Set<string>;
export declare function matchResourcePattern(pattern: string, path: string): boolean;
export interface EvaluationResult {
    allowed: boolean;
    effect: Effect | 'none';
    priority?: number;
    matchedRule?: PolicyRule;
    reason: string;
}
export declare function evaluateRbacPolicy(userRole: string | undefined, path: string, method: string, userPermissions?: Set<string>): EvaluationResult;
