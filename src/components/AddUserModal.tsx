import { useState, FormEvent, useEffect } from 'react';
import { X, Copy, CheckCircle, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import type { Role } from '../lib/types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

interface UserFormData {
  email: string;
  full_name: string;
  phone: string;
  user_role: 'admin' | 'user';
  role_id: string;
}

export default function AddUserModal({ isOpen, onClose, onUserAdded }: AddUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdUserEmail, setCreatedUserEmail] = useState('');
  const [createdPassword, setCreatedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    full_name: '',
    phone: '',
    user_role: 'user',
    role_id: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  const fetchRoles = async () => {
    setLoadingRoles(true);
    const { data, error } = await api.get('/api/admin/roles', { order: 'name' });

    if (data && data.length > 0) {
      // Admin accounts can't be created directly from this form — an admin who needs to grant
      // another user Admin access can promote them afterwards from Settings > Roles & Permissions.
      const selectableRoles = data.filter((r: Role) => r.name.toLowerCase() !== 'admin');
      setRoles(selectableRoles);
      const userRole = selectableRoles.find((r: Role) => r.name === 'User');
      if (userRole) {
        setFormData(prev => ({ ...prev, role_id: userRole.id }));
      } else if (selectableRoles.length > 0) {
        setFormData(prev => ({ ...prev, role_id: selectableRoles[0].id }));
      }
    } else if (error) {
      setError('Failed to load roles. Please try again.');
    }
    setLoadingRoles(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.role_id) {
      setError('Please select a role for the user');
      return;
    }

    setLoading(true);

    try {
      const { data: result, error: createError } = await api.post('/api/admin/users', {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        user_role: formData.user_role,
        role_id: formData.role_id,
      });

      if (createError) {
        throw new Error(typeof createError === 'string' ? createError : (createError as any).message || 'Failed to create user');
      }

      setCreatedUserEmail(formData.email);
      setCreatedPassword(result.password || '');
      setEmailSent(result.email_sent || false);
      setEmailError(result.email_error || '');
      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Full error:', err);
      let errorMessage = 'Failed to create user';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      const userRole = roles.find((r) => r.name === 'User');
      setFormData({
        email: '',
        full_name: '',
        phone: '',
        user_role: 'user',
        role_id: userRole?.id || '',
      });
      setError('');
      setSuccess(false);
      setCreatedUserEmail('');
      setCreatedPassword('');
      setCopied(false);
      setEmailSent(false);
      setEmailError('');
      onClose();
      if (success) {
        onUserAdded();
      }
    }
  };

  if (!isOpen) return null;

  if (success) {
    const handleCopy = () => {
      navigator.clipboard.writeText(`Email: ${createdUserEmail}\nPassword: ${createdPassword}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">User Created Successfully</h2>
            {emailSent ? (
              <p className="text-gray-600">Login credentials have been sent to the user's email</p>
            ) : (
              <p className="text-gray-600">Please share the login credentials with the user</p>
            )}
          </div>

          {!emailSent && emailError && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong className="font-semibold">Email Not Sent:</strong> {emailError}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Please copy and send the credentials manually to the user.
                  </p>
                </div>
              </div>
            </div>
          )}

          {emailSent && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    <strong className="font-semibold">Email Sent Successfully!</strong> The user will receive their credentials at {createdUserEmail}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    You can still copy the credentials below as a backup.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Login Credentials</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                <p className="text-sm text-gray-900 font-mono break-all">{createdUserEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Password</p>
                <p className="text-sm text-gray-900 font-mono bg-white px-3 py-1.5 rounded border border-gray-200">{createdPassword}</p>
              </div>
            </div>
          </div>

          {!emailSent && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-6">
              <p className="text-xs text-amber-800">
                <strong>Important:</strong> Make sure to copy and share these credentials securely with the user. The password will not be shown again after closing this dialog.
              </p>
            </div>
          )}

          {emailSent && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-6">
              <p className="text-xs text-blue-800">
                The credentials are shown here for your reference. The user has already received them via email.
              </p>
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Add New User</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold mb-1">Error creating user</p>
              <p className="text-sm whitespace-pre-line">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-sm text-blue-900">
              A secure password will be generated and sent to the user's email. They can log in immediately and change their password later from their profile page.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Role <span className="text-red-500">*</span>
              </label>
              {loadingRoles ? (
                <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  Loading roles...
                </div>
              ) : roles.length === 0 ? (
                <div className="w-full px-4 py-2 border border-red-300 rounded-lg bg-red-50 text-red-700">
                  No roles available. Please contact the system administrator.
                </div>
              ) : (
                <select
                  required
                  value={formData.role_id}
                  onChange={(e) => {
                    const selectedRole = roles.find(r => r.id === e.target.value);
                    setFormData({
                      ...formData,
                      role_id: e.target.value,
                      user_role: selectedRole?.name === 'Admin' ? 'admin' : 'user'
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                      {role.description && ` - ${role.description}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mt-6">
            <p className="text-sm text-gray-600">
              The user can complete additional profile details (roll number, department, supervisor, etc.) after accepting the invitation and logging in.
            </p>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingRoles || roles.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Creating User...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
