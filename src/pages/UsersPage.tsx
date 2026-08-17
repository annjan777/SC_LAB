import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Search, Users, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import UserDetailsModal from '../components/UserDetailsModal';
import AdvancedSearchFilters, { SearchFilters } from '../components/AdvancedSearchFilters';

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
  user_role: string;
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

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [userSoftware, setUserSoftware] = useState<UserSoftware[]>([]);
  const [userEquipment, setUserEquipment] = useState<UserEquipment[]>([]);
  const [userProcesses, setUserProcesses] = useState<UserProcess[]>([]);
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
    const { data } = await api.get('/api/users', { order: 'created_at', ascending: 'false' });

    if (data) {
      const usersWithExpertise = await Promise.all(
        data.map(async (user: any) => {
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

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (typeof aValue === 'boolean') {
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      }

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Lab Members</h1>
        <p className="text-gray-600 mt-2">View lab member profiles and expertise</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, roll number, employee ID, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
}
