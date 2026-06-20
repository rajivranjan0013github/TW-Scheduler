import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const GoogleLoginCallback = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Google sign in...');

  useEffect(() => {
    const finishLogin = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(window.location.search);
      const accessToken = hashParams.get('access_token');
      const error = hashParams.get('error_description')
        || hashParams.get('error')
        || searchParams.get('error_description')
        || searchParams.get('error');

      if (error) {
        setMessage(error);
        setTimeout(() => navigate('/login', { replace: true }), 1800);
        return;
      }

      if (!accessToken) {
        setMessage('Google did not return an access token.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
        return;
      }

      window.history.replaceState(null, '', '/auth/google/callback');
      const success = await login(null, accessToken);
      sessionStorage.removeItem('google_login_redirect_uri');

      if (success) {
        navigate('/', { replace: true });
      } else {
        setMessage('Google authentication failed. Please try again.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
      }
    };

    finishLogin();
  }, [login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfbfd] px-6 text-center text-[#1d1d1f]">
      <div className="rounded-xl border border-[#d2d2d7] bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#3478f6] border-t-transparent" />
        <p className="m-0 text-sm font-semibold">{message}</p>
      </div>
    </div>
  );
};

export default GoogleLoginCallback;
