import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Radio, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export const OnboardingScreen = () => {
  const { updateProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState('account_handler');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const success = await updateProfile({ userType: selectedRole });
      if (!success) {
        throw new Error('Failed to update your account role. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-12 text-white font-sans antialiased selection:bg-[#7831d6] selection:text-white">
      <div className="w-full max-w-2xl bg-[#0a0a0a] rounded-2xl border border-white/10 p-8 md:p-12 shadow-2xl space-y-8 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#7831d6]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#7831d6]/5 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

        <div className="text-center relative z-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#7831d6]/20 border border-[#7831d6]/40 text-[#c4b5fd] mb-4 shadow-[0_0_20px_rgba(120,49,214,0.3)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white m-0">
            Welcome to EasyPost
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto m-0 leading-relaxed">
            Configure your workspace path. Let us know how you will be using EasyPost. You can change this role anytime in settings.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/15 p-4 text-xs font-semibold text-rose-400 relative z-10">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 relative z-10">
          {/* Card: Campaign Maker */}
          <button
            type="button"
            onClick={() => setSelectedRole('campaign_maker')}
            className={`flex flex-col items-start text-left p-6 rounded-xl border-2 transition duration-200 relative overflow-hidden group ${
              selectedRole === 'campaign_maker'
                ? 'border-[#7831d6] bg-[#7831d6]/10 ring-2 ring-[#7831d6]/20'
                : 'border-white/10 bg-black hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            {selectedRole === 'campaign_maker' && (
              <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-[#c4b5fd]" />
            )}
            <div className={`p-3 rounded-lg mb-4 ${
              selectedRole === 'campaign_maker' ? 'bg-[#7831d6] text-white shadow-md shadow-[#7831d6]/30' : 'bg-white/5 text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition'
            }`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white m-0">Campaign Maker</h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed m-0">
              For brands, marketers, and agencies. Set up marketing campaigns, schedule posts, create videos, and analyze workspaces.
            </p>
          </button>

          {/* Card: Account Handler / Creator */}
          <button
            type="button"
            onClick={() => setSelectedRole('account_handler')}
            className={`flex flex-col items-start text-left p-6 rounded-xl border-2 transition duration-200 relative overflow-hidden group ${
              selectedRole === 'account_handler'
                ? 'border-[#7831d6] bg-[#7831d6]/10 ring-2 ring-[#7831d6]/20'
                : 'border-white/10 bg-black hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            {selectedRole === 'account_handler' && (
              <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-[#c4b5fd]" />
            )}
            <div className={`p-3 rounded-lg mb-4 ${
              selectedRole === 'account_handler' ? 'bg-[#7831d6] text-white shadow-md shadow-[#7831d6]/30' : 'bg-white/5 text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition'
            }`}>
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white m-0">Account Handler / Creator</h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed m-0">
              For influencers and channel owners. Verify your social handles, view scheduled campaigns, and track your channel stats.
            </p>
          </button>
        </div>

        <div className="flex justify-end pt-4 border-t border-white/10 relative z-10">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#7831d6] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#7831d6]/25"
          >
            {submitting ? 'Setting up workspace...' : 'Confirm Role Choice'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;

