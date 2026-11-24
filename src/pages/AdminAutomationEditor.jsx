import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { RuleEditor } from '../components/automations/RuleEditor';
import { NoCampaignSelected } from '../components/automations/NoCampaignSelected';
import { adminAutomationKeys, adminRequest } from '../components/automations/api';
import { emptyDraft, ruleToDraft } from '../components/automations/drafts';
import { LoadError } from '../components/automations/ui';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';


// Full-page create (/admin/automations/new) and edit (/admin/automations/:ruleId/edit)
export const AdminAutomationEditor = () => {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const campaignId = getActiveCampaignId();
  const campaignName = localStorage.getItem('active-campaign-name') || '';
  // The list passes its own URL so going back keeps its filters
  const returnTo = location.state?.returnTo || '/admin/automations';
  const [dirty, setDirty] = useState(false);

  const accountsQuery = useQuery({
    queryKey: adminAutomationKeys.accounts(campaignId),
    queryFn: () => adminRequest('/accounts'),
    enabled: Boolean(campaignId),
    staleTime: 60 * 1000,
  });
  const ruleQuery = useQuery({
    queryKey: adminAutomationKeys.rule(campaignId, ruleId),
    queryFn: () => adminRequest(`/rules/${ruleId}`),
    enabled: Boolean(campaignId && ruleId),
  });

  const sessionExpired = accountsQuery.error?.status === 401 || ruleQuery.error?.status === 401;
  useEffect(() => {
    if (sessionExpired) logout();
  }, [sessionExpired, logout]);

  const accounts = useMemo(() => accountsQuery.data || [], [accountsQuery.data]);
  const initialDraft = useMemo(() => {
    // Wait for the accounts too: the editor needs them to know e.g. whether DMs are possible
    if (!accountsQuery.data) return null;
    if (ruleId) return ruleQuery.data ? ruleToDraft(ruleQuery.data) : null;
    // New automations start with no account chosen; the admin picks one or more
    return { ...emptyDraft, socialAccountId: '', socialAccountIds: [] };
  }, [ruleId, ruleQuery.data, accountsQuery.data]);

  if (!campaignId) return <NoCampaignSelected title={ruleId ? 'Edit automation' : 'New automation'} />;

  const loadError = accountsQuery.error || ruleQuery.error;

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] p-4 pb-16 font-sans text-white antialiased lg:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to={returnTo}
            onClick={(event) => {
              if (dirty && !window.confirm('Discard your changes to this automation?')) event.preventDefault();
            }}
            className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-xs font-semibold text-zinc-400 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Automations{campaignName ? ` · ${campaignName}` : ''}
          </Link>
        </div>

        {loadError && <LoadError error={loadError} onRetry={() => { accountsQuery.refetch(); if (ruleId) ruleQuery.refetch(); }} />}
        {!loadError && !initialDraft && (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
        )}
        {!loadError && accountsQuery.data && accounts.length === 0 && !ruleId && (
          <p className="m-0 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">
            This campaign has no connected Instagram, Facebook or YouTube accounts yet.
          </p>
        )}

        {!loadError && initialDraft && (ruleId || accounts.length > 0) && (
          <RuleEditor
            key={ruleId || 'new'}
            variant="page"
            accounts={accounts}
            initialDraft={initialDraft}
            ruleId={ruleId || null}
            allowTemplates={false}
            accountPicker="dialog"
            multiAccount
            request={adminRequest}
            rulesKey={adminAutomationKeys.all}
            onDirtyChange={setDirty}
            onSaved={(message) => navigate(returnTo, { state: { toast: message } })}
          />
        )}
      </div>
    </div>
  );
};

export default AdminAutomationEditor;
