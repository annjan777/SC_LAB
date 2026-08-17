import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, authApi } from '../lib/api';
import { Save, Plus, X, User, Briefcase, Phone, Award, Lock, Eye, EyeOff, Code, Box, Cpu } from 'lucide-react';
import AutocompleteInput from '../components/AutocompleteInput';

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

export default function ProfilePage() {
  const { profile, reloadProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    roll_number: '',
    employee_id: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    department: '',
    program_designation: '',
    supervisor: '',
    joining_date: '',
    tenure_ending_date: '',
  });

  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState('intermediate');

  const [userSoftware, setUserSoftware] = useState<UserSoftware[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState('');
  const [softwareProficiency, setSoftwareProficiency] = useState('intermediate');

  const [userEquipment, setUserEquipment] = useState<UserEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [equipmentExperience, setEquipmentExperience] = useState('intermediate');

  const [userProcesses, setUserProcesses] = useState<UserProcess[]>([]);
  const [selectedProcess, setSelectedProcess] = useState('');
  const [processExperience, setProcessExperience] = useState('intermediate');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        roll_number: profile.roll_number || '',
        employee_id: profile.employee_id || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        department: profile.department || '',
        program_designation: profile.program_designation || '',
        supervisor: profile.supervisor || '',
        joining_date: profile.joining_date || '',
        tenure_ending_date: profile.tenure_ending_date || '',
      });
      fetchUserSkills();
      fetchUserSoftware();
      fetchUserEquipment();
      fetchUserProcesses();
    }
  }, [profile]);

  const fetchUserSkills = async () => {
    const { data } = await api.get('/api/expertise/skills', { user_id: profile?.id });
    if (data) setUserSkills(data);
  };

  const fetchUserSoftware = async () => {
    const { data } = await api.get('/api/expertise/software', { user_id: profile?.id });
    if (data) setUserSoftware(data);
  };

  const fetchUserEquipment = async () => {
    const { data } = await api.get('/api/expertise/equipment', { user_id: profile?.id });
    if (data) setUserEquipment(data);
  };

  const fetchUserProcesses = async () => {
    const { data } = await api.get('/api/expertise/processes', { user_id: profile?.id });
    if (data) setUserProcesses(data);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const sanitizedData = {
        ...formData,
        date_of_birth: formData.date_of_birth || null,
        joining_date: formData.joining_date || null,
        tenure_ending_date: formData.tenure_ending_date || null,
        roll_number: formData.roll_number || null,
        employee_id: formData.employee_id || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        department: formData.department || null,
        program_designation: formData.program_designation || null,
        supervisor: formData.supervisor || null,
        gender: formData.gender || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await api.put('/api/users/' + profile?.id, sanitizedData);

      if (error) throw error;

      await reloadProfile();

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const addSkill = async () => {
    if (!selectedSkill.trim()) return;

    try {
      const { error } = await api.post('/api/expertise/skills', {
        user_id: profile?.id,
        skill_name: selectedSkill.trim(),
        proficiency_level: proficiencyLevel,
      });

      if (error) throw error;

      setSelectedSkill('');
      setProficiencyLevel('intermediate');
      fetchUserSkills();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const removeSkill = async (skillId: string) => {
    try {
      const { error } = await api.delete('/api/expertise/skills/' + skillId);
      if (error) throw error;
      fetchUserSkills();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const addSoftware = async () => {
    if (!selectedSoftware.trim()) return;

    try {
      const { error } = await api.post('/api/expertise/software', {
        user_id: profile?.id,
        software_name: selectedSoftware.trim(),
        proficiency_level: softwareProficiency,
      });

      if (error) throw error;

      setSelectedSoftware('');
      setSoftwareProficiency('intermediate');
      fetchUserSoftware();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const removeSoftware = async (id: string) => {
    try {
      const { error } = await api.delete('/api/expertise/software/' + id);
      if (error) throw error;
      fetchUserSoftware();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const addEquipment = async () => {
    if (!selectedEquipment.trim()) return;

    try {
      const { error } = await api.post('/api/expertise/equipment', {
        user_id: profile?.id,
        equipment_name: selectedEquipment.trim(),
        experience_level: equipmentExperience,
      });

      if (error) throw error;

      setSelectedEquipment('');
      setEquipmentExperience('intermediate');
      fetchUserEquipment();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const removeEquipment = async (id: string) => {
    try {
      const { error } = await api.delete('/api/expertise/equipment/' + id);
      if (error) throw error;
      fetchUserEquipment();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const addProcess = async () => {
    if (!selectedProcess.trim()) return;

    try {
      const { error } = await api.post('/api/expertise/processes', {
        user_id: profile?.id,
        process_name: selectedProcess.trim(),
        experience_level: processExperience,
      });

      if (error) throw error;

      setSelectedProcess('');
      setProcessExperience('intermediate');
      fetchUserProcesses();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const removeProcess = async (id: string) => {
    try {
      const { error } = await api.delete('/api/expertise/processes/' + id);
      if (error) throw error;
      fetchUserProcesses();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Current password is required' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPasswordChanging(true);

    try {
      const { error } = await authApi.changePassword(newPassword, currentPassword);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setPasswordChanging(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600 mt-2">Manage your personal information and expertise</p>
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

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number</label>
                <input
                  type="text"
                  value={formData.roll_number}
                  onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Phone className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.emergency_contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_name: e.target.value })
                    }
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_phone: e.target.value })
                    }
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Briefcase className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Academic/Employment Info</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program/Designation
                  </label>
                  <input
                    type="text"
                    value={formData.program_designation}
                    onChange={(e) =>
                      setFormData({ ...formData, program_designation: e.target.value })
                    }
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor</label>
                  <input
                    type="text"
                    value={formData.supervisor}
                    onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tenure Ending Date</label>
                  <input
                    type="date"
                    value={formData.tenure_ending_date}
                    onChange={(e) => setFormData({ ...formData, tenure_ending_date: e.target.value })}
                    className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Award className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Skills & Expertise</h2>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Add New Skill</h3>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Skill</label>
                <AutocompleteInput
                  type="skill"
                  value={selectedSkill}
                  onChange={setSelectedSkill}
                  placeholder="Type skill name..."
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Proficiency</label>
                <select
                  value={proficiencyLevel}
                  onChange={(e) => setProficiencyLevel(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <button
                onClick={addSkill}
                disabled={!selectedSkill.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {userSkills.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No skills added yet</p>
            ) : (
              userSkills.map((userSkill) => (
                <div
                  key={userSkill.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{userSkill.skill_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{userSkill.proficiency_level}</p>
                  </div>
                  <button
                    onClick={() => removeSkill(userSkill.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Code className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Software Proficiency</h2>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Add Software Tool</h3>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Software</label>
                <AutocompleteInput
                  type="software"
                  value={selectedSoftware}
                  onChange={setSelectedSoftware}
                  placeholder="Type software name..."
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Proficiency</label>
                <select
                  value={softwareProficiency}
                  onChange={(e) => setSoftwareProficiency(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <button
                onClick={addSoftware}
                disabled={!selectedSoftware.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {userSoftware.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No software added yet</p>
            ) : (
              userSoftware.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.software_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{item.proficiency_level}</p>
                  </div>
                  <button
                    onClick={() => removeSoftware(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Box className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Equipment Experience</h2>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Add Equipment</h3>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment</label>
                <AutocompleteInput
                  type="equipment"
                  value={selectedEquipment}
                  onChange={setSelectedEquipment}
                  placeholder="Type equipment name..."
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                <select
                  value={equipmentExperience}
                  onChange={(e) => setEquipmentExperience(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <button
                onClick={addEquipment}
                disabled={!selectedEquipment.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {userEquipment.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No equipment added yet</p>
            ) : (
              userEquipment.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.equipment_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{item.experience_level}</p>
                  </div>
                  <button
                    onClick={() => removeEquipment(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Process Experience</h2>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Add Process</h3>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Process</label>
                <AutocompleteInput
                  type="process"
                  value={selectedProcess}
                  onChange={setSelectedProcess}
                  placeholder="Type process name..."
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                <select
                  value={processExperience}
                  onChange={(e) => setProcessExperience(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <button
                onClick={addProcess}
                disabled={!selectedProcess.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {userProcesses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No processes added yet</p>
            ) : (
              userProcesses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.process_name}</p>
                    <p className="text-sm text-gray-600 capitalize">{item.experience_level}</p>
                  </div>
                  <button
                    onClick={() => removeProcess(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
            </div>
          </div>

          <p className="text-gray-600 text-sm mb-4">
            Update your password to keep your account secure. You can change it anytime.
          </p>

          {profile?.last_password_changed_at && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-gray-600">
                Last changed: {new Date(profile.last_password_changed_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 h-[42px] pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={passwordChanging}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2 font-medium"
              >
                <Lock className="w-4 h-4" />
                <span>{passwordChanging ? 'Changing...' : 'Change Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
