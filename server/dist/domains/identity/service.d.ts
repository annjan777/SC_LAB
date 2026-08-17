import { UserProfile } from './repository.js';
export declare class IdentityService {
    getUserSessionProfile(userId: string): Promise<{
        profile: UserProfile | null;
        permissions: string[];
    }>;
    updateUserPermissions(params: {
        targetUserId: string;
        actorUserId?: string;
        userRole?: string;
        roleId?: string;
        permissionIds?: string[];
    }): Promise<void>;
}
export declare const identityService: IdentityService;
