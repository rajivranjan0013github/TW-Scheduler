import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  Layers3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const previewPosts = [
  { network: 'Instagram', title: 'Summer look reel', time: '09:30', status: 'Ready' },
  { network: 'Facebook', title: 'Launch reminder', time: '13:45', status: 'Queued' },
  { network: 'Instagram', title: 'Behind the scenes', time: '18:00', status: 'Draft' },
];

const metrics = [
  { label: 'Reach', value: '24.8K', icon: TrendingUp },
  { label: 'Posts', value: '38', icon: CalendarClock },
  { label: 'Media', value: '412', icon: Camera },
];

const features = [
  {
    icon: CalendarClock,
    title: 'Plan every channel',
    text: 'Schedule posts, reels, and campaign drops from one focused calendar.',
  },
  {
    icon: Layers3,
    title: 'Keep assets organized',
    text: 'Store approved creative, captions, and media in a clean publishing workspace.',
  },
  {
    icon: TrendingUp,
    title: 'Track performance',
    text: 'Analyze reach and audience growth across channels from a single overview.',
  },
];

export const Home = () => (
  <div className="h-screen overflow-y-auto bg-[#0c0c0e] text-white font-sans selection:bg-white selection:text-black">
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0c0c0e]/80 backdrop-blur-xl px-5 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="m-0 text-base font-bold tracking-tight text-white">EasyPost</p>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Social publishing hub</p>
          </div>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-[10px] bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 shadow-sm"
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden bg-[#0c0c0e]">
        {/* Subtle radial glow background */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full" />
        
        <div className="relative mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl grid-cols-1 items-center gap-10 px-5 py-12 lg:grid-cols-[0.94fr_1.06fr] lg:py-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              <ShieldCheck className="h-3.5 w-3.5 text-white" />
              Built for creators and lean teams
            </div>

            <h1 className="m-0 max-w-2xl text-[44px] font-black leading-[1.02] tracking-tight text-white sm:text-[58px] lg:text-[70px]">
              EasyPost
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
              A calm command center to connect publishing channels, schedule content, and track performance without losing the thread.
            </p>

            <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-4 shadow-2xl backdrop-blur-xl sm:inline-flex sm:items-center sm:gap-5">
              <div className="mb-4 sm:mb-0">
                <p className="m-0 text-sm font-bold text-white">Enter your workspace</p>
                <p className="m-0 mt-1 text-xs text-zinc-400">Sign in to continue to EasyPost.</p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-[10px] bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 shadow-sm"
              >
                Open login
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#c4b5fd]" />
                Instagram scheduling
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#c4b5fd]" />
                Facebook Pages
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#c4b5fd]" />
                Comment inbox
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 shadow-2xl">
              <div className="rounded-xl border border-white/10 bg-black">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#0a0a0a]">
                  <div>
                    <p className="m-0 text-sm font-bold text-white">Publishing overview</p>
                    <p className="m-0 mt-0.5 text-[11px] text-zinc-400">Today across connected channels</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
                      <metric.icon className="h-4 w-4 text-[#c4b5fd]" />
                      <p className="m-0 mt-4 text-2xl font-bold tracking-tight text-white">{metric.value}</p>
                      <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{metric.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
                    <div className="flex items-center justify-between">
                      <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Queue</p>
                      <CalendarClock className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {previewPosts.map((post) => (
                        <div key={post.title} className="flex items-center justify-between gap-3 rounded-lg bg-black border border-white/10 p-3 transition hover:bg-white/[0.04]">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                              {post.network === 'Instagram' ? (
                                <Camera className="h-4 w-4 text-[#c4b5fd]" />
                              ) : (
                                <span className="text-sm font-bold text-[#c4b5fd]">f</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="m-0 truncate text-sm font-semibold text-white">{post.title}</p>
                              <p className="m-0 mt-0.5 text-[11px] text-zinc-400">{post.network} at {post.time}</p>
                            </div>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            post.status === 'Ready'
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                              : post.status === 'Queued'
                              ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                          }`}>
                            {post.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Reach trend</p>
                      <TrendingUp className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="mt-5 flex h-44 items-end gap-2">
                      {[36, 54, 48, 72, 62, 88, 96].map((height, index) => (
                        <div key={height} className="flex flex-1 flex-col items-center gap-2">
                          <div
                            className="w-full rounded-t-md bg-white"
                            style={{ height: `${height}%`, opacity: 0.25 + index * 0.1 }}
                          />
                          <span className="text-[10px] text-zinc-400 font-medium">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] bg-[#0c0c0e] px-5 py-12">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-6 transition hover:border-white/20 hover:bg-white/[0.04]">
              <feature.icon className="h-5 w-5 text-white" />
              <h2 className="m-0 mt-5 text-base font-bold text-white">{feature.title}</h2>
              <p className="m-0 mt-2 text-sm leading-6 text-zinc-400">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>

    <footer className="border-t border-white/[0.08] bg-[#0c0c0e] px-5 py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="m-0 text-base font-bold tracking-tight text-white">EasyPost</p>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Social publishing hub</p>
            </div>
          </div>
          <p className="m-0 mt-5 max-w-md text-sm leading-6 text-zinc-400">
            Plan, publish, and review social content from one steady workspace built for creators and lean teams.
          </p>
        </div>

        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Platform</p>
          <div className="mt-4 grid gap-2 text-sm text-zinc-400">
            <Link to="/login" className="transition hover:text-white">Connect accounts</Link>
            <Link to="/login" className="transition hover:text-white">Schedule posts</Link>
            <Link to="/login" className="transition hover:text-white">Comment inbox</Link>
          </div>
        </div>

        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Workspace</p>
          <div className="mt-4 grid gap-2 text-sm text-zinc-400">
            <Link to="/login" className="transition hover:text-white">Google sign in</Link>
            <Link to="/login" className="transition hover:text-white">Media library</Link>
            <Link to="/login" className="transition hover:text-white">Performance insights</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0">
          © 2026 EasyPost. All rights reserved. This product is powered by{' '}
          <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline text-zinc-400 hover:text-white">
            thousandway to make
          </a>.
        </p>
        <div className="flex gap-4">
          <Link to="/privacy-policy" className="transition text-zinc-400 hover:text-white">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="transition text-zinc-400 hover:text-white">Terms</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default Home;

