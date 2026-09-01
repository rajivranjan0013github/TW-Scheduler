import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  LockKeyhole,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react';

const LoginFlowPreview = () => (
  <div className="relative mt-10 overflow-hidden rounded-[26px] border border-white/[0.1] bg-[#0d0d0b] p-3 shadow-[0_30px_90px_rgba(0,0,0,.5)]">
    <div className="flex items-center justify-between border-b border-white/[0.08] px-2 pb-3">
      <div>
        <p className="m-0 text-[9px] font-black uppercase tracking-[0.18em] text-[#6f6a64]">Campaign flow</p>
        <p className="m-0 mt-1 text-xs font-bold text-[#ded8cf]">One video. Two ways to publish.</p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#cfc8bd]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f3eee5]" />
        Active
      </span>
    </div>

    <div className="relative mt-3 aspect-[1.8] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#090908]">
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.15) 1px, transparent 1px)',
        backgroundSize: '15px 15px',
      }} />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 520 290" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path d="M137 145 C190 145 192 145 222 145" stroke="#302e2a" strokeWidth="2" />
        <path d="M294 145 C335 145 330 82 365 82" stroke="#302e2a" strokeWidth="2" />
        <path d="M294 145 C335 145 330 208 365 208" stroke="#302e2a" strokeWidth="2" />
        <path className="distribution-flow" d="M137 145 C190 145 192 145 222 145" stroke="#f3eee5" strokeWidth="2.3" strokeLinecap="round" strokeDasharray="6 9" />
        <path className="distribution-flow distribution-flow-delay" d="M294 145 C335 145 330 82 365 82" stroke="#f3eee5" strokeWidth="2.3" strokeLinecap="round" strokeDasharray="6 9" />
        <path className="distribution-flow distribution-flow-delay-long" d="M294 145 C335 145 330 208 365 208" stroke="#bbb5ad" strokeWidth="2.3" strokeLinecap="round" strokeDasharray="6 9" />
      </svg>

      <div className="absolute left-[5%] top-[13%] w-[21%]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-[#d8d2c9] via-[#5c5954] to-[#171715] shadow-[0_12px_35px_rgba(0,0,0,.35)]">
          <div className="absolute -right-4 top-5 h-12 w-12 rounded-full border-[9px] border-white/10" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-white/30 bg-black/30">
              <span className="ml-0.5 block h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-[#f7f3ed]" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-2 pt-8">
            <p className="m-0 text-[5px] font-black uppercase tracking-[0.13em] text-[#d9d3ca]">9:16 video</p>
            <p className="m-0 mt-0.5 text-[7px] font-black text-[#f7f3ed]">Product launch</p>
          </div>
        </div>
      </div>

      <div className="absolute left-[42.5%] top-[36%] w-[15%] text-center">
        <div className="distribution-node-pulse relative grid aspect-square place-items-center rounded-full border border-white/30 bg-[#171715] shadow-[0_0_30px_rgba(244,239,231,.12)]">
          <div className="absolute inset-[10%] rounded-full border border-dashed border-white/20" />
          <Send className="relative h-4 w-4 text-[#e5dfd6]" />
        </div>
        <p className="m-0 mt-1 text-[6px] font-black uppercase tracking-[0.1em] text-[#817b74]">Distribute</p>
      </div>

      <div className="absolute left-[70%] top-[12%] flex w-[26%] items-center gap-2 rounded-xl border border-white/[0.1] bg-[#151513] p-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#f3eee5] text-[#11110f]">
          <UsersRound className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[8px] font-black text-[#ede7df]">Human posters</p>
          <p className="m-0 mt-0.5 text-[6px] text-[#77716b]">12 available</p>
        </div>
      </div>

      <div className="absolute left-[70%] top-[61%] flex w-[26%] items-center gap-2 rounded-xl border border-white/[0.1] bg-[#151513] p-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.12] bg-white/[0.04] text-[#d8d2c9]">
          <CalendarClock className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[8px] font-black text-[#ede7df]">Direct schedule</p>
          <p className="m-0 mt-0.5 text-[6px] text-[#77716b]">8 channels</p>
        </div>
      </div>
    </div>
  </div>
);

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
    <div className="h-screen overflow-y-auto bg-[#080807] text-[#f5f0e8] selection:bg-[#f3eee5] selection:text-[#11110f]">
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

          <Link to="/" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black text-[#8f8982] transition hover:bg-white/[0.04] hover:text-[#f5f0e8]">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden">
        <div className="pointer-events-none absolute left-1/4 top-20 h-[500px] w-[500px] rounded-full bg-[#f3eee5]/[0.025] blur-[130px]" />
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'linear-gradient(to bottom, black, transparent 95%)',
        }} />

        <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-[1280px] items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <section className="hidden max-w-xl lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#aaa39b]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#e5dfd6]" />
              Your workspace is ready
            </div>
            <h1 className="m-0 mt-6 text-[4.5rem] font-black leading-[0.9] tracking-[-0.07em] text-[#f5f0e8]">
              Generate.
              <span className="block text-[#cfc8bd]">Distribute.</span>
            </h1>
            <p className="m-0 mt-6 max-w-lg text-base leading-7 text-[#8f8982]">
              Sign in to create campaign content, work with human posters, and manage direct publishing from one place.
            </p>
            <LoginFlowPreview />
          </section>

          <section className="mx-auto w-full max-w-md lg:justify-self-end">
            <div className="mb-8 text-center lg:hidden">
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#77726c]">Welcome back</p>
              <h1 className="m-0 mt-3 text-4xl font-black tracking-[-0.055em] text-[#f5f0e8]">Generate. Distribute.</h1>
            </div>

            <div className="rounded-[28px] border border-white/[0.1] bg-[#11110f]/95 p-6 shadow-[0_35px_100px_rgba(0,0,0,.52)] backdrop-blur-2xl sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="m-0 text-[9px] font-black uppercase tracking-[0.2em] text-[#77726c]">Secure access</p>
                  <h2 className="m-0 mt-3 text-3xl font-black tracking-[-0.045em] text-[#f5f0e8]">Enter your workspace</h2>
                  <p className="m-0 mt-2 text-sm leading-6 text-[#89837c]">Continue with the account connected to your channels.</p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-[#cfc8bd]">
                  <LockKeyhole className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="group flex w-full items-center justify-between rounded-2xl bg-[#f3eee5] px-4 py-3.5 text-sm font-black text-[#11110f] shadow-[0_14px_35px_rgba(244,239,231,.1)] transition hover:-translate-y-0.5 hover:bg-[#fffdf9]"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-black/10 bg-[#fffdf9] text-xs font-black text-[#11110f]">G</span>
                    Continue with Google
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={handleFacebookLogin}
                  className="group flex w-full items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.035] px-4 py-3.5 text-sm font-black text-[#e8e1d8] transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.12] bg-white/[0.05] text-xs font-black text-[#f3eee5]">f</span>
                    Continue with Facebook
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#8f8982] transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-5">
                <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-[#77716b]" />
                <p className="m-0 text-[10px] leading-5 text-[#716c66]">OAuth sign-in. EasyPost never stores your provider password.</p>
              </div>

              <p className="m-0 mt-5 text-center text-[10px] leading-5 text-[#68635e]">
                By continuing, you agree to the{' '}
                <Link to="/terms-and-conditions" className="font-bold text-[#cfc8bd] transition hover:text-[#fffdf9]">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy-policy" className="font-bold text-[#cfc8bd] transition hover:text-[#fffdf9]">Privacy Policy</Link>.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Login;
