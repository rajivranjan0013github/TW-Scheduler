import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const FacebookLoginCallback = () => {
  const { user, facebookLogin } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Facebook sign in...');
  const handledRef = useRef(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    if (handledRef.current) return;
    handledRef.current = true;

    const finishLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error_description') || params.get('error_message');
      const redirectUri = sessionStorage.getItem('facebook_login_redirect_uri') || `${window.location.origin}/auth/facebook-login/callback`;

      if (error) {
        setMessage(error);
        setTimeout(() => navigate('/login', { replace: true }), 1800);
        return;
      }

      if (!code) {
        setMessage('Facebook did not return a login code.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
        return;
      }

      const success = await facebookLogin(code, redirectUri);
      sessionStorage.removeItem('facebook_login_redirect_uri');

      if (success) {
        navigate('/', { replace: true });
      } else {
        setMessage('Facebook authentication failed. Please try again.');
        setTimeout(() => navigate('/login', { replace: true }), 1800);
      }
    };

    finishLogin();
  }, [user, facebookLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06040a] px-6 text-center text-white">
      <div className="rounded-2xl border border-white/10 bg-[#121118] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#1877f2] border-t-transparent" />
        <p className="m-0 text-sm font-semibold text-zinc-300">{message}</p>
      </div>
    </div>
  );
};

export default FacebookLoginCallback;
