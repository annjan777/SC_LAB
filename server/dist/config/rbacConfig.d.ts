export type Action = 'read' | 'write' | 'delete';
export type Effect = 'allow' | 'deny';
export interface PolicyRule {
    role: string;
    resource: string | string[];
    action: Action[];
    effect: Effect;
    priority: number;
}
export interface RoleDefinition {
    inherits: string[];
}
export interface RbacConfig {
    roles: Record<string, RoleDefinition>;
    policies: PolicyRule[];
}
export declare const SC_LAB_RBAC_CONFIG: RbacConfig;
export declare const PERMISSION_POLICIES: Record<string, PolicyRule[]>;
