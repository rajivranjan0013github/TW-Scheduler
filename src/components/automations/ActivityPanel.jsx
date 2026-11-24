import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { accountLabel, formatRelative } from './format';
import { InitialAvatar } from './ui';

const statusMeta = {
  sent: { icon: CheckCircle2, className: 'text-emerald-400', label: 'sent' },
  failed: { icon: XCircle, className: 'text-rose-400', label: 'failed' },
  pending: { icon: Clock, className: 'text-amber-400', label: 'sending' },
};

const ActionStatus = ({ label, status }) => {
  const meta = statusMeta[status];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
      <meta.icon className="h-3.5 w-3.5" /> {label} {meta.label}
    </span>
  );
};

// `accountsById` (optional) adds the account to each row, for views that span many accounts
export const ActivityPanel = ({
  events,
  rulesById,
  isLoading,
  error,
  accountsById,
  emptyTitle = 'No activity yet',
  emptyMessage = 'Comments that trigger an automation will show up here.',
}) => {
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>;
  if (error) {
    return <p className="m-0 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04] p-6 text-sm text-rose-300">{error.message}</p>;
  }
  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
        <Clock className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="m-0 mt-3 text-base font-semibold text-white">{emptyTitle}</p>
        <p className="m-0 mt-1 text-sm text-zinc-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      {events.map((event) => {
        const ruleName = rulesById?.get(String(event.ruleId))?.name || event.ruleName;
        const account = accountsById?.get(String(event.socialAccountId));
        return (
          <div key={event._id} className="flex gap-3 px-5 py-4">
            <InitialAvatar name={event.commenterUsername} className="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <p className="m-0 truncate text-sm text-zinc-300">
                  <span className="font-semibold text-white">{event.commenterUsername || 'Someone'}</span> commented
                  <span className="text-zinc-400"> “{event.commentText}”</span>
                </p>
                <span className="shrink-0 text-xs text-zinc-500">{formatRelative(event.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {account && <span className="text-xs font-medium text-zinc-400">{accountLabel(account)}</span>}
                <span className="text-xs text-zinc-500">{ruleName || (event.ruleId ? 'Deleted automation' : 'Sent manually')}</span>
                <ActionStatus label="Reply" status={event.replyStatus} />
                <ActionStatus label="DM" status={event.dmStatus} />
              </div>
              {event.error && <p className="m-0 mt-1.5 break-words text-xs text-rose-400/80">{event.error}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
