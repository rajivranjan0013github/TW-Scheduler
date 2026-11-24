import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Search, X } from 'lucide-react';
import { formatHandle } from '../../utils/channelOAuth';
import PlatformIcon from '../PlatformIcon';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';
import { iconButton, primaryButton } from './styles';
import { Modal } from './ui';

// Account picker that opens a dialog with search by account name, @handle, or the
// name/email of the person who handles or owns it. Used on the admin editor page,
// where a campaign can have many accounts across several handlers.

const isReady = (account) => account.hasAutomationScopes && account.subscribedAt;

const peopleOf = (account) => {
  const people = [...(account.handlers || [])];
  if (account.owner && !people.some((person) => String(person._id) === String(account.owner._id))) people.push(account.owner);
  return people;
};

const handlerLabel = (account) => {
  const names = (account.handlers || []).map((person) => person.name || person.email).filter(Boolean);
  return names.length ? names.join(', ') : '';
};

const matches = (account, query) => {
  if (!query) return true;
  const fields = [
    account.name,
    account.username,
    account.platform,
    ...peopleOf(account).flatMap((person) => [person.name, person.email]),
  ];
  return fields.some((field) => String(field || '').toLowerCase().includes(query));
};

const AccountRow = ({ account, selected, onPick, multiple }) => {
  const handler = handlerLabel(account);
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(account)}
        role={multiple ? 'checkbox' : undefined}
        aria-checked={multiple ? selected : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
          selected ? 'bg-[#7831d6]/15 ring-1 ring-[#7831d6]/40' : 'hover:bg-white/[0.05]'
        }`}
      >
        {multiple && (
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            selected ? 'border-[#7831d6] bg-[#7831d6] text-white' : 'border-white/20'
          }`} aria-hidden="true">
            {selected && <Check className="h-3.5 w-3.5" />}
          </span>
        )}
        <span className="relative shrink-0">
          <AccountAvatar account={account} className="h-10 w-10 rounded-full object-cover" />
          <PlatformIcon platform={account.platform} className="absolute -bottom-0.5 -right-0.5 h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{account.name || account.username}</span>
          <span className="block truncate text-xs text-zinc-500">
            {account.username ? formatHandle(account.username) : account.platform}
            {handler && <> · Handler: <span className="text-zinc-300">{handler}</span></>}
          </span>
        </span>
        {!isReady(account) && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Needs setup
          </span>
        )}
        {selected && !multiple && <Check className="h-4 w-4 shrink-0 text-[#c4a5f5]" />}
      </button>
    </li>
  );
};

// In `multiple` mode, value is an array of ids and choices apply when Done is pressed
const AccountPickerDialog = ({ accounts, value, onChange, onClose, multiple }) => {
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(() => new Set((multiple ? value : [value]).filter(Boolean).map(String)));
  const query = search.trim().toLowerCase();
  const results = useMemo(() => accounts.filter((account) => matches(account, query)), [accounts, query]);
  const allShownChosen = results.length > 0 && results.every((account) => chosen.has(String(account._id)));

  const pick = (account) => {
    if (!multiple) {
      onChange(account._id);
      onClose();
      return;
    }
    setChosen((current) => {
      const next = new Set(current);
      const key = String(account._id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleAllShown = () => setChosen((current) => {
    const next = new Set(current);
    results.forEach((account) => (allShownChosen ? next.delete(String(account._id)) : next.add(String(account._id))));
    return next;
  });
  const done = () => {
    // Keep the accounts' own order so the first chosen one drives the preview
    onChange(accounts.filter((account) => chosen.has(String(account._id))).map((account) => account._id));
    onClose();
  };

  return (
    // Fixed height so the dialog doesn't jump as search narrows the list; the list scrolls inside
    <Modal onClose={onClose} className="h-[min(560px,85vh)] max-w-lg">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <h3 className="m-0 text-base font-semibold text-white">{multiple ? 'Choose accounts' : 'Choose an account'}</h3>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">{accounts.length} account{accounts.length === 1 ? '' : 's'} in this campaign</p>
        </div>
        <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="border-b border-white/[0.06] p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition focus-within:border-[#7831d6]">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (!multiple && results.length === 1) pick(results[0]);
              }
            }}
            placeholder="Search by account or handler name"
            aria-label="Search accounts by account or handler name"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none"
            autoFocus
          />
        </div>
      </div>
      {multiple && results.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-5 pt-3 text-xs">
          <button type="button" onClick={toggleAllShown} className="font-semibold text-[#c4a5f5] hover:text-white">
            {allShownChosen ? 'Unselect' : 'Select'} {query ? `all ${results.length} shown` : `all ${results.length}`}
          </button>
          {chosen.size > 0 && (
            <button type="button" onClick={() => setChosen(new Set())} className="font-semibold text-zinc-500 hover:text-white">Clear</button>
          )}
        </div>
      )}
      <ul className="m-0 min-h-0 flex-1 list-none space-y-1 overflow-y-auto p-2" aria-label="Accounts">
        {results.map((account) => (
          <AccountRow
            key={account._id}
            account={account}
            selected={chosen.has(String(account._id))}
            onPick={pick}
            multiple={multiple}
          />
        ))}
        {results.length === 0 && (
          <li className="px-3 py-10 text-center text-sm text-zinc-500">No account or handler matches “{search.trim()}”.</li>
        )}
      </ul>
      {multiple && (
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
          <span className="text-xs text-zinc-400">{chosen.size} selected</span>
          <button type="button" onClick={done} disabled={chosen.size === 0} className={`${primaryButton} px-4 py-2 text-xs`}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
};

/**
 * The field: shows the chosen account(s) and handler; clicking it opens the search dialog.
 * With `multiple`, value/onChange use an array of account ids.
 */
export const AccountPicker = ({ id, accounts, value, onChange, disabled, multiple = false }) => {
  const [open, setOpen] = useState(false);
  const ids = (multiple ? value || [] : [value]).map(String);
  const chosen = accounts.filter((account) => ids.includes(String(account._id)));
  const selected = chosen.length === 1 ? chosen[0] : null;
  const handler = selected && handlerLabel(selected);

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {chosen.length > 1 ? (
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 -space-x-2">
              {chosen.slice(0, 3).map((account) => (
                <AccountAvatar key={account._id} account={account} className="h-8 w-8 rounded-full border-2 border-[#111114] object-cover" />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{chosen.length} accounts</span>
              <span className="block truncate text-xs text-zinc-500">{chosen.map((account) => account.name || account.username).join(', ')}</span>
            </span>
          </span>
        ) : selected ? (
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative shrink-0">
              <AccountAvatar account={selected} className="h-8 w-8 rounded-full object-cover" />
              <PlatformIcon platform={selected.platform} className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{selected.name || selected.username}</span>
              <span className="block truncate text-xs text-zinc-500">
                {selected.username ? formatHandle(selected.username) : selected.platform}
                {handler && ` · ${handler}`}
              </span>
            </span>
          </span>
        ) : (
          <span className="py-1.5 text-sm text-zinc-500">{multiple ? 'Choose accounts' : 'Choose an account'}</span>
        )}
        {!disabled && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#c4a5f5]">
            {chosen.length ? 'Change' : 'Choose'} <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {open && (
        <AccountPickerDialog accounts={accounts} value={value} onChange={onChange} onClose={() => setOpen(false)} multiple={multiple} />
      )}
    </>
  );
};
