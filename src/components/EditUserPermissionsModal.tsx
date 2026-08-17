import { useState, useEffect } from 'react';
import { X, Save, Shield, User, Crown } from 'lucide-react';
import { api } from '../lib/api';
import type { Role, Permission, UserProfile } from '../lib/types';

interface EditUserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdated: () => void;
}

interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export default function EditUserPermissionsModal({
  isOpen,
  onClose,
  user,
  onUpdated,
}: EditUserPermissionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState(user.role_id || '');
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, user.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesResult, permissionsResult, userPermsResult] = await Promise.all([
        api.get('/api/admin/roles'),
        api.get('/api/admin/permissions'),
        api.get('/api/admin/users/' + user.id + '/permissions'),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (permissionsResult.error) throw permissionsResult.error;
      if (userPermsResult.error) throw userPermsResult.error;

      const rolesData: RoleWithPermissions[] = rolesResult.data || [];
      const permissionsData: Permission[] = permissionsResult.data || [];
      setAllPermissions(permissionsData);
      setRoles(rolesData);

      const rawUserPerms = userPermsResult.data;
      const fetchedRoleId = rawUserPerms?.role_id || user.role_id;
      let matchedRole = rolesData.find((r) => r.id === fetchedRoleId);

      if (!matchedRole) {
        const userRoleName = (user.user_role || 'user').toLowerCase();
        matchedRole = rolesData.find(
          (r) => r.name.toLowerCase() === userRoleName
        ) || rolesData.find(
          (r) => r.name.toLowerCase() === 'user'
        ) || rolesData[0];
      }

      if (matchedRole) {
        setSelectedRoleId(matchedRole.id);
        if (Array.isArray(matchedRole.permissions)) {
          setRolePermissions(new Set(matchedRole.permissions.map((p) => p.id)));
        } else {
          setRolePermissions(new Set());
        }
      }

      const userPermsData = Array.isArray(rawUserPerms)
        ? rawUserPerms
        : (rawUserPerms?.direct_permissions || []);
      const userPerms = new Set<string>(
        userPermsData.map((up: any) => up.permission_id || up.id)
      );
      setUserPermissions(userPerms);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load permissions data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (newRoleId: string) => {
    setSelectedRoleId(newRoleId);
    const newRole = roles.find((r) => r.id === newRoleId);
    if (newRole && Array.isArray(newRole.permissions)) {
      setRolePermissions(new Set(newRole.permissions.map((p) => p.id)));
      setUserPermissions(new Set(newRole.permissions.map((p) => p.id)));
    } else {
      setRolePermissions(new Set());
      setUserPermissions(new Set());
    }
  };

  const toggleUserPermission = (permissionId: string) => {
    const newUserPerms = new Set(userPermissions);
    if (newUserPerms.has(permissionId)) {
      newUserPerms.delete(permissionId);
    } else {
      newUserPerms.add(permissionId);
    }
    setUserPermissions(newUserPerms);
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const selectedRole = roles.find((r) => r.id === selectedRoleId);
      const newUserRole = selectedRole?.name.toLowerCase() === 'admin' ? 'admin' : 'user';

      const { error: updateError } = await api.put('/api/admin/users/' + user.id + '/permissions', {
        role_id: selectedRoleId,
        user_role: newUserRole,
        individual_permissions: Array.from(userPermissions),
      });

      if (updateError) {
        throw new Error(typeof updateError === 'string' ? updateError : (updateError as any).message || 'Failed to save permissions');
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error saving permissions:', err);
      setError(err.message || 'Failed to save permissions');
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions = allPermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const categoryDisplayNames: Record<string, string> = {
    user_management: 'User Management',
    facilities: 'Facilities',
    procurement: 'Procurement',
    leave_management: 'Leave Management',
    work_planning: 'Work Planning',
    inventory: 'Inventory',
    reports: 'Reports',
    settings: 'Settings',
    notifications: 'Notifications',
  };

  const hasPermission = (permId: string): boolean => {
    return userPermissions.has(permId);
  };

  const isPermissionFromRole = (permId: string): boolean => {
    return rolePermissions.has(permId);
  };

  const canPromoteToAdmin = selectedRoleId !== roles.find(r => r.name.toLowerCase() === 'admin')?.id;

  const handlePromoteToAdmin = () => {
    const adminRole = roles.find(r => r.name.toLowerCase() === 'admin');
    if (adminRole) {
      handleRoleChange(adminRole.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Permissions for {user.full_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage role assignment and individual permissions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-1">
                  How permissions work:
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Users inherit all permissions from their assigned role</li>
                  <li>• You can grant additional individual permissions or remove inherited permissions</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigned Role
            </label>
            <div className="flex items-center gap-3">
              <select
                value={selectedRoleId}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                    {role.description && ` - ${role.description}`}
                  </option>
                ))}
              </select>
              {canPromoteToAdmin && (
                <button
                  onClick={handlePromoteToAdmin}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
                  disabled={loading}
                >
                  <Crown className="w-4 h-4" />
                  Promote to Admin
                </button>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Permissions Overview
            </h3>
            <div className="space-y-4">
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div
                  key={category}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">
                      {categoryDisplayNames[category] || category}
                    </h4>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perms.map((permission) => {
                        const isFromRole = isPermissionFromRole(permission.id);
                        const isGranted = hasPermission(permission.id);

                        return (
                          <label
                            key={permission.id}
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50`}
                          >
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => toggleUserPermission(permission.id)}
                              disabled={loading}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {permission.display_name}
                                </span>
                                {isFromRole && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded border border-blue-200">
                                    Role Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {permission.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-600">
            Total permissions: {rolePermissions.size + userPermissions.size} (
            {rolePermissions.size} from role, {userPermissions.size} individual)
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
