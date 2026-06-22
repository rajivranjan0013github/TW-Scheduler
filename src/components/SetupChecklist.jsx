import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Link2,
  Upload,
  Clock,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';
import { getActiveCampaignId } from '../utils/campaignScope';

const DISMISS_KEY = 'easypost-setup-dismissed';

export const SetupChecklist = ({ channelsCount = 0, mediaCount = 0, postsCount = 0 }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  );

  // If user dismissed or all 3 steps are done, don't show
  const allDone = channelsCount > 0 && mediaCount > 0 && postsCount > 0;
  if (dismissed || allDone) return null;

  const steps = [
    {
      id: 'channels',
      title: 'Connect your first channel',
      description:
        'Link your Instagram, Facebook, or YouTube account so EasyPost can publish content for you.',
      done: channelsCount > 0,
      unlocked: true,
      action: () => navigate('/channels'),
      actionLabel: 'Connect a channel',
      icon: Link2,
      color: '#0071e3',
      bgColor: '#eef5ff',
    },
    {
      id: 'media',
      title: 'Upload your content',
      description:
        'Add videos or images to your media library. You can upload individual files or entire folders with captions.',
      done: mediaCount > 0,
      unlocked: channelsCount > 0,
      action: () => navigate('/media'),
      actionLabel: 'Open media library',
      icon: Upload,
      color: '#8b5cf6',
      bgColor: '#f5f0ff',
    },
    {
      id: 'schedule',
      title: 'Schedule your first post',
      description:
        'Pick your content, choose a time, and let EasyPost handle the publishing automatically.',
      done: postsCount > 0,
      unlocked: channelsCount > 0 && mediaCount > 0,
      action: () => navigate('/scheduler'),
      actionLabel: 'Create a schedule',
      icon: Clock,
      color: '#059669',
      bgColor: '#ecfdf5',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-[#d2d2d7] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-[#0071e3]/[0.04] via-[#8b5cf6]/[0.04] to-[#059669]/[0.04] px-7 py-6 border-b border-[#e5e5ea]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0071e3] to-[#8b5cf6] text-white shadow-md flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-lg font-semibold tracking-tight text-[#1d1d1f]">
                Get started with EasyPost
              </h2>
              <p className="m-0 mt-1 text-sm text-[#6e6e73]">
                Complete these 3 steps and you'll be scheduling your first post in
                under 2 minutes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e93] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] flex-shrink-0"
            title="Dismiss setup guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-[#e5e5ea] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0071e3] to-[#8b5cf6] transition-all duration-700 ease-out"
              style={{ width: `${(completedCount / 3) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[#6e6e73] flex-shrink-0">
            {completedCount}/3
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[#e5e5ea]">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isLocked = !step.unlocked && !step.done;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-4 px-7 py-5 transition-colors ${
                isLocked ? 'opacity-45' : ''
              } ${step.done ? 'bg-[#fbfbfd]' : ''}`}
            >
              {/* Step indicator */}
              <div className="flex-shrink-0 pt-0.5">
                {step.done ? (
                  <CheckCircle2
                    className="h-6 w-6 text-[#34c759]"
                    strokeWidth={2.5}
                  />
                ) : (
                  <div className="relative flex h-6 w-6 items-center justify-center">
                    <Circle className="h-6 w-6 text-[#d2d2d7]" />
                    <span className="absolute text-[10px] font-bold text-[#8e8e93]">
                      {index + 1}
                    </span>
                  </div>
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: step.bgColor }}
                  >
                    <StepIcon
                      className="h-3.5 w-3.5"
                      style={{ color: step.color }}
                    />
                  </div>
                  <h3
                    className={`m-0 text-sm font-semibold ${
                      step.done
                        ? 'text-[#8e8e93] line-through'
                        : 'text-[#1d1d1f]'
                    }`}
                  >
                    {step.title}
                  </h3>
                  {step.done && (
                    <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                      Done
                    </span>
                  )}
                </div>

                <p className="m-0 mt-2 text-xs leading-5 text-[#6e6e73] max-w-xl">
                  {step.description}
                </p>

                {/* Action button — only show if step is unlocked and not done */}
                {!step.done && step.unlocked && (
                  <button
                    type="button"
                    onClick={step.action}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.98] shadow-sm"
                    style={{ backgroundColor: step.color }}
                  >
                    {step.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Locked message */}
                {isLocked && (
                  <p className="m-0 mt-2 text-[10px] font-semibold text-[#8e8e93] italic">
                    Complete the previous step first
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-[#e5e5ea] px-7 py-3 bg-[#fbfbfd]">
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-[#8e8e93] hover:text-[#1d1d1f] transition font-medium"
        >
          Skip setup and explore on your own →
        </button>
      </div>
    </div>
  );
};

export default SetupChecklist;
