import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const Login = () => {
  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('Set VITE_GOOGLE_CLIENT_ID in tw-frontend/.env to enable Google login.');
      return;
    }

    const rawRedirectUri = `${window.location.origin}/auth/google/callback`;
    sessionStorage.setItem('google_login_redirect_uri', rawRedirectUri);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: rawRedirectUri,
      response_type: 'token',
      scope: 'openid email profile',
      include_granted_scopes: 'true',
      prompt: 'select_account',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

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
    <div className="flex min-h-screen flex-col bg-[#080807] text-[#f5f0e8] selection:bg-[#f3eee5] selection:text-[#11110f]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080807]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 sm:px-8">
          <Link to="/" className="group inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#f3eee5] text-[#11110f] shadow-[0_0_30px_rgba(244,239,231,.14)]">
              <Sparkles className="h-4 w-4" strokeWidth={2.7} />
            </span>
            <div>
              <p className="m-0 text-[15px] font-black tracking-[-0.03em] text-[#f5f0e8]">EasyPost</p>
              <p className="m-0 mt-0.5 text-[8px] font-black uppercase tracking-[0.22em] text-[#77726c]">Generate · Distribute</p>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[11px] font-black text-[#8f8982] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-[#f5f0e8]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      {/* Main Centered Login Section */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
        {/* Ambient background lights */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3eee5]/[0.03] blur-[140px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 80%)',
          }}
        />

        <div className="relative w-full max-w-md">
          {/* Card Container */}
          <div className="rounded-[28px] border border-white/[0.1] bg-[#11110f]/95 p-7 shadow-[0_35px_100px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-9">
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-[#cfc8bd] shadow-inner">
                <LockKeyhole className="h-5 w-5 text-[#f3eee5]" />
              </div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#77726c]">Secure Access</p>
              <h1 className="m-0 mt-2 text-2xl font-black tracking-[-0.04em] text-[#f5f0e8] sm:text-3xl">
                Sign in to EasyPost
              </h1>
              <p className="m-0 mt-2 text-xs leading-5 text-[#89837c]">
                Continue with your connected account to access your workspace.
              </p>
            </div>

            {/* Login Buttons */}
            <div className="mt-8 space-y-3.5">
              {/* Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="group flex w-full items-center justify-between rounded-2xl bg-[#f3eee5] px-4 py-3.5 text-sm font-black text-[#11110f] shadow-[0_14px_35px_rgba(244,239,231,.1)] transition hover:-translate-y-0.5 hover:bg-[#fffdf9]"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white shadow-sm">
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
                  </span>
                  Continue with Google
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* Facebook Login Button */}
              <button
                type="button"
                onClick={handleFacebookLogin}
                className="group flex w-full items-center justify-between rounded-2xl border border-white/[0.12] bg-[#1877f2]/10 px-4 py-3.5 text-sm font-black text-[#e8e1d8] transition hover:-translate-y-0.5 hover:border-[#1877f2]/40 hover:bg-[#1877f2]/20"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1877f2] text-white shadow-sm">
                    <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                  Continue with Facebook
                </span>
                <ArrowRight className="h-4 w-4 text-[#8f8982] transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Security Guarantee Note */}
            <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/[0.08] pt-5 text-center">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#8f8982]" />
              <p className="m-0 text-[11px] leading-5 text-[#716c66]">
                OAuth 2.0 secured · EasyPost never stores your provider password
              </p>
            </div>

            {/* Terms and Privacy Policy */}
            <p className="m-0 mt-4 text-center text-[10px] leading-5 text-[#68635e]">
              By continuing, you agree to our{' '}
              <Link to="/terms-and-conditions" className="font-bold text-[#cfc8bd] transition hover:text-[#fffdf9]">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy-policy" className="font-bold text-[#cfc8bd] transition hover:text-[#fffdf9]">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
