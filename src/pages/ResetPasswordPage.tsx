import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, setToken } from '../lib/api';
import { Lock, CheckCircle, X, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      console.log('=== RESET PASSWORD PAGE: Checking session ===');
      // Extract token from URL query params (e.g., ?token=xxx)
      const searchParams = new URLSearchParams(location.search);
      const token = searchParams.get('token');

      if (token) {
        // Store the reset token so subsequent API calls are authorized
        setToken(token);
      }

      // Verify the token is valid by calling verifyResetToken
      const { data, error: sessionError } = await authApi.verifyResetToken();

      if (sessionError || !data) {
        console.error('Session error:', sessionError);
        setError('Your password reset link may have expired. Please request a new one.');
        setToken(null);
        setIsCheckingSession(false);
        return;
      }

      console.log('Valid session confirmed - ready for password reset');
      setIsCheckingSession(false);
    };

    checkSession();
  }, [location.search]);

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
  const canSubmit = allRequirementsMet && passwordsMatch && !loading && !isCheckingSession;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canSubmit) {
      setError('Please meet all password requirements and ensure passwords match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await authApi.changePassword(newPassword);

      if (updateError) {
        throw updateError;
      }

      // Clear the reset token
      setToken(null);

      navigate('/login', {
        state: { message: 'Password reset successfully! Please log in with your new password.' }
      });
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Reset Password</h1>
          <p className="text-center text-gray-600 mb-8">
            Create a new password for your account
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
              {error.includes('expired') && (
                <button
                  onClick={() => navigate('/login')}
                  className="block w-full mt-3 text-center text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Go back to login and request a new reset link
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  disabled={loading || !!error}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading || !!error}
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
                  disabled={loading || !!error}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading || !!error}
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
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
