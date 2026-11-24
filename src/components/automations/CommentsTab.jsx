import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Reply,
  Send,
  X,
} from 'lucide-react';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';
import { AccountSelect } from './AccountSelect';
import { apiRequest, automationKeys } from './api';
import { formatRelative, commenterLabel } from './format';
import { secondaryButton, iconButton } from './styles';
import { Segmented, InitialAvatar } from './ui';

const DM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const isWithinDmWindow = (comment) => (
  !comment.timestamp || Date.now() - new Date(comment.timestamp).getTime() < DM_WINDOW_MS
);

const CommentDmForm = ({ accountId, mediaId, comment, onDone, onSent }) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const dmMutation = useMutation({
    mutationFn: () => apiRequest(`/comments/${comment.id}/dm`, {
      method: 'POST',
      body: {
        accountId,
        message,
        mediaId,
        commenterUsername: comment.username || comment.name,
        commentText: comment.text,
      },
    }),
    onSuccess: () => {
      queryClient.setQueryData(automationKeys.comments(accountId, mediaId), (current) => (
        Array.isArray(current)
          ? current.map((item) => (item.id === comment.id ? { ...item, dmSent: true } : item))
          : current
      ));
      queryClient.invalidateQueries({ queryKey: automationKeys.events() });
      queryClient.invalidateQueries({ queryKey: automationKeys.recentComments() });
      onSent();
      onDone();
    },
  });

  return (
    <form
      className="mt-3 rounded-2xl border border-[#7831d6]/30 bg-[#7831d6]/[0.06] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (message.trim()) dmMutation.mutate();
      }}
    >
      <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-[#d6c2fa]">
        <Send className="h-3.5 w-3.5" />
        Private message to {comment.username ? `@${comment.username}` : comment.name || 'this commenter'}
      </p>
      <textarea
        className="min-h-[80px] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-white placeholder:text-zinc-500 outline-none transition focus:border-[#7831d6]"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone();
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && message.trim()) dmMutation.mutate();
        }}
        placeholder="Hey! Thanks for your comment, here's the link…"
        maxLength={1000}
        aria-label={`Private message to ${commenterLabel(comment)}`}
        autoFocus
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="m-0 text-xs text-zinc-500">One DM per comment. They'll see it in their inbox.</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={dmMutation.isPending || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-40"
          >
            {dmMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send DM
          </button>
        </div>
      </div>
      {dmMutation.error && <p className="m-0 mt-2 text-xs text-rose-400">{dmMutation.error.message}</p>}
    </form>
  );
};

const CommentReplyForm = ({ accountId, mediaId, comment, onDone, onSent }) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const replyMutation = useMutation({
    mutationFn: () => apiRequest(`/comments/${comment.id}/reply`, { method: 'POST', body: { accountId, message } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.comments(accountId, mediaId) });
      queryClient.invalidateQueries({ queryKey: automationKeys.recentComments() });
      onSent();
      onDone();
    },
  });

  return (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (message.trim()) replyMutation.mutate();
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5 pl-3.5 transition focus-within:border-[#7831d6]">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') onDone(); }}
          placeholder="Write a reply…"
          maxLength={2200}
          aria-label={`Reply to ${commenterLabel(comment)}`}
          autoFocus
        />
        <button type="button" onClick={onDone} className={iconButton} aria-label="Cancel reply">
          <X className="h-4 w-4" />
        </button>
        <button
          type="submit"
          disabled={replyMutation.isPending || !message.trim()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7831d6] text-white transition hover:bg-[#6825bc] disabled:opacity-40"
          aria-label="Send reply"
        >
          {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {replyMutation.error && <p className="m-0 mt-1.5 text-xs text-rose-400">{replyMutation.error.message}</p>}
    </form>
  );
};

const CommentRow = ({ comment, isReply, children }) => (
  <div className="flex gap-3">
    <InitialAvatar name={commenterLabel(comment)} className={isReply ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs'} />
    <div className="min-w-0 flex-1">
      <p className="m-0 flex items-baseline gap-2">
        <span className="truncate text-sm font-semibold text-white">{commenterLabel(comment)}</span>
        <span className="shrink-0 text-xs text-zinc-500">{formatRelative(comment.timestamp)}</span>
      </p>
      <p className="m-0 mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{comment.text}</p>
      {children}
    </div>
  </div>
);

const CommentsPanel = ({ accounts, onSent, onDmSent }) => {
  const [accountId, setAccountId] = useState(accounts[0]?._id || '');
  const accountSupportsDm = accounts.find((account) => account._id === accountId)?.supportsDm !== false;
  const [mediaId, setMediaId] = useState('');
  // { commentId, mode: 'reply' | 'dm' } for the one open composer
  const [composer, setComposer] = useState(null);

  const mediaQuery = useQuery({
    queryKey: automationKeys.media(accountId),
    queryFn: () => apiRequest(`/accounts/${accountId}/media`),
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
  });
  const commentsQuery = useQuery({
    queryKey: automationKeys.comments(accountId, mediaId),
    queryFn: () => apiRequest(`/accounts/${accountId}/media/${mediaId}/comments`),
    enabled: Boolean(accountId && mediaId),
    refetchInterval: 60 * 1000,
  });

  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="m-0 mt-3 text-base font-semibold text-white">No account has comment access yet</p>
        <p className="m-0 mt-1 text-sm text-zinc-400">Finish the setup above to read and reply to comments here.</p>
      </div>
    );
  }

  const media = mediaQuery.data || [];
  const comments = commentsQuery.data || [];
  const selectedMedia = media.find((item) => item.id === mediaId);

  const postList = (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-white/[0.06] p-3">
        <AccountSelect
          id="comments-account"
          accounts={accounts}
          value={accountId}
          onChange={(nextId) => { setAccountId(nextId); setMediaId(''); setComposer(null); }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {mediaQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>}
        {mediaQuery.error && <p className="m-0 p-3 text-sm text-rose-400">{mediaQuery.error.message}</p>}
        {mediaQuery.data && media.length === 0 && <p className="m-0 p-3 text-sm text-zinc-500">No posts yet.</p>}
        {media.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setMediaId(item.id); setComposer(null); }}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
              item.id === mediaId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
            }`}
          >
            <img src={item.thumbnail_url || item.media_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
            <span className="min-w-0">
              <span className="line-clamp-2 block text-sm leading-snug text-zinc-200">{item.caption || 'No caption'}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{formatRelative(item.timestamp)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const thread = (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => setMediaId('')} className={`${iconButton} lg:hidden`} aria-label="Back to posts">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="m-0 truncate text-sm font-semibold text-white">
            {commentsQuery.data ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Comments'}
          </p>
        </div>
        {selectedMedia?.permalink && (
          <a href={selectedMedia.permalink} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white">
            View post <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {commentsQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>}
        {commentsQuery.error && <p className="m-0 text-sm text-rose-400">{commentsQuery.error.message}</p>}
        {commentsQuery.data && comments.length === 0 && (
          <div className="py-16 text-center">
            <MessageCircle className="mx-auto h-7 w-7 text-zinc-600" />
            <p className="m-0 mt-2 text-sm text-zinc-500">No comments on this post yet.</p>
          </div>
        )}
        <div className="space-y-5">
          {comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment}>
              {composer?.commentId === comment.id && composer.mode === 'reply' && (
                <CommentReplyForm
                  accountId={accountId}
                  mediaId={mediaId}
                  comment={comment}
                  onDone={() => setComposer(null)}
                  onSent={onSent}
                />
              )}
              {composer?.commentId === comment.id && composer.mode === 'dm' && (
                <CommentDmForm
                  accountId={accountId}
                  mediaId={mediaId}
                  comment={comment}
                  onDone={() => setComposer(null)}
                  onSent={onDmSent}
                />
              )}
              {composer?.commentId !== comment.id && (
                <div className="mt-1 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setComposer({ commentId: comment.id, mode: 'reply' })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-white"
                  >
                    <Reply className="h-3.5 w-3.5" /> Reply
                  </button>
                  {!accountSupportsDm ? null : comment.dmSent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> DM sent
                    </span>
                  ) : isWithinDmWindow(comment) ? (
                    <button
                      type="button"
                      onClick={() => setComposer({ commentId: comment.id, mode: 'dm' })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-[#d6c2fa]"
                    >
                      <Send className="h-3.5 w-3.5" /> Send DM
                    </button>
                  ) : (
                    <span
                      className="inline-flex cursor-help items-center gap-1 text-xs font-semibold text-zinc-700"
                      title="Instagram and Facebook only allow a DM within 7 days of the comment."
                    >
                      <Send className="h-3.5 w-3.5" /> DM expired
                    </span>
                  )}
                </div>
              )}
              {comment.replies.length > 0 && (
                <div className="mt-3 space-y-3">
                  {comment.replies.map((reply) => <CommentRow key={reply.id} comment={reply} isReply />)}
                </div>
              )}
            </CommentRow>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid h-[calc(100vh-260px)] min-h-[480px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className={`min-h-0 border-white/[0.06] lg:flex lg:flex-col lg:border-r ${mediaId ? 'hidden' : 'flex flex-col'}`}>{postList}</div>
      <div className={`min-h-0 lg:flex lg:flex-col ${mediaId ? 'flex flex-col' : 'hidden'}`}>
        {mediaId ? thread : (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <MessageCircle className="h-8 w-8 text-zinc-700" />
            <p className="m-0 mt-3 text-sm text-zinc-500">Pick a post to see its comments</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Recent comments ─────────────────────────────────────────────────────────

const StatusTag = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
    <Icon className="h-3 w-3" /> {children}
  </span>
);

const RecentComments = ({ accounts, onSent, onDmSent, onError }) => {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(accounts[0]?._id || '');
  const selectedAccount = accounts.find((account) => account._id === accountId);
  const accountSupportsDm = selectedAccount?.supportsDm !== false;
  // { commentId, mode: 'reply' | 'dm' } for the one open composer
  const [composer, setComposer] = useState(null);

  const syncMutation = useMutation({
    mutationFn: (force) => apiRequest('/comments/recent/sync', { method: 'POST', body: { accountId, force } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: automationKeys.recentComments() }),
    onError,
  });
  const { mutate: syncComments } = syncMutation;
  useEffect(() => {
    if (accountId) syncComments(false);
  }, [accountId, syncComments]);

  const recentQuery = useQuery({
    queryKey: automationKeys.recentComments(accountId),
    queryFn: () => apiRequest(`/comments/recent?accountId=${accountId}&limit=60`),
    enabled: Boolean(accountId),
    refetchInterval: 15000,
  });
  const mediaQuery = useQuery({
    queryKey: automationKeys.media(accountId),
    queryFn: () => apiRequest(`/accounts/${accountId}/media`),
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
  });

  const unseenCount = recentQuery.data?.unseenCount || 0;
  useEffect(() => {
    if (!accountId || unseenCount === 0) return undefined;
    // Leave the "new" highlight visible for a moment before clearing it
    const timer = setTimeout(() => {
      apiRequest('/comments/recent/seen', { method: 'POST', body: { accountId } })
        .then(() => queryClient.invalidateQueries({ queryKey: automationKeys.recentComments() }))
        .catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [accountId, unseenCount, queryClient]);

  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="m-0 mt-3 text-base font-semibold text-white">No account has comment access yet</p>
        <p className="m-0 mt-1 text-sm text-zinc-400">Finish the setup above to see new comments here.</p>
      </div>
    );
  }

  const mediaById = new Map((mediaQuery.data || []).map((item) => [item.id, item]));
  const comments = recentQuery.data?.comments || [];

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-72">
          <AccountSelect
            id="recent-comments-account"
            accounts={accounts}
            value={accountId}
            onChange={(nextId) => { setAccountId(nextId); setComposer(null); }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-zinc-500">
            {unseenCount > 0 ? `${unseenCount} new` : 'Updates automatically'}
          </span>
          <button
            type="button"
            onClick={() => syncComments(true)}
            disabled={syncMutation.isPending}
            className={`${secondaryButton} px-3 py-2 text-xs`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {recentQuery.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>}
      {recentQuery.error && <p className="m-0 p-5 text-sm text-rose-400">{recentQuery.error.message}</p>}
      {recentQuery.data && comments.length === 0 && (
        <div className="py-16 text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-zinc-600" />
          <p className="m-0 mt-2 text-sm text-zinc-500">
            {syncMutation.isPending ? 'Loading comments…' : 'No comments yet. New ones show up here as they arrive.'}
          </p>
        </div>
      )}

      <div className="divide-y divide-white/[0.05]">
        {comments.map((comment) => {
          const post = mediaById.get(comment.mediaId);
          // Comment threads are one level deep, so replies to a reply go to its parent comment
          const replyTarget = comment.parentId ? { ...comment, id: comment.parentId } : comment;
          const isOpen = composer?.commentId === comment.id;
          return (
            <div key={comment.id} className={`flex gap-3 px-4 py-4 transition-colors sm:px-5 ${comment.unseen ? 'bg-[#7831d6]/[0.07]' : ''}`}>
              <div className="relative shrink-0">
                <InitialAvatar name={commenterLabel(comment)} className="h-9 w-9 text-xs" />
                {comment.unseen && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111114] bg-[#9b5ff0]" />}
              </div>
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
                        <AccountAvatar account={selectedAccount} className="mt-0.5 h-5 w-5 shrink-0 rounded-full object-cover" />
                        <div className="min-w-0">
                          <p className="m-0 flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-white">You</span>
                            <span className="text-[11px] text-zinc-500">{formatRelative(reply.timestamp)}</span>
                          </p>
                          <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{reply.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isOpen && composer.mode === 'reply' && (
                  <CommentReplyForm
                    accountId={accountId}
                    mediaId={comment.mediaId}
                    comment={replyTarget}
                    onDone={() => setComposer(null)}
                    onSent={onSent}
                  />
                )}
                {isOpen && composer.mode === 'dm' && (
                  <CommentDmForm
                    accountId={accountId}
                    mediaId={comment.mediaId}
                    comment={comment}
                    onDone={() => setComposer(null)}
                    onSent={onDmSent}
                  />
                )}
                {!isOpen && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={() => setComposer({ commentId: comment.id, mode: 'reply' })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-white"
                    >
                      <Reply className="h-3.5 w-3.5" /> Reply
                    </button>
                    {accountSupportsDm && !comment.dmSent && isWithinDmWindow(comment) && (
                      <button
                        type="button"
                        onClick={() => setComposer({ commentId: comment.id, mode: 'dm' })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-[#d6c2fa]"
                      >
                        <Send className="h-3.5 w-3.5" /> Send DM
                      </button>
                    )}
                    {comment.ownerReplied && <StatusTag icon={Reply}>Replied</StatusTag>}
                    {comment.dmSent && <StatusTag icon={CheckCircle2}>DM sent</StatusTag>}
                  </div>
                )}
              </div>
              {post ? (
                <a href={post.permalink} target="_blank" rel="noreferrer" className="shrink-0" title={post.caption || 'View post'}>
                  <img src={post.thumbnail_url || post.media_url} alt="" className="h-12 w-12 rounded-lg object-cover transition hover:opacity-80" loading="lazy" />
                </a>
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  <MessageCircle className="h-4 w-4 text-zinc-600" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CommentsTab = ({ accounts, onSent, onDmSent, onError }) => {
  const [view, setView] = useState('recent');
  return (
    <div className="space-y-4">
      <div className="w-full sm:w-64">
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: 'recent', label: 'Recent' }, { value: 'posts', label: 'By post' }]}
        />
      </div>
      {view === 'recent'
        ? <RecentComments accounts={accounts} onSent={onSent} onDmSent={onDmSent} onError={onError} />
        : <CommentsPanel accounts={accounts} onSent={onSent} onDmSent={onDmSent} />}
    </div>
  );
};
