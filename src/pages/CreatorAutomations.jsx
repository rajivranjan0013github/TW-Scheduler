import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ExternalLink,
  Gift,
  Heart,
  Inbox,
  Link2,
  Loader2,
  MessageCircle,
  MinusCircle,
  Pencil,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Tag,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import { connectInstagramOAuth, connectMetaOAuth, formatHandle } from '../utils/channelOAuth';
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

// ─── Drafts & templates ──────────────────────────────────────────────────────

const emptyDraft = {
  socialAccountId: '',
  name: '',
  enabled: true,
  mediaScope: 'all',
  mediaIds: [],
  triggerType: 'keywords',
  keywords: [],
  replies: [''],
  sendDm: true,
  dmMessage: '',
};

const TEMPLATES = [
  {
    id: 'link',
    icon: Link2,
    title: 'Send link in DM',
    description: 'Someone comments "link" → reply publicly and DM them the link.',
    draft: {
      name: 'Send link in DM',
      triggerType: 'keywords',
      keywords: ['link', 'send'],
      replies: ['Sent you a DM {{username}} 📩', 'Check your inbox {{username}}!'],
      sendDm: true,
      dmMessage: "Hey {{username}}! Here's the link you asked for: ",
    },
  },
  {
    id: 'price',
    icon: Tag,
    title: 'Answer price questions',
    description: 'Comments asking about price get the details in a DM.',
    draft: {
      name: 'Price questions',
      triggerType: 'keywords',
      keywords: ['price', 'cost', 'how much'],
      replies: ["Just DM'd you the details {{username}}!"],
      sendDm: true,
      dmMessage: 'Hi {{username}}! Thanks for asking. Here are the prices: ',
    },
  },
  {
    id: 'giveaway',
    icon: Gift,
    title: 'Giveaway entry',
    description: 'Confirm every entry publicly and send the rules by DM.',
    draft: {
      name: 'Giveaway entries',
      triggerType: 'any',
      keywords: [],
      replies: ["You're in {{username}}! 🎉", 'Entry confirmed {{username}}, good luck!'],
      sendDm: true,
      dmMessage: 'Thanks for entering {{username}}! Winners are announced on ',
    },
  },
  {
    id: 'thanks',
    icon: Heart,
    title: 'Thank every commenter',
    description: 'A friendly public reply on every comment. No DM.',
    draft: {
      name: 'Thank commenters',
      triggerType: 'any',
      keywords: [],
      replies: ['Thank you {{username}}! 🙏', 'Appreciate you {{username}} ❤️'],
      sendDm: false,
      dmMessage: '',
    },
  },
];

const ruleToDraft = (rule) => ({
  socialAccountId: String(rule.socialAccountId),
  name: rule.name,
  enabled: rule.enabled,
  mediaScope: rule.mediaScope,
  mediaIds: rule.mediaIds || [],
  triggerType: rule.triggerType,
  keywords: rule.keywords || [],
  replies: rule.commentReplies?.length ? rule.commentReplies : [''],
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
  keywords: draft.triggerType === 'keywords' ? draft.keywords : [],
  commentReplies: draft.replies.map((reply) => reply.trim()).filter(Boolean),
  sendDm: draft.sendDm,
  dmMessage: draft.sendDm ? draft.dmMessage : '',
});

// ─── Formatting ──────────────────────────────────────────────────────────────

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const formatRelative = (value) => {
  if (!value) return '';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let amount = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(amount) < size) return relativeTimeFormat.format(Math.round(amount), unit);
    amount /= size;
  }
  return '';
};

const fillPreview = (text, username = 'sample_user') => (
  String(text || '').replace(/\{\{\s*username\s*\}\}/gi, `@${username}`)
);

// Instagram commenters have @handles; Facebook only exposes a display name
const commenterLabel = (item) => item?.username || item?.name || 'Unknown user';

const accountLabel = (account) => (account ? formatHandle(account.username) || account.name : 'Unknown account');

// ─── Small UI primitives ─────────────────────────────────────────────────────

const inputClass = 'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-[#7831d6] focus:bg-white/[0.05]';
const primaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7831d6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#7831d6]/20 transition hover:bg-[#6825bc] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100';
const secondaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]';
const iconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.08] hover:text-white';

const Switch = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
      checked ? 'bg-[#7831d6]' : 'bg-white/15'
    }`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
  </button>
);

const Segmented = ({ value, options, onChange }) => (
  <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-white/[0.04] p-1">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
          value === option.value ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Field = ({ label, hint, htmlFor, children }) => (
  <div className="space-y-2">
    {label && <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-200">{label}</label>}
    {children}
    {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
  </div>
);

const InitialAvatar = ({ name, className = 'h-8 w-8 text-xs' }) => (
  <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7831d6]/60 to-fuchsia-500/40 font-semibold uppercase text-white ${className}`}>
    {(name || '?').replace(/^@/, '').charAt(0) || '?'}
  </span>
);

const Modal = ({ onClose, children, className = 'max-w-md' }) => {
  useEffect(() => {
    const handleKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#111114] shadow-2xl sm:rounded-3xl ${className}`}>
        {children}
      </div>
    </div>
  );
};

const Toast = ({ toast, onDone }) => {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [toast, onDone]);
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 md:bottom-8">
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
        isError ? 'border-rose-500/30 bg-rose-950/90 text-rose-100' : 'border-white/10 bg-zinc-900/95 text-white'
      }`}>
        {isError ? <XCircle className="h-4 w-4 text-rose-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {toast.message}
      </div>
    </div>
  );
};

// ─── Account picker ──────────────────────────────────────────────────────────

const AccountOption = ({ account, size = 'h-8 w-8' }) => (
  <span className="flex min-w-0 items-center gap-3">
    <span className="relative shrink-0">
      <AccountAvatar account={account} className={`${size} rounded-full object-cover`} />
      <PlatformIcon platform={account.platform || 'instagram'} className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5" />
    </span>
    <span className="min-w-0 text-left">
      <span className="block truncate text-sm font-medium text-white">{account.name || account.username}</span>
      {account.username && <span className="block truncate text-xs text-zinc-500">{formatHandle(account.username)}</span>}
    </span>
  </span>
);

const AccountSelect = ({ accounts, value, onChange, disabled, id, placeholder = 'Select an account' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = accounts.find((account) => String(account._id) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white/[0.03] px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-[#7831d6]' : 'border-white/10 hover:border-white/20'
        }`}
      >
        {selected ? <AccountOption account={selected} /> : <span className="py-1.5 text-sm text-zinc-500">{placeholder}</span>}
        {!disabled && <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#18181c] p-1.5 shadow-2xl shadow-black/60"
        >
          {accounts.map((account) => {
            const isSelected = String(account._id) === String(value);
            return (
              <li key={account._id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(account._id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition ${
                    isSelected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <AccountOption account={account} />
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[#c4a5f5]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ─── Keyword chips ───────────────────────────────────────────────────────────

const KeywordInput = ({ keywords, onChange }) => {
  const [value, setValue] = useState('');
  const addKeyword = (raw) => {
    const keyword = raw.trim().toLowerCase();
    if (keyword && !keywords.includes(keyword)) onChange([...keywords, keyword]);
    setValue('');
  };

  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 transition focus-within:border-[#7831d6]">
      {keywords.map((keyword) => (
        <span key={keyword} className="inline-flex items-center gap-1 rounded-lg bg-[#7831d6]/20 py-1 pl-2.5 pr-1 text-sm text-[#d6c2fa]">
          {keyword}
          <button
            type="button"
            onClick={() => onChange(keywords.filter((item) => item !== keyword))}
            className="rounded p-0.5 text-[#b99cf0] hover:bg-white/10 hover:text-white"
            aria-label={`Remove ${keyword}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next.endsWith(',')) addKeyword(next.slice(0, -1));
          else setValue(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); addKeyword(value); }
          if (event.key === 'Backspace' && !value && keywords.length) onChange(keywords.slice(0, -1));
        }}
        onBlur={() => value && addKeyword(value)}
        placeholder={keywords.length ? 'Add another…' : 'Type a keyword and press Enter'}
        className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-zinc-500 outline-none"
        aria-label="Add keyword"
      />
    </div>
  );
};

// ─── Post picker ─────────────────────────────────────────────────────────────

const MediaGrid = ({ media, selectedIds, onToggle }) => (
  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
    {media.map((item) => {
      const selected = selectedIds.includes(item.id);
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onToggle(item.id)}
          title={item.caption || ''}
          className={`relative aspect-square overflow-hidden rounded-xl ring-2 transition ${
            selected ? 'ring-[#7831d6]' : 'ring-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <img
            src={item.thumbnail_url || item.media_url}
            alt={item.caption ? item.caption.slice(0, 60) : 'Post'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {selected && (
            <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#7831d6] text-white shadow">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ─── Live preview ────────────────────────────────────────────────────────────

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

// ─── Rule editor ─────────────────────────────────────────────────────────────

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

const RuleEditor = ({ accounts, initialDraft, ruleId, showTemplates, onClose, onSaved }) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialDraft);
  const [pickingTemplate, setPickingTemplate] = useState(showTemplates);
  const [error, setError] = useState('');
  const update = (changes) => setDraft((current) => ({ ...current, ...changes }));
  const account = accounts.find((item) => String(item._id) === String(draft.socialAccountId));
  const canDm = account?.supportsDm !== false;

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
      onSaved(ruleId ? 'Automation updated' : 'Automation created');
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
    saveMutation.mutate(draftToPayload(canDm ? draft : { ...draft, sendDm: false }));
  };

  const title = ruleId ? 'Edit automation' : pickingTemplate ? 'New automation' : draft.name || 'New automation';

  return (
    <Modal onClose={onClose} className={pickingTemplate ? 'max-w-2xl' : 'max-w-5xl'}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="flex min-w-0 items-center gap-2">
          {!ruleId && !pickingTemplate && (
            <button type="button" onClick={() => setPickingTemplate(true)} className={iconButton} aria-label="Back to templates">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-semibold text-white">{title}</h3>
            {pickingTemplate && <p className="m-0 mt-0.5 text-xs text-zinc-500">Pick a starting point. You can change everything after.</p>}
          </div>
        </div>
        <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {pickingTemplate ? (
        <div className="overflow-y-auto">
          <TemplatePicker
            onPick={(template) => {
              setDraft((current) => ({ ...current, ...template.draft, replies: [...template.draft.replies] }));
              setPickingTemplate(false);
            }}
            onBlank={() => setPickingTemplate(false)}
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
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
                  <AccountSelect
                    id="automation-account"
                    accounts={accounts}
                    value={draft.socialAccountId}
                    onChange={(socialAccountId) => update({ socialAccountId, mediaIds: [] })}
                    disabled={Boolean(ruleId)}
                  />
                </Field>
              </div>

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
                      onChange={(mediaScope) => update({ mediaScope })}
                      options={[{ value: 'all', label: 'Any post' }, { value: 'specific', label: 'Specific posts' }]}
                    />
                  </Field>
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
                  <div className="pl-9">
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
              <div className="sticky top-0">
                <AutomationPreview draft={canDm ? draft : { ...draft, sendDm: false }} account={account} />
              </div>
            </aside>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 min-h-[1.25rem] text-sm text-rose-400">{error}</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={`${secondaryButton} flex-1 sm:flex-none`}>Cancel</button>
              <button type="submit" disabled={saveMutation.isPending} className={`${primaryButton} flex-1 sm:flex-none`}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {ruleId ? 'Save changes' : 'Create automation'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};

// ─── Confirm dialog ──────────────────────────────────────────────────────────

const ConfirmDelete = ({ rule, pending, onCancel, onConfirm }) => (
  <Modal onClose={onCancel}>
    <div className="space-y-4 p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
        <Trash2 className="h-5 w-5" />
      </span>
      <div>
        <h3 className="m-0 text-base font-semibold text-white">Delete “{rule.name}”?</h3>
        <p className="m-0 mt-1.5 text-sm leading-relaxed text-zinc-400">
          It stops replying straight away. Activity already logged stays in the Activity tab.
        </p>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className={`${secondaryButton} flex-1`}>Cancel</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete
        </button>
      </div>
    </div>
  </Modal>
);

// ─── Rules tab ───────────────────────────────────────────────────────────────

const FlowLabel = ({ children }) => (
  <span className="w-12 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</span>
);

const Pill = ({ children, tone = 'neutral' }) => (
  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
    tone === 'accent' ? 'bg-[#7831d6]/20 text-[#d6c2fa]' : 'bg-white/[0.06] text-zinc-300'
  }`}>
    {children}
  </span>
);

const RuleCard = ({ rule, account, onToggle, onEdit, onDelete }) => (
  <article className={`group rounded-2xl border bg-white/[0.02] p-5 transition hover:border-white/15 ${
    rule.enabled ? 'border-white/10' : 'border-white/[0.06] opacity-70'
  }`}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <AccountAvatar account={account} className="h-10 w-10 rounded-xl object-cover" />
          <PlatformIcon platform={account?.platform || rule.platform || 'instagram'} className="absolute -bottom-1 -right-1 h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="m-0 truncate text-[15px] font-semibold text-white">{rule.name}</h4>
          <p className="m-0 mt-0.5 truncate text-xs text-zinc-500">{accountLabel(account)}</p>
        </div>
      </div>
      <Switch checked={rule.enabled} onChange={onToggle} label={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name}`} />
    </div>

    <div className="mt-4 space-y-2.5 rounded-xl bg-black/30 p-3.5">
      <div className="flex gap-2">
        <FlowLabel>When</FlowLabel>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-300">
          {rule.triggerType === 'any' ? (
            <span>any comment</span>
          ) : (
            <>
              <span>comment has</span>
              {rule.keywords.slice(0, 4).map((keyword) => <Pill key={keyword} tone="accent">{keyword}</Pill>)}
              {rule.keywords.length > 4 && <Pill>+{rule.keywords.length - 4}</Pill>}
            </>
          )}
          <span>on</span>
          <Pill>{rule.mediaScope === 'all' ? 'any post' : `${rule.mediaIds.length} post${rule.mediaIds.length === 1 ? '' : 's'}`}</Pill>
        </div>
      </div>
      <div className="flex gap-2">
        <FlowLabel>Then</FlowLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          {rule.commentReplies.length > 0 && <Pill><Reply className="h-3 w-3" /> Reply</Pill>}
          {rule.commentReplies.length > 0 && rule.sendDm && <ArrowRight className="h-3 w-3 text-zinc-600" />}
          {rule.sendDm && <Pill><Send className="h-3 w-3" /> DM</Pill>}
        </div>
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="m-0 flex items-center gap-1.5 text-xs text-zinc-500">
        <Zap className="h-3.5 w-3.5" />
        {rule.triggeredCount ? `${rule.triggeredCount.toLocaleString()} times` : 'Not triggered yet'}
        {rule.lastTriggeredAt && <span>· {formatRelative(rule.lastTriggeredAt)}</span>}
      </p>
      <div className="flex gap-0.5">
        <button type="button" onClick={onEdit} className={iconButton} aria-label={`Edit ${rule.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDelete} className={`${iconButton} hover:bg-rose-500/10! hover:text-rose-400!`} aria-label={`Delete ${rule.name}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  </article>
);

const EmptyRules = ({ onPick }) => (
  <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#7831d6]/[0.08] to-transparent p-6 sm:p-10">
    <div className="mx-auto max-w-lg text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7831d6]/20 text-[#c4a5f5]">
        <Bot className="h-6 w-6" />
      </span>
      <h3 className="m-0 mt-4 text-lg font-semibold text-white">Create your first automation</h3>
      <p className="m-0 mt-1.5 text-sm text-zinc-400">Reply to comments and send DMs automatically, even while you sleep.</p>
    </div>
    <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onPick(template)}
          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#111114] p-4 text-left transition hover:border-[#7831d6]/60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7831d6]/15 text-[#c4a5f5]">
            <template.icon className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">{template.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{template.description}</span>
          </span>
        </button>
      ))}
    </div>
  </div>
);

// ─── Comments tab ────────────────────────────────────────────────────────────

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
      queryClient.setQueryData(['automations', 'comments', accountId, mediaId], (current) => (
        Array.isArray(current)
          ? current.map((item) => (item.id === comment.id ? { ...item, dmSent: true } : item))
          : current
      ));
      queryClient.invalidateQueries({ queryKey: ['automations', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['automations', 'recent-comments'] });
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
  const [message, setMessage] = useState(comment.username ? `@${comment.username} ` : '');
  const replyMutation = useMutation({
    mutationFn: () => apiRequest(`/comments/${comment.id}/reply`, { method: 'POST', body: { accountId, message } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'comments', accountId, mediaId] });
      queryClient.invalidateQueries({ queryKey: ['automations', 'recent-comments'] });
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
    queryKey: ['automations', 'media', accountId],
    queryFn: () => apiRequest(`/accounts/${accountId}/media`),
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
  });
  const commentsQuery = useQuery({
    queryKey: ['automations', 'comments', accountId, mediaId],
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
  const accountSupportsDm = accounts.find((account) => account._id === accountId)?.supportsDm !== false;
  // { commentId, mode: 'reply' | 'dm' } for the one open composer
  const [composer, setComposer] = useState(null);

  const syncMutation = useMutation({
    mutationFn: (force) => apiRequest('/comments/recent/sync', { method: 'POST', body: { accountId, force } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations', 'recent-comments'] }),
    onError,
  });
  const { mutate: syncComments } = syncMutation;
  useEffect(() => {
    if (accountId) syncComments(false);
  }, [accountId, syncComments]);

  const recentQuery = useQuery({
    queryKey: ['automations', 'recent-comments', accountId],
    queryFn: () => apiRequest(`/comments/recent?accountId=${accountId}&limit=60`),
    enabled: Boolean(accountId),
    refetchInterval: 15000,
  });
  const mediaQuery = useQuery({
    queryKey: ['automations', 'media', accountId],
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
        .then(() => queryClient.invalidateQueries({ queryKey: ['automations', 'recent-comments'] }))
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

const CommentsTab = ({ accounts, onSent, onDmSent, onError }) => {
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

// ─── Inbox tab ───────────────────────────────────────────────────────────────

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
  const queryKey = ['automations', 'inbox', 'messages', conversationId];

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
    if (loaded) queryClient.invalidateQueries({ queryKey: ['automations', 'inbox', 'conversations'] });
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
      queryClient.invalidateQueries({ queryKey: ['automations', 'inbox', 'conversations'] });
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

const InboxPanel = ({ accounts, onError }) => {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(accounts[0]?._id || '');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');

  const syncMutation = useMutation({
    mutationFn: (force) => apiRequest(`/inbox/accounts/${accountId}/sync`, { method: 'POST', body: { force } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations', 'inbox', 'conversations'] }),
    onError,
  });
  const { mutate: syncInbox } = syncMutation;

  useEffect(() => {
    if (accountId) syncInbox(false);
  }, [accountId, syncInbox]);

  const conversationsQuery = useQuery({
    queryKey: ['automations', 'inbox', 'conversations', accountId],
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

// ─── Activity tab ────────────────────────────────────────────────────────────

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

const ActivityPanel = ({ events, rulesById, isLoading }) => {
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>;
  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
        <Clock className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="m-0 mt-3 text-base font-semibold text-white">No activity yet</p>
        <p className="m-0 mt-1 text-sm text-zinc-400">Comments that trigger an automation will show up here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      {events.map((event) => {
        const rule = rulesById.get(String(event.ruleId));
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
                <span className="text-xs text-zinc-500">{rule ? rule.name : event.ruleId ? 'Deleted automation' : 'Sent manually'}</span>
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

// ─── Page ────────────────────────────────────────────────────────────────────

const SetupBanner = ({ accounts, onSubscribe, subscribingId }) => (
  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06]">
    <div className="flex items-center gap-2.5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
      <p className="m-0 text-sm text-amber-100">
        {accounts.length === 1 ? '1 account needs' : `${accounts.length} accounts need`} one more step before automations can run.
      </p>
    </div>
    <div className="divide-y divide-amber-500/10 border-t border-amber-500/10">
      {accounts.map((account) => (
        <div key={account._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <AccountAvatar account={account} className="h-7 w-7 shrink-0 rounded-full object-cover" />
            <span className="truncate text-sm font-medium text-white">{accountLabel(account)}</span>
            <span className="hidden truncate text-xs text-amber-200/60 sm:inline">
              {account.hasAutomationScopes ? 'Comment events are off' : account.supportsDm === false ? 'Needs comment access' : 'Needs comment & message access'}
            </span>
          </div>
          {account.hasAutomationScopes ? (
            <button
              type="button"
              onClick={() => onSubscribe(account._id)}
              disabled={Boolean(subscribingId)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
            >
              {subscribingId === account._id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Turn on
            </button>
          ) : (
            account.platform === 'youtube' ? (
              // YouTube reconnects go through My Channels, which shows the required YouTube Terms consent first
              <Link
                to="/channels"
                className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                Reconnect
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => (account.platform === 'facebook' ? connectMetaOAuth(null, account._id) : connectInstagramOAuth())}
                className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                Reconnect
              </button>
            )
          )}
        </div>
      ))}
    </div>
  </div>
);

const Tabs = ({ value, onChange, tabs }) => (
  <div className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-white/[0.08] [scrollbar-width:none]" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        type="button"
        role="tab"
        aria-selected={value === tab.value}
        onClick={() => onChange(tab.value)}
        className={`relative -mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${
          value === tab.value ? 'border-[#7831d6] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
        }`}
      >
        {tab.label}
        {tab.count > 0 && (
          <span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${value === tab.value ? 'bg-[#7831d6]/25 text-[#d6c2fa]' : 'bg-white/[0.06] text-zinc-500'}`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
    <p className="m-0 text-xs text-zinc-500">{label}</p>
    <p className="m-0 mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
  </div>
);

export const CreatorAutomations = () => {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState(null);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('automations');

  const accountsQuery = useQuery({
    queryKey: ['automations', 'accounts'],
    queryFn: () => apiRequest('/accounts'),
    staleTime: 60 * 1000,
  });
  const rulesQuery = useQuery({
    queryKey: ['automations', 'rules'],
    queryFn: () => apiRequest('/rules'),
  });
  const recentBadgeQuery = useQuery({
    queryKey: ['automations', 'recent-comments', 'badge'],
    queryFn: () => apiRequest('/comments/recent?limit=1'),
    refetchInterval: 15000,
  });
  const newComments = recentBadgeQuery.data?.unseenCount || 0;
  const inboxQuery = useQuery({
    queryKey: ['automations', 'inbox', 'conversations', 'all'],
    queryFn: () => apiRequest('/inbox/conversations'),
    refetchInterval: 15000,
  });
  const unreadConversations = (inboxQuery.data || []).filter((conversation) => conversation.unreadCount > 0).length;
  const eventsQuery = useQuery({
    queryKey: ['automations', 'events'],
    queryFn: () => apiRequest('/events?limit=50'),
    refetchInterval: 30 * 1000,
  });

  const accounts = accountsQuery.data || [];
  const rules = rulesQuery.data || [];
  const events = eventsQuery.data || [];
  const accountsById = useMemo(
    () => new Map((accountsQuery.data || []).map((account) => [String(account._id), account])),
    [accountsQuery.data]
  );
  const rulesById = useMemo(
    () => new Map((rulesQuery.data || []).map((rule) => [String(rule._id), rule])),
    [rulesQuery.data]
  );
  const readyAccounts = accounts.filter((account) => account.hasAutomationScopes && account.subscribedAt);
  const accountsNeedingSetup = accounts.filter((account) => !account.hasAutomationScopes || !account.subscribedAt);
  const commentAccounts = accounts.filter((account) => account.hasAutomationScopes);

  const clearToast = useCallback(() => setToast(null), []);
  const showError = (error) => setToast({ type: 'error', message: error.message });
  const subscribeMutation = useMutation({
    mutationFn: (accountId) => apiRequest(`/accounts/${accountId}/subscribe`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'accounts'] });
      setToast({ message: 'Comment events turned on' });
    },
    onError: showError,
  });
  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }) => apiRequest(`/rules/${ruleId}`, { method: 'PATCH', body: { enabled } }),
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] });
      setToast({ message: rule.enabled ? 'Automation resumed' : 'Automation paused' });
    },
    onError: showError,
  });
  const deleteMutation = useMutation({
    mutationFn: (ruleId) => apiRequest(`/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] });
      setRuleToDelete(null);
      setToast({ message: 'Automation deleted' });
    },
    onError: showError,
  });

  const defaultAccountId = readyAccounts[0]?._id || accounts[0]?._id || '';
  const openNewRule = (template = null) => setEditor({
    ruleId: null,
    showTemplates: !template,
    draft: {
      ...emptyDraft,
      socialAccountId: defaultAccountId,
      ...(template ? { ...template.draft, replies: [...template.draft.replies] } : {}),
    },
  });

  const activeCount = rules.filter((rule) => rule.enabled).length;
  const totalTriggers = rules.reduce((sum, rule) => sum + (rule.triggeredCount || 0), 0);
  const dmsSent = events.filter((event) => event.dmStatus === 'sent').length;
  const isLoading = accountsQuery.isLoading || rulesQuery.isLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="m-0 text-2xl font-bold tracking-tight text-white">Automations</h2>
          <p className="m-0 mt-1.5 text-sm text-zinc-400">
            Reply to Instagram, Facebook and YouTube comments, and send DMs automatically.
          </p>
        </div>
        {accounts.length > 0 && activeTab === 'automations' && (
          <button type="button" onClick={() => openNewRule()} className={`${primaryButton} self-start sm:self-auto`}>
            <Plus className="h-4 w-4" /> New automation
          </button>
        )}
      </header>

      {isLoading && (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
      )}

      {!isLoading && accounts.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <span className="mx-auto flex h-12 w-fit items-center justify-center gap-2.5 rounded-2xl bg-white/[0.04] px-3.5">
            <PlatformIcon platform="instagram" className="h-6 w-6" />
            <PlatformIcon platform="facebook" className="h-6 w-6" />
            <PlatformIcon platform="youtube" className="h-6 w-6" />
          </span>
          <h3 className="m-0 mt-4 text-lg font-semibold text-white">Connect Instagram, Facebook or YouTube to get started</h3>
          <p className="m-0 mt-1.5 text-sm text-zinc-400">Automations work with Instagram Business and Creator accounts, Facebook Pages and YouTube channels.</p>
          <Link to="/channels" className={`${primaryButton} mt-5`}>Go to My Channels</Link>
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <>
          {accountsNeedingSetup.length > 0 && (
            <SetupBanner
              accounts={accountsNeedingSetup}
              onSubscribe={(id) => subscribeMutation.mutate(id)}
              subscribingId={subscribeMutation.isPending ? subscribeMutation.variables : null}
            />
          )}

          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            tabs={[
              { value: 'automations', label: 'Automations', count: rules.length },
              { value: 'inbox', label: 'Inbox', count: unreadConversations },
              { value: 'comments', label: 'Comments', count: newComments },
              { value: 'activity', label: 'Activity', count: events.length },
            ]}
          />

          {activeTab === 'automations' && (
            rules.length === 0 ? (
              <EmptyRules onPick={openNewRule} />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Active" value={`${activeCount}/${rules.length}`} />
                  <Stat label="Times triggered" value={totalTriggers.toLocaleString()} />
                  <Stat label="Recent DMs sent" value={dmsSent.toLocaleString()} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {rules.map((rule) => (
                    <RuleCard
                      key={rule._id}
                      rule={rule}
                      account={accountsById.get(String(rule.socialAccountId))}
                      onToggle={(enabled) => toggleMutation.mutate({ ruleId: rule._id, enabled })}
                      onEdit={() => setEditor({ ruleId: rule._id, showTemplates: false, draft: ruleToDraft(rule) })}
                      onDelete={() => setRuleToDelete(rule)}
                    />
                  ))}
                </div>
              </div>
            )
          )}

          {activeTab === 'comments' && (
            <CommentsTab
              accounts={commentAccounts}
              onSent={() => setToast({ message: 'Reply posted' })}
              onDmSent={() => setToast({ message: 'DM sent' })}
              onError={showError}
            />
          )}

          {activeTab === 'inbox' && (
            <InboxPanel accounts={commentAccounts.filter((account) => account.supportsDm !== false)} onError={showError} />
          )}

          {activeTab === 'activity' && (
            <ActivityPanel events={events} rulesById={rulesById} isLoading={eventsQuery.isLoading} />
          )}
        </>
      )}

      {editor && (
        <RuleEditor
          accounts={accounts}
          initialDraft={editor.draft}
          ruleId={editor.ruleId}
          showTemplates={editor.showTemplates}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null);
            setToast({ message });
          }}
        />
      )}

      {ruleToDelete && (
        <ConfirmDelete
          rule={ruleToDelete}
          pending={deleteMutation.isPending}
          onCancel={() => setRuleToDelete(null)}
          onConfirm={() => deleteMutation.mutate(ruleToDelete._id)}
        />
      )}

      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
};

export default CreatorAutomations;
