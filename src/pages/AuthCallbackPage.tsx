import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setToken, authApi } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double execution in development mode
    if (hasRun.current) return;
    hasRun.current = true;

    let timeoutId: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const handleAuthCallback = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            console.warn('Auth callback taking too long');
            setError('The authentication process is taking longer than expected. Please try logging in with your credentials.');
          }
        }, 15000); // 15 second timeout

        setStatus('Checking authentication link...');
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        console.log('=== AUTH CALLBACK START ===');
        console.log('Search parameters:', { type, hasToken: !!token });

        if (!token) {
          console.error('Missing token in callback URL');
          setError('Invalid authentication link. Please request a new invitation.');
          return;
        }

        setStatus('Setting up your session...');
        console.log('Setting token from callback...');

        // Store the token in localStorage for subsequent API calls
        setToken(token);

        // Verify the token is valid
        const { data, error: meError } = await authApi.getMe();

        if (meError || !data) {
          console.error('Error verifying token:', meError);
          setToken(null);
          setError('Failed to establish session. The link may have expired. Please request a new invitation.');
          return;
        }

        console.log('Session established for user:', data.user?.id);

        if (isCancelled) return;

        if (type === 'recovery') {
          console.log('Recovery type detected - redirecting to reset password page');
          clearTimeout(timeoutId);
          setStatus('Setting up password reset...');
          navigate(`/reset-password?token=${encodeURIComponent(token)}`, { replace: true });
          return;
        }

        if (type === 'invite' || type === 'signup') {
          console.log(`Type is "${type}" - redirecting to change password`);
          clearTimeout(timeoutId);
          setStatus('Setting up password page...');
          navigate('/change-password', { replace: true });
          return;
        }

        // If we get here, navigate to dashboard
        console.log('Redirecting to dashboard...');
        clearTimeout(timeoutId);
        setStatus('Redirecting to dashboard...');
        navigate('/dashboard', { replace: true });

      } catch (err) {
        if (isCancelled) return;
        console.error('Unexpected error in auth callback:', err);
        setError(`An unexpected error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`);
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    handleAuthCallback();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [location.search, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const searchParams = new URLSearchParams(location.search);
  const isPasswordReset = searchParams.get('type') === 'recovery';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {isPasswordReset ? 'Processing password reset...' : 'Processing your invitation...'}
        </h2>
        <p className="text-gray-600">{status}</p>
        <p className="text-xs text-gray-400 mt-4">Check the console (F12) for detailed logs</p>
      </div>
    </div>
  );
}
