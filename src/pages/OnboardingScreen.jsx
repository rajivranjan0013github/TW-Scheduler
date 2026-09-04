import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Layers3,
  LogOut,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const workspaceTypes = [
  {
    value: 'campaign_maker',
    title: 'Run campaigns',
    description: 'Create content, manage schedules, and coordinate posters.',
    icon: Layers3,
  },
  {
    value: 'account_handler',
    title: 'Post content',
    description: 'Connect social channels and publish assigned posts.',
    icon: UsersRound,
  },
];

export const OnboardingScreen = () => {
  const { user, updateProfile, logout } = useAuth();
  const [selectedRole, setSelectedRole] = useState('campaign_maker');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');

    try {
      const success = await updateProfile({ userType: selectedRole });
      if (!success) {
        throw new Error('Could not set role. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto bg-[#080807] text-[#f5f0e8] selection:bg-[#f3eee5] selection:text-[#11110f]">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 flex-shrink-0 border-b border-white/[0.08] bg-[#080807]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 sm:h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-8">
          <div className="inline-flex items-center">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
              ThousandPost
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {user?.email && (
              <span className="hidden max-w-[200px] truncate text-xs font-semibold text-[#8f8982] md:inline">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-[11px] font-black text-[#8f8982] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-[#f5f0e8]"
              title="Log out"
            >
              <LogOut className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Selection Area */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-8 pb-16 sm:px-6 sm:py-12">
        {/* Ambient background lighting and grid */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[350px] sm:h-[600px] sm:w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3eee5]/[0.025] blur-[100px] sm:blur-[140px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-15 sm:opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 85%)',
          }}
        />

        <div className="relative w-full max-w-md sm:max-w-lg">
          {/* Card Container */}
          <div className="rounded-2xl sm:rounded-[28px] border border-white/[0.1] bg-[#11110f]/95 p-5 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl">
            {/* Header */}
            <div className="text-center">
              <h1 className="m-0 text-xl sm:text-2xl md:text-3xl font-black tracking-[-0.04em] text-[#f5f0e8]">
                Select your role
              </h1>
              <p className="m-0 mt-1 text-xs sm:text-sm text-[#89837c]">
                Choose how you want to use ThousandPost.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-200">
                {error}
              </div>
            )}

            {/* Role Options */}
            <div className="mt-6 space-y-3">
              {workspaceTypes.map((type) => {
                const isSelected = selectedRole === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedRole(type.value)}
                    aria-pressed={isSelected}
                    className={`group w-full rounded-xl sm:rounded-2xl border p-4 text-left transition duration-200 focus:outline-none ${
                      isSelected
                        ? 'border-[#ded8cf] bg-[#1a1917]/90 shadow-[0_0_25px_rgba(244,239,231,.08)]'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4">
                      {/* Icon */}
                      <span
                        className={`grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl border transition ${
                          isSelected
                            ? 'border-black/10 bg-[#f3eee5] text-[#11110f]'
                            : 'border-white/[0.1] bg-white/[0.04] text-[#8f8982] group-hover:text-[#f5f0e8]'
                        }`}
                      >
                        <type.icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="m-0 text-sm sm:text-base font-black text-[#f5f0e8]">
                            {type.title}
                          </h2>

                          {/* Checkbox indicator */}
                          <span
                            className={`grid h-5 w-5 sm:h-6 sm:w-6 shrink-0 place-items-center rounded-full border transition ${
                              isSelected
                                ? 'border-transparent bg-[#f3eee5] text-[#11110f]'
                                : 'border-white/20 text-transparent'
                            }`}
                          >
                            <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
                          </span>
                        </div>

                        <p className="m-0 mt-0.5 text-[11px] sm:text-xs text-[#89837c]">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="group mt-6 flex min-h-[46px] sm:min-h-[50px] w-full items-center justify-between rounded-xl sm:rounded-2xl bg-[#f3eee5] px-4 sm:px-5 py-3 text-xs sm:text-sm font-black text-[#11110f] shadow-[0_12px_30px_rgba(244,239,231,.1)] transition hover:-translate-y-0.5 hover:bg-[#fffdf9] active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
            >
              <span>{submitting ? 'Setting up…' : 'Continue'}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OnboardingScreen;
