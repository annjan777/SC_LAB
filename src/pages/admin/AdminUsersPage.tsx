import { useEffect, useState } from 'react';
import { api, authApi } from '../../lib/api';
import { Search, Users, Eye, Trash2, UserPlus, Upload, Shield, ChevronUp, ChevronDown, Key } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  roll_number: string | null;
  employee_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  department: string | null;
  program_designation: string | null;
  supervisor: string | null;
  joining_date: string | null;
  tenure_ending_date: string | null;
  user_role: 'admin' | 'user';
  is_active: boolean;
  profile_picture_url: string | null;
  require_password_change: boolean;
  last_password_changed_at: string | null;
  created_at: string;
  updated_at: string;
  role_id: string | null;
  skills?: string[];
  software?: string[];
  equipment?: string[];
  processes?: string[];
}

interface UserSkill {
  id: string;
  skill_name: string;
  proficiency_level: string;
}

interface UserSoftware {
  id: string;
  software_name: string;
  proficiency_level: string;
}

interface UserEquipment {
  id: string;
  equipment_name: string;
  experience_level: string;
}

interface UserProcess {
  id: string;
  process_name: string;
  experience_level: string;
}

type SortField = 'full_name' | 'program_designation' | 'email' | 'phone' | 'user_role' | 'is_active';
type SortDirection = 'asc' | 'desc';

import AddUserModal from '../../components/AddUserModal';
import BulkImportModal from '../../components/BulkImportModal';
import UserDetailsModal from '../../components/UserDetailsModal';
import DeleteUserModal from '../../components/DeleteUserModal';
import EditUserPermissionsModal from '../../components/EditUserPermissionsModal';
import AdvancedSearchFilters, { SearchFilters } from '../../components/AdvancedSearchFilters';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [userSoftware, setUserSoftware] = useState<UserSoftware[]>([]);
  const [userEquipment, setUserEquipment] = useState<UserEquipment[]>([]);
  const [userProcesses, setUserProcesses] = useState<UserProcess[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({
    skills: [],
    software: [],
    equipment: [],
    processes: [],
    matchMode: 'any',
  });
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, advancedFilters, sortField, sortDirection]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await api.get('/api/users', { order: 'created_at', ascending: 'false' });

    if (data) {
      const usersWithExpertise = await Promise.all(
        data.map(async (user: UserProfile) => {
          const [skillsData, softwareData, equipmentData, processesData] = await Promise.all([
            api.get('/api/expertise/skills', { user_id: user.id }),
            api.get('/api/expertise/software', { user_id: user.id }),
            api.get('/api/expertise/equipment', { user_id: user.id }),
            api.get('/api/expertise/processes', { user_id: user.id }),
          ]);

          return {
            ...user,
            skills: skillsData.data?.map((s: any) => s.skill_name) || [],
            software: softwareData.data?.map((s: any) => s.software_name) || [],
            equipment: equipmentData.data?.map((e: any) => e.equipment_name) || [],
            processes: processesData.data?.map((p: any) => p.process_name) || [],
          };
        })
      );
      setUsers(usersWithExpertise);
    }
    setLoading(false);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.roll_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.supervisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.user_role === roleFilter);
    }

    const hasAdvancedFilters = advancedFilters.skills.length > 0 ||
                               advancedFilters.software.length > 0 ||
                               advancedFilters.equipment.length > 0 ||
                               advancedFilters.processes.length > 0;

    if (hasAdvancedFilters) {
      filtered = filtered.filter((user) => {
        const matchesSkills = advancedFilters.skills.length === 0 ||
          advancedFilters.skills.some((skill) =>
            user.skills?.some((userSkill) =>
              userSkill.toLowerCase().includes(skill.toLowerCase())
            )
          );

        const matchesSoftware = advancedFilters.software.length === 0 ||
          advancedFilters.software.some((sw) =>
            user.software?.some((userSw) =>
              userSw.toLowerCase().includes(sw.toLowerCase())
            )
          );

        const matchesEquipment = advancedFilters.equipment.length === 0 ||
          advancedFilters.equipment.some((eq) =>
            user.equipment?.some((userEq) =>
              userEq.toLowerCase().includes(eq.toLowerCase())
            )
          );

        const matchesProcesses = advancedFilters.processes.length === 0 ||
          advancedFilters.processes.some((proc) =>
            user.processes?.some((userProc) =>
              userProc.toLowerCase().includes(proc.toLowerCase())
            )
          );

        if (advancedFilters.matchMode === 'all') {
          return matchesSkills && matchesSoftware && matchesEquipment && matchesProcesses;
        } else {
          const checks = [
            advancedFilters.skills.length > 0 ? matchesSkills : null,
            advancedFilters.software.length > 0 ? matchesSoftware : null,
            advancedFilters.equipment.length > 0 ? matchesEquipment : null,
            advancedFilters.processes.length > 0 ? matchesProcesses : null,
          ].filter((check) => check !== null);

          return checks.some((check) => check === true);
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // For boolean values (is_active)
      if (typeof aValue === 'boolean') {
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      }

      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    setFilteredUsers(filtered);
  };

  const deleteUser = async () => {
    if (!selectedUser) return;

    try {
      console.log('Deleting user:', selectedUser.id, selectedUser.full_name);

      const { error } = await api.delete('/api/users/' + selectedUser.id);

      if (error) throw new Error(typeof error === 'string' ? error : error.message || 'Failed to delete user');

      setMessage({ type: 'success', text: 'User deleted successfully' });
      setTimeout(() => setMessage(null), 5000);
      fetchUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Delete user error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete user' });
      setTimeout(() => setMessage(null), 8000);
      throw error;
    }
  };

  const resetPassword = async () => {
    if (!selectedUser) return;

    setResetPasswordLoading(true);
    try {
      const { data: result, error } = await authApi.adminResetPassword(selectedUser.id);

      if (error) throw new Error(typeof error === 'string' ? error : error.message || 'Failed to reset password');

      if (result?.email_sent) {
        setMessage({
          type: 'success',
          text: `Password reset successfully! New credentials have been sent to ${selectedUser.email}`
        });
      } else {
        setMessage({
          type: 'success',
          text: `Password reset successfully!${result?.password ? ` New password: ${result.password}` : ''}`
        });
      }

      setTimeout(() => setMessage(null), 8000);
      setShowResetPasswordModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Reset password error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to reset password' });
      setTimeout(() => setMessage(null), 8000);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleViewUserDetails = async (user: UserProfile) => {
    setSelectedUser(user);

    const [skillsData, softwareData, equipmentData, processesData] = await Promise.all([
      api.get('/api/expertise/skills', { user_id: user.id }),
      api.get('/api/expertise/software', { user_id: user.id }),
      api.get('/api/expertise/equipment', { user_id: user.id }),
      api.get('/api/expertise/processes', { user_id: user.id }),
    ]);

    setUserSkills(skillsData.data || []);
    setUserSoftware(softwareData.data || []);
    setUserEquipment(equipmentData.data || []);
    setUserProcesses(processesData.data || []);
    setShowDetailsModal(true);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ?
      <ChevronUp className="w-4 h-4 inline ml-1" /> :
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
          <p className="text-gray-600 mt-2">View and manage lab members</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Bulk Import
          </button>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, roll number, employee ID, department, or supervisor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>

          <AdvancedSearchFilters
            filters={advancedFilters}
            onChange={setAdvancedFilters}
            defaultExpanded={true}
          />

          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-4">
            <span>
              Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
            </span>
          </div>
        </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('full_name')}
                >
                  Name {getSortIcon('full_name')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('program_designation')}
                >
                  Designation {getSortIcon('program_designation')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  Email ID {getSortIcon('email')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('phone')}
                >
                  Contact No. {getSortIcon('phone')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('user_role')}
                >
                  Role {getSortIcon('user_role')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('is_active')}
                >
                  Status {getSortIcon('is_active')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No users match your search criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => handleViewUserDetails(user)}
                    className="hover:bg-gray-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <span className="text-blue-700 font-medium">
                            {user.full_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {user.program_designation || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {user.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                          user.user_role === 'admin'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {user.user_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewUserDetails(user);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setShowPermissionsModal(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                          title="Edit permissions"
                        >
                          <Shield className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setShowResetPasswordModal(true);
                          }}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                          title="Reset password"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete user"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onUserAdded={() => {
          fetchUsers();
          setShowAddUserModal(false);
        }}
      />

      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onImportComplete={() => {
          fetchUsers();
        }}
      />

      {showDetailsModal && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          skills={userSkills}
          software={userSoftware}
          equipment={userEquipment}
          processes={userProcesses}
          onClose={() => setShowDetailsModal(false)}
        />
      )}

      {showDeleteModal && selectedUser && (
        <DeleteUserModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          onConfirm={deleteUser}
          userName={selectedUser.full_name}
          userEmail={selectedUser.email}
        />
      )}

      {showPermissionsModal && selectedUser && (
        <EditUserPermissionsModal
          isOpen={showPermissionsModal}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onUpdated={() => {
            fetchUsers();
            setShowPermissionsModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full">
              <Key className="w-8 h-8 text-orange-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Reset Password
            </h2>

            <p className="text-gray-600 text-center mb-6">
              This will generate a new password for <strong>{selectedUser.full_name}</strong> and send it to{' '}
              <strong>{selectedUser.email}</strong>.
            </p>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-sm text-yellow-800">
                The user will receive an email with their new password and can change it after logging in.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedUser(null);
                }}
                disabled={resetPasswordLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={resetPassword}
                disabled={resetPasswordLoading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 font-medium"
              >
                {resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
