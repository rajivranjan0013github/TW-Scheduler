import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const FacebookLoginCallback = () => {
  const { facebookLogin } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Facebook sign in...');

  useEffect(() => {
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
  }, [facebookLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfbfd] px-6 text-center text-[#1d1d1f]">
      <div className="rounded-xl border border-[#d2d2d7] bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#3478f6] border-t-transparent" />
        <p className="m-0 text-sm font-semibold">{message}</p>
      </div>
    </div>
  );
};

export default FacebookLoginCallback;
