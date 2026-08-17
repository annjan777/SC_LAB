import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, api } from '../lib/api';
import { Lock, CheckCircle, X, Eye, EyeOff, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, profile, reloadProfile, signOut } = useAuth();

  const isFirstTimeLogin = profile?.require_password_change === true;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
    { label: 'Contains uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { label: 'Contains lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { label: 'Contains number', test: (pwd: string) => /[0-9]/.test(pwd) },
    { label: 'Contains special character', test: (pwd: string) => /[!@#$%^&*]/.test(pwd) },
  ];

  const getPasswordStrength = () => {
    const passedRequirements = passwordRequirements.filter((req) => req.test(newPassword)).length;
    if (passedRequirements <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' };
    if (passedRequirements <= 4) return { label: 'Medium', color: 'bg-yellow-500', width: '66%' };
    return { label: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  const allRequirementsMet = passwordRequirements.every((req) => req.test(newPassword));
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== '';
  const canSubmit = allRequirementsMet && passwordsMatch && !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canSubmit) {
      setError('Please meet all password requirements and ensure passwords match');
      return;
    }

    setLoading(true);

    try {
      if (!user?.id) {
        throw new Error('You must be logged in to change your password. Please refresh and try again.');
      }

      const userId = user.id;
      console.log('Starting password change for user:', userId);

      console.log('Step 1: Changing password via API...');
      const { error: updateError } = await authApi.changePassword(
        newPassword,
        isFirstTimeLogin ? undefined : currentPassword
      );

      if (updateError) {
        console.error('API password change failed:', updateError);
        throw updateError;
      }

      console.log('Step 2: Updating profile flag...');
      await api.put('/api/users/' + userId, {
        require_password_change: false,
        last_password_changed_at: new Date().toISOString(),
      });

      console.log('Step 3: Password updated successfully!');
      await reloadProfile();

      console.log('Step 4: Signing out and redirecting to login...');
      await signOut();

      await new Promise(resolve => setTimeout(resolve, 300));
      const message = isFirstTimeLogin
        ? 'Password set successfully! Please log in with your new password.'
        : 'Password changed successfully. Please log in with your new password.';
      navigate('/login', { state: { message } });
    } catch (err: any) {
      console.error('Password change error:', err);
      setError(err.message || 'Failed to update password');
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1"></div>
            <div className="bg-blue-600 p-3 rounded-xl">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            {isFirstTimeLogin ? 'Set Your Password' : 'Change Password'}
          </h1>
          <p className="text-center text-gray-600 mb-8">
            {isFirstTimeLogin
              ? 'Welcome! Please create a secure password for your account'
              : 'Update your password to keep your account secure'
            }
          </p>

          {isFirstTimeLogin && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
              <p className="text-sm text-amber-900">
                This is your first login. You must create a password before accessing the system.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isFirstTimeLogin && (
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Enter current password"
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
            )}

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {newPassword && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Password Strength</span>
                    <span className={`text-xs font-medium ${
                      strength.label === 'Weak' ? 'text-red-600' :
                      strength.label === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: strength.width }}
                    />
                  </div>
                </div>
              )}
            </div>

            {newPassword && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Password Requirements:</p>
                <ul className="space-y-2">
                  {passwordRequirements.map((req, index) => {
                    const passed = req.test(newPassword);
                    return (
                      <li key={index} className="flex items-center text-sm">
                        {passed ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        )}
                        <span className={passed ? 'text-green-700' : 'text-gray-600'}>
                          {req.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {confirmPassword && (
                <div className="mt-2">
                  {passwordsMatch ? (
                    <div className="flex items-center text-sm text-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Passwords match
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-red-600">
                      <X className="w-4 h-4 mr-2" />
                      Passwords do not match
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? isFirstTimeLogin ? 'Setting Password...' : 'Updating Password...'
                : isFirstTimeLogin ? 'Set Password' : 'Change Password'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
