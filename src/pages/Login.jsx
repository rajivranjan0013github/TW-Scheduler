import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const { login } = useAuth();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const success = await login(null, tokenResponse.access_token);
      if (!success) {
        alert('Workspace authentication failed. Please verify database connection or credentials.');
      }
    },
    onError: () => {
      alert('Google Authentication Failed');
    },
  });

  const handleFacebookLogin = () => {
    const appId = import.meta.env.VITE_META_APP_ID;
    if (!appId) {
      alert('Set VITE_META_APP_ID in tw-frontend/.env to enable Facebook login.');
      return;
    }

    const rawRedirectUri = `${window.location.origin}/auth/facebook-login/callback`;
    sessionStorage.setItem('facebook_login_redirect_uri', rawRedirectUri);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: rawRedirectUri,
      scope: 'pages_show_list',
      response_type: 'code',
      auth_type: 'rerequest',
    });

    window.location.href = `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans">
      <header className="border-b border-[#d2d2d7] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3478f6]">
            <ArrowLeft className="h-4 w-4" />
            EasyPost
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[#3478f6]" />
            Secure login
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-66px)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#5e9cff] bg-white text-[#3478f6] shadow-[0_8px_24px_rgba(52,120,246,0.18)]">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="m-0 mt-6 text-3xl font-semibold tracking-tight text-[#1d1d1f]">Sign in to EasyPost</h1>
            <p className="m-0 mt-2 text-sm leading-6 text-[#6e6e73]">
              Access your publishing calendar, connected channels, media library, and insights.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-[#d2d2d7] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#e5e5ea] pb-4">
              <LockKeyhole className="h-4 w-4 text-[#6e6e73]" />
              <p className="m-0 text-sm font-semibold text-[#1d1d1f]">Workspace authentication</p>
            </div>

            <button
              onClick={() => handleGoogleLogin()}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-[#d2d2d7] bg-white px-4 py-3 text-sm font-semibold text-[#1d1d1f] shadow-sm transition hover:bg-[#f5f5f7]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.77z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.24A7.18 7.18 0 0 1 5 12c0-.79.13-1.57.38-2.34V6.51H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.39l4.06-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.51l4.06 3.15c.95-2.85 3.6-4.91 6.73-4.91z"
                />
              </svg>
              Sign in with Google
            </button>

            <button
              onClick={handleFacebookLogin}
              className="mt-3 flex w-full items-center justify-center gap-3 rounded-lg border border-[#1877f2] bg-[#1877f2] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166fe5]"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1877f2]">f</span>
              Sign in with Facebook
            </button>

            <p className="m-0 mt-4 text-center text-xs leading-5 text-[#6e6e73]">
              By signing in, you agree to the{' '}
              <Link to="/terms-and-conditions" className="font-semibold text-[#3478f6]">Terms</Link>
              {' '}and{' '}
              <Link to="/privacy-policy" className="font-semibold text-[#3478f6]">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
