import {
  ArrowRight,
  Bot,
  Loader2,
  Pencil,
  Reply,
  Send,
  Trash2,
  Zap,
} from 'lucide-react';
import PlatformIcon from '../PlatformIcon';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';
import { TEMPLATES } from './drafts';
import { formatRelative, accountLabel } from './format';
import { secondaryButton, iconButton } from './styles';
import { Switch, Modal } from './ui';

export const ConfirmDelete = ({ rule, pending, onCancel, onConfirm }) => (
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

export const RuleCard = ({ rule, account, toggling, onToggle, onEdit, onDelete }) => (
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
      <Switch checked={rule.enabled} onChange={onToggle} disabled={toggling} label={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name}`} />
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

export const EmptyRules = ({ onPick }) => (
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
