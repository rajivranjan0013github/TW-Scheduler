import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Film,
  CalendarPlus,
  Users,
  Layers,
  Zap,
  Check,
  Megaphone,
  CheckCircle2,
  TrendingUp,
  X,
  BarChart3,
} from 'lucide-react';
import PlatformIcon from '../components/PlatformIcon';

const BrandMark = ({ compact = false }) => (
  <div className="flex items-center gap-3">
    <span className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#8a3ff2] to-[#6320be] text-white shadow-[0_0_20px_rgba(120,49,214,0.35)]`}>
      <Sparkles className="h-4 w-4" strokeWidth={2.5} />
    </span>
    <div>
      <p className="m-0 text-base font-bold tracking-tight text-white">EasyPost</p>
      {!compact && (
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
          UGC Campaign Platform
        </p>
      )}
    </div>
  </div>
);

const platforms = [
  { id: 'instagram', name: 'Instagram', label: 'Reels & Stories' },
  { id: 'youtube', name: 'YouTube', label: 'Shorts' },
  { id: 'facebook', name: 'Facebook', label: 'Pages & Reels' },
];

const features = [
  {
    icon: Users,
    title: 'Hire & Coordinate Real Creators',
    description: 'Recruit authentic UGC creators and account handlers. Assign 30-day deliverables, set posting guidelines, and track verified live post links.',
    badge: 'Creator Hiring & Roster',
  },
  {
    icon: Layers,
    title: 'Manage 100+ Accounts at Once',
    description: 'Connect brand channels and creator profiles from a single dashboard. No logging in and out, sharing passwords, or getting rate-limited.',
    badge: '100+ Account Scale',
  },
  {
    icon: Zap,
    title: '30 Days Content in 30 Sec',
    description: 'Paste your product URL or brief. EasyPost automatically generates 30 days of viral video hooks, captions, and 9:16 creative variations in seconds.',
    badge: 'Instant Bulk AI Engine',
  },
  {
    icon: BarChart3,
    title: 'Full Campaign Analytics',
    description: 'Monitor live total views, engagement, top-performing creators, and verified post URLs across Instagram, YouTube, and Facebook.',
    badge: 'Real-Time ROI Tracking',
  },
];

const workflowSteps = [
  {
    step: '01',
    title: 'Create 30 Days of Content in 30 Sec',
    text: 'Input product details, App Store links, or briefs. The engine instantly crafts 30 unique video angles, hooks, and 9:16 vertical creative drafts.',
  },
  {
    step: '02',
    title: 'Hire Creators & Deploy to 100+ Accounts',
    text: 'Assign deliverables across your network of hired creators and brand channels. Paced queues schedule posts automatically across all platforms.',
  },
  {
    step: '03',
    title: 'Track Full Analytics & Verified Live Posts',
    text: 'Watch views roll in in real time. Verify live post URLs, measure creator performance rankings, and scale winning creative angles.',
  },
];

export const Home = () => {
  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#8a3ff2] selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark />

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-xs font-semibold text-zinc-400 transition hover:text-white">
              Features
            </a>
            <a href="#analytics" className="text-xs font-semibold text-zinc-400 transition hover:text-white">
              Analytics
            </a>
            <a href="#comparison" className="text-xs font-semibold text-zinc-400 transition hover:text-white">
              Why EasyPost
            </a>
            <a href="#workflow" className="text-xs font-semibold text-zinc-400 transition hover:text-white">
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Sign In
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8a3ff2] to-[#6d24cf] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(138,63,242,0.35)] transition hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Free Trial
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="space-y-24 py-12 sm:space-y-32 sm:py-20">
        {/* Hero Section */}
        <section className="relative px-4 text-center sm:px-6 lg:px-8">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[380px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8a3ff2]/20 blur-[130px]" />

          <div className="mx-auto max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300">
              <Megaphone className="h-3.5 w-3.5 text-purple-400" />
              <span>All-In-One UGC Campaign Management</span>
            </div>

            <h1 className="m-0 text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl sm:leading-[1.08]">
              Hire real creators.{' '}
              <span className="block mt-1 bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#8a3ff2] bg-clip-text text-transparent">
                Manage 100+ accounts. Get full analytics.
              </span>
            </h1>

            <p className="mx-auto m-0 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
              The end-to-end UGC platform for brands and agencies. Generate 30 days of viral content in 30 seconds, coordinate real creator poster teams, orchestrate 100+ social accounts simultaneously, and track live campaign view analytics in real time.
            </p>

            {/* Fast Stats Pill Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/15 px-3 py-1.5 text-xs font-bold text-purple-200">
                🤝 Hire Real Creators
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200">
                🌐 Manage 100+ Accounts at Once
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200">
                ⚡ 30 Days Content in 30 Sec
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/15 px-3 py-1.5 text-xs font-bold text-purple-200">
                📊 Full Campaign Analytics
              </span>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 pt-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a3ff2] to-[#6d24cf] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-900/40 transition hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              >
                Launch UGC Campaign
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] hover:text-white sm:w-auto"
              >
                Explore Features
              </a>
            </div>

            {/* Social Platform Badges */}
            <div className="pt-6">
              <p className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Publish and track UGC across Instagram, YouTube Shorts, and Facebook
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {platforms.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 transition hover:border-white/20"
                  >
                    <PlatformIcon platform={p.id} className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium text-zinc-200">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>


        {/* Core Features Grid */}
        <section id="features" className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Complete UGC Campaign Stack
              </span>
              <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Hire, manage 100+ accounts, and measure ROI
              </h2>
              <p className="m-0 text-sm text-zinc-400 max-w-xl mx-auto">
                Everything brands and agencies need to scale short-form video operations from one workspace.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-200 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-white/[0.05]"
                  >
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-300 mb-5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                        {feature.badge}
                      </span>
                      <h3 className="m-0 mt-2 text-base font-bold text-white">
                        {feature.title}
                      </h3>
                      <p className="m-0 mt-2 text-xs leading-relaxed text-zinc-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dedicated Analytics Section */}
        <section id="analytics" className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-3xl border border-purple-500/20 bg-gradient-to-b from-[#14121e] to-[#0c0a14] p-8 sm:p-12 space-y-8">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Real-Time Campaign Intelligence
              </span>
              <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Full analytics on every creator, post, and view
              </h2>
              <p className="m-0 text-sm leading-relaxed text-zinc-400">
                Stop wondering whether creators actually posted. EasyPost automatically pulls live performance metrics and verified post URLs across all platforms.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Verified Post URLs
                </div>
                <h3 className="m-0 text-base font-bold text-white">Proof of Delivery</h3>
                <p className="m-0 text-xs text-zinc-400 leading-relaxed">
                  Automatic link verification confirms every video is live on Instagram, YouTube, or Facebook before creator payout.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  Daily View Velocity
                </div>
                <h3 className="m-0 text-base font-bold text-white">Views & Engagement</h3>
                <p className="m-0 text-xs text-zinc-400 leading-relaxed">
                  Real-time tracking of lifetime views, daily watch surges, like-to-view ratios, and comment velocity across 100+ accounts.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <BarChart3 className="h-4 w-4 text-purple-400" />
                  Creator Leaderboards
                </div>
                <h3 className="m-0 text-base font-bold text-white">Performance Ranking</h3>
                <p className="m-0 text-xs text-zinc-400 leading-relaxed">
                  Identify top-performing creator posters instantly so you can double down on winning creative angles and high-ROI channels.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section (Old Way vs EasyPost) */}
        <section id="comparison" className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                The Scale Difference
              </span>
              <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Stop doing UGC manually. Run it on autopilot.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Old Way */}
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="m-0 text-lg font-bold text-rose-300">The Old Manual Way</h3>
                  <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">Slow & Chaotic</span>
                </div>
                <ul className="m-0 p-0 space-y-3 list-none text-xs text-zinc-400">
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>Spend 20+ hours writing individual hooks and scripts each month</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>Constantly logging in and out of 10+ accounts or getting account banned</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>Messy Google Drive folders, missing files, and broken links</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>No analytics: manually messaging creators on WhatsApp asking for view screenshots</span>
                  </li>
                </ul>
              </div>

              {/* With EasyPost */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="m-0 text-lg font-bold text-emerald-300">With EasyPost</h3>
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">30 Sec Setup</span>
                </div>
                <ul className="m-0 p-0 space-y-3 list-none text-xs text-zinc-200">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Generate 30 days of unique video hooks and creative in 30 seconds</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Hire real creators and manage 100+ accounts at once from a single dashboard</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>In-browser 9:16 timeline studio with automatic subtitle overlays</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Full campaign analytics with live view counts and verified post links</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Simple Workflow */}
        <section id="workflow" className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                The Scale Workflow
              </span>
              <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                From brief to 100+ live accounts with full analytics
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {workflowSteps.map((s) => (
                <div
                  key={s.step}
                  className="relative rounded-2xl border border-white/10 bg-[#121216] p-6 space-y-4"
                >
                  <span className="text-3xl font-black text-purple-400/30">
                    {s.step}
                  </span>
                  <h3 className="m-0 text-lg font-bold text-white">
                    {s.title}
                  </h3>
                  <p className="m-0 text-xs leading-relaxed text-zinc-400">
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dual Roles Section (Brands vs Creators) */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
                <Megaphone className="h-5 w-5" />
              </div>
              <h3 className="m-0 text-xl font-bold text-white">For Brands & Agencies</h3>
              <p className="m-0 text-xs leading-relaxed text-zinc-400">
                Hire real creators, generate 30 days of UGC hooks in 30 seconds, manage 100+ accounts, and monitor full analytics without extra headcount.
              </p>
              <ul className="m-0 p-0 space-y-2 list-none text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400" />
                  Hire & assign vetted UGC creators
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400" />
                  Simultaneous 100+ account orchestration
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400" />
                  Live analytics, view tracking, & proof of post
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="m-0 text-xl font-bold text-white">For Creators & Posters</h3>
              <p className="m-0 text-xs leading-relaxed text-zinc-400">
                Get hired by top brands. Connect your Instagram, YouTube, and Facebook accounts to receive pre-edited 9:16 videos and schedule deliverables.
              </p>
              <ul className="m-0 p-0 space-y-2 list-none text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400" />
                  Direct access to paid brand campaigns
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400" />
                  Pre-edited, ready-to-publish 9:16 videos
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400" />
                  Clear schedule calendars & delivery tracking
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Final Call to Action Card */}
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#1c122c] to-[#0e0917] p-8 text-center sm:p-14 shadow-2xl shadow-purple-950/40">
            <div className="relative mx-auto max-w-2xl space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                <Sparkles className="h-3.5 w-3.5" />
                Hire Creators · Manage 100+ Accounts · Full Analytics
              </span>

              <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                Ready to scale your UGC campaigns?
              </h2>

              <p className="m-0 text-sm leading-relaxed text-purple-200/80">
                Join brands, agencies, and creator networks running high-volume UGC distribution with complete analytics and proof of delivery.
              </p>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="btn-white-solid inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold shadow-[0_10px_35px_rgba(255,255,255,0.2)] transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Start with EasyPost</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] text-purple-300/70">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Manage 100+ accounts
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Live analytics & verified post URLs
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070709] pt-16 pb-12 text-zinc-400">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 pb-12 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand Column */}
            <div className="space-y-4 sm:col-span-2">
              <BrandMark />
              <p className="m-0 max-w-sm text-xs leading-relaxed text-zinc-400">
                The all-in-one platform for high-volume UGC campaigns. Hire real creators, create 30 days of content in 30 seconds, and manage 100+ accounts with real-time analytics.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  All Systems Operational
                </span>
              </div>
            </div>

            {/* Product Column */}
            <div className="space-y-3">
              <p className="m-0 text-xs font-bold uppercase tracking-wider text-white">Product</p>
              <ul className="m-0 p-0 space-y-2 list-none text-xs">
                <li>
                  <a href="#features" className="text-zinc-400 transition hover:text-white">
                    UGC Features
                  </a>
                </li>
                <li>
                  <a href="#analytics" className="text-zinc-400 transition hover:text-white">
                    Campaign Analytics
                  </a>
                </li>
                <li>
                  <a href="#comparison" className="text-zinc-400 transition hover:text-white">
                    Why EasyPost
                  </a>
                </li>
                <li>
                  <a href="#workflow" className="text-zinc-400 transition hover:text-white">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>

            {/* Supported Networks Column */}
            <div className="space-y-3">
              <p className="m-0 text-xs font-bold uppercase tracking-wider text-white">Platforms</p>
              <ul className="m-0 p-0 space-y-2 list-none text-xs">
                <li className="flex items-center gap-2 text-zinc-400">
                  <PlatformIcon platform="instagram" className="h-3.5 w-3.5" />
                  <span>Instagram Reels</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-400">
                  <PlatformIcon platform="youtube" className="h-3.5 w-3.5" />
                  <span>YouTube Shorts</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-400">
                  <PlatformIcon platform="facebook" className="h-3.5 w-3.5" />
                  <span>Facebook Pages</span>
                </li>
              </ul>
            </div>

            {/* Legal & Account Column */}
            <div className="space-y-3">
              <p className="m-0 text-xs font-bold uppercase tracking-wider text-white">Legal & Account</p>
              <ul className="m-0 p-0 space-y-2 list-none text-xs">
                <li>
                  <Link to="/privacy-policy" className="text-zinc-400 transition hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms-and-conditions" className="text-zinc-400 transition hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/data-deletion" className="text-zinc-400 transition hover:text-white">
                    Data Deletion
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-zinc-400 transition hover:text-white">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-zinc-400">
              © 2026 EasyPost Technologies. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span>Hire Creators</span>
              <span>•</span>
              <span>100+ Accounts</span>
              <span>•</span>
              <span>Full Analytics</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
