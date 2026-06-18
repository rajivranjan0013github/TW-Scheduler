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
  <div className="min-h-screen bg-white text-[#1d1d1f] font-sans">
    <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur px-5 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#5e9cff] bg-white text-[#3478f6] shadow-[0_2px_8px_rgba(52,120,246,0.22)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="m-0 text-base font-semibold tracking-tight text-[#1d1d1f]">EasyPost</p>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Social publishing hub</p>
          </div>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4]"
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden bg-[#fbfbfd]">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,1)_0%,rgba(255,255,255,0.92)_48%,rgba(245,249,255,0.86)_100%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl grid-cols-1 items-center gap-10 px-5 py-12 lg:grid-cols-[0.94fr_1.06fr] lg:py-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d2d2d7] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3478f6]" />
              Built for creators and lean teams
            </div>

            <h1 className="m-0 max-w-2xl text-[44px] font-semibold leading-[1.02] tracking-tight text-[#1d1d1f] sm:text-[58px] lg:text-[70px]">
              EasyPost
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#515154] sm:text-lg">
              A calm command center to connect social accounts, schedule content, and track performance without losing the thread.
            </p>

            <div className="mt-8 rounded-lg border border-[#d2d2d7] bg-white p-4 shadow-sm sm:inline-flex sm:items-center sm:gap-5">
              <div className="mb-4 sm:mb-0">
                <p className="m-0 text-sm font-semibold text-[#1d1d1f]">Enter your workspace</p>
                <p className="m-0 mt-1 text-xs text-[#6e6e73]">Sign in to continue to EasyPost.</p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg bg-[#3478f6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f6fe4]"
              >
                Open login
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#515154]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#3478f6]" />
                Instagram scheduling
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#3478f6]" />
                Facebook Pages
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#3478f6]" />
                Comment inbox
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-xl border border-[#d2d2d7] bg-white p-3 shadow-[0_24px_80px_rgba(29,29,31,0.12)]">
              <div className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]">
                <div className="flex items-center justify-between border-b border-[#e5e5ea] px-4 py-3">
                  <div>
                    <p className="m-0 text-sm font-semibold text-[#1d1d1f]">Publishing overview</p>
                    <p className="m-0 mt-0.5 text-[11px] text-[#6e6e73]">Today across connected channels</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#3478f6] ring-1 ring-[#bfdbff]">
                    <span className="h-2 w-2 rounded-full bg-[#3478f6]" />
                    Live
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-[#e5e5ea] bg-white p-4">
                      <metric.icon className="h-4 w-4 text-[#3478f6]" />
                      <p className="m-0 mt-4 text-2xl font-semibold tracking-tight text-[#1d1d1f]">{metric.value}</p>
                      <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">{metric.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-lg border border-[#e5e5ea] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Queue</p>
                      <CalendarClock className="h-4 w-4 text-[#6e6e73]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {previewPosts.map((post) => (
                        <div key={post.title} className="flex items-center justify-between gap-3 rounded-lg bg-[#f5f5f7] p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[#e5e5ea]">
                              {post.network === 'Instagram' ? (
                                <Camera className="h-4 w-4 text-[#3478f6]" />
                              ) : (
                                <span className="text-sm font-bold text-[#3478f6]">f</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">{post.title}</p>
                              <p className="m-0 mt-0.5 text-[11px] text-[#6e6e73]">{post.network} at {post.time}</p>
                            </div>
                          </div>
                          <span className="rounded-md border border-[#d2d2d7] bg-white px-2 py-1 text-[10px] font-semibold text-[#515154]">
                            {post.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e5e5ea] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Reach trend</p>
                      <TrendingUp className="h-4 w-4 text-[#6e6e73]" />
                    </div>
                    <div className="mt-5 flex h-44 items-end gap-2">
                      {[36, 54, 48, 72, 62, 88, 96].map((height, index) => (
                        <div key={height} className="flex flex-1 flex-col items-center gap-2">
                          <div
                            className="w-full rounded-t-md bg-[#3478f6]"
                            style={{ height: `${height}%`, opacity: 0.45 + index * 0.07 }}
                          />
                          <span className="text-[10px] text-[#a1a1a6]">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
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

      <section className="border-t border-[#e5e5ea] bg-white px-5 py-12">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-[#e5e5ea] bg-white p-6">
              <feature.icon className="h-5 w-5 text-[#3478f6]" />
              <h2 className="m-0 mt-5 text-base font-semibold text-[#1d1d1f]">{feature.title}</h2>
              <p className="m-0 mt-2 text-sm leading-6 text-[#6e6e73]">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>

    <footer className="border-t border-[#d2d2d7] bg-[#f5f5f7] px-5 py-10 text-[#1d1d1f]">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#5e9cff] bg-white text-[#3478f6]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="m-0 text-base font-semibold tracking-tight text-[#1d1d1f]">EasyPost</p>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Social publishing hub</p>
            </div>
          </div>
          <p className="m-0 mt-5 max-w-md text-sm leading-6 text-[#515154]">
            Plan, publish, and review social content from one steady workspace built for creators and lean teams.
          </p>
        </div>

        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Platform</p>
          <div className="mt-4 grid gap-2 text-sm text-[#515154]">
            <Link to="/login" className="transition hover:text-[#3478f6]">Connect accounts</Link>
            <Link to="/login" className="transition hover:text-[#3478f6]">Schedule posts</Link>
            <Link to="/login" className="transition hover:text-[#3478f6]">Comment inbox</Link>
          </div>
        </div>

        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Workspace</p>
          <div className="mt-4 grid gap-2 text-sm text-[#515154]">
            <Link to="/login" className="transition hover:text-[#3478f6]">Google sign in</Link>
            <Link to="/login" className="transition hover:text-[#3478f6]">Media library</Link>
            <Link to="/login" className="transition hover:text-[#3478f6]">Performance insights</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-[#d2d2d7] pt-5 text-xs text-[#6e6e73] sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0">
          © 2026 EasyPost. All rights reserved. This product is powered by{' '}
          <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#3478f6]">
            thousandway to make
          </a>.
        </p>
        <div className="flex gap-4">
          <Link to="/privacy-policy" className="transition hover:text-[#3478f6]">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="transition hover:text-[#3478f6]">Terms</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default Home;
