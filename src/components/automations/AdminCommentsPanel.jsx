import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, Loader2, MessageCircle, Reply, Search } from 'lucide-react';
import PlatformIcon from '../PlatformIcon';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';
import { AccountSelect } from './AccountSelect';
import { adminAutomationKeys, adminRequest, toQuery } from './api';
import { accountLabel, commenterLabel, formatRelative } from './format';
import { secondaryButton } from './styles';
import { InitialAvatar, LoadError } from './ui';

const toKey = (value) => (value == null ? '' : String(value));

const Tag = ({ icon: Icon, tone = 'neutral', children }) => (
  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
    tone === 'danger' ? 'bg-rose-500/10 text-rose-300' : tone === 'good' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.06] text-zinc-300'
  }`}>
    <Icon className="h-3 w-3" /> {children}
  </span>
);

const automationFailed = (automation) => automation?.replyStatus === 'failed' || automation?.dmStatus === 'failed';

// Read-only feed of every comment on the campaign's accounts (in the page's handler/platform scope).
// Replying and DMing stay with each account's handler, under their own Automations page.
export const AdminCommentsPanel = ({ campaignId, scope, accounts, accountsById }) => {
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Drop an account pick that the page's handler/platform filters no longer include
  const pickedAccount = accounts.some((account) => toKey(account._id) === accountId) ? accountId : '';
  const filters = { ...scope, accountId: pickedAccount, q };

  const commentsQuery = useInfiniteQuery({
    queryKey: adminAutomationKeys.comments(campaignId, filters),
    queryFn: ({ pageParam }) => adminRequest(`/comments${toQuery({ ...filters, before: pageParam, limit: 50 })}`),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextBefore || undefined,
    refetchInterval: 30 * 1000,
  });
  const comments = commentsQuery.data?.pages.flatMap((page) => page.comments) || [];
  const filtered = Boolean(pickedAccount || q);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition focus-within:border-[#7831d6] sm:w-64">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search comments"
            aria-label="Search comments"
            className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
          />
        </div>
        <div className="sm:w-64">
          <AccountSelect
            id="admin-comments-account"
            accounts={accounts}
            value={pickedAccount}
            onChange={(nextId) => setAccountId(toKey(nextId))}
            allLabel="All accounts"
          />
        </div>
      </div>

      {commentsQuery.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>}
      {commentsQuery.error && <LoadError error={commentsQuery.error} onRetry={() => commentsQuery.refetch()} />}
      {commentsQuery.data && comments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-zinc-600" />
          <p className="m-0 mt-2 text-sm text-zinc-500">
            {filtered ? 'No comments match these filters.' : 'No comments yet. They show up here once handlers’ accounts start receiving them.'}
          </p>
        </div>
      )}

      {comments.length > 0 && (
        <div className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {comments.map((comment) => {
            const account = accountsById.get(toKey(comment.socialAccountId));
            const { automation } = comment;
            return (
              <div key={`${comment.socialAccountId}:${comment.id}`} className="flex gap-3 px-4 py-4 sm:px-5">
                <InitialAvatar name={commenterLabel(comment)} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate text-sm font-semibold text-white">{commenterLabel(comment)}</span>
                    <span className="text-xs text-zinc-500">
                      {comment.parentId ? 'replied in a thread · ' : ''}{formatRelative(comment.timestamp)}
                    </span>
                  </p>
                  <p className="m-0 mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{comment.text}</p>

                  {comment.replies?.length > 0 && (
                    <div className="mt-2.5 space-y-2 border-l-2 border-[#7831d6]/40 pl-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-2">
                          <AccountAvatar account={account} className="mt-0.5 h-5 w-5 shrink-0 rounded-full object-cover" />
                          <div className="min-w-0">
                            <p className="m-0 flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-white">{accountLabel(account)}</span>
                              <span className="text-[11px] text-zinc-500">{formatRelative(reply.timestamp)}</span>
                            </p>
                            <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{reply.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {comment.ownerReplied ? <Tag icon={Reply} tone="good">Replied</Tag> : <Tag icon={Reply}>Needs reply</Tag>}
                    {comment.dmSent && <Tag icon={CheckCircle2} tone="good">DM sent</Tag>}
                    {automation && (
                      <Tag icon={Bot} tone={automationFailed(automation) ? 'danger' : 'neutral'}>
                        {automation.ruleName || 'Automation'}{automationFailed(automation) ? ' · failed' : ''}
                      </Tag>
                    )}
                  </div>
                </div>
                <div className="flex max-w-[160px] shrink-0 items-start gap-2" title={accountLabel(account)}>
                  <span className="relative shrink-0">
                    <AccountAvatar account={account} className="h-7 w-7 rounded-full object-cover" />
                    <PlatformIcon platform={account?.platform || comment.platform} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
                  </span>
                  <span className="hidden truncate pt-1 text-xs text-zinc-400 sm:block">{accountLabel(account)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {commentsQuery.hasNextPage && (
        <button
          type="button"
          onClick={() => commentsQuery.fetchNextPage()}
          disabled={commentsQuery.isFetchingNextPage}
          className={`${secondaryButton} w-full text-xs`}
        >
          {commentsQuery.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Load older comments
        </button>
      )}
    </div>
  );
};

export default AdminCommentsPanel;
