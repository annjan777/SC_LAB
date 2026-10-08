import { useEffect, useState } from 'react';
import { api, authApi } from '../../lib/api';
import { Search, Users, Eye, Trash2, UserPlus, Upload, Shield, ChevronUp, ChevronDown, Key, Edit2, Send, Download } from 'lucide-react';

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
  designation?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  project_start_date?: string | null;
  project_end_date?: string | null;
  project_tenure?: string | null;
  staff_contract_start_date?: string | null;
  staff_contract_end_date?: string | null;
  contract_tenure?: string | null;
  project_role_responsibility?: string | null;
  project_pi_coordinator?: string | null;
  reporting_manager?: string | null;
  current_status?: string | null;
  contract_status?: string | null;
  remarks_staff?: string | null;
  remarks_manager?: string | null;
  is_profile_completed?: boolean;
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
import BroadcastModal from '../../components/BroadcastModal';
import UserDetailsModal from '../../components/UserDetailsModal';
import DeleteUserModal from '../../components/DeleteUserModal';
import EditUserPermissionsModal from '../../components/EditUserPermissionsModal';
import AdvancedSearchFilters, { SearchFilters } from '../../components/AdvancedSearchFilters';
import {
  PageHeader,
  Button,
  Select,
  TableContainer,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  StatusBadge,
  EmptyState,
} from '../../components/ui';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [openDetailsInEditMode, setOpenDetailsInEditMode] = useState(false);
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

  const handleViewUserDetails = async (user: UserProfile, editMode = false) => {
    setSelectedUser(user);
    setOpenDetailsInEditMode(editMode);

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

  const exportUsersToCSV = () => {
    // If filters are applied, filteredUsers contains the filtered subset.
    // If no filters are applied, filteredUsers contains all users.
    const usersToExport = filteredUsers;

    if (usersToExport.length === 0) {
      alert('No users match the current search or filters to export.');
      return;
    }

    const headers = [
      'S. No.',
      'Full Name',
      'Email',
      'Phone',
      'Designation',
      'Project Name',
      'Project Code',
      'Project Start Date',
      'Project End Date',
      'Project Tenure',
      'Staff Contract Start Date',
      'Staff Contract End Date',
      'Contract Tenure',
      'Project Role / Responsibility',
      'Project PI / Coordinator',
      'Reporting Manager',
      'Current Status',
      'Contract Status',
      'Remarks (Staff)',
      'Remarks(Manager)',
    ];

    const formatDate = (val?: string | null) => {
      if (!val) return '';
      return val.split('T')[0];
    };

    const escapeCSV = (val?: string | number | null) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).trim();
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = usersToExport.map((u, idx) => [
      escapeCSV(idx + 1),
      escapeCSV(u.full_name || ''),
      escapeCSV(u.email || ''),
      escapeCSV(u.phone || ''),
      escapeCSV(u.designation || u.program_designation || ''),
      escapeCSV(u.project_name || ''),
      escapeCSV(u.project_code || ''),
      escapeCSV(formatDate(u.project_start_date)),
      escapeCSV(formatDate(u.project_end_date)),
      escapeCSV(u.project_tenure || ''),
      escapeCSV(formatDate(u.staff_contract_start_date)),
      escapeCSV(formatDate(u.staff_contract_end_date)),
      escapeCSV(u.contract_tenure || ''),
      escapeCSV(u.project_role_responsibility || ''),
      escapeCSV(u.project_pi_coordinator || ''),
      escapeCSV(u.reporting_manager || u.supervisor || ''),
      escapeCSV(u.current_status || (u.is_active ? 'Active' : 'Inactive')),
      escapeCSV(u.contract_status || (u.is_active ? 'Active' : 'Inactive')),
      escapeCSV(u.remarks_staff || ''),
      escapeCSV(u.remarks_manager || ''),
    ]);

    const csvContent =
      headers.map((h) => `"${h}"`).join(',') +
      '\n' +
      rows.map((row) => row.join(',')).join('\n') +
      '\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const isFiltered = usersToExport.length !== users.length;
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = isFiltered
      ? `sc_lab_users_filtered_${usersToExport.length}_${timestamp}.csv`
      : `sc_lab_users_all_${timestamp}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage({
      type: 'success',
      text: `Successfully exported ${usersToExport.length} user(s) to CSV${isFiltered ? ' (filtered results)' : ' (all members)'}.`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Manage Users"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportUsersToCSV}
              leftIcon={<Download className="w-4 h-4" />}
              title={
                filteredUsers.length === users.length
                  ? `Export all ${users.length} users as CSV`
                  : `Export ${filteredUsers.length} filtered user(s) as CSV`
              }
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowBroadcastModal(true)}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Broadcast
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowBulkImportModal(true)}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Bulk Import
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowAddUserModal(true)}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Add User
            </Button>
          </div>
        }
      />

      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-emerald-950/40 border-green-200 dark:border-emerald-800 text-green-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, roll number, employee ID, department, or supervisor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-gray-400 dark:placeholder-slate-500 transition"
              />
            </div>
          </div>

          <div>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </Select>
          </div>
        </div>

        <AdvancedSearchFilters
          filters={advancedFilters}
          onChange={setAdvancedFilters}
          defaultExpanded={true}
        />

        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-slate-400 mt-4">
          <span>
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
          </span>
        </div>
      </div>

      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                onClick={() => handleSort('full_name')}
              >
                Name {getSortIcon('full_name')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                onClick={() => handleSort('program_designation')}
              >
                Designation {getSortIcon('program_designation')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                onClick={() => handleSort('email')}
              >
                Email ID {getSortIcon('email')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                onClick={() => handleSort('phone')}
              >
                Contact No. {getSortIcon('phone')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                onClick={() => handleSort('user_role')}
              >
                Role {getSortIcon('user_role')}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                onClick={() => handleSort('is_active')}
              >
                Status {getSortIcon('is_active')}
              </TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <tr>
                <TableCell colSpan={7} className="py-12 text-center text-gray-500 dark:text-slate-400">
                  No users match your search criteria
                </TableCell>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  onClick={() => handleViewUserDetails(user)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center mr-3 shrink-0">
                        <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{user.full_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.program_designation || '-'}
                  </TableCell>
                  <TableCell>
                    {user.email || '-'}
                  </TableCell>
                  <TableCell>
                    {user.phone || '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={user.user_role}
                      variant={user.user_role === 'admin' ? 'purple' : 'blue'}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={user.is_active ? 'Active' : 'Inactive'}
                      variant={user.is_active ? 'emerald' : 'red'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewUserDetails(user, false);
                        }}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewUserDetails(user, true);
                        }}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                        title="Edit user details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                          setShowPermissionsModal(true);
                        }}
                        className="p-1.5 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title="Edit permissions"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                          setShowResetPasswordModal(true);
                        }}
                        className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50 rounded-lg transition"
                        title="Reset password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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

      {showBroadcastModal && (
        <BroadcastModal
          onClose={() => setShowBroadcastModal(false)}
          onSuccess={(msg) => {
            setMessage({ type: 'success', text: msg });
          }}
        />
      )}

      {showDetailsModal && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          skills={userSkills}
          software={userSoftware}
          equipment={userEquipment}
          processes={userProcesses}
          initialEditMode={openDetailsInEditMode}
          onClose={() => {
            setShowDetailsModal(false);
            setOpenDetailsInEditMode(false);
          }}
          onUserUpdated={(updatedUser) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === updatedUser.id
                  ? ({ ...u, ...updatedUser, user_role: updatedUser.user_role as 'admin' | 'user' })
                  : u
              )
            );
            setSelectedUser(updatedUser as any);
            setMessage({
              type: 'success',
              text: `Updated ${updatedUser.full_name}'s details successfully!`,
            });
            setTimeout(() => setMessage(null), 5000);
          }}
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
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
