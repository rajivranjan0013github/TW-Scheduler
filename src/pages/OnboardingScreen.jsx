import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Radio, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

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
        throw new Error('Failed to update your account role. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-6 py-12 text-[#1d1d1f] font-sans antialiased">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-[#d2d2d7] p-8 md:p-12 shadow-xl space-y-8 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#3478f6]/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#ff5500]/5 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

        <div className="text-center relative z-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#3478f6]/10 text-[#3478f6] mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-black m-0">
            Welcome to EasyPost
          </h1>
          <p className="text-sm text-[#6e6e73] mt-2 max-w-md mx-auto m-0 leading-relaxed">
            Configure your workspace path. Let us know how you will be using EasyPost. You can change this role anytime in settings.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 relative z-10">
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
                ? 'border-[#3478f6] bg-[#3478f6]/5 shadow-[0_8px_24px_rgba(52,120,246,0.06)]'
                : 'border-[#e5e5ea] bg-white hover:border-[#8e8e93] hover:shadow-md'
            }`}
          >
            {selectedRole === 'campaign_maker' && (
              <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-[#3478f6]" />
            )}
            <div className={`p-3 rounded-lg mb-4 ${
              selectedRole === 'campaign_maker' ? 'bg-[#3478f6] text-white' : 'bg-[#f5f5f7] text-[#6e6e73] group-hover:text-black group-hover:bg-[#e8e8ed] transition'
            }`}>
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-black m-0">Campaign Maker</h3>
            <p className="text-xs text-[#6e6e73] mt-1.5 leading-relaxed m-0">
              For brands, marketers, and agencies. Set up marketing campaigns, schedule posts, create videos, and analyze workspaces.
            </p>
          </button>

          {/* Card: Account Handler / Creator */}
          <button
            type="button"
            onClick={() => setSelectedRole('account_handler')}
            className={`flex flex-col items-start text-left p-6 rounded-xl border-2 transition duration-200 relative overflow-hidden group ${
              selectedRole === 'account_handler'
                ? 'border-[#3478f6] bg-[#3478f6]/5 shadow-[0_8px_24px_rgba(52,120,246,0.06)]'
                : 'border-[#e5e5ea] bg-white hover:border-[#8e8e93] hover:shadow-md'
            }`}
          >
            {selectedRole === 'account_handler' && (
              <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-[#3478f6]" />
            )}
            <div className={`p-3 rounded-lg mb-4 ${
              selectedRole === 'account_handler' ? 'bg-[#3478f6] text-white' : 'bg-[#f5f5f7] text-[#6e6e73] group-hover:text-black group-hover:bg-[#e8e8ed] transition'
            }`}>
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-black m-0">Account Handler / Creator</h3>
            <p className="text-xs text-[#6e6e73] mt-1.5 leading-relaxed m-0">
              For influencers and channel owners. Verify your social handles, view scheduled campaigns, and track your channel stats.
            </p>
          </button>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#e5e5ea] relative z-10">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#3478f6] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#2f6fe4] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
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
