import { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Trash2, Users, X, Save, Download, Upload, AlertTriangle } from 'lucide-react';
import { api, getStoredToken, setToken } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Permission, RoleWithPermissions } from '../../lib/types';

interface RoleFormData {
  name: string;
  description: string;
  selectedPermissions: Set<string>;
}

export default function AdminSettingsPage() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.user_role === 'super_admin';
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    selectedPermissions: new Set(),
  });
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importConfirmText, setImportConfirmText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  const fetchRolesAndPermissions = async () => {
    setLoading(true);
    try {
      const [rolesResult, permissionsResult] = await Promise.all([
        api.get('/api/admin/roles'),
        api.get('/api/admin/permissions'),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (permissionsResult.error) throw permissionsResult.error;

      const rolesData: RoleWithPermissions[] = rolesResult.data || [];
      const permissionsData: Permission[] = permissionsResult.data || [];
      setPermissions(permissionsData);

      // Count users per role from roles data if provided, otherwise just set roles
      const counts: Record<string, number> = {};
      rolesData.forEach((role: any) => {
        if (role.user_count !== undefined) {
          counts[role.id] = role.user_count;
        }
      });
      setUserCounts(counts);

      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching roles and permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      selectedPermissions: new Set(),
    });
    setShowRoleModal(true);
  };

  const handleEditRole = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      selectedPermissions: new Set(role.permissions.map((p) => p.id)),
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    try {
      if (!formData.name.trim()) {
        alert('Role name is required');
        return;
      }

      const permissionsArray = Array.from(formData.selectedPermissions);

      if (editingRole) {
        const { error } = await api.put('/api/admin/roles/' + editingRole.id, {
          name: formData.name,
          description: formData.description,
          permissions: permissionsArray,
        });

        if (error) throw error;
      } else {
        const { error } = await api.post('/api/admin/roles', {
          name: formData.name,
          description: formData.description,
          is_system_role: false,
          permissions: permissionsArray,
        });

        if (error) throw error;
      }

      await fetchRolesAndPermissions();
      setShowRoleModal(false);
    } catch (error: any) {
      console.error('Error saving role:', error);
      alert(`Error saving role: ${error.message}`);
    }
  };

  const handleDeleteRole = async (role: RoleWithPermissions) => {
    if (role.is_system_role) {
      alert('System roles cannot be deleted');
      return;
    }

    const userCount = userCounts[role.id] || 0;
    if (userCount > 0) {
      alert(
        `Cannot delete role "${role.name}" because it is assigned to ${userCount} user(s). Please reassign these users to a different role first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return;
    }

    try {
      const { error } = await api.delete('/api/admin/roles/' + role.id);

      if (error) throw error;

      await fetchRolesAndPermissions();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(`Error deleting role: ${error.message}`);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      const token = getStoredToken();
      const res = await fetch('/api/admin/backup/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] || `sclab-backup-${new Date().toISOString()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportConfirmText('');
    setImportError('');
    setShowImportModal(true);
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportError('Please choose a backup .zip file');
      return;
    }
    if (importConfirmText !== 'IMPORT') {
      setImportError('Type IMPORT exactly to confirm');
      return;
    }

    setImporting(true);
    setImportError('');
    try {
      const form = new FormData();
      form.append('backup', importFile);
      const { data, error } = await api.upload('/api/admin/backup/import', form);
      if (error) throw error;

      alert(
        `Data restored successfully.\n\nA safety snapshot of what was just replaced was saved on the server at:\n${data?.preImportBackupPath || '(see server logs)'}\n\nYou will now be signed out — please log in again.`
      );
      setToken(null);
      window.location.href = '/login';
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    const newSelected = new Set(formData.selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setFormData({ ...formData, selectedPermissions: newSelected });
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Configure lab management portal settings</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure lab management portal settings</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Roles & Permissions</h2>
              <p className="text-sm text-gray-600">
                Manage user roles and their permissions
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateRole}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{role.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {role.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {role.permissions.length} permission
                      {role.permissions.length !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      {userCounts[role.id] || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.is_system_role ? (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        System
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditRole(role)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit role"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!role.is_system_role && (
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete role"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Data Export &amp; Import</h2>
                <p className="text-sm text-gray-600">
                  Full backup and restore of the database and uploaded files. Super Admin only.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-1">Export Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download a complete .zip snapshot of the database and all uploaded documents/images.
                Keep this somewhere safe in case the server is lost.
              </p>
              {exportError && (
                <div className="text-sm text-red-600 mb-3">{exportError}</div>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Preparing export...' : 'Export Data'}
              </button>
            </div>

            <div className="border border-red-200 bg-red-50 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-1">Import Data</h3>
              <p className="text-sm text-gray-700 mb-4">
                Restores the database and files from a previously exported .zip.{' '}
                <strong>This replaces all current data.</strong> A safety snapshot of what gets
                replaced is taken automatically first, but this is still a destructive action.
              </p>
              <button
                onClick={openImportModal}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-semibold text-gray-900">Import Data</h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                This will <strong>delete and replace every record and file currently in the
                system</strong> with what's in the backup you upload. Everyone, including you,
                will be signed out immediately afterward. A safety snapshot of the current data
                is taken automatically before anything is overwritten, but only use this if
                you're certain about the file you're uploading.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup file (.zip)
                </label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono font-bold">IMPORT</span> to confirm
                </label>
                <input
                  type="text"
                  value={importConfirmText}
                  onChange={(e) => setImportConfirmText(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="IMPORT"
                />
              </div>

              {importError && (
                <div className="text-sm text-red-600">{importError}</div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || importConfirmText !== 'IMPORT' || !importFile}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Restoring... this may take a while' : 'Overwrite and Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </h2>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Lab Manager"
                  disabled={editingRole?.is_system_role}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what this role is for"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Permissions
                </label>
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">
                        {categoryDisplayNames[category] || category}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {perms.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.selectedPermissions.has(
                                permission.id
                              )}
                              onChange={() => togglePermission(permission.id)}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {permission.display_name}
                              </div>
                              {permission.description && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {permission.description}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="text-sm text-gray-600">
                {formData.selectedPermissions.size} permission
                {formData.selectedPermissions.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
