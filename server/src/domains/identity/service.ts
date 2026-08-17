import { identityRepository, UserProfile } from './repository.js';
import { logAuditEvent } from '../../services/auditLogger.js';

export class IdentityService {
  async getUserSessionProfile(userId: string): Promise<{ profile: UserProfile | null; permissions: string[] }> {
    const profile = await identityRepository.findUserById(userId);
    const permissions = await identityRepository.findUserPermissions(userId);
    return { profile, permissions };
  }

  async updateUserPermissions(params: {
    targetUserId: string;
    actorUserId?: string;
    userRole?: string;
    roleId?: string;
    permissionIds?: string[];
  }): Promise<void> {
    const { targetUserId, actorUserId, userRole, roleId, permissionIds } = params;

    await identityRepository.updateUserRoleAndPermissions(
      targetUserId,
      userRole,
      roleId,
      permissionIds,
      actorUserId
    );

    await logAuditEvent({
      userId: actorUserId,
      action: 'PERMISSION_CHANGE',
      entityType: 'user_permissions',
      entityId: targetUserId,
      newValue: { roleId, userRole, permissionIds },
      remarks: `IdentityService: Updated permissions for user ${targetUserId}`,
    });
  }
}

export const identityService = new IdentityService();
