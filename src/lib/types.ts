// Central application types re-exported from AuthContext
export type { UserProfile, PermissionName, UserRole } from '../contexts/AuthContext';

export type Permission = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  created_at: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
};

export type RoleWithPermissions = Role & { permissions: Permission[] };

export type UserPermission = {
  permission_id: string;
  permission: Permission;
  granted_by: string | null;
  granted_at: string;
};
