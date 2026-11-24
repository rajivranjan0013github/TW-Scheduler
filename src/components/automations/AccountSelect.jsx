import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { formatHandle } from '../../utils/channelOAuth';
import PlatformIcon from '../PlatformIcon';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';

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

export const AccountSelect = ({ accounts, value, onChange, disabled, id, placeholder = 'Select an account' }) => {
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
