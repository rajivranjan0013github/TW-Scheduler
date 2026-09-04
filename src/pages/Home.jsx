import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Film,
  Users,
  Zap,
  Check,
  Megaphone,
  CheckCircle2,
  BarChart3,
  Smartphone,
  Send,
} from 'lucide-react';
import PlatformIcon from '../components/PlatformIcon';

const BrandMark = () => (
  <Link to="/" className="inline-flex items-center">
    <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
      ThousandPost
    </span>
  </Link>
);

const platforms = [
  { id: 'instagram', label: 'Instagram Reels' },
  { id: 'youtube', label: 'YouTube Shorts' },
  { id: 'facebook', label: 'Facebook Pages & Reels' },
];

export const Home = () => {
  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#8a3ff2] selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark />

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#workflow" className="text-xs font-semibold text-zinc-400 transition hover:text-white">
              How It Works
            </a>
            <a href="#roles" className="text-xs font-semibold text-zinc-400 transition hover:text-white">
              For Brands & Creators
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
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="space-y-20 py-12 sm:space-y-28 sm:py-16">
        {/* Hero Section */}
        <section className="relative px-4 text-center sm:px-6 lg:px-8">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[340px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8a3ff2]/20 blur-[120px]" />

          <div className="mx-auto max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300">
              <Megaphone className="h-3.5 w-3.5 text-purple-400" />
              <span>All-In-One UGC Campaign Management</span>
            </div>

            <h1 className="m-0 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.1]">
              Hire real creators.{' '}
              <span className="block mt-1 bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#8a3ff2] bg-clip-text text-transparent">
                Manage 100+ accounts. Get full analytics.
              </span>
            </h1>

            <p className="mx-auto m-0 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
              The end-to-end platform for brands and agencies to generate 30 days of viral short-form video ads in 30 seconds, coordinate creator poster teams, and track live campaign view analytics in real time.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a3ff2] to-[#6d24cf] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-900/40 transition hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              >
                Launch UGC Campaign
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] hover:text-white sm:w-auto"
              >
                See How It Works
              </a>
            </div>

            {/* Social Platform Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              {platforms.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 transition hover:border-white/20"
                >
                  <PlatformIcon platform={p.id} className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium text-zinc-300">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Visual Wire Pipeline Diagram (How It Works) */}
        <section id="workflow" className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="text-center space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-purple-300">
                <Sparkles className="h-3.5 w-3.5" />
                Live Circuit Architecture
              </span>
              <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                How Content Flows Through the Pipeline
              </h2>
              <p className="m-0 text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                Follow the live wire from raw product URL to 30 bulk-rendered videos, paced distribution across 100+ accounts, and unified analytics.
              </p>
            </div>

            {/* Circuit Canvas Box */}
            <div className="relative rounded-3xl border border-white/10 bg-[#0a0914] p-5 sm:p-8 shadow-2xl overflow-hidden">
              {/* Background ambient lighting & grid */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#8a3ff2_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
              <div className="pointer-events-none absolute -top-20 left-1/2 -z-0 h-60 w-[500px] -translate-x-1/2 rounded-full bg-purple-600/15 blur-[120px]" />

              {/* DESKTOP WIRE DIAGRAM (lg:block) */}
              <div className="relative z-10 hidden lg:block">
                <svg className="w-full h-auto" viewBox="0 0 1200 370" fill="none">
                  <defs>
                    {/* Glowing Cable Filters */}
                    <filter id="glowFilter" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Gradients for Wires */}
                    <linearGradient id="wireGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#c084fc" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>

                    <linearGradient id="wireGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>

                    <linearGradient id="wireGradTop" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>

                    <linearGradient id="wireGradBottom" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>

                    <linearGradient id="wireGradMergeTop" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>

                    <linearGradient id="wireGradMergeBottom" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>

                  {/* BASE WIRES (Inactive cables) */}
                  <path d="M 190 185 H 240" stroke="#251c3d" strokeWidth="4" />
                  <path d="M 430 185 H 480" stroke="#251c3d" strokeWidth="4" />
                  <path d="M 670 185 C 700 185, 715 95, 735 95" stroke="#251c3d" strokeWidth="4" />
                  <path d="M 670 185 C 700 185, 715 275, 735 275" stroke="#251c3d" strokeWidth="4" />
                  <path d="M 945 95 C 965 95, 975 185, 995 185" stroke="#251c3d" strokeWidth="4" />
                  <path d="M 945 275 C 965 275, 975 185, 995 185" stroke="#251c3d" strokeWidth="4" />

                  {/* ACTIVE GLOWING WIRES */}
                  {/* Wire 1: Admin -> Hire Creators */}
                  <path d="M 190 185 H 240" stroke="url(#wireGrad1)" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glowFilter)" />

                  {/* Wire 2: Hire Creators -> AI Studio */}
                  <path d="M 430 185 H 480" stroke="url(#wireGrad2)" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glowFilter)" />

                  {/* Wire 3A: Studio -> Route A */}
                  <path d="M 670 185 C 700 185, 715 95, 735 95" stroke="url(#wireGradTop)" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glowFilter)" />

                  {/* Wire 3B: Studio -> Route B */}
                  <path d="M 670 185 C 700 185, 715 275, 735 275" stroke="url(#wireGradBottom)" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glowFilter)" />

                  {/* Wire 4A: Route A -> Analytics */}
                  <path d="M 945 95 C 965 95, 975 185, 995 185" stroke="url(#wireGradMergeTop)" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glowFilter)" />

                  {/* Wire 4B: Route B -> Analytics */}
                  <path d="M 945 275 C 965 275, 975 185, 995 185" stroke="url(#wireGradMergeBottom)" strokeWidth="2.5" strokeDasharray="6 4" filter="url(#glowFilter)" />

                  {/* ANIMATED PULSING PHOTONS */}
                  <circle r="4" fill="#c084fc" filter="url(#glowFilter)">
                    <animateMotion path="M 190 185 H 240" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle r="4" fill="#38bdf8" filter="url(#glowFilter)">
                    <animateMotion path="M 430 185 H 480" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle r="4" fill="#f59e0b" filter="url(#glowFilter)">
                    <animateMotion path="M 670 185 C 700 185, 715 95, 735 95" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle r="4" fill="#10b981" filter="url(#glowFilter)">
                    <animateMotion path="M 670 185 C 700 185, 715 275, 735 275" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle r="4" fill="#ec4899" filter="url(#glowFilter)">
                    <animateMotion path="M 945 95 C 965 95, 975 185, 995 185" dur="2.2s" repeatCount="indefinite" />
                  </circle>
                  <circle r="4" fill="#ec4899" filter="url(#glowFilter)">
                    <animateMotion path="M 945 275 C 965 275, 975 185, 995 185" dur="2.2s" repeatCount="indefinite" />
                  </circle>

                  {/* CONNECTION SOCKETS */}
                  <circle cx="190" cy="185" r="5" fill="#a855f7" stroke="#120c24" strokeWidth="2" />
                  <circle cx="240" cy="185" r="5" fill="#a855f7" stroke="#120c24" strokeWidth="2" />
                  <circle cx="430" cy="185" r="5" fill="#38bdf8" stroke="#120c24" strokeWidth="2" />
                  <circle cx="480" cy="185" r="5" fill="#38bdf8" stroke="#120c24" strokeWidth="2" />
                  <circle cx="670" cy="185" r="5" fill="#38bdf8" stroke="#120c24" strokeWidth="2" />
                  <circle cx="735" cy="95" r="5" fill="#f59e0b" stroke="#120c24" strokeWidth="2" />
                  <circle cx="735" cy="275" r="5" fill="#10b981" stroke="#120c24" strokeWidth="2" />
                  <circle cx="945" cy="95" r="5" fill="#f59e0b" stroke="#120c24" strokeWidth="2" />
                  <circle cx="945" cy="275" r="5" fill="#10b981" stroke="#120c24" strokeWidth="2" />
                  <circle cx="995" cy="185" r="5" fill="#ec4899" stroke="#120c24" strokeWidth="2" />

                  {/* WIRE DATA LABELS */}
                  <g transform="translate(195, 160)">
                    <rect width="40" height="16" rx="8" fill="#1a142e" stroke="#8a3ff2" strokeWidth="0.8" />
                    <text x="20" y="11" fill="#c084fc" fontSize="8" fontWeight="bold" textAnchor="middle">Brief</text>
                  </g>
                  <g transform="translate(435, 160)">
                    <rect width="42" height="16" rx="8" fill="#141c2e" stroke="#38bdf8" strokeWidth="0.8" />
                    <text x="21" y="11" fill="#7dd3fc" fontSize="8" fontWeight="bold" textAnchor="middle">Clips</text>
                  </g>
                  <g transform="translate(680, 125)">
                    <rect width="50" height="16" rx="8" fill="#261b12" stroke="#f59e0b" strokeWidth="0.8" />
                    <text x="25" y="11" fill="#fbbf24" fontSize="8" fontWeight="bold" textAnchor="middle">API Queue</text>
                  </g>
                  <g transform="translate(675, 230)">
                    <rect width="55" height="16" rx="8" fill="#10261e" stroke="#10b981" strokeWidth="0.8" />
                    <text x="27" y="11" fill="#34d399" fontSize="8" fontWeight="bold" textAnchor="middle">Creator App</text>
                  </g>
                  <g transform="translate(950, 172)">
                    <rect width="42" height="16" rx="8" fill="#2b1226" stroke="#ec4899" strokeWidth="0.8" />
                    <text x="21" y="11" fill="#f472b6" fontSize="8" fontWeight="bold" textAnchor="middle">Sync</text>
                  </g>

                  {/* HTML CARDS VIA FOREIGNOBJECT */}

                  {/* Station 1: Admin Setup */}
                  <foreignObject x="10" y="110" width="180" height="150">
                    <div className="h-full rounded-2xl border border-purple-500/30 bg-[#120d22] p-3.5 flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wide">01 · Admin Setup</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                            <Megaphone className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <h4 className="m-0 text-xs font-bold text-white leading-tight">Product URL Brief</h4>
                        <p className="m-0 mt-1 text-[10px] text-zinc-400 leading-tight">
                          Paste store link to generate 30 viral hooks & angles.
                        </p>
                      </div>
                      <div className="rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[9px] text-purple-300 font-semibold">
                        Input Strategy
                      </div>
                    </div>
                  </foreignObject>

                  {/* Station 2: Hire Real Creators */}
                  <foreignObject x="240" y="110" width="190" height="150">
                    <div className="h-full rounded-2xl border border-fuchsia-500/30 bg-[#190d22] p-3.5 flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-wide">02 · Creator Roster</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-300">
                            <Users className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <h4 className="m-0 text-xs font-bold text-white leading-tight">Hire Real Creators</h4>
                        <p className="m-0 mt-1 text-[10px] text-zinc-400 leading-tight">
                          Recruit vetted creators, assign handles & deliverables.
                        </p>
                      </div>
                      <div className="rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 px-1.5 py-0.5 text-[9px] text-fuchsia-300 font-semibold">
                        🤝 Creator Network
                      </div>
                    </div>
                  </foreignObject>

                  {/* Station 3: AI Bulk Studio */}
                  <foreignObject x="480" y="110" width="190" height="150">
                    <div className="h-full rounded-2xl border border-blue-500/30 bg-[#0d1627] p-3.5 flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">03 · Studio Engine</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                            <Film className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <h4 className="m-0 text-xs font-bold text-white leading-tight">AI Bulk Video Studio</h4>
                        <p className="m-0 mt-1 text-[10px] text-zinc-400 leading-tight">
                          Pairs hook + demo splitscreen & burns subtitles.
                        </p>
                      </div>
                      <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-300 font-semibold">
                        ⚡ 30+ 9:16 Ads Rendered
                      </div>
                    </div>
                  </foreignObject>

                  {/* Station 4A: Route A (API Auto-Publish) */}
                  <foreignObject x="735" y="35" width="210" height="120">
                    <div className="h-full rounded-2xl border border-amber-500/30 bg-[#1f170f] p-3 flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wide">Route A · Direct API</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                            <Send className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <h4 className="m-0 text-xs font-bold text-white leading-tight">Admin Auto-Publish</h4>
                        <p className="m-0 mt-0.5 text-[10px] text-zinc-400 leading-tight">
                          Admin posts directly to creator channels once joined.
                        </p>
                      </div>
                      <span className="text-[9px] font-semibold text-amber-300">⚡ Hands-Free Queue</span>
                    </div>
                  </foreignObject>

                  {/* Station 4B: Route B (Creator Mobile PWA) */}
                  <foreignObject x="735" y="215" width="210" height="120">
                    <div className="h-full rounded-2xl border border-emerald-500/30 bg-[#0d1e17] p-3 flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wide">Route B · Creator Posting</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                            <Smartphone className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <h4 className="m-0 text-xs font-bold text-white leading-tight">Creator Manual Posting</h4>
                        <p className="m-0 mt-0.5 text-[10px] text-zinc-400 leading-tight">
                          Creator 1-tap downloads video & posts with 6h cooldown.
                        </p>
                      </div>
                      <span className="text-[9px] font-semibold text-emerald-300">⏳ Anti-Spam Pacing</span>
                    </div>
                  </foreignObject>

                  {/* Station 5: Unified Live Analytics */}
                  <foreignObject x="995" y="110" width="195" height="150">
                    <div className="h-full rounded-2xl border border-fuchsia-500/30 bg-[#210d1e] p-3.5 flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-wide">05 · Live Hub</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-300">
                            <BarChart3 className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <h4 className="m-0 text-xs font-bold text-white leading-tight">Live Analytics & Proof of Post</h4>
                        <p className="m-0 mt-1 text-[10px] text-zinc-400 leading-tight">
                          FeedSync verifies live post URLs & tracks views in real time.
                        </p>
                      </div>
                      <div className="rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 px-1.5 py-0.5 text-[9px] text-fuchsia-300 font-semibold">
                        📊 Proof of Delivery
                      </div>
                    </div>
                  </foreignObject>

                </svg>
              </div>

              {/* MOBILE & TABLET CIRCUIT DIAGRAM (lg:hidden) */}
              <div className="relative z-10 lg:hidden space-y-6">
                {/* Vertical Cable Line */}
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-purple-500 via-fuchsia-500 via-blue-500 to-emerald-500" />

                {/* Mobile Step 1 */}
                <div className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-[19px] top-4 h-3 w-3 rounded-full bg-purple-400 ring-4 ring-purple-500/30 shadow-[0_0_10px_#a855f7]" />
                  <div className="w-full rounded-2xl border border-purple-500/30 bg-[#120d22] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wide">01 · Admin Setup</span>
                      <Megaphone className="h-4 w-4 text-purple-300" />
                    </div>
                    <h4 className="m-0 text-sm font-bold text-white">Campaign Brief & AI Hooks</h4>
                    <p className="m-0 mt-1 text-xs text-zinc-300 leading-relaxed">
                      Paste product URL to automatically generate 30 viral hooks and creative angles.
                    </p>
                  </div>
                </div>

                {/* Mobile Step 2 */}
                <div className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-[19px] top-4 h-3 w-3 rounded-full bg-fuchsia-400 ring-4 ring-fuchsia-500/30 shadow-[0_0_10px_#d946ef]" />
                  <div className="w-full rounded-2xl border border-fuchsia-500/30 bg-[#190d22] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wide">02 · Creator Roster</span>
                      <Users className="h-4 w-4 text-fuchsia-300" />
                    </div>
                    <h4 className="m-0 text-sm font-bold text-white">Hire Real Creators</h4>
                    <p className="m-0 mt-1 text-xs text-zinc-300 leading-relaxed">
                      Recruit authentic UGC creators, assign target social channels, and set 30-day deliverables.
                    </p>
                  </div>
                </div>

                {/* Mobile Step 3 */}
                <div className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-[19px] top-4 h-3 w-3 rounded-full bg-blue-400 ring-4 ring-blue-500/30 shadow-[0_0_10px_#38bdf8]" />
                  <div className="w-full rounded-2xl border border-blue-500/30 bg-[#0d1627] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wide">03 · Studio Engine</span>
                      <Film className="h-4 w-4 text-blue-300" />
                    </div>
                    <h4 className="m-0 text-sm font-bold text-white">AI Bulk Video Studio</h4>
                    <p className="m-0 mt-1 text-xs text-zinc-300 leading-relaxed">
                      Pairs creator hook + app demo splitscreen, burns subtitles, and outputs 30 ready-to-post 9:16 videos.
                    </p>
                  </div>
                </div>

                {/* Mobile Step 4 (Fork) */}
                <div className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-[19px] top-4 h-3 w-3 rounded-full bg-amber-400 ring-4 ring-amber-500/30 shadow-[0_0_10px_#f59e0b]" />
                  <div className="w-full space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                      04 · Paced Multi-Account Distribution
                    </span>
                    {/* 4A */}
                    <div className="rounded-2xl border border-amber-500/30 bg-[#1f170f] p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-300">Route A · Admin Auto-Publish via API</span>
                        <Send className="h-3.5 w-3.5 text-amber-300" />
                      </div>
                      <p className="m-0 text-xs text-zinc-300">
                        Admin schedules and auto-posts directly to creator channels once they join & connect accounts.
                      </p>
                    </div>
                    {/* 4B */}
                    <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1e17] p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-300">Route B · Creator Manual Posting App</span>
                        <Smartphone className="h-3.5 w-3.5 text-emerald-300" />
                      </div>
                      <p className="m-0 text-xs text-zinc-300">
                        For manual distribution: creators 1-tap download & copy captions with 6-hour anti-spam pacing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Step 5 */}
                <div className="relative flex items-start gap-4 pl-12">
                  <div className="absolute left-[19px] top-4 h-3 w-3 rounded-full bg-fuchsia-400 ring-4 ring-fuchsia-500/30 shadow-[0_0_10px_#ec4899]" />
                  <div className="w-full rounded-2xl border border-fuchsia-500/30 bg-[#210d1e] p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-fuchsia-300 uppercase tracking-wide">05 · Live Hub</span>
                      <BarChart3 className="h-4 w-4 text-fuchsia-300" />
                    </div>
                    <h4 className="m-0 text-sm font-bold text-white">Live Analytics & Verified Proof of Post</h4>
                    <p className="m-0 mt-1 text-xs text-zinc-300 leading-relaxed">
                      FeedSync automatically confirms live URLs and tracks view velocity across all 100+ accounts in real time.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* Dual Roles Section (Brands vs Creators) */}
        <section id="roles" className="px-4 sm:px-6 lg:px-8">
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
                  Auto-publish directly to creator channels once joined
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
                  Connect accounts once—allow admin auto-post or post manually
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
                  <span>Start with ThousandPost</span>
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
      <footer className="border-t border-white/10 bg-[#070709] py-10 text-zinc-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <BrandMark />
            <p className="m-0 text-xs text-zinc-500">
              © 2026 ThousandPost · Managed by{' '}
              <a
                href="https://thethousandways.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-zinc-400 hover:text-white transition"
              >
                Thousand Ways
              </a>
              . All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <a href="#workflow" className="transition hover:text-white">
              How It Works
            </a>
            <a href="#roles" className="transition hover:text-white">
              For Brands & Creators
            </a>
            <Link to="/privacy-policy" className="transition hover:text-white">
              Privacy Policy
            </Link>
            <Link to="/terms-and-conditions" className="transition hover:text-white">
              Terms
            </Link>
            <Link to="/data-deletion" className="transition hover:text-white">
              Data Deletion
            </Link>
            <a href="mailto:admin@thethousandways.com" className="transition hover:text-white">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
