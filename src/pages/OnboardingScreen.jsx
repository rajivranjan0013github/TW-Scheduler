import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleUserRound,
  Layers3,
  Sparkles,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import creatorStrip from '../assets/onboarding-creators.jpg';

const workspaceTypes = [
  {
    value: 'campaign_maker',
    eyebrow: 'Create + orchestrate',
    title: 'I run campaigns',
    description: 'Generate content, route it to human posters, or schedule it directly from one workspace.',
    icon: Layers3,
    points: ['AI content studio', 'Human + direct distribution'],
  },
  {
    value: 'account_handler',
    eyebrow: 'Review + publish',
    title: 'I post for campaigns',
    description: 'Receive approved content, connect verified channels, and keep every assigned campaign moving.',
    icon: CircleUserRound,
    points: ['Assigned campaign queue', 'Channel-safe publishing'],
  },
];

const workflow = [
  { index: '01', label: 'Generate', icon: WandSparkles },
  { index: '02', label: 'Choose route', icon: UsersRound },
  { index: '03', label: 'Go live', icon: CalendarClock },
];

export const OnboardingScreen = () => {
  const { updateProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState('campaign_maker');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');

    try {
      const success = await updateProfile({ userType: selectedRole });
      if (!success) {
        throw new Error('We could not set up your workspace. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#0b0b0b] text-[#f7f3ed] selection:bg-[#ff6b3d] selection:text-[#0b0b0b]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <header className="relative z-20 flex h-20 items-center justify-between border-b border-white/[0.09] px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff6b3d] text-[#0b0b0b] shadow-[0_0_30px_rgba(255,107,61,.25)]">
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <p className="m-0 text-sm font-black uppercase tracking-[0.16em] text-[#f7f3ed]">EasyPost</p>
            <p className="m-0 mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#77736e]">
              Content operating system
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#817c76]">
          <span className="hidden sm:inline">Workspace setup</span>
          <span className="h-px w-8 bg-white/20" />
          <span className="text-[#ff8b66]">01 / 01</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-5rem)] max-w-[1600px] lg:grid-cols-[minmax(0,1.15fr)_minmax(440px,.85fr)]">
        <section className="flex flex-col justify-between border-b border-white/[0.09] px-5 py-10 sm:px-8 sm:py-12 lg:border-b-0 lg:border-r lg:px-12 xl:px-16 xl:py-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ff6b3d]/30 bg-[#ff6b3d]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff9a77]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff6b3d]" />
              Built to ship content
            </div>

            <h1 className="m-0 max-w-4xl text-[clamp(3rem,6.2vw,6.9rem)] font-black leading-[0.88] tracking-[-0.07em] text-[#f7f3ed]">
              Create once.
              <span className="mt-2 block text-[#ff6b3d]">Move everywhere.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-base font-medium leading-7 text-[#aaa49d] sm:text-lg">
              Generate campaign-ready content, hand it to real posters, or send it straight to the schedule. One pipeline. Zero chaos.
            </p>
          </div>

          <div className="mt-10 xl:mt-14">
            <div className="group relative overflow-hidden rounded-[24px] border border-white/[0.12] bg-[#151412] shadow-[0_30px_80px_rgba(0,0,0,.42)]">
              <img
                src={creatorStrip}
                alt="Four creators presenting campaign content"
                className="h-[230px] w-full object-cover saturate-[.9] transition duration-700 group-hover:scale-[1.015] sm:h-[285px] xl:h-[330px]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6">
                <div>
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff9a77]">Human distribution network</p>
                  <p className="m-0 mt-1 text-base font-bold text-[#f7f3ed] sm:text-lg">Real people. Real channels. Ready to post.</p>
                </div>
                <span className="hidden rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddd7cf] backdrop-blur-md sm:inline-flex">
                  Route: Human
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#11100f]">
              {workflow.map((step, index) => (
                <div
                  key={step.index}
                  className={`relative px-3 py-4 sm:px-5 ${index !== workflow.length - 1 ? 'border-r border-white/[0.09]' : ''}`}
                >
                  <div className="flex items-center gap-2 text-[#ff8b66]">
                    <step.icon className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-black tracking-[0.18em]">{step.index}</span>
                  </div>
                  <p className="m-0 mt-2 text-[11px] font-bold text-[#d6d0c8] sm:text-xs">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center px-5 py-10 sm:px-8 lg:px-10 xl:px-14">
          <div className="mx-auto w-full max-w-xl">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#817c76]">Pick your side of the pipeline</p>
            <h2 className="m-0 mt-3 text-3xl font-black leading-tight tracking-[-0.045em] text-[#f7f3ed] sm:text-4xl">
              How will you use EasyPost?
            </h2>
            <p className="m-0 mt-3 text-sm leading-6 text-[#918c85]">
              We’ll shape the workspace around your role. You can switch this later in settings.
            </p>

            {error && (
              <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs font-semibold text-red-200" role="alert">
                {error}
              </div>
            )}

            <div className="mt-7 space-y-3">
              {workspaceTypes.map((type) => {
                const selected = selectedRole === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedRole(type.value)}
                    aria-pressed={selected}
                    className={`group w-full rounded-[20px] border p-5 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b3d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b] sm:p-6 ${
                      selected
                        ? 'border-[#ff6b3d] bg-[#1b1512] shadow-[0_18px_55px_rgba(255,107,61,.08)]'
                        : 'border-white/[0.1] bg-[#11100f] hover:border-white/25 hover:bg-[#151412]'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
                          selected
                            ? 'border-[#ff6b3d]/40 bg-[#ff6b3d] text-[#0b0b0b]'
                            : 'border-white/10 bg-white/[0.04] text-[#a39d96] group-hover:text-[#f7f3ed]'
                        }`}
                      >
                        <type.icon className="h-5 w-5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span>
                            <span className={`block text-[9px] font-black uppercase tracking-[0.2em] ${selected ? 'text-[#ff8b66]' : 'text-[#77736e]'}`}>
                              {type.eyebrow}
                            </span>
                            <span className="mt-1.5 block text-lg font-black tracking-[-0.025em] text-[#f7f3ed]">{type.title}</span>
                          </span>
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selected ? 'border-[#ff6b3d] bg-[#ff6b3d] text-[#0b0b0b]' : 'border-white/20 text-transparent'}`}>
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        </span>

                        <span className="mt-2 block text-xs leading-5 text-[#9d9790] sm:text-sm">{type.description}</span>
                        <span className="mt-4 flex flex-wrap gap-2">
                          {type.points.map((point) => (
                            <span key={point} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#aaa49d]">
                              <CheckCircle2 className="h-3 w-3 text-[#ff8b66]" />
                              {point}
                            </span>
                          ))}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-between rounded-2xl bg-[#ff6b3d] px-5 py-4 text-sm font-black text-[#160c08] shadow-[0_16px_50px_rgba(255,107,61,.22)] transition hover:bg-[#ff7d55] hover:shadow-[0_20px_60px_rgba(255,107,61,.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb096] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b] disabled:cursor-wait disabled:opacity-60"
            >
              <span>{submitting ? 'Building your workspace…' : 'Enter my workspace'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="m-0 mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#625e59]">
              No setup maze · Start creating immediately
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default OnboardingScreen;
