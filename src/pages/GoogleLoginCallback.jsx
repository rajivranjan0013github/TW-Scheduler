import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const GoogleLoginCallback = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Google sign in...');
  const handledRef = useRef(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    if (handledRef.current) return;
    handledRef.current = true;

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
  }, [user, login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06040a] px-6 text-center text-white">
      <div className="rounded-2xl border border-white/10 bg-[#121118] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        <p className="m-0 text-sm font-semibold text-zinc-300">{message}</p>
      </div>
    </div>
  );
};

export default GoogleLoginCallback;
