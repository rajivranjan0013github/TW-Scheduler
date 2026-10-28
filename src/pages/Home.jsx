import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Link2,
  Menu,
  MessageCircle,
  Reply,
  Send,
  X,
} from 'lucide-react';
import PlatformIcon from '../components/PlatformIcon';

const headingFont = { fontFamily: "'Outfit', sans-serif" };

const navLinks = [
  { href: '#automations', label: 'Automations' },
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'How It Works' },
  { href: '#faq', label: 'FAQ' },
];

const platforms = [
  { id: 'instagram', label: 'Instagram Reels' },
  { id: 'youtube', label: 'YouTube Shorts' },
  { id: 'facebook', label: 'Facebook Pages & Reels' },
];

const steps = [
  {
    icon: Link2,
    title: 'Connect & upload',
    description: 'Link your Instagram, Facebook, and YouTube accounts, then add your media and captions.',
  },
  {
    icon: Bot,
    title: 'Schedule & automate',
    description: 'Pick a publishing time and set comment rules that reply publicly and send DMs.',
  },
  {
    icon: BarChart3,
    title: 'Engage & measure',
    description: 'Answer messages from one Inbox and see how your content performs.',
  },
];

const faqs = [
  {
    q: 'Which platforms does ThousandPost support?',
    a: 'You can publish to Instagram, YouTube, and Facebook. Comment auto-replies work on all three. DMs and the Inbox support Instagram and Facebook.',
  },
  {
    q: 'How does comment-to-DM automation work?',
    a: 'Choose a keyword (or every new comment), write your public reply and DM, and pick the posts it applies to. When an eligible comment matches, your enabled rule sends both.',
  },
  {
    q: 'Are there limits on automated DMs?',
    a: 'Yes. DMs are sent only for eligible Instagram and Facebook comments and are subject to each platform’s messaging limits.',
  },
  {
    q: 'Can I pause a rule or delete my data?',
    a: 'You can pause any rule at any time, disconnect accounts, and delete your ThousandPost data from your settings.',
  },
];

const BrandMark = ({ onClick }) => (
  <Link to="/" onClick={onClick} className="inline-flex items-center">
    <span style={headingFont} className="text-2xl font-black tracking-tight text-white">
      ThousandPost
    </span>
  </Link>
);

const PrimaryCta = ({ children = 'Get started', className = '' }) => (
  <Link
    to="/login"
    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#8a3ff2] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(138,63,242,0.35)] transition hover:-translate-y-0.5 hover:bg-[#7c33e0] active:translate-y-0 ${className}`}
  >
    {children}
    <ArrowRight className="h-4 w-4" aria-hidden="true" />
  </Link>
);

const Eyebrow = ({ children }) => (
  <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">{children}</p>
);

// Reveals children when they scroll into view; skipped for reduced-motion users.
const Reveal = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
};

const SentBadge = ({ children }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    {children}
  </span>
);

const HeroMockup = () => (
  <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
    <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#8a3ff2]/20 blur-3xl" />
    <div className="space-y-3 rounded-3xl border border-white/10 bg-[#121216]/90 p-4 shadow-2xl backdrop-blur">
      {/* Scheduled post */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <Calendar className="h-4 w-4 text-purple-300" />
            Scheduled · Today, 6:30 PM
          </div>
          <div className="flex -space-x-1.5">
            {platforms.map((p) => (
              <PlatformIcon key={p.id} platform={p.id} className="h-5 w-5 rounded-full ring-2 ring-[#121216]" />
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          <div className="h-20 w-14 shrink-0 rounded-lg bg-gradient-to-br from-[#c084fc] via-[#8a3ff2] to-[#3b0f7a]" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-2.5 w-11/12 rounded bg-white/15" />
            <div className="h-2.5 w-3/4 rounded bg-white/10" />
            <div className="h-2.5 w-1/2 rounded bg-white/10" />
            <p className="m-0 pt-1 text-[11px] text-zinc-500">Comment “link” to get the guide 👇</p>
          </div>
        </div>
      </div>

      {/* Automation thread */}
      <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
          <Bot className="h-4 w-4 text-purple-300" />
          Rule: keyword “link”
        </div>
        <div className="flex items-start gap-2">
          <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-700" />
          <p className="m-0 rounded-2xl rounded-tl-sm bg-white/[0.08] px-3 py-2 text-xs text-white">
            Can you send me the <strong className="text-purple-200">link</strong>?
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-purple-500/10 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-zinc-200">
            <Reply className="h-3.5 w-3.5 text-purple-300" /> Public reply
          </span>
          <SentBadge>Sent</SentBadge>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-purple-500/10 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-zinc-200">
            <Send className="h-3.5 w-3.5 text-purple-300" /> DM with your link
          </span>
          <SentBadge>Sent</SentBadge>
        </div>
      </div>
    </div>
  </div>
);

const FeatureTile = ({ icon: Icon, title, description, children, className = '' }) => (
  <article className={`flex min-w-0 flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7 ${className}`}>
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
    <h3 style={headingFont} className="m-0 mt-5 text-xl font-semibold text-white">
      {title}
    </h3>
    <p className="m-0 mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
    {children && <div className="mt-6 flex-1">{children}</div>}
  </article>
);

const CheckList = ({ items }) => (
  <ul className="m-0 list-none space-y-2.5 p-0 text-sm text-zinc-300">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2.5">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" aria-hidden="true" />
        {item}
      </li>
    ))}
  </ul>
);

const chartBars = [40, 65, 50, 85, 60, 95, 75];

export const Home = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const scrollRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const root = scrollRef.current;
    const hero = heroRef.current;
    if (!root || !hero || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setShowStickyCta(!entry.isIntersecting), {
      root,
      threshold: 0,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div
      ref={scrollRef}
      className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#8a3ff2] selection:text-white"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark onClick={closeMenu} />

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-zinc-400 transition hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="hidden items-center gap-1.5 rounded-xl bg-[#8a3ff2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7c33e0] sm:inline-flex"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/[0.06] md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="border-t border-white/10 bg-[#09090b] px-4 pb-6 pt-2 md:hidden">
            <nav className="flex flex-col" aria-label="Mobile">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={closeMenu}
                  className="border-b border-white/5 py-3.5 text-base font-medium text-zinc-200"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-5 grid gap-3">
              <PrimaryCta className="w-full" />
              <Link
                to="/login"
                className="rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-zinc-200"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section ref={heroRef} className="relative isolate overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-28">
          <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[#8a3ff2]/15 blur-[120px]" />

          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-2 pr-3.5">
                <span className="flex -space-x-1">
                  {platforms.map((p) => (
                    <PlatformIcon key={p.id} platform={p.id} className="h-5 w-5 rounded-full" />
                  ))}
                </span>
                <span className="text-xs font-medium text-zinc-300">Instagram · YouTube · Facebook</span>
              </div>

              <h1
                style={headingFont}
                className="m-0 mt-6 text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]"
              >
                Post everywhere.
                <span className="block text-purple-300">Reply automatically.</span>
              </h1>

              <p className="m-0 mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0">
                Schedule Reels and Shorts, auto-reply to comments, and send DMs to your audience, all from one creator
                workspace.
              </p>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <PrimaryCta className="w-full sm:w-auto" />
                <a
                  href="#automations"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
                >
                  See how automation works
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            <HeroMockup />
          </div>
        </section>

        {/* Comment-to-DM */}
        <section
          id="automations"
          aria-labelledby="automations-title"
          className="scroll-mt-16 border-y border-white/5 bg-white/[0.015] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow>Instagram & Facebook automation</Eyebrow>
              <h2
                id="automations-title"
                style={headingFont}
                className="m-0 mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl"
              >
                They comment “link”.
                <br className="hidden sm:block" /> Your rule does the rest.
              </h2>
              <p className="m-0 mt-4 text-base leading-relaxed text-zinc-400">
                Pick a keyword, write your public reply and DM. When an eligible comment matches, your enabled rule sends
                both.
              </p>
            </Reveal>

            <ol aria-label="Example comment-to-DM automation" className="m-0 mt-14 grid list-none gap-4 p-0 md:grid-cols-3">
              {[
                {
                  icon: MessageCircle,
                  step: 'Someone comments',
                  meta: 'On your selected post',
                  body: (
                    <p className="m-0 inline-block rounded-2xl rounded-tl-sm bg-white/[0.08] px-4 py-3 text-sm text-white">
                      Can you send me the <strong className="font-semibold text-purple-200">link</strong>?
                    </p>
                  ),
                },
                {
                  icon: Reply,
                  step: 'Your rule replies',
                  meta: 'Public comment reply',
                  body: (
                    <>
                      <p className="m-0 rounded-2xl rounded-tl-sm bg-purple-500/15 px-4 py-3 text-sm leading-relaxed text-white">
                        Sent you the link by DM. Check your inbox!
                      </p>
                      <div className="mt-3">
                        <SentBadge>Reply posted</SentBadge>
                      </div>
                    </>
                  ),
                },
                {
                  icon: Send,
                  step: 'A DM follows',
                  meta: 'Private reply to the commenter',
                  body: (
                    <>
                      <div className="rounded-2xl rounded-tl-sm bg-purple-500/15 px-4 py-3">
                        <p className="m-0 text-sm leading-relaxed text-white">Here’s the link you asked for.</p>
                        <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-purple-200">
                          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Your saved link
                        </span>
                      </div>
                      <div className="mt-3">
                        <SentBadge>DM delivered</SentBadge>
                      </div>
                    </>
                  ),
                },
              ].map(({ icon: Icon, step, meta, body }, index) => (
                <li key={step} className="min-w-0">
                  <Reveal delay={index * 150} className="h-full">
                    <div className="h-full rounded-3xl border border-white/10 bg-[#0e0e12] p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-sm font-semibold text-purple-200">
                          {index + 1}
                        </span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Icon className="h-4 w-4 text-purple-300" aria-hidden="true" />
                          {step}
                        </span>
                      </div>
                      <p className="m-0 mb-2 mt-5 text-xs font-medium text-zinc-500">{meta}</p>
                      {body}
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>

            <p className="m-0 mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-zinc-500">
              Example messages. You choose the wording and link. DMs and the Inbox support Instagram and Facebook, subject
              to platform messaging limits. Public comment replies also work on YouTube.
            </p>
          </div>
        </section>

        {/* Features bento */}
        <section id="features" aria-labelledby="features-title" className="scroll-mt-16 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <Eyebrow>Everything in one workspace</Eyebrow>
              <h2 id="features-title" style={headingFont} className="m-0 mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Less tab-switching.
                <br /> More creating.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-6">
              <Reveal className="md:col-span-4">
                <FeatureTile
                  icon={Bot}
                  title="Automatic comment replies & DMs"
                  description="Reply to comments on Instagram, Facebook, and YouTube. Send links or details by DM on Instagram and Facebook when a comment matches your rule."
                  className="h-full border-purple-500/25 bg-gradient-to-br from-purple-500/[0.10] to-transparent"
                >
                  <div className="grid gap-6 sm:grid-cols-2">
                    <CheckList
                      items={[
                        'Trigger on keywords or every new comment',
                        'Target specific posts or all your posts',
                        'Start from templates and pause anytime',
                      ]}
                    />
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4" aria-hidden="true">
                      {['“price?”', '“link”', '“info”'].map((kw) => (
                        <div key={kw} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                          <span className="text-xs text-zinc-300">{kw}</span>
                          <SentBadge>Auto-reply</SentBadge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="m-0 mt-5 text-xs text-zinc-500">
                    DMs are available for eligible Instagram and Facebook comments, subject to platform messaging limits.
                  </p>
                </FeatureTile>
              </Reveal>

              <Reveal className="md:col-span-2" delay={100}>
                <FeatureTile
                  icon={Inbox}
                  title="One Inbox"
                  description="Read and reply to Instagram and Facebook DMs, and browse comments by post."
                  className="h-full"
                >
                  <div className="space-y-2" aria-hidden="true">
                    {[
                      { id: 'instagram', w: 'w-3/4', unread: 2 },
                      { id: 'facebook', w: 'w-2/3', unread: 1 },
                      { id: 'instagram', w: 'w-1/2', unread: 0 },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                        <PlatformIcon platform={row.id} className="h-5 w-5 shrink-0" />
                        <div className={`h-2 rounded bg-white/15 ${row.w}`} />
                        {row.unread > 0 && (
                          <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8a3ff2] text-[10px] font-bold text-white">
                            {row.unread}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </FeatureTile>
              </Reveal>

              <Reveal className="md:col-span-3">
                <FeatureTile
                  icon={Send}
                  title="Schedule & publish"
                  description="Upload once, choose your channels, write a caption, and set the time. Publish automatically or download media and copy the caption."
                  className="h-full"
                >
                  <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
                    {Array.from({ length: 14 }, (_, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-lg ${[2, 5, 8, 11].includes(i) ? 'bg-[#8a3ff2]/70' : 'bg-white/[0.05]'}`}
                      />
                    ))}
                  </div>
                  <p className="m-0 mt-4 text-xs text-zinc-500">Your uploads stay organized in My Media.</p>
                </FeatureTile>
              </Reveal>

              <Reveal className="md:col-span-3" delay={100}>
                <FeatureTile
                  icon={BarChart3}
                  title="Performance insights"
                  description="Track available views, likes, and comment counts, and review results by platform and connected account."
                  className="h-full"
                >
                  <div className="flex h-24 items-end gap-2" aria-hidden="true">
                    {chartBars.map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`flex-1 rounded-t-md ${i === chartBars.length - 2 ? 'bg-[#8a3ff2]' : 'bg-white/10'}`}
                      />
                    ))}
                  </div>
                </FeatureTile>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="workflow"
          aria-labelledby="workflow-title"
          className="scroll-mt-16 border-y border-white/5 bg-white/[0.015] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 id="workflow-title" style={headingFont} className="m-0 mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Up and running in three steps
              </h2>
            </Reveal>

            <ol className="m-0 mt-14 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-6">
              {steps.map(({ icon: Icon, title, description }, index) => (
                <li key={title} className="relative min-w-0 text-center md:text-left">
                  <Reveal delay={index * 120}>
                    <div className="flex items-center justify-center gap-4 md:justify-start">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-200">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      {index < steps.length - 1 && (
                        <span className="hidden h-px flex-1 bg-gradient-to-r from-purple-500/40 to-transparent md:block" />
                      )}
                    </div>
                    <p className="m-0 mt-5 text-xs font-semibold tracking-wider text-purple-300">STEP {index + 1}</p>
                    <h3 style={headingFont} className="m-0 mt-1 text-xl font-semibold text-white">
                      {title}
                    </h3>
                    <p className="m-0 mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <h2 id="faq-title" style={headingFont} className="m-0 mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Questions, answered
              </h2>
              <p className="m-0 mt-4 text-sm text-zinc-400">
                Something else?{' '}
                <a href="mailto:admin@thethousandways.com" className="text-purple-300 underline-offset-4 hover:underline">
                  Email us
                </a>
                .
              </p>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-white [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500 transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="m-0 mt-3 pr-8 text-sm leading-relaxed text-zinc-400">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-6xl">
            <div className="relative isolate overflow-hidden rounded-[2rem] border border-purple-500/30 bg-gradient-to-br from-[#2a1450] via-[#170c2c] to-[#0e0917] px-6 py-16 text-center sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[#8a3ff2]/30 blur-[100px]" />
              <h2 style={headingFont} className="m-0 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Stop copy-pasting the same reply.
              </h2>
              <p className="m-0 mx-auto mt-4 max-w-xl text-base text-zinc-300">
                Schedule your next post and let your rules handle the comments.
              </p>
              <PrimaryCta className="mt-8">Get started with ThousandPost</PrimaryCta>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070709] py-10 pb-28 text-zinc-400 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <BrandMark />
            <p className="m-0 text-xs text-zinc-500">
              © {new Date().getFullYear()} ThousandPost · Managed by{' '}
              <a
                href="https://thethousandways.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 underline transition hover:text-white"
              >
                Thousand Ways
              </a>
              . All rights reserved.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-zinc-400" aria-label="Footer">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="transition hover:text-white">
                {l.label}
              </a>
            ))}
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
          </nav>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#09090b]/90 p-3 backdrop-blur-xl transition-transform duration-300 sm:hidden ${showStickyCta && !menuOpen ? 'translate-y-0' : 'translate-y-full'}`}
        inert={!showStickyCta || menuOpen}
      >
        <PrimaryCta className="w-full" />
      </div>
    </div>
  );
};

export default Home;
