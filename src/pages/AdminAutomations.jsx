import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';
import { ActivityPanel } from '../components/automations/ActivityPanel';
import { AdminCommentsPanel } from '../components/automations/AdminCommentsPanel';
import { NoCampaignSelected } from '../components/automations/NoCampaignSelected';
import { ConfirmDelete } from '../components/automations/RulesTab';
import { adminAutomationKeys, adminRequest, toQuery } from '../components/automations/api';
import { accountLabel, formatRelative } from '../components/automations/format';
import { iconButton, inputClass, primaryButton, secondaryButton } from '../components/automations/styles';
import { LoadError, Segmented, Stat, Switch, Tabs, Toast } from '../components/automations/ui';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
];
const SCOPE_FILTERS = ['handlerId', 'platform'];
const selectClass = `${inputClass} appearance-none py-2 pr-8 text-xs sm:w-auto`;
const toKey = (value) => (value == null ? '' : String(value));

const isReady = (account) => account.hasAutomationScopes && account.subscribedAt;
const setupProblem = (account) => {
  if (!account.hasAutomationScopes) {
    return account.supportsDm === false ? 'Needs comment access' : 'Needs comment & message access';
  }
  return account.subscribedAt ? '' : 'Comment events are off';
};

// Same rules as the backend filter, so the Accounts tab matches the other tabs
const matchesScope = (account, { handlerId, platform }) => (
  (!platform || account.platform === platform)
  && (!handlerId || toKey(account.owner?._id) === handlerId
    || (account.handlers || []).some((handler) => toKey(handler._id) === handlerId))
);

const peopleLabel = (people = []) => (
  people.length === 0 ? '—' : people.map((person) => person.name || person.email).join(', ')
);

// ─── Filters ─────────────────────────────────────────────────────────────────

const FilterSelect = ({ label, value, onChange, options, allLabel }) => (
  <label className="relative block">
    <span className="sr-only">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass} aria-label={label}>
      <option value="">{allLabel}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">▼</span>
  </label>
);

const Filters = ({ accounts, filters, onChange, search, onSearch }) => {
  const handlers = useMemo(() => {
    const byId = new Map();
    accounts.forEach((account) => [account.owner, ...(account.handlers || [])].forEach((person) => {
      if (person?._id) byId.set(toKey(person._id), person.name || person.email);
    }));
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts]);
  const hasFilters = SCOPE_FILTERS.some((key) => filters[key]) || filters.status || search;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition focus-within:border-[#7831d6] sm:w-64">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search automations"
          aria-label="Search automations"
          className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <FilterSelect label="Handler" value={filters.handlerId} onChange={(value) => onChange({ handlerId: value })} options={handlers} allLabel="All handlers" />
        <FilterSelect label="Platform" value={filters.platform} onChange={(value) => onChange({ platform: value })} options={PLATFORMS} allLabel="All platforms" />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => onChange({ status: value })}
          options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]}
          allLabel="Any status"
        />
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={() => { onSearch(''); onChange({ handlerId: '', platform: '', status: '' }); }}
          className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-2 text-xs font-semibold text-zinc-400 transition hover:text-white sm:self-auto"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
};

// ─── Rules table ─────────────────────────────────────────────────────────────

const TriggerSummary = ({ rule }) => (
  <p className="m-0 mt-0.5 truncate text-xs text-zinc-500">
    {rule.triggerType === 'any' ? 'Any comment' : `Keywords: ${rule.keywords.slice(0, 3).join(', ')}${rule.keywords.length > 3 ? ` +${rule.keywords.length - 3}` : ''}`}
    {' · '}
    {rule.mediaScope === 'all' ? 'all posts' : `${rule.mediaIds.length} post${rule.mediaIds.length === 1 ? '' : 's'}`}
  </p>
);

const RuleActions = ({ rule }) => (
  <div className="flex flex-wrap gap-1">
    {rule.commentReplies.length > 0 && (
      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-zinc-300"><Reply className="h-3 w-3" /> Reply</span>
    )}
    {rule.sendDm && (
      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-zinc-300"><Send className="h-3 w-3" /> DM</span>
    )}
  </div>
);

const RulesTable = ({ rules, accountsById, selected, onSelect, onSelectAll, togglingId, onToggle, onEdit, onDelete }) => {
  const allSelected = rules.length > 0 && rules.every((rule) => selected.has(toKey(rule._id)));
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full min-w-[860px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onSelectAll(!allSelected)}
                aria-label="Select all automations"
                className="h-4 w-4 accent-[#7831d6]"
              />
            </th>
            <th className="px-3 py-3 font-semibold">Automation</th>
            <th className="px-3 py-3 font-semibold">Account</th>
            <th className="px-3 py-3 font-semibold">Handler</th>
            <th className="px-3 py-3 font-semibold">Does</th>
            <th className="px-3 py-3 font-semibold">Triggered</th>
            <th className="px-3 py-3 font-semibold">On</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rules.map((rule) => {
            const id = toKey(rule._id);
            const account = accountsById.get(toKey(rule.socialAccountId));
            return (
              <tr key={id} className={`transition hover:bg-white/[0.02] ${rule.enabled ? '' : 'opacity-60'}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => onSelect(id)}
                    aria-label={`Select ${rule.name}`}
                    className="h-4 w-4 accent-[#7831d6]"
                  />
                </td>
                <td className="max-w-[240px] px-3 py-3">
                  <button type="button" onClick={() => onEdit(rule)} className="block max-w-full truncate text-left text-sm font-semibold text-white hover:text-[#d6c2fa]">
                    {rule.name}
                  </button>
                  <TriggerSummary rule={rule} />
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2">
                    <span className="relative shrink-0">
                      <AccountAvatar account={account} className="h-7 w-7 rounded-full object-cover" />
                      <PlatformIcon platform={account?.platform || rule.platform} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
                    </span>
                    <span className="max-w-[150px] truncate text-zinc-200">{accountLabel(account)}</span>
                  </span>
                </td>
                <td className="max-w-[200px] px-3 py-3">
                  <p className="m-0 truncate text-zinc-200">{peopleLabel(rule.handlers)}</p>
                  {rule.owner && toKey(rule.owner._id) !== toKey(rule.handlers?.[0]?._id) && (
                    <p className="m-0 mt-0.5 truncate text-zinc-500">Owner: {rule.owner.name || rule.owner.email}</p>
                  )}
                </td>
                <td className="px-3 py-3"><RuleActions rule={rule} /></td>
                <td className="px-3 py-3 tabular-nums">
                  <p className="m-0 text-zinc-200">{(rule.triggeredCount || 0).toLocaleString()}</p>
                  <p className="m-0 mt-0.5 text-zinc-500">{rule.lastTriggeredAt ? formatRelative(rule.lastTriggeredAt) : 'never'}</p>
                </td>
                <td className="px-3 py-3">
                  <Switch
                    checked={rule.enabled}
                    disabled={togglingId === id}
                    onChange={(enabled) => onToggle(rule, enabled)}
                    label={`${rule.enabled ? 'Pause' : 'Resume'} ${rule.name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-0.5">
                    <button type="button" onClick={() => onEdit(rule)} className={iconButton} aria-label={`Edit ${rule.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onDelete(rule)} className={`${iconButton} hover:bg-rose-500/10! hover:text-rose-400!`} aria-label={`Delete ${rule.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const BulkBar = ({ count, pending, onPause, onResume, onClear }) => (
  <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7831d6]/30 bg-[#18121f]/95 px-4 py-2.5 shadow-xl backdrop-blur">
    <span className="text-xs font-semibold text-[#d6c2fa]">{count} selected</span>
    <div className="flex items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      <button type="button" disabled={pending} onClick={onPause} className={`${secondaryButton} px-3 py-1.5 text-xs`}>
        <Pause className="h-3.5 w-3.5" /> Pause
      </button>
      <button type="button" disabled={pending} onClick={onResume} className={`${secondaryButton} px-3 py-1.5 text-xs`}>
        <Play className="h-3.5 w-3.5" /> Resume
      </button>
      <button type="button" onClick={onClear} className={iconButton} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </button>
    </div>
  </div>
);

// ─── Accounts tab ────────────────────────────────────────────────────────────

const AccountsList = ({ accounts }) => {
  if (accounts.length === 0) {
    return <p className="m-0 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">No accounts match these filters.</p>;
  }
  const sorted = [...accounts].sort((a, b) => Number(Boolean(isReady(a))) - Number(Boolean(isReady(b))));
  return (
    <div className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      {sorted.map((account) => {
        const problem = setupProblem(account);
        const contacts = account.handlers?.length ? account.handlers : [account.owner].filter(Boolean);
        return (
          <div key={account._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative shrink-0">
                <AccountAvatar account={account} className="h-9 w-9 rounded-full object-cover" />
                <PlatformIcon platform={account.platform} className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium text-white">{accountLabel(account)}</p>
                <p className="m-0 truncate text-xs text-zinc-500">
                  {peopleLabel(contacts)}
                </p>
              </div>
            </div>
            {problem ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 sm:self-auto" title="The handler can fix this from Automations or My Channels">
                <AlertTriangle className="h-3.5 w-3.5" /> {problem}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 sm:self-auto">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const AdminAutomations = () => {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('rules');
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [failedOnly, setFailedOnly] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // The editor page sends its "saved" message back here
  const [toast, setToast] = useState(() => (location.state?.toast ? { message: location.state.toast } : null));
  useEffect(() => {
    if (location.state?.toast) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);
  const [search, setSearch] = useState(params.get('q') || '');
  // Like the other admin pages, this shows the active campaign. Switching campaigns remounts the page.
  const campaignId = getActiveCampaignId();
  const campaignName = localStorage.getItem('active-campaign-name') || '';

  const filters = {
    handlerId: params.get('handlerId') || '',
    platform: params.get('platform') || '',
    status: params.get('status') || '',
    q: params.get('q') || '',
  };
  const scope = { handlerId: filters.handlerId, platform: filters.platform };

  // Filters live in the URL so links like ?handlerId=… open a filtered view
  const updateFilters = useCallback((changes) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      return next;
    }, { replace: true });
    setSelected(new Set());
  }, [setParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== filters.q) updateFilters({ q: search.trim() });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filters.q, updateFilters]);

  const accountsQuery = useQuery({
    queryKey: adminAutomationKeys.accounts(campaignId),
    queryFn: () => adminRequest('/accounts'),
    enabled: Boolean(campaignId),
    staleTime: 60 * 1000,
  });
  const summaryQuery = useQuery({
    queryKey: adminAutomationKeys.summary(campaignId, scope),
    queryFn: () => adminRequest(`/summary${toQuery(scope)}`),
    enabled: Boolean(campaignId),
    refetchInterval: 60 * 1000,
  });
  const rulesQuery = useQuery({
    queryKey: adminAutomationKeys.rules(campaignId, filters),
    queryFn: () => adminRequest(`/rules${toQuery(filters)}`),
    enabled: Boolean(campaignId),
  });
  const eventsQuery = useInfiniteQuery({
    queryKey: adminAutomationKeys.events(campaignId, { ...scope, failedOnly }),
    queryFn: ({ pageParam }) => adminRequest(`/events${toQuery({ ...scope, status: failedOnly ? 'failed' : '', before: pageParam, limit: 50 })}`),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextBefore || undefined,
    enabled: Boolean(campaignId) && activeTab === 'activity',
    refetchInterval: 30 * 1000,
  });

  const sessionExpired = accountsQuery.error?.status === 401 || rulesQuery.error?.status === 401;
  useEffect(() => {
    if (sessionExpired) logout();
  }, [sessionExpired, logout]);

  const accounts = useMemo(() => accountsQuery.data || [], [accountsQuery.data]);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [toKey(account._id), account])), [accounts]);
  const scopedAccounts = accounts.filter((account) => matchesScope(account, scope));
  const needingSetup = scopedAccounts.filter((account) => !isReady(account));
  const rules = rulesQuery.data || [];
  const events = eventsQuery.data?.pages.flatMap((page) => page.events) || [];
  const summary = summaryQuery.data;

  const clearToast = useCallback(() => setToast(null), []);
  const showError = (error) => setToast({ type: 'error', message: error.message });
  const refreshAll = () => queryClient.invalidateQueries({ queryKey: adminAutomationKeys.all });

  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }) => adminRequest(`/rules/${ruleId}`, { method: 'PATCH', body: { enabled } }),
    onSuccess: (rule) => {
      refreshAll();
      setToast({ message: rule.enabled ? 'Automation resumed' : 'Automation paused' });
    },
    onError: showError,
  });
  const bulkMutation = useMutation({
    mutationFn: (enabled) => adminRequest('/rules/bulk', { method: 'POST', body: { ids: [...selected], enabled } }),
    onSuccess: ({ updated }, enabled) => {
      refreshAll();
      setSelected(new Set());
      setToast({ message: `${updated} automation${updated === 1 ? '' : 's'} ${enabled ? 'resumed' : 'paused'}` });
    },
    onError: showError,
  });
  const deleteMutation = useMutation({
    mutationFn: (ruleId) => adminRequest(`/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: (_data, ruleId) => {
      refreshAll();
      setRuleToDelete(null);
      setSelected((current) => { const next = new Set(current); next.delete(toKey(ruleId)); return next; });
      setToast({ message: 'Automation deleted' });
    },
    onError: showError,
  });

  // Create and edit open their own page; it comes back here (with these filters) when done
  const returnTo = `${location.pathname}${location.search}`;
  const openNewRule = () => navigate('/admin/automations/new', { state: { returnTo } });
  const openRule = (rule) => navigate(`/admin/automations/${rule._id}/edit`, { state: { returnTo } });

  const toggleSelected = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const failures24h = (summary?.last24h.repliesFailed || 0) + (summary?.last24h.dmsFailed || 0);

  if (!campaignId) return <NoCampaignSelected />;

  return (
    <div className="min-h-screen w-full space-y-6 bg-[#0c0c0e] p-4 pb-16 font-sans text-white antialiased lg:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-xl font-bold tracking-tight text-white">Automations</h2>
          <p className="m-0 mt-1 text-xs text-zinc-400">
            Comment replies and DMs running on the accounts in {campaignName ? <span className="font-semibold text-zinc-200">{campaignName}</span> : 'this campaign'}.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refreshAll} className={`${secondaryButton} px-3 py-2 text-xs`}>
            <RefreshCw className={`h-3.5 w-3.5 ${rulesQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {accounts.length > 0 && (
            <button type="button" onClick={openNewRule} className={`${primaryButton} px-3 py-2 text-xs`}>
              <Plus className="h-3.5 w-3.5" /> New automation
            </button>
          )}
        </div>
      </header>

      {accountsQuery.isLoading && <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>}
      {accountsQuery.error && <LoadError error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} />}

      {accountsQuery.data && accounts.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="m-0 mt-3 text-base font-semibold text-white">No accounts to automate in this campaign yet</p>
          <p className="m-0 mt-1 text-sm text-zinc-400">Once handlers connect Instagram, Facebook or YouTube accounts to this campaign, they show up here.</p>
          <Link to="/channels" className={`${secondaryButton} mt-5`}>Go to Publishing Channels</Link>
        </div>
      )}

      {accounts.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Active automations"
              value={summary ? `${summary.rules.active}/${summary.rules.total}` : '—'}
              hint={summary ? `${summary.accounts} account${summary.accounts === 1 ? '' : 's'}` : null}
            />
            <Stat label="Comments handled (7d)" value={summary ? summary.last7d.events.toLocaleString() : '—'} hint={summary ? `${summary.triggers.toLocaleString()} all time` : null} />
            <Stat label="DMs sent (7d)" value={summary ? summary.last7d.dmsSent.toLocaleString() : '—'} hint={summary ? `${summary.last7d.repliesSent.toLocaleString()} public replies` : null} />
            <Stat
              label="Failures (24h)"
              value={summary ? failures24h.toLocaleString() : '—'}
              hint={summary ? `${((summary.last7d.repliesFailed || 0) + (summary.last7d.dmsFailed || 0)).toLocaleString()} in 7 days` : null}
              tone={failures24h > 0 ? 'danger' : undefined}
            />
          </div>

          <Filters accounts={accounts} filters={filters} onChange={updateFilters} search={search} onSearch={setSearch} />

          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            tabs={[
              { value: 'rules', label: 'Automations', count: rules.length },
              { value: 'activity', label: 'Activity' },
              { value: 'comments', label: 'Comments' },
              { value: 'accounts', label: 'Accounts', count: needingSetup.length },
            ]}
          />

          {activeTab === 'rules' && (
            <div className="space-y-3">
              {selected.size > 0 && (
                <BulkBar
                  count={selected.size}
                  pending={bulkMutation.isPending}
                  onPause={() => bulkMutation.mutate(false)}
                  onResume={() => bulkMutation.mutate(true)}
                  onClear={() => setSelected(new Set())}
                />
              )}
              {rulesQuery.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>}
              {rulesQuery.error && <LoadError error={rulesQuery.error} onRetry={() => rulesQuery.refetch()} />}
              {rulesQuery.data && rules.length === 0 && (
                <p className="m-0 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">
                  {Object.values(filters).some(Boolean) ? 'No automations match these filters.' : 'No automations yet. Create one, or let handlers set theirs up.'}
                </p>
              )}
              {rules.length > 0 && (
                <RulesTable
                  rules={rules}
                  accountsById={accountsById}
                  selected={selected}
                  onSelect={toggleSelected}
                  onSelectAll={(all) => setSelected(all ? new Set(rules.map((rule) => toKey(rule._id))) : new Set())}
                  togglingId={toggleMutation.isPending ? toKey(toggleMutation.variables?.ruleId) : null}
                  onToggle={(rule, enabled) => toggleMutation.mutate({ ruleId: rule._id, enabled })}
                  onEdit={openRule}
                  onDelete={setRuleToDelete}
                />
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div className="w-full sm:w-64">
                <Segmented
                  value={failedOnly ? 'failed' : 'all'}
                  onChange={(value) => setFailedOnly(value === 'failed')}
                  options={[{ value: 'all', label: 'Everything' }, { value: 'failed', label: 'Failures' }]}
                />
              </div>
              <ActivityPanel
                events={events}
                accountsById={accountsById}
                isLoading={eventsQuery.isLoading}
                error={eventsQuery.error}
                emptyTitle={failedOnly ? 'No failures' : 'No activity yet'}
                emptyMessage={failedOnly ? 'Every reply and DM in this view went through.' : 'Comments that trigger an automation will show up here.'}
              />
              {eventsQuery.hasNextPage && (
                <button
                  type="button"
                  onClick={() => eventsQuery.fetchNextPage()}
                  disabled={eventsQuery.isFetchingNextPage}
                  className={`${secondaryButton} w-full text-xs`}
                >
                  {eventsQuery.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load older activity
                </button>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <AdminCommentsPanel campaignId={campaignId} scope={scope} accounts={scopedAccounts} accountsById={accountsById} />
          )}

          {activeTab === 'accounts' && <AccountsList accounts={scopedAccounts} />}
        </>
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

export default AdminAutomations;
