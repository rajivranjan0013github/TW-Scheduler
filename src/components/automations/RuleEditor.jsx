import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  MessageCircle,
  MinusCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import PlatformIcon from '../PlatformIcon';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';
import { AccountPicker } from './AccountPicker';
import { AccountSelect } from './AccountSelect';
import { KeywordInput } from './KeywordInput';
import { MediaGrid } from './MediaGrid';
import { apiRequest, automationKeys } from './api';
import { TEMPLATES, draftToPayload } from './drafts';
import { fillPreview } from './format';
import { inputClass, primaryButton, secondaryButton, iconButton } from './styles';
import { Switch, Segmented, Field, InitialAvatar, Modal } from './ui';

const AutomationPreview = ({ draft, account }) => {
  const handle = account?.username || 'your_account';
  const sampleComment = draft.triggerType === 'keywords' && draft.keywords[0]
    ? `${draft.keywords[0]} please! 🙌`
    : 'Love this! 😍';
  const reply = draft.replies.find((item) => item.trim());

  return (
    <div className="flex h-full flex-col">
      <p className="m-0 mb-3 text-xs font-medium text-zinc-500">Preview</p>
      <div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
        <div>
          <p className="m-0 mb-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <MessageCircle className="h-3.5 w-3.5" /> On your post
          </p>
          <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
            <div className="flex gap-2.5">
              <InitialAvatar name="sample_user" className="h-7 w-7 text-[11px]" />
              <p className="m-0 text-sm leading-snug text-zinc-200">
                <span className="font-semibold text-white">sample_user</span> {sampleComment}
              </p>
            </div>
            {reply ? (
              <div className="ml-8 flex gap-2.5">
                <AccountAvatar account={account} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                <p className="m-0 text-sm leading-snug text-zinc-200">
                  <span className="font-semibold text-white">{handle}</span> {fillPreview(reply)}
                </p>
              </div>
            ) : (
              <p className="m-0 ml-8 text-xs italic text-zinc-600">No public reply</p>
            )}
          </div>
        </div>

        {account?.supportsDm !== false && (
        <div>
          <p className="m-0 mb-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <Send className="h-3.5 w-3.5" /> In their DMs
          </p>
          <div className="rounded-xl bg-white/[0.03] p-3">
            {draft.sendDm && draft.dmMessage.trim() ? (
              <div className="flex items-end gap-2">
                <AccountAvatar account={account} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                <p className="m-0 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2 text-sm leading-snug text-white">
                  {fillPreview(draft.dmMessage)}
                </p>
              </div>
            ) : (
              <p className="m-0 text-xs italic text-zinc-600">{draft.sendDm ? 'Write a DM message to preview it' : 'No DM'}</p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

const StepHeader = ({ number, title, description, action }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7831d6]/20 text-xs font-bold text-[#c4a5f5]">
        {number}
      </span>
      <div>
        <h4 className="m-0 text-[15px] font-semibold text-white">{title}</h4>
        {description && <p className="m-0 mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
    </div>
    {action}
  </div>
);

const TemplatePicker = ({ onPick, onBlank }) => (
  <div className="space-y-4 px-6 py-6">
    <div className="grid gap-3 sm:grid-cols-2">
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onPick(template)}
          className="group flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-[#7831d6]/60 hover:bg-[#7831d6]/[0.06]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7831d6]/15 text-[#c4a5f5]">
            <template.icon className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">{template.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{template.description}</span>
          </span>
        </button>
      ))}
    </div>
    <button type="button" onClick={onBlank} className={`${secondaryButton} w-full`}>
      <Plus className="h-4 w-4" /> Start from scratch
    </button>
  </div>
);

const SubmitButton = ({ form, pending, ruleId, className = '' }) => (
  <button type="submit" form={form} disabled={pending} className={`${primaryButton} shrink-0 ${className}`}>
    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
    {ruleId ? 'Save changes' : 'Create automation'}
  </button>
);

// The editor shows in a dialog (variant="modal") or as the body of its own page (variant="page").
const EditorFrame = ({ variant, onClose, wide, children }) => (
  variant === 'page' ? (
    <div className="flex flex-col rounded-3xl border border-white/10 bg-[#111114]">{children}</div>
  ) : (
    <Modal onClose={onClose} className={wide ? 'max-w-5xl' : 'max-w-2xl'}>{children}</Modal>
  )
);

// `request` and `rulesKey` let another page (e.g. the admin one) reuse the editor against its own endpoints
// `allowTemplates={false}` skips the starter templates and opens a blank form.
// `accountPicker="dialog"` picks the account in a dialog searchable by account or handler name.
// `multiAccount` (new rules, dialog picker) lets one form create the rule on several accounts.
export const RuleEditor = ({
  variant = 'modal',
  allowTemplates = true,
  accountPicker = 'dropdown',
  multiAccount = false,
  accounts,
  initialDraft,
  ruleId,
  showTemplates,
  onClose,
  onSaved,
  onDirtyChange,
  request = apiRequest,
  rulesKey = automationKeys.rules(),
}) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialDraft);
  const [pickingTemplate, setPickingTemplate] = useState(allowTemplates && showTemplates);
  const [error, setError] = useState('');
  const update = (changes) => setDraft((current) => ({ ...current, ...changes }));
  const isPage = variant === 'page';
  const formId = useId();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  // As a page, reloading or closing the tab with unsaved changes asks first, and the
  // page is told about changes so its own back link can ask too (a dialog closes on purpose)
  useEffect(() => {
    if (!isPage || !dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isPage, dirty]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const multi = multiAccount && !ruleId;
  const selectedIds = (multi ? draft.socialAccountIds || [draft.socialAccountId] : [draft.socialAccountId])
    .filter(Boolean)
    .map(String);
  const selectedAccounts = accounts.filter((item) => selectedIds.includes(String(item._id)));
  const severalAccounts = selectedAccounts.length > 1;
  // The first chosen account drives the preview
  const account = selectedAccounts[0];
  const canDm = selectedAccounts.length === 0 || selectedAccounts.some((item) => item.supportsDm !== false);
  const someWithoutDm = canDm && selectedAccounts.some((item) => item.supportsDm === false);
  const notReady = selectedAccounts.filter((item) => !(item.hasAutomationScopes && item.subscribedAt));

  const mediaQuery = useQuery({
    queryKey: automationKeys.media(draft.socialAccountId),
    queryFn: () => request(`/accounts/${draft.socialAccountId}/media`),
    enabled: Boolean(draft.socialAccountId) && draft.mediaScope === 'specific',
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => (
      severalAccounts
        ? request('/rules/batch', { method: 'POST', body: { ...payload, socialAccountIds: selectedIds } })
        : request(ruleId ? `/rules/${ruleId}` : '/rules', { method: ruleId ? 'PATCH' : 'POST', body: payload })
    ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: rulesKey });
      if (ruleId) onSaved('Automation updated');
      else onSaved(data?.created > 1 ? `${data.created} automations created` : 'Automation created');
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const toggleMedia = (mediaId) => update({
    mediaIds: draft.mediaIds.includes(mediaId)
      ? draft.mediaIds.filter((id) => id !== mediaId)
      : [...draft.mediaIds, mediaId],
  });

  const setReply = (index, value) => update({ replies: draft.replies.map((item, i) => (i === index ? value : item)) });
  const removeReply = (index) => update({
    replies: draft.replies.length > 1 ? draft.replies.filter((_, i) => i !== index) : [''],
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    if (!selectedIds.length) {
      setError(multi ? 'Choose at least one account.' : 'Choose an account.');
      return;
    }
    saveMutation.mutate(draftToPayload(canDm ? draft : { ...draft, sendDm: false }));
  };

  const title = ruleId ? 'Edit automation' : pickingTemplate ? 'New automation' : draft.name || 'New automation';

  return (
    <EditorFrame variant={variant} onClose={onClose} wide={!pickingTemplate}>
      <div className={`flex items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4 ${
        isPage ? 'sticky top-0 z-10 rounded-t-3xl bg-[#111114]/95 backdrop-blur' : ''
      }`}>
        <div className="flex min-w-0 items-center gap-2">
          {allowTemplates && !ruleId && !pickingTemplate && (
            <button type="button" onClick={() => setPickingTemplate(true)} className={iconButton} aria-label="Back to templates">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-semibold text-white">{title}</h3>
            {pickingTemplate && <p className="m-0 mt-0.5 text-xs text-zinc-500">Pick a starting point. You can change everything after.</p>}
          </div>
        </div>
        {/* As a page, the save button sits top right and stays in view while scrolling */}
        {isPage ? (
          !pickingTemplate && <SubmitButton form={formId} pending={saveMutation.isPending} ruleId={ruleId} />
        ) : (
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {pickingTemplate ? (
        <div className={isPage ? '' : 'overflow-y-auto'}>
          <TemplatePicker
            onPick={(template) => {
              setDraft((current) => ({ ...current, ...template.draft, replies: [...template.draft.replies] }));
              setPickingTemplate(false);
            }}
            onBlank={() => setPickingTemplate(false)}
          />
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {isPage && error && (
            <p className="m-0 mx-6 mt-5 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-300">{error}</p>
          )}
          <div className={`grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px] ${isPage ? '' : 'overflow-y-auto'}`}>
            <div className="space-y-8 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="automation-name">
                  <input
                    id="automation-name"
                    className={inputClass}
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                    placeholder="e.g. Send product link"
                    maxLength={120}
                  />
                </Field>
                <Field label="Account" htmlFor="automation-account">
                  {multi && accountPicker === 'dialog' ? (
                    <AccountPicker
                      id="automation-account"
                      multiple
                      accounts={accounts}
                      value={selectedIds}
                      onChange={(ids) => update({
                        socialAccountIds: ids.map(String),
                        socialAccountId: ids.length ? String(ids[0]) : '',
                        mediaIds: [],
                        // Posts belong to one account, so several accounts always mean "any post"
                        ...(ids.length > 1 ? { mediaScope: 'all' } : {}),
                      })}
                    />
                  ) : accountPicker === 'dialog' ? (
                    <AccountPicker
                      id="automation-account"
                      accounts={accounts}
                      value={draft.socialAccountId}
                      onChange={(socialAccountId) => update({ socialAccountId, mediaIds: [] })}
                      disabled={Boolean(ruleId)}
                    />
                  ) : (
                    <AccountSelect
                      id="automation-account"
                      accounts={accounts}
                      value={draft.socialAccountId}
                      onChange={(socialAccountId) => update({ socialAccountId, mediaIds: [] })}
                      disabled={Boolean(ruleId)}
                    />
                  )}
                </Field>
              </div>

              {notReady.length > 0 && (
                <p className="m-0 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  {severalAccounts
                    ? `${notReady.length} of ${selectedAccounts.length} accounts still need setup (${notReady.map((item) => item.name || item.username).join(', ')}). Their automations won't run until they're reconnected.`
                    : "This account still needs setup, so the automation won't run until it's reconnected."}
                </p>
              )}
              {severalAccounts && (
                <p className="m-0 rounded-xl bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-zinc-400">
                  A separate automation is created on each of the {selectedAccounts.length} accounts, so you can pause or edit them one by one later.
                </p>
              )}

              <section className="space-y-4">
                <StepHeader number={1} title="When someone comments" description="Choose which comments start this automation." />
                <div className="space-y-4 pl-9">
                  <Segmented
                    value={draft.triggerType}
                    onChange={(triggerType) => update({ triggerType })}
                    options={[{ value: 'keywords', label: 'With a keyword' }, { value: 'any', label: 'Anything' }]}
                  />
                  {draft.triggerType === 'keywords' && (
                    <Field hint="Matches whole words, ignoring case. “link” won't match “linked”.">
                      <KeywordInput keywords={draft.keywords} onChange={(keywords) => update({ keywords })} />
                    </Field>
                  )}
                  <Field label="On">
                    <Segmented
                      value={draft.mediaScope}
                      onChange={(mediaScope) => { if (!severalAccounts) update({ mediaScope }); }}
                      options={[{ value: 'all', label: 'Any post' }, { value: 'specific', label: 'Specific posts' }]}
                    />
                  </Field>
                  {severalAccounts && (
                    <p className="m-0 -mt-2 text-xs text-zinc-500">To pick specific posts, choose a single account.</p>
                  )}
                  {draft.mediaScope === 'specific' && (
                    <div>
                      {!draft.socialAccountId && <p className="m-0 text-sm text-zinc-500">Select an account first.</p>}
                      {mediaQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
                      {mediaQuery.error && <p className="m-0 text-sm text-rose-400">{mediaQuery.error.message}</p>}
                      {mediaQuery.data && (
                        <>
                          <MediaGrid media={mediaQuery.data} selectedIds={draft.mediaIds} onToggle={toggleMedia} />
                          <p className="m-0 mt-2 text-xs text-zinc-500">{draft.mediaIds.length} selected</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <StepHeader
                  number={2}
                  title="Reply to the comment"
                  description="A random reply is picked each time so they don't all look the same."
                />
                <div className="space-y-2 pl-9">
                  {draft.replies.map((reply, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        value={reply}
                        onChange={(event) => setReply(index, event.target.value)}
                        placeholder={index === 0 ? 'Sent you a DM {{username}}! 📩' : 'Another variation…'}
                        maxLength={300}
                        aria-label={`Reply variation ${index + 1}`}
                      />
                      {(draft.replies.length > 1 || reply) && (
                        <button type="button" onClick={() => removeReply(index)} className={iconButton} aria-label="Remove reply">
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {draft.replies.length < 10 && (
                    <button
                      type="button"
                      onClick={() => update({ replies: [...draft.replies, ''] })}
                      className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-[#c4a5f5] hover:text-white"
                    >
                      <Plus className="h-4 w-4" /> Add variation
                    </button>
                  )}
                  <p className="m-0 text-xs text-zinc-500">Leave empty to skip the public reply.</p>
                </div>
              </section>

              {canDm ? (
              <section className="space-y-4">
                <StepHeader
                  number={3}
                  title="Send them a DM"
                  description="One DM per comment, within 7 days of the comment."
                  action={<Switch checked={draft.sendDm} onChange={(sendDm) => update({ sendDm })} label="Send a DM" />}
                />
                {draft.sendDm && (
                  <div className="space-y-1.5 pl-9">
                    {someWithoutDm && (
                      <p className="m-0 text-xs text-zinc-500">YouTube accounts have no DMs, so they only get the public reply.</p>
                    )}
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-y leading-relaxed`}
                      value={draft.dmMessage}
                      onChange={(event) => update({ dmMessage: event.target.value })}
                      placeholder="Hey {{username}}! Here's the link you asked for: https://…"
                      maxLength={1000}
                      aria-label="DM message"
                    />
                    <p className="m-0 mt-1.5 text-right text-xs text-zinc-600">{draft.dmMessage.length}/1000</p>
                  </div>
                )}
              </section>
              ) : (
                <p className="m-0 flex items-start gap-2.5 rounded-xl border border-white/[0.06] px-4 py-3 text-xs leading-relaxed text-zinc-400">
                  <PlatformIcon platform={account?.platform} className="mt-0.5 h-4 w-4 shrink-0" />
                  YouTube has no direct messages, so this automation only replies to the comment.
                </p>
              )}

              <p className="m-0 rounded-xl bg-white/[0.03] px-4 py-3 text-xs text-zinc-400">
                Tip: write <code className="rounded bg-white/10 px-1 py-0.5 text-zinc-200">{'{{username}}'}</code> to mention the commenter.
              </p>
            </div>

            <aside className="hidden border-l border-white/[0.06] bg-white/[0.015] px-6 py-6 lg:block">
              <div className={`sticky ${isPage ? 'top-6' : 'top-0'}`}>
                <AutomationPreview draft={canDm ? draft : { ...draft, sendDm: false }} account={account} />
              </div>
            </aside>
          </div>

          {!isPage && (
            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 min-h-[1.25rem] text-sm text-rose-400">{error}</p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className={`${secondaryButton} flex-1 sm:flex-none`}>Cancel</button>
                <SubmitButton pending={saveMutation.isPending} ruleId={ruleId} className="flex-1 sm:flex-none" />
              </div>
            </div>
          )}
        </form>
      )}
    </EditorFrame>
  );
};
