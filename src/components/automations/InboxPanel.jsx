import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { AccountSelect } from './AccountSelect';
import { apiRequest, automationKeys } from './api';
import { formatRelative } from './format';
import { iconButton } from './styles';
import { InitialAvatar } from './ui';

const ParticipantAvatar = ({ conversation, className = 'h-10 w-10 text-sm' }) => {
  const [failed, setFailed] = useState(false);
  const label = conversation.participantUsername || conversation.participantName;
  if (conversation.participantAvatarUrl && !failed) {
    return (
      <img
        src={conversation.participantAvatarUrl}
        alt=""
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return <InitialAvatar name={label} className={className} />;
};

const participantTitle = (conversation) => (
  conversation.participantName || conversation.participantUsername || 'Unknown user'
);

const formatTimeLeft = (closesAt) => {
  const minutes = Math.max(0, Math.round((new Date(closesAt).getTime() - Date.now()) / 60000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
  return `${minutes}m left`;
};

const formatDayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatClock = (value) => new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const MessageBubble = ({ message, showTime }) => {
  const isOut = message.direction === 'out';
  return (
    <div className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
      {message.attachments?.map((attachment, index) => (
        attachment.type === 'image' && attachment.url ? (
          <a key={index} href={attachment.url} target="_blank" rel="noreferrer" className="mb-1 block">
            <img src={attachment.url} alt="Shared image" className="max-h-60 max-w-[240px] rounded-2xl object-cover" />
          </a>
        ) : (
          <span key={index} className="mb-1 rounded-2xl bg-white/[0.06] px-3.5 py-2 text-sm text-zinc-300">📎 {attachment.type || 'Attachment'}</span>
        )
      ))}
      {message.text && (
        <p className={`m-0 max-w-[75%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed ${
          isOut
            ? 'rounded-2xl rounded-br-md bg-[#7831d6] text-white'
            : 'rounded-2xl rounded-bl-md bg-white/[0.08] text-zinc-100'
        } ${message.pending ? 'opacity-60' : ''}`}
        >
          {message.text}
        </p>
      )}
      {showTime && (
        <span className="mt-1 px-1 text-[11px] text-zinc-600">
          {message.pending ? 'Sending…' : formatClock(message.sentAt)}
        </span>
      )}
    </div>
  );
};

const ChatThread = ({ conversationId, onBack, onError }) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const scrollRef = useRef(null);
  const queryKey = automationKeys.messages(conversationId);

  const messagesQuery = useQuery({
    queryKey,
    queryFn: () => apiRequest(`/inbox/conversations/${conversationId}/messages`),
    refetchInterval: 5000,
  });
  const conversation = messagesQuery.data?.conversation;
  const messages = useMemo(() => messagesQuery.data?.messages || [], [messagesQuery.data]);

  const loaded = messagesQuery.isSuccess;
  useEffect(() => {
    // Opening a thread marks it read on the server; refresh the unread badges
    if (loaded) queryClient.invalidateQueries({ queryKey: automationKeys.conversations() });
  }, [loaded, queryClient]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, conversationId]);

  const sendMutation = useMutation({
    mutationFn: (messageText) => apiRequest(`/inbox/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { text: messageText },
    }),
    onMutate: async (messageText) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => current && ({
        ...current,
        messages: [...current.messages, {
          _id: `pending-${Date.now()}`, direction: 'out', text: messageText, sentAt: new Date().toISOString(), pending: true,
        }],
      }));
      setText('');
      return { previous, messageText };
    },
    onError: (error, _messageText, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      setText(context?.messageText || '');
      onError(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: automationKeys.conversations() });
    },
  });

  const send = () => {
    const trimmed = text.trim();
    if (trimmed && !sendMutation.isPending) sendMutation.mutate(trimmed);
  };

  if (messagesQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>;
  }
  if (messagesQuery.error) {
    return <p className="m-0 p-6 text-sm text-rose-400">{messagesQuery.error.message}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className={`${iconButton} lg:hidden`} aria-label="Back to conversations">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <ParticipantAvatar conversation={conversation} className="h-9 w-9 text-xs" />
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-white">{participantTitle(conversation)}</p>
            {conversation.platform !== 'facebook' && conversation.participantUsername && (
              <a
                href={`https://instagram.com/${conversation.participantUsername}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-xs text-zinc-500 hover:text-zinc-300"
              >
                @{conversation.participantUsername}
              </a>
            )}
          </div>
        </div>
        {conversation.canReply ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {formatTimeLeft(conversation.replyWindowClosesAt)}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-400">
            <Clock className="h-3.5 w-3.5" /> Window closed
          </span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="m-0 py-10 text-center text-sm text-zinc-500">No messages yet.</p>}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const newDay = !previous || new Date(previous.sentAt).toDateString() !== new Date(message.sentAt).toDateString();
          const lastInGroup = !next || next.direction !== message.direction
            || new Date(next.sentAt) - new Date(message.sentAt) > 5 * 60 * 1000;
          return (
            <div key={message._id || message.mid}>
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-zinc-500">{formatDayLabel(message.sentAt)}</span>
                </div>
              )}
              <MessageBubble message={message} showTime={lastInGroup} />
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        {conversation.canReply ? (
          <form
            onSubmit={(event) => { event.preventDefault(); send(); }}
            className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 pl-4 transition focus-within:border-[#7831d6]"
          >
            <textarea
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Message…"
              maxLength={1000}
              aria-label="Message"
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-white placeholder:text-zinc-500 outline-none [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={!text.trim() || sendMutation.isPending}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7831d6] text-white transition hover:bg-[#6825bc] disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <p className="m-0 rounded-xl bg-white/[0.03] px-4 py-3 text-center text-xs leading-relaxed text-zinc-400">
            You can reply within 24 hours of their last message.
            You can chat again as soon as they send a new message.
          </p>
        )}
      </div>
    </div>
  );
};

export const InboxPanel = ({ accounts, onError }) => {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(accounts[0]?._id || '');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');

  const syncMutation = useMutation({
    mutationFn: (force) => apiRequest(`/inbox/accounts/${accountId}/sync`, { method: 'POST', body: { force } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: automationKeys.conversations() }),
    onError,
  });
  const { mutate: syncInbox } = syncMutation;

  useEffect(() => {
    if (accountId) syncInbox(false);
  }, [accountId, syncInbox]);

  const conversationsQuery = useQuery({
    queryKey: automationKeys.conversations(accountId),
    queryFn: () => apiRequest(`/inbox/conversations?accountId=${accountId}`),
    enabled: Boolean(accountId),
    refetchInterval: 10000,
  });

  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
        <Inbox className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="m-0 mt-3 text-base font-semibold text-white">No account has message access yet</p>
        <p className="m-0 mt-1 text-sm text-zinc-400">Finish the setup above to see and answer your DMs here.</p>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const conversations = (conversationsQuery.data || []).filter((conversation) => (
    !query
    || conversation.participantUsername.toLowerCase().includes(query)
    || conversation.participantName.toLowerCase().includes(query)
  ));

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-white/[0.06] p-3">
        <AccountSelect
          id="inbox-account"
          accounts={accounts}
          value={accountId}
          onChange={(nextId) => { setAccountId(nextId); setSelectedId(''); }}
        />
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition focus-within:border-[#7831d6]">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search conversations"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-zinc-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => syncInbox(true)}
            disabled={syncMutation.isPending}
            className={`${iconButton} h-9 w-9 border border-white/10`}
            aria-label="Refresh conversations"
            title="Refresh conversations"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {conversationsQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>}
        {conversationsQuery.error && <p className="m-0 p-3 text-sm text-rose-400">{conversationsQuery.error.message}</p>}
        {conversationsQuery.data && conversations.length === 0 && (
          <p className="m-0 px-3 py-10 text-center text-sm text-zinc-500">
            {query ? 'No conversations match.' : 'No messages yet. DMs people send you will appear here.'}
          </p>
        )}
        {conversations.map((conversation) => {
          const unread = conversation.unreadCount > 0;
          return (
            <button
              key={conversation._id}
              type="button"
              onClick={() => setSelectedId(conversation._id)}
              className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
                conversation._id === selectedId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <ParticipantAvatar conversation={conversation} className="h-11 w-11 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${unread ? 'font-semibold text-white' : 'font-medium text-zinc-200'}`}>
                    {participantTitle(conversation)}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-500">{formatRelative(conversation.lastMessageAt)}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${unread ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {conversation.lastMessageDirection === 'out' && 'You: '}{conversation.lastMessageText}
                  </span>
                  {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#9b5ff0]" aria-label={`${conversation.unreadCount} unread`} />}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="grid h-[calc(100vh-260px)] min-h-[520px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className={`min-h-0 flex-col border-white/[0.06] lg:flex lg:border-r ${selectedId ? 'hidden' : 'flex'}`}>{list}</div>
      <div className={`min-h-0 flex-col lg:flex ${selectedId ? 'flex' : 'hidden'}`}>
        {selectedId ? (
          <ChatThread key={selectedId} conversationId={selectedId} onBack={() => setSelectedId('')} onError={onError} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10">
              <Send className="h-6 w-6 text-zinc-500" />
            </span>
            <p className="m-0 mt-4 text-base font-semibold text-white">Your messages</p>
            <p className="m-0 mt-1 text-sm text-zinc-500">Pick a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};
