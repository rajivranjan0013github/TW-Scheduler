import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { loginWithEmail } = useAuth();
  const [showReviewerLogin, setShowReviewerLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] selection:bg-[#8a3ff2] selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-white hover:opacity-90 transition">
              ThousandPost
            </span>
          </Link>
        </div>
      </header>

      {/* Main Centered Login Section */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
        {/* Ambient background lights */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-purple-600/15 blur-[140px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-indigo-600/10 blur-[100px]" />

        <div className="relative w-full max-w-md">
          {/* Card Container */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121216]/90 p-8 shadow-2xl shadow-black/80 backdrop-blur-2xl sm:p-10">
            {/* Subtle top accent line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />

            {/* Header */}
            <div className="text-center">
              <h1 className="m-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Sign in to ThousandPost
              </h1>
              <p className="m-0 mt-2 text-sm text-zinc-400">
                Continue with your connected account to access your workspace.
              </p>
            </div>

            {/* Login Buttons & Form */}
            <div className="mt-8 space-y-4">
              {/* Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-zinc-900 shadow-md shadow-white/5 transition hover:bg-zinc-100 active:scale-[0.99]"
              >
                <span className="grid h-6 w-6 place-items-center">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
                <span>Continue with Google</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/10" />
                <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  or
                </span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              {/* Reviewer / Email Credentials Form */}
              {!showReviewerLogin ? (
                <button
                  type="button"
                  onClick={() => setShowReviewerLogin(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  <span>Sign in with Email / Reviewer Credentials</span>
                </button>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-3 pt-1">
                  {error && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1 text-left">
                    <label className="text-[11px] font-semibold text-zinc-400">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[11px] font-semibold text-zinc-400">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-purple-900/30 transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing In…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In with Credentials</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>

                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowReviewerLogin(false)}
                      className="text-[11px] text-zinc-400 hover:text-white transition underline"
                    >
                      Hide reviewer credentials
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Terms and Privacy Policy */}
            <p className="m-0 mt-8 text-center text-xs leading-relaxed text-zinc-500">
              By continuing, you agree to our{' '}
              <Link to="/terms-and-conditions" className="font-semibold text-zinc-300 underline hover:text-white transition">
                Terms
              </Link>
              {', '}
              <Link to="/privacy-policy" className="font-semibold text-zinc-300 underline hover:text-white transition">
                Privacy Policy
              </Link>
              {', and '}
              <Link to="/data-deletion" className="font-semibold text-zinc-300 underline hover:text-white transition">
                Data Deletion
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
