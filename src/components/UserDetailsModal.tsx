import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Edit2,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { api } from '../lib/api';
import { extractIndianPhone, validateEmail } from '../utils/userValidation';
import { calculateTenure } from '../utils/tenureUtils';
import { useAuth } from '../contexts/AuthContext';

export interface UserProfile {
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
}

export interface UserSkill {
  id: string;
  skill_name: string;
  proficiency_level: string;
}

export interface UserSoftware {
  id: string;
  software_name: string;
  proficiency_level: string;
}

export interface UserEquipment {
  id: string;
  equipment_name: string;
  experience_level: string;
}

export interface UserProcess {
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
  initialEditMode?: boolean;
  onClose: () => void;
  onUserUpdated?: (updatedUser: UserProfile) => void;
}

function toDateInputValue(val: string | null | undefined): string {
  if (!val) return '';
  // Check if already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export default function UserDetailsModal({
  user,
  skills,
  software,
  equipment,
  processes,
  initialEditMode = false,
  onClose,
  onUserUpdated,
}: UserDetailsModalProps) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(user);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const { profile } = useAuth();
  const canEdit = profile?.user_role === 'admin' || profile?.user_role === 'super_admin' || profile?.id === user.id;

  // Form state
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    email: user.email || '',
    phone: user.phone || '',
    roll_number: user.roll_number || '',
    employee_id: user.employee_id || '',
    date_of_birth: toDateInputValue(user.date_of_birth),
    gender: user.gender || '',
    address: user.address || '',
    emergency_contact_name: user.emergency_contact_name || '',
    emergency_contact_phone: user.emergency_contact_phone || '',
    department: user.department || '',
    program_designation: user.program_designation || user.designation || '',
    supervisor: user.supervisor || user.reporting_manager || '',
    joining_date: toDateInputValue(user.joining_date),
    project_name: user.project_name || '',
    project_code: user.project_code || '',
    project_start_date: toDateInputValue(user.project_start_date),
    project_end_date: toDateInputValue(user.project_end_date),
    project_tenure: user.project_tenure || '',
    staff_contract_start_date: toDateInputValue(user.staff_contract_start_date),
    staff_contract_end_date: toDateInputValue(user.staff_contract_end_date),
    contract_tenure: user.contract_tenure || '',
    project_role_responsibility: user.project_role_responsibility || '',
    project_pi_coordinator: user.project_pi_coordinator || '',
    reporting_manager: user.reporting_manager || user.supervisor || '',
    current_status: user.current_status || 'Active',
    contract_status: user.contract_status || 'Active',
    remarks_staff: user.remarks_staff || '',
    remarks_manager: user.remarks_manager || '',
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString();
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

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate project tenure if dates change
      if (field === 'project_start_date' || field === 'project_end_date') {
        const tenure = calculateTenure(
          field === 'project_start_date' ? value : prev.project_start_date,
          field === 'project_end_date' ? value : prev.project_end_date
        );
        if (tenure) updated.project_tenure = tenure;
      }

      // Auto-calculate contract tenure if dates change
      if (field === 'staff_contract_start_date' || field === 'staff_contract_end_date') {
        const tenure = calculateTenure(
          field === 'staff_contract_start_date' ? value : prev.staff_contract_start_date,
          field === 'staff_contract_end_date' ? value : prev.staff_contract_end_date
        );
        if (tenure) updated.contract_tenure = tenure;
      }

      return updated;
    });
    setError(null);
  };

  const handleCancelEdit = () => {
    setFormData({
      full_name: currentUser.full_name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      roll_number: currentUser.roll_number || '',
      employee_id: currentUser.employee_id || '',
      date_of_birth: toDateInputValue(currentUser.date_of_birth),
      gender: currentUser.gender || '',
      address: currentUser.address || '',
      emergency_contact_name: currentUser.emergency_contact_name || '',
      emergency_contact_phone: currentUser.emergency_contact_phone || '',
      department: currentUser.department || '',
      program_designation: currentUser.program_designation || currentUser.designation || '',
      supervisor: currentUser.supervisor || currentUser.reporting_manager || '',
      joining_date: toDateInputValue(currentUser.joining_date),
      project_name: currentUser.project_name || '',
      project_code: currentUser.project_code || '',
      project_start_date: toDateInputValue(currentUser.project_start_date),
      project_end_date: toDateInputValue(currentUser.project_end_date),
      project_tenure: currentUser.project_tenure || '',
      staff_contract_start_date: toDateInputValue(currentUser.staff_contract_start_date),
      staff_contract_end_date: toDateInputValue(currentUser.staff_contract_end_date),
      contract_tenure: currentUser.contract_tenure || '',
      project_role_responsibility: currentUser.project_role_responsibility || '',
      project_pi_coordinator: currentUser.project_pi_coordinator || '',
      reporting_manager: currentUser.reporting_manager || currentUser.supervisor || '',
      current_status: currentUser.current_status || 'Active',
      contract_status: currentUser.contract_status || 'Active',
      remarks_staff: currentUser.remarks_staff || '',
      remarks_manager: currentUser.remarks_manager || '',
    });
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!formData.full_name.trim()) {
      setError('Full Name cannot be empty');
      return;
    }

    if (formData.phone.trim()) {
      const phoneCheck = extractIndianPhone(formData.phone, false);
      if (!phoneCheck.isValid) {
        setError(phoneCheck.error || 'Invalid phone number format');
        return;
      }
      formData.phone = phoneCheck.phone || formData.phone;
    }

    if (formData.email.trim()) {
      const emailCheck = validateEmail(formData.email);
      if (!emailCheck.isValid) {
        setError(emailCheck.error || 'Invalid email address');
        return;
      }
    }

    setSaving(true);

    try {
      const payload: Record<string, any> = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        roll_number: formData.roll_number.trim() || null,
        employee_id: formData.employee_id.trim() || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        address: formData.address.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        department: formData.department.trim() || null,
        program_designation: formData.program_designation.trim() || null,
        designation: formData.program_designation.trim() || null,
        supervisor: formData.supervisor.trim() || null,
        joining_date: formData.joining_date || null,
        project_name: formData.project_name.trim() || null,
        project_code: formData.project_code.trim() || null,
        project_start_date: formData.project_start_date || null,
        project_end_date: formData.project_end_date || null,
        project_tenure: formData.project_tenure.trim() || null,
        staff_contract_start_date: formData.staff_contract_start_date || null,
        staff_contract_end_date: formData.staff_contract_end_date || null,
        contract_tenure: formData.contract_tenure.trim() || null,
        project_role_responsibility: formData.project_role_responsibility.trim() || null,
        project_pi_coordinator: formData.project_pi_coordinator.trim() || null,
        reporting_manager: formData.reporting_manager.trim() || null,
        current_status: formData.current_status.trim() || null,
        contract_status: formData.contract_status.trim() || null,
        remarks_staff: formData.remarks_staff.trim() || null,
        remarks_manager: formData.remarks_manager.trim() || null,
      };

      const { data, error: apiError } = await api.put(`/api/users/${currentUser.id}`, payload);

      if (apiError) {
        throw new Error(
          typeof apiError === 'string'
            ? apiError
            : (apiError as any).message || 'Failed to update user profile'
        );
      }

      const updatedUser: UserProfile = {
        ...currentUser,
        ...data,
      };

      setCurrentUser(updatedUser);
      setIsEditing(false);
      setSuccessMessage('User information has been updated successfully!');
      onUserUpdated?.(updatedUser);
    } catch (err: any) {
      console.error('Failed to update user profile:', err);
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base sm:text-lg shrink-0">
              {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-gray-900 flex flex-wrap items-center gap-1 sm:gap-2">
                <span className="truncate">{currentUser.full_name}</span>
                <span
                  className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-medium ${
                    currentUser.user_role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {currentUser.user_role === 'admin' ? 'Admin' : 'User'}
                </span>
                <span
                  className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-medium ${
                    currentUser.is_active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {currentUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {currentUser.email || 'No email registered'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition"
                title="Edit user information"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Info</span>
              </button>
            )}
            {canEdit && isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition p-1.5 hover:bg-gray-100 rounded-lg"
              disabled={saving}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications / Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {isEditing ? (
            /* ================= EDIT MODE FORM ================= */
            <form id="edit-user-form" onSubmit={handleSave} className="space-y-4 sm:space-y-6">
              {/* Primary Profile Attributes */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 sm:p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Profile Identity</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => handleFieldChange('full_name', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="e.g. member@kgpian.iitkgp.ac.in"
                    />
                  </div>
                </div>
              </div>

              {/* 1. Basic Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-700" />
                  <span>Basic Information</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Roll Number</label>
                    <input
                      type="text"
                      value={formData.roll_number}
                      onChange={(e) => handleFieldChange('roll_number', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
                    <input
                      type="text"
                      value={formData.employee_id}
                      onChange={(e) => handleFieldChange('employee_id', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleFieldChange('gender', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Contact Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-700" />
                  <span>Contact Information</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Phone (10-digit Indian Contact Number)
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 9876543210 or +91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Residential Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Contact Name</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={(e) => handleFieldChange('emergency_contact_name', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => handleFieldChange('emergency_contact_phone', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Employment Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-700" />
                  <span>Employment Information</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => handleFieldChange('department', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Program / Designation</label>
                    <input
                      type="text"
                      value={formData.program_designation}
                      onChange={(e) => handleFieldChange('program_designation', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Supervisor</label>
                    <input
                      type="text"
                      value={formData.supervisor}
                      onChange={(e) => handleFieldChange('supervisor', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Joining Date</label>
                    <input
                      type="date"
                      value={formData.joining_date}
                      onChange={(e) => handleFieldChange('joining_date', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Project & Contract Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Project & Contract Details</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={formData.project_name}
                      onChange={(e) => handleFieldChange('project_name', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Multi Level AI based Anaemia screening technology"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project Code</label>
                    <input
                      type="text"
                      value={formData.project_code}
                      onChange={(e) => handleFieldChange('project_code', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. SRIC/HGS_SC/2026/AUG/928"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project PI / Coordinator</label>
                    <input
                      type="text"
                      value={formData.project_pi_coordinator}
                      onChange={(e) => handleFieldChange('project_pi_coordinator', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project Start Date</label>
                    <input
                      type="date"
                      value={formData.project_start_date}
                      onChange={(e) => handleFieldChange('project_start_date', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project End Date</label>
                    <input
                      type="date"
                      value={formData.project_end_date}
                      onChange={(e) => handleFieldChange('project_end_date', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project Tenure</label>
                    <input
                      type="text"
                      value={formData.project_tenure}
                      onChange={(e) => handleFieldChange('project_tenure', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 1 Year, 6 Months, 89 Days"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reporting Manager</label>
                    <input
                      type="text"
                      value={formData.reporting_manager}
                      onChange={(e) => handleFieldChange('reporting_manager', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Project Role / Responsibility</label>
                    <textarea
                      rows={2}
                      value={formData.project_role_responsibility}
                      onChange={(e) => handleFieldChange('project_role_responsibility', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Key roles, responsibilities, or research scope..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Staff Contract Start Date</label>
                    <input
                      type="date"
                      value={formData.staff_contract_start_date}
                      onChange={(e) => handleFieldChange('staff_contract_start_date', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Staff Contract End Date</label>
                    <input
                      type="date"
                      value={formData.staff_contract_end_date}
                      onChange={(e) => handleFieldChange('staff_contract_end_date', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contract Tenure</label>
                    <input
                      type="text"
                      value={formData.contract_tenure}
                      onChange={(e) => handleFieldChange('contract_tenure', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 89 Days, 1 Year"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Current Status</label>
                    <input
                      type="text"
                      value={formData.current_status}
                      onChange={(e) => handleFieldChange('current_status', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Active, On Leave, Under Renewal Process_89 Days"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contract Status</label>
                    <input
                      type="text"
                      value={formData.contract_status}
                      onChange={(e) => handleFieldChange('contract_status', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Active, Under Renewal Process_89 Days, Completed"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks (Staff)</label>
                    <textarea
                      rows={2}
                      value={formData.remarks_staff}
                      onChange={(e) => handleFieldChange('remarks_staff', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks (Manager)</label>
                    <textarea
                      rows={2}
                      value={formData.remarks_manager}
                      onChange={(e) => handleFieldChange('remarks_manager', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* ================= VIEW MODE DISPLAY ================= */
            <>
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-600" />
                    <span>Basic Information</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Roll Number</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.roll_number || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Employee ID</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.employee_id || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Date of Birth</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatDate(currentUser.date_of_birth)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Gender</p>
                    <p className="text-sm font-semibold text-gray-900 capitalize mt-0.5">
                      {currentUser.gender?.replace('_', ' ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <span>Contact Information</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Phone</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.phone || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Email</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.email || 'N/A'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Address</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.address || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Emergency Contact</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.emergency_contact_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Emergency Phone</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.emergency_contact_phone || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Employment Information */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-600" />
                  <span>Employment Information</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Department</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.department || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Program / Designation</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.program_designation || currentUser.designation || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Supervisor</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.supervisor || currentUser.reporting_manager || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Joining Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatDate(currentUser.joining_date)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Project & Contract Details */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Project & Contract Details</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Project Name</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.project_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Project Code</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5 font-mono">
                      {currentUser.project_code || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Project PI / Coordinator</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.project_pi_coordinator || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Project Start Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatDate(currentUser.project_start_date || null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Project End Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatDate(currentUser.project_end_date || null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Project Tenure</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.project_tenure || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Reporting Manager</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.reporting_manager || currentUser.supervisor || 'N/A'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-gray-500">Project Role / Responsibility</p>
                    <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">
                      {currentUser.project_role_responsibility || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Staff Contract Start Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatDate(currentUser.staff_contract_start_date || null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Staff Contract End Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {formatDate(currentUser.staff_contract_end_date || null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Contract Tenure</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {currentUser.contract_tenure || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Current Status</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {currentUser.current_status || 'Active'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Contract Status</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {currentUser.contract_status || 'Active'}
                    </span>
                  </div>
                  {currentUser.remarks_staff && (
                    <div className="md:col-span-2 bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500">Remarks (Staff)</p>
                      <p className="text-xs text-gray-800 mt-0.5 whitespace-pre-wrap">
                        {currentUser.remarks_staff}
                      </p>
                    </div>
                  )}
                  {currentUser.remarks_manager && (
                    <div className="md:col-span-2 bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500">Remarks (Manager)</p>
                      <p className="text-xs text-gray-800 mt-0.5 whitespace-pre-wrap">
                        {currentUser.remarks_manager}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Skills & Expertise */}
              {skills.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm"
                      >
                        <p className="font-medium text-xs text-gray-900">{skill.skill_name}</p>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-medium ${getLevelColor(
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
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Software Proficiency</h3>
                  <div className="flex flex-wrap gap-2">
                    {software.map((sw) => (
                      <div
                        key={sw.id}
                        className="bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm"
                      >
                        <p className="font-medium text-xs text-gray-900">{sw.software_name}</p>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-medium ${getLevelColor(
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
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Equipment Experience</h3>
                  <div className="flex flex-wrap gap-2">
                    {equipment.map((eq) => (
                      <div
                        key={eq.id}
                        className="bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm"
                      >
                        <p className="font-medium text-xs text-gray-900">{eq.equipment_name}</p>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-medium ${getLevelColor(
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
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Process Experience</h3>
                  <div className="flex flex-wrap gap-2">
                    {processes.map((proc) => (
                      <div
                        key={proc.id}
                        className="bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm"
                      >
                        <p className="font-medium text-xs text-gray-900">{proc.process_name}</p>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-medium ${getLevelColor(
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
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          {isEditing ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">
                Editing personal & project information
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-user-form"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit User Details</span>
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-700 text-xs font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
