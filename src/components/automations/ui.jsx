import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { secondaryButton } from './styles';

export const Switch = ({ checked, onChange, label, disabled }) => (
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

export const Segmented = ({ value, options, onChange }) => (
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

export const Field = ({ label, hint, htmlFor, children }) => (
  <div className="space-y-2">
    {label && <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-200">{label}</label>}
    {children}
    {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
  </div>
);

export const InitialAvatar = ({ name, className = 'h-8 w-8 text-xs' }) => (
  <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7831d6]/60 to-fuchsia-500/40 font-semibold uppercase text-white ${className}`}>
    {(name || '?').replace(/^@/, '').charAt(0) || '?'}
  </span>
);

export const Modal = ({ onClose, children, className = 'max-w-md' }) => {
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

export const Toast = ({ toast, onDone }) => {
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

export const Tabs = ({ value, onChange, tabs }) => (
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

export const LoadError = ({ error, onRetry }) => (
  <div className="rounded-3xl border border-rose-500/20 bg-rose-500/[0.04] p-10 text-center">
    <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
    <p className="m-0 mt-3 text-base font-semibold text-white">Couldn't load your automations</p>
    <p className="m-0 mt-1 text-sm text-zinc-400">{error.message}</p>
    <button type="button" onClick={onRetry} className={`${secondaryButton} mt-5`}>
      <RefreshCw className="h-4 w-4" /> Try again
    </button>
  </div>
);

// tone="danger" highlights a number that needs attention (e.g. failures)
export const Stat = ({ label, value, hint, tone }) => (
  <div className={`rounded-2xl border px-4 py-3.5 ${
    tone === 'danger' ? 'border-rose-500/25 bg-rose-500/[0.05]' : 'border-white/[0.08] bg-white/[0.02]'
  }`}>
    <p className="m-0 text-xs text-zinc-500">{label}</p>
    <p className={`m-0 mt-1 text-xl font-semibold tabular-nums ${tone === 'danger' ? 'text-rose-300' : 'text-white'}`}>{value}</p>
    {hint && <p className="m-0 mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
  </div>
);
