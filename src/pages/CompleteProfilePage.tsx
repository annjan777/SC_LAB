import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  UserCheck,
  Briefcase,
  Calendar,
  Clock,
  ShieldCheck,
  FileText,
  Building2,
  CheckCircle2,
  LogOut,
  Sparkles,
  AlertCircle,
  Phone
} from 'lucide-react';
import { calculateTenure } from '../utils/tenureUtils';
import { extractIndianPhone } from '../utils/userValidation';

export default function CompleteProfilePage() {
  const { user, profile, reloadProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    designation: '',
    project_name: '',
    project_code: '',
    project_start_date: '',
    project_end_date: '',
    project_tenure: '',
    staff_contract_start_date: '',
    staff_contract_end_date: '',
    contract_tenure: '',
    project_role_responsibility: '',
    project_pi_coordinator: '',
    reporting_manager: '',
    current_status: '',
    contract_status: '',
    remarks_staff: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Populate initial state from profile (which includes bulk imported data)
  useEffect(() => {
    if (profile) {
      const initialProjectTenure = profile.project_tenure ||
        calculateTenure(profile.project_start_date, profile.project_end_date);
      const initialContractTenure = profile.contract_tenure ||
        calculateTenure(profile.staff_contract_start_date, profile.staff_contract_end_date);

      setFormData({
        full_name: (profile.full_name && profile.full_name !== 'New User') ? profile.full_name : '',
        phone: profile.phone || '',
        designation: profile.designation || profile.program_designation || '',
        project_name: profile.project_name || '',
        project_code: profile.project_code || '',
        project_start_date: profile.project_start_date ? profile.project_start_date.split('T')[0] : '',
        project_end_date: profile.project_end_date ? profile.project_end_date.split('T')[0] : '',
        project_tenure: initialProjectTenure || '',
        staff_contract_start_date: profile.staff_contract_start_date ? profile.staff_contract_start_date.split('T')[0] : '',
        staff_contract_end_date: profile.staff_contract_end_date ? profile.staff_contract_end_date.split('T')[0] : '',
        contract_tenure: initialContractTenure || '',
        project_role_responsibility: profile.project_role_responsibility || '',
        project_pi_coordinator: profile.project_pi_coordinator || '',
        reporting_manager: profile.reporting_manager || profile.supervisor || '',
        current_status: profile.current_status || '',
        contract_status: profile.contract_status || '',
        remarks_staff: profile.remarks_staff || '',
      });
    }
  }, [profile]);

  // Real-time project tenure auto-calc helper
  const handleProjectDateChange = (field: 'project_start_date' | 'project_end_date', value: string) => {
    const updated = { ...formData, [field]: value };
    const calculated = calculateTenure(updated.project_start_date, updated.project_end_date);
    if (calculated) {
      updated.project_tenure = calculated;
    }
    setFormData(updated);
  };

  // Real-time contract tenure auto-calc helper
  const handleContractDateChange = (field: 'staff_contract_start_date' | 'staff_contract_end_date', value: string) => {
    const updated = { ...formData, [field]: value };
    const calculated = calculateTenure(updated.staff_contract_start_date, updated.staff_contract_end_date);
    if (calculated) {
      updated.contract_tenure = calculated;
    }
    setFormData(updated);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const phoneCheck = extractIndianPhone(formData.phone, true);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.error || 'Please enter a valid 10-digit Indian phone number.');
      return;
    }

    const requiredChecks: { val: string; name: string }[] = [
      { val: formData.full_name, name: 'Full Name' },
      { val: formData.phone, name: 'Phone Number' },
      { val: formData.designation, name: 'Designation' },
      { val: formData.reporting_manager, name: 'Reporting Manager' },
      { val: formData.project_pi_coordinator, name: 'Project PI / Coordinator' },
      { val: formData.project_name, name: 'Project Name' },
      { val: formData.project_code, name: 'Project Code' },
      { val: formData.project_start_date, name: 'Project Start Date' },
      { val: formData.project_end_date, name: 'Project End Date' },
      { val: formData.project_tenure, name: 'Project Tenure' },
      { val: formData.project_role_responsibility, name: 'Project Role / Responsibility' },
      { val: formData.staff_contract_start_date, name: 'Staff Contract Start Date' },
      { val: formData.staff_contract_end_date, name: 'Staff Contract End Date' },
      { val: formData.contract_tenure, name: 'Contract Tenure' },
      { val: formData.current_status, name: 'Current Status' },
      { val: formData.contract_status, name: 'Contract Status' },
      { val: formData.remarks_staff, name: 'Remarks (Staff)' },
    ];

    const missing = requiredChecks.filter(item => !item.val || !item.val.toString().trim());
    if (missing.length > 0) {
      setError(`All fields are mandatory. Please fill in: ${missing.map(m => m.name).join(', ')}.`);
      return;
    }

    setLoading(true);

    try {
      if (!user?.id) {
        throw new Error('User session not found. Please refresh and try again.');
      }

      const payload = {
        full_name: formData.full_name.trim(),
        phone: phoneCheck.phone,
        designation: formData.designation.trim() || null,
        program_designation: formData.designation.trim() || null,
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
        supervisor: formData.reporting_manager.trim() || null,
        current_status: formData.current_status || 'Active',
        contract_status: formData.contract_status || 'Active',
        remarks_staff: formData.remarks_staff.trim() || null,
        is_profile_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await api.put(`/api/users/${user.id}`, payload);
      if (updateError) throw updateError;

      await reloadProfile();
      setSuccess(true);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1000);
    } catch (err: any) {
      console.error('Profile completion error:', err);
      setError(err.message || 'Failed to save profile details. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-200 mb-8">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="SC Lab Logo" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-wide">SC Lab Portal</h1>
              <p className="text-xs text-gray-500">Profile Setup & Verification</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-200 transition"
            title="Log out and complete later"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Welcome Banner */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 mb-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-32 h-32 text-blue-100" />
          </div>
          <div className="relative z-10 flex items-start space-x-4">
            <div className="p-3 bg-white border border-blue-200 rounded-xl text-blue-600 shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to SC Lab!</h2>
              <p className="text-gray-600 text-sm leading-relaxed max-w-2xl">
                Please verify and complete your project and employment details below.
                <strong className="text-gray-900"> All fields are mandatory</strong> before proceeding to your dashboard.
                If your details were pre-loaded during registration or bulk import, they appear pre-filled for your verification.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-5 py-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-5 py-4 rounded-xl mb-6">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Profile confirmed successfully! Redirecting to your dashboard...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Basic & Role Info */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-gray-100">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Basic & Designation Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Designation <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Project Associate, Researcher, JRF"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reporting Manager <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.reporting_manager}
                  onChange={(e) => setFormData({ ...formData, reporting_manager: e.target.value })}
                  placeholder="e.g. Dr. John Doe"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project PI / Coordinator <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_pi_coordinator}
                  onChange={(e) => setFormData({ ...formData, project_pi_coordinator: e.target.value })}
                  placeholder="e.g. Prof. Jane Smith"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Project Information */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-gray-100">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Project Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g. AI-Driven Smart Materials Lab"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_code}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  placeholder="e.g. PRJ-2026-081"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Start Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.project_start_date}
                  onChange={(e) => handleProjectDateChange('project_start_date', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project End Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.project_end_date}
                  onChange={(e) => handleProjectDateChange('project_end_date', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Tenure <span className="text-rose-400">*</span>
                  <span className="text-xs text-gray-500 ml-2 font-normal">(Auto-calculated from dates, or editable)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_tenure}
                  onChange={(e) => setFormData({ ...formData, project_tenure: e.target.value })}
                  placeholder="e.g. 2 Years, 1 Year 6 Months"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Role / Responsibility <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_role_responsibility}
                  onChange={(e) => setFormData({ ...formData, project_role_responsibility: e.target.value })}
                  placeholder="e.g. Lead Developer, Hardware Testing, Synthesis & Characterization"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Staff & Contract Information */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-gray-100">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">Staff Contract & Status Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Contract Start Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.staff_contract_start_date}
                  onChange={(e) => handleContractDateChange('staff_contract_start_date', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Contract End Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.staff_contract_end_date}
                  onChange={(e) => handleContractDateChange('staff_contract_end_date', e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Tenure <span className="text-rose-400">*</span>
                  <span className="text-xs text-gray-500 ml-2 font-normal">(Auto-calculated from dates, or editable)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.contract_tenure}
                  onChange={(e) => setFormData({ ...formData, contract_tenure: e.target.value })}
                  placeholder="e.g. 1 Year, 6 Months"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Status <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={formData.current_status}
                  onChange={(e) => setFormData({ ...formData, current_status: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="">-- Select Current Status --</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Relieved">Relieved</option>
                  <option value="Completed">Completed</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Status <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={formData.contract_status}
                  onChange={(e) => setFormData({ ...formData, contract_status: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="">-- Select Contract Status --</option>
                  <option value="Active">Active</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Renewed">Renewed</option>
                  <option value="Expired">Expired</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks (Staff) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.remarks_staff}
                  onChange={(e) => setFormData({ ...formData, remarks_staff: e.target.value })}
                  placeholder="Additional remarks or notes (mandatory)..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Form Submit Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 pb-12">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium px-8 py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{loading ? 'Saving Profile...' : 'Confirm & Complete Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
