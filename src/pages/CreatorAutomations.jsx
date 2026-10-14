import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import { connectInstagramOAuth, formatHandle } from '../utils/channelOAuth';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';
import PlatformIcon from '../components/PlatformIcon';

const apiRequest = async (path, { method = 'GET', body } = {}) => {
  const token = localStorage.getItem('tw_token');
  const response = await fetch(`${API_BASE_URL}/api/automations${path}`, {
    method,
    headers: withHandlerPreviewHeaders({
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
};

const emptyDraft = {
  socialAccountId: '',
  name: '',
  enabled: true,
  mediaScope: 'all',
  mediaIds: [],
  triggerType: 'keywords',
  keywordsText: '',
  repliesText: '',
  sendDm: true,
  dmMessage: '',
};

const splitLines = (text, separator) => (
  String(text || '').split(separator).map((item) => item.trim()).filter(Boolean)
);

const ruleToDraft = (rule) => ({
  socialAccountId: String(rule.socialAccountId),
  name: rule.name,
  enabled: rule.enabled,
  mediaScope: rule.mediaScope,
  mediaIds: rule.mediaIds || [],
  triggerType: rule.triggerType,
  keywordsText: (rule.keywords || []).join(', '),
  repliesText: (rule.commentReplies || []).join('\n'),
  sendDm: rule.sendDm,
  dmMessage: rule.dmMessage || '',
});

const draftToPayload = (draft) => ({
  socialAccountId: draft.socialAccountId,
  name: draft.name,
  enabled: draft.enabled,
  mediaScope: draft.mediaScope,
  mediaIds: draft.mediaScope === 'specific' ? draft.mediaIds : [],
  triggerType: draft.triggerType,
  keywords: draft.triggerType === 'keywords' ? splitLines(draft.keywordsText, ',') : [],
  commentReplies: splitLines(draft.repliesText, '\n'),
  sendDm: draft.sendDm,
  dmMessage: draft.sendDm ? draft.dmMessage : '',
});

const statusStyles = {
  sent: 'text-emerald-400',
  failed: 'text-rose-400',
  pending: 'text-amber-400',
  skipped: 'text-zinc-500',
};

const StatusPill = ({ label, status }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${statusStyles[status] || 'text-zinc-500'}`}>
    {status === 'sent' && <CheckCircle2 className="h-3 w-3" />}
    {status === 'failed' && <XCircle className="h-3 w-3" />}
    {label}: {status}
  </span>
);

const inputClass = 'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-[#7831d6]';
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400';

const SegmentedChoice = ({ value, options, onChange }) => (
  <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          value === option.value ? 'bg-[#7831d6] text-white' : 'text-zinc-400 hover:text-white'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const RuleEditor = ({ accounts, initialDraft, ruleId, onClose }) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState('');
  const update = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const mediaQuery = useQuery({
    queryKey: ['automations', 'media', draft.socialAccountId],
    queryFn: () => apiRequest(`/accounts/${draft.socialAccountId}/media`),
    enabled: Boolean(draft.socialAccountId) && draft.mediaScope === 'specific',
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => apiRequest(ruleId ? `/rules/${ruleId}` : '/rules', {
      method: ruleId ? 'PATCH' : 'POST',
      body: payload,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] });
      onClose();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const toggleMedia = (mediaId) => update({
    mediaIds: draft.mediaIds.includes(mediaId)
      ? draft.mediaIds.filter((id) => id !== mediaId)
      : [...draft.mediaIds, mediaId],
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    saveMutation.mutate(draftToPayload(draft));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#121216] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="m-0 text-sm font-bold text-white">{ruleId ? 'Edit automation' : 'New automation'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <label className={labelClass} htmlFor="automation-name">Name</label>
            <input
              id="automation-name"
              className={inputClass}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="e.g. Send product link"
              maxLength={120}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="automation-account">Instagram account</label>
            <select
              id="automation-account"
              className={inputClass}
              value={draft.socialAccountId}
              onChange={(event) => update({ socialAccountId: event.target.value, mediaIds: [] })}
              disabled={Boolean(ruleId)}
            >
              <option value="">Select an account</option>
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>
                  {formatHandle(account.username) || account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelClass}>Which posts</span>
            <SegmentedChoice
              value={draft.mediaScope}
              onChange={(mediaScope) => update({ mediaScope })}
              options={[{ value: 'all', label: 'All posts' }, { value: 'specific', label: 'Specific posts' }]}
            />
            {draft.mediaScope === 'specific' && (
              <div className="mt-3">
                {!draft.socialAccountId && <p className="m-0 text-xs text-zinc-500">Select an account first.</p>}
                {mediaQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                {mediaQuery.error && <p className="m-0 text-xs text-rose-400">{mediaQuery.error.message}</p>}
                {mediaQuery.data && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {mediaQuery.data.map((media) => {
                      const selected = draft.mediaIds.includes(media.id);
                      return (
                        <button
                          key={media.id}
                          type="button"
                          onClick={() => toggleMedia(media.id)}
                          title={media.caption || ''}
                          className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                            selected ? 'border-[#7831d6]' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={media.thumbnail_url || media.media_url}
                            alt={media.caption ? media.caption.slice(0, 60) : 'Instagram post'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {selected && (
                            <CheckCircle2 className="absolute right-1 top-1 h-4 w-4 rounded-full bg-[#7831d6] text-white" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <span className={labelClass}>Trigger</span>
            <SegmentedChoice
              value={draft.triggerType}
              onChange={(triggerType) => update({ triggerType })}
              options={[{ value: 'keywords', label: 'Keywords' }, { value: 'any', label: 'Every comment' }]}
            />
            {draft.triggerType === 'keywords' && (
              <input
                className={`${inputClass} mt-3`}
                value={draft.keywordsText}
                onChange={(event) => update({ keywordsText: event.target.value })}
                placeholder="link, price, info"
                aria-label="Keywords, separated by commas"
              />
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="automation-replies">Public comment reply</label>
            <textarea
              id="automation-replies"
              className={`${inputClass} min-h-[80px] resize-y`}
              value={draft.repliesText}
              onChange={(event) => update({ repliesText: event.target.value })}
              placeholder={'Sent you a DM {{username}}!\nCheck your inbox {{username}} 📩'}
            />
            <p className="m-0 mt-1 text-[11px] text-zinc-500">
              One reply per line; a random one is used each time. Leave empty to skip the public reply.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-white">
                <Send className="h-3.5 w-3.5 text-[#a77bf0]" />
                Send a DM to the commenter
              </span>
              <input
                type="checkbox"
                checked={draft.sendDm}
                onChange={(event) => update({ sendDm: event.target.checked })}
                className="h-4 w-4 accent-[#7831d6]"
              />
            </label>
            {draft.sendDm && (
              <>
                <textarea
                  className={`${inputClass} mt-3 min-h-[90px] resize-y`}
                  value={draft.dmMessage}
                  onChange={(event) => update({ dmMessage: event.target.value })}
                  placeholder="Hey {{username}}! Here's the link you asked for: https://…"
                  maxLength={1000}
                  aria-label="DM message"
                />
                <p className="m-0 mt-1 text-[11px] text-zinc-500">
                  Instagram allows one DM per comment, within 7 days of the comment.
                </p>
              </>
            )}
          </div>

          <p className="m-0 text-[11px] text-zinc-500">
            Use <code className="text-zinc-300">{'{{username}}'}</code> to insert the commenter's handle.
          </p>
          {error && <p className="m-0 text-xs text-rose-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6825bc] disabled:opacity-60"
          >
            {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {ruleId ? 'Save changes' : 'Create automation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const CreatorAutomations = () => {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState(null);
  const [actionError, setActionError] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['automations', 'accounts'],
    queryFn: () => apiRequest('/accounts'),
    staleTime: 60 * 1000,
  });
  const rulesQuery = useQuery({
    queryKey: ['automations', 'rules'],
    queryFn: () => apiRequest('/rules'),
  });
  const eventsQuery = useQuery({
    queryKey: ['automations', 'events'],
    queryFn: () => apiRequest('/events?limit=30'),
    refetchInterval: 30 * 1000,
  });

  const accounts = accountsQuery.data || [];
  const rules = rulesQuery.data || [];
  const events = eventsQuery.data || [];
  const accountsById = useMemo(
    () => new Map((accountsQuery.data || []).map((account) => [String(account._id), account])),
    [accountsQuery.data]
  );
  const readyAccounts = accounts.filter((account) => account.hasAutomationScopes && account.subscribedAt);
  const accountsNeedingSetup = accounts.filter((account) => !account.hasAutomationScopes || !account.subscribedAt);

  const subscribeMutation = useMutation({
    mutationFn: (accountId) => apiRequest(`/accounts/${accountId}/subscribe`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations', 'accounts'] }),
    onError: (error) => setActionError(error.message),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }) => apiRequest(`/rules/${ruleId}`, { method: 'PATCH', body: { enabled } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] }),
    onError: (error) => setActionError(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (ruleId) => apiRequest(`/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] }),
    onError: (error) => setActionError(error.message),
  });

  const openNewRule = () => setEditor({
    ruleId: null,
    draft: { ...emptyDraft, socialAccountId: readyAccounts[0]?._id || accounts[0]?._id || '' },
  });

  const handleDelete = (rule) => {
    if (window.confirm(`Delete the automation "${rule.name}"?`)) deleteMutation.mutate(rule._id);
  };

  const isLoading = accountsQuery.isLoading || rulesQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-xl font-bold tracking-tight text-white">Automations</h2>
          <p className="m-0 mt-1 text-xs text-zinc-400">
            Auto-reply to Instagram comments and send a DM to people who comment a keyword.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewRule}
          disabled={accounts.length === 0}
          className="flex items-center gap-1.5 self-start rounded-lg bg-[#7831d6] px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] active:scale-95 disabled:opacity-50 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New automation
        </button>
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
      )}

      {!isLoading && accounts.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <PlatformIcon platform="instagram" className="mx-auto h-8 w-8" />
          <p className="m-0 mt-3 text-sm font-semibold text-white">Connect an Instagram account first</p>
          <p className="m-0 mt-1 text-xs text-zinc-400">Automations work with Instagram Business and Creator accounts.</p>
          <Link to="/channels" className="mt-4 inline-block rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6825bc]">
            Go to My Channels
          </Link>
        </div>
      )}

      {accountsNeedingSetup.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Finish setup</h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {accountsNeedingSetup.map((account) => (
              <div key={account._id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-black/40 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AccountAvatar account={account} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-semibold text-white">{formatHandle(account.username) || account.name}</p>
                    <p className="m-0 truncate text-[10px] text-amber-300/80">
                      {account.hasAutomationScopes ? 'Comment events not turned on yet' : 'Needs comment & message access'}
                    </p>
                  </div>
                </div>
                {account.hasAutomationScopes ? (
                  <button
                    type="button"
                    onClick={() => subscribeMutation.mutate(account._id)}
                    disabled={subscribeMutation.isPending}
                    className="shrink-0 rounded-lg bg-[#7831d6] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#6825bc] disabled:opacity-60"
                  >
                    Turn on
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => connectInstagramOAuth()}
                    className="shrink-0 rounded-lg bg-[#7831d6] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#6825bc]"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && accounts.length > 0 && (
        <section className="space-y-3">
          <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Your automations ({rules.length})</h3>
          {rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <Bot className="mx-auto h-7 w-7 text-zinc-500" />
              <p className="m-0 mt-3 text-sm font-semibold text-white">No automations yet</p>
              <p className="m-0 mt-1 text-xs text-zinc-400">
                Example: when someone comments "link", reply publicly and DM them the product link.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {rules.map((rule) => {
                const account = accountsById.get(String(rule.socialAccountId));
                return (
                  <article key={rule._id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-white">{rule.name}</p>
                        <p className="m-0 mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-zinc-400">
                          <PlatformIcon platform="instagram" className="h-3.5 w-3.5" />
                          {account ? formatHandle(account.username) || account.name : 'Account unavailable'}
                          <span>·</span>
                          {rule.mediaScope === 'all' ? 'All posts' : `${rule.mediaIds.length} post${rule.mediaIds.length === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
                        {rule.enabled ? 'On' : 'Off'}
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) => toggleMutation.mutate({ ruleId: rule._id, enabled: event.target.checked })}
                          className="h-4 w-4 accent-[#7831d6]"
                          aria-label={`Turn ${rule.name} ${rule.enabled ? 'off' : 'on'}`}
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rule.triggerType === 'any' ? (
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">Every comment</span>
                      ) : rule.keywords.map((keyword) => (
                        <span key={keyword} className="rounded-md bg-[#7831d6]/15 px-2 py-0.5 text-[11px] text-[#c4a5f5]">{keyword}</span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                      {rule.commentReplies.length > 0 && (
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Public reply</span>
                      )}
                      {rule.sendDm && <span className="flex items-center gap-1"><Send className="h-3 w-3" /> DM</span>}
                      <span>Triggered {rule.triggeredCount || 0}×</span>
                    </div>

                    <div className="mt-3 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditor({ ruleId: rule._id, draft: ruleToDraft(rule) })}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {events.length > 0 && (
        <section className="space-y-3">
          <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Recent activity</h3>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {events.map((event) => (
              <div key={event._id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="m-0 truncate text-xs text-white">
                    <span className="font-semibold">{formatHandle(event.commenterUsername) || 'Someone'}</span>
                    <span className="text-zinc-400">: {event.commentText}</span>
                  </p>
                  <p className="m-0 mt-0.5 text-[10px] text-zinc-500">
                    {new Date(event.createdAt).toLocaleString()}
                    {event.error && <span className="ml-2 text-rose-400/80">{event.error}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <StatusPill label="Reply" status={event.replyStatus} />
                  <StatusPill label="DM" status={event.dmStatus} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {editor && (
        <RuleEditor
          accounts={accounts}
          initialDraft={editor.draft}
          ruleId={editor.ruleId}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
};

export default CreatorAutomations;
