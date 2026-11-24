import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import PlatformIcon from '../components/PlatformIcon';
import { ActivityPanel } from '../components/automations/ActivityPanel';
import { CommentsTab } from '../components/automations/CommentsTab';
import { InboxPanel } from '../components/automations/InboxPanel';
import { RuleEditor } from '../components/automations/RuleEditor';
import { ConfirmDelete, RuleCard, EmptyRules } from '../components/automations/RulesTab';
import { SetupBanner } from '../components/automations/SetupBanner';
import { apiRequest, automationKeys } from '../components/automations/api';
import { emptyDraft, ruleToDraft } from '../components/automations/drafts';
import { primaryButton } from '../components/automations/styles';
import { Toast, Tabs, LoadError, Stat } from '../components/automations/ui';
import { useAuth } from '../context/AuthContext';

export const CreatorAutomations = () => {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [editor, setEditor] = useState(null);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('automations');

  const accountsQuery = useQuery({
    queryKey: automationKeys.accounts(),
    queryFn: () => apiRequest('/accounts'),
    staleTime: 60 * 1000,
  });
  const rulesQuery = useQuery({
    queryKey: automationKeys.rules(),
    queryFn: () => apiRequest('/rules'),
  });
  const recentBadgeQuery = useQuery({
    queryKey: automationKeys.recentCommentsBadge(),
    queryFn: () => apiRequest('/comments/recent?limit=1'),
    refetchInterval: 15000,
  });
  const newComments = recentBadgeQuery.data?.unseenCount || 0;
  const inboxQuery = useQuery({
    queryKey: automationKeys.conversations('all'),
    queryFn: () => apiRequest('/inbox/conversations'),
    refetchInterval: 15000,
  });
  const unreadConversations = (inboxQuery.data || []).filter((conversation) => conversation.unreadCount > 0).length;
  const eventsQuery = useQuery({
    queryKey: automationKeys.events(),
    queryFn: () => apiRequest('/events?limit=50'),
    refetchInterval: 30 * 1000,
  });

  // A 401 here means the login itself expired, so send them back to sign in
  const sessionExpired = accountsQuery.error?.status === 401 || rulesQuery.error?.status === 401;
  useEffect(() => {
    if (sessionExpired) logout();
  }, [sessionExpired, logout]);

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
      queryClient.invalidateQueries({ queryKey: automationKeys.accounts() });
      setToast({ message: 'Comment events turned on' });
    },
    onError: showError,
  });
  const toggleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }) => apiRequest(`/rules/${ruleId}`, { method: 'PATCH', body: { enabled } }),
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
      setToast({ message: rule.enabled ? 'Automation resumed' : 'Automation paused' });
    },
    onError: showError,
  });
  const deleteMutation = useMutation({
    mutationFn: (ruleId) => apiRequest(`/rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationKeys.rules() });
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

      {!isLoading && accountsQuery.error && (
        <LoadError error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} />
      )}

      {!isLoading && !accountsQuery.error && accounts.length === 0 && (
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
              { value: 'activity', label: 'Activity' },
            ]}
          />

          {activeTab === 'automations' && (
            rulesQuery.error ? (
              <LoadError error={rulesQuery.error} onRetry={() => rulesQuery.refetch()} />
            ) : rules.length === 0 ? (
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
                      toggling={toggleMutation.isPending && toggleMutation.variables?.ruleId === rule._id}
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
            <ActivityPanel events={events} rulesById={rulesById} isLoading={eventsQuery.isLoading} error={eventsQuery.error} />
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
