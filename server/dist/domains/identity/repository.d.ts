export interface UserProfile {
    id: string;
    full_name: string;
    email: string | null;
    user_role: string;
    role_id: string | null;
    is_active: boolean;
    department: string | null;
    program_designation: string | null;
    supervisor: string | null;
}
export declare class IdentityRepository {
    findUserById(id: string): Promise<UserProfile | null>;
    findUserPermissions(userId: string): Promise<string[]>;
    updateUserRoleAndPermissions(userId: string, userRole?: string, roleId?: string, permissionIds?: string[], grantedBy?: string): Promise<void>;
}
export declare const identityRepository: IdentityRepository;
