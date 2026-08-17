import { X, User, Mail, Phone, MapPin, Calendar, Briefcase } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  roll_number: string | null;
  employee_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
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

interface UserDetailsModalProps {
  user: UserProfile;
  skills: UserSkill[];
  software: UserSoftware[];
  equipment: UserEquipment[];
  processes: UserProcess[];
  onClose: () => void;
}

export default function UserDetailsModal({
  user,
  skills,
  software,
  equipment,
  processes,
  onClose,
}: UserDetailsModalProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-yellow-100 text-yellow-800',
      intermediate: 'bg-blue-100 text-blue-800',
      advanced: 'bg-green-100 text-green-800',
      expert: 'bg-purple-100 text-purple-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
            <p className="text-gray-600 mt-1">
              {user.user_role === 'admin' ? 'Administrator' : 'User'} • {user.is_active ? 'Active' : 'Inactive'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Roll Number</p>
                <p className="text-gray-900">{user.roll_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Employee ID</p>
                <p className="text-gray-900">{user.employee_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                <p className="text-gray-900">{formatDate(user.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Gender</p>
                <p className="text-gray-900 capitalize">{user.gender?.replace('_', ' ') || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Phone</p>
                <p className="text-gray-900">{user.phone || 'N/A'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p className="text-gray-900">{user.address || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Emergency Contact</p>
                <p className="text-gray-900">{user.emergency_contact_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Emergency Phone</p>
                <p className="text-gray-900">{user.emergency_contact_phone || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2" />
              Employment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Department</p>
                <p className="text-gray-900">{user.department || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Program/Designation</p>
                <p className="text-gray-900">{user.program_designation || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Supervisor</p>
                <p className="text-gray-900">{user.supervisor || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Joining Date</p>
                <p className="text-gray-900">{formatDate(user.joining_date)}</p>
              </div>
            </div>
          </div>

          {skills.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-white rounded-lg px-3 py-2 border border-gray-200"
                  >
                    <p className="font-medium text-gray-900">{skill.skill_name}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(
                        skill.proficiency_level
                      )}`}
                    >
                      {skill.proficiency_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {software.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Software Proficiency</h3>
              <div className="flex flex-wrap gap-2">
                {software.map((sw) => (
                  <div
                    key={sw.id}
                    className="bg-white rounded-lg px-3 py-2 border border-gray-200"
                  >
                    <p className="font-medium text-gray-900">{sw.software_name}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(
                        sw.proficiency_level
                      )}`}
                    >
                      {sw.proficiency_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {equipment.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipment Experience</h3>
              <div className="flex flex-wrap gap-2">
                {equipment.map((eq) => (
                  <div
                    key={eq.id}
                    className="bg-white rounded-lg px-3 py-2 border border-gray-200"
                  >
                    <p className="font-medium text-gray-900">{eq.equipment_name}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(
                        eq.experience_level
                      )}`}
                    >
                      {eq.experience_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processes.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Process Experience</h3>
              <div className="flex flex-wrap gap-2">
                {processes.map((proc) => (
                  <div
                    key={proc.id}
                    className="bg-white rounded-lg px-3 py-2 border border-gray-200"
                  >
                    <p className="font-medium text-gray-900">{proc.process_name}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(
                        proc.experience_level
                      )}`}
                    >
                      {proc.experience_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skills.length === 0 &&
            software.length === 0 &&
            equipment.length === 0 &&
            processes.length === 0 && (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <p className="text-gray-500">No expertise information available</p>
              </div>
            )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
