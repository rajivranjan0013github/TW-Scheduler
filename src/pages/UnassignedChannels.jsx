import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, Link2, Mail, Plus, Search, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import PlatformIcon from '../components/PlatformIcon';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';
import { getActiveCampaignId } from '../utils/campaignScope';
import { getHandlerPreviewContext, withHandlerPreviewHeaders } from '../utils/handlerPreview';
import { formatHandle } from '../utils/channelOAuth';

const fetchList = async (path, signal) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${localStorage.getItem('tw_token')}` }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Unable to load channels. Please try again.');
  if (!Array.isArray(data)) throw new Error('Unable to load channels. Please try again.');
  return data;
};

export default function UnassignedChannels() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId') || getActiveCampaignId();
  const previewUserId = getHandlerPreviewContext()?.userId || '';
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [addingAccountId, setAddingAccountId] = useState('');
  const addingRef = useRef(false);
  const canViewAdmin = ['owner', 'admin'].includes(user?.role);
  const campaignQuery = campaignId ? `?${new URLSearchParams({ campaignId })}` : '';
  const campaignChannelKey = ['admin-channels', '/api/accounts/publishing-channels', campaignQuery, previewUserId];

  const campaignsQuery = useQuery({
    queryKey: ['unassigned-channel-campaigns', user?._id, previewUserId, canViewAdmin],
    queryFn: ({ signal }) => fetchList(canViewAdmin
      ? '/api/admin/campaigns/list?scope=workspace'
      : '/api/accounts/campaigns', signal),
    enabled: Boolean(user),
  });
  const unassignedChannelKey = ['unassigned-channels', user?._id, previewUserId];
  const accountsQuery = useQuery({
    queryKey: unassignedChannelKey,
    queryFn: ({ signal }) => fetchList('/api/accounts/unassigned', signal),
    enabled: Boolean(user),
    staleTime: 0,
  });

  const campaigns = campaignsQuery.data || [];
  const selectedCampaign = campaigns.find((campaign) => campaign._id === campaignId);
  const campaignName = selectedCampaign?.name || 'the selected campaign';
  const availableAccounts = accountsQuery.data || [];

  const getCreator = (account) => {
    const userObj = typeof account.userId === 'object' ? account.userId : account.user;
    return {
      name: userObj?.name || '',
      email: userObj?.email || '',
    };
  };

  const filteredAccounts = availableAccounts.filter((account) => {
    const creator = getCreator(account);
    return [
      account.name,
      account.displayName,
      account.username,
      account.accountId,
      account.platform,
      creator.name,
      creator.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });
  const loadError = accountsQuery.error;
  const loading = accountsQuery.isPending;

  const addToCampaign = async (account) => {
    if (!campaignId || addingRef.current) return;
    addingRef.current = true;
    setAddingAccountId(account._id);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/toggle-campaign-link`, {
        method: 'POST',
        headers: withHandlerPreviewHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
        body: JSON.stringify({ campaignId, socialAccountId: account._id, action: 'link' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) await queryClient.invalidateQueries({ queryKey: ['unassigned-channels'] });
        throw new Error(data.message || 'Unable to add this channel. Please try again.');
      }
      if (!Array.isArray(data.channels)) throw new Error('Unable to confirm the assignment. Please refresh the list.');

      queryClient.setQueryData(campaignChannelKey, data.channels);
      queryClient.setQueryData(unassignedChannelKey, (accounts = []) => accounts.filter((item) => item._id !== account._id));
      setFeedback({ type: 'success', message: `${account.name || account.displayName || account.username || 'Channel'} added to ${campaignName}.` });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['unassigned-channels'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-channels'] }),
        queryClient.invalidateQueries({ queryKey: ['all-social-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin'] }),
        queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
        queryClient.invalidateQueries({ queryKey: ['creator'] }),
      ]);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      addingRef.current = false;
      setAddingAccountId('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] p-4 lg:p-6 text-white space-y-6 font-sans antialiased pb-20">
      <Link to="/channels" state={campaignId ? { campaignId } : undefined} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Channels
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="m-0 text-xl font-bold tracking-tight">Unassigned Channels</h2>
          <p className="m-0 mt-1 text-xs text-zinc-400">Connected channels that are not assigned to any campaign. Select a campaign, then add a channel.</p>
        </div>
        <div className="w-full md:w-72">
          <label htmlFor="channel-campaign" className="mb-1.5 block text-xs font-semibold text-zinc-300">Add channels to campaign</label>
          <select
            id="channel-campaign"
            value={campaignId || ''}
            disabled={Boolean(addingAccountId) || campaignsQuery.isPending}
            onChange={(event) => {
              setSearchParams({ campaignId: event.target.value });
              setFeedback(null);
            }}
            className="w-full rounded-lg border border-white/15 bg-[#161619] px-3 py-2 text-xs text-white outline-none focus:border-[#7831d6] disabled:opacity-50"
          >
            <option value="" disabled>{campaignsQuery.isPending ? 'Loading campaigns...' : 'Select a campaign'}</option>
            {campaignId && !selectedCampaign && <option value={campaignId}>Selected campaign</option>}
            {campaigns.map((campaign) => <option key={campaign._id} value={campaign._id}>{campaign.name}</option>)}
          </select>
        </div>
      </div>

      {campaignsQuery.isError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          Unable to load campaign choices. <button type="button" onClick={() => campaignsQuery.refetch()} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}
      {feedback && (
        <div role={feedback.type === 'error' ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-xl border p-4 text-xs ${feedback.type === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
          {feedback.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {!campaignId && (
        <div className="rounded-xl border border-white/10 p-4 text-xs text-zinc-400">
          Select a campaign above to assign these channels, or <Link to="/campaigns" className="font-semibold text-white underline">create a campaign</Link>.
        </div>
      )}
      {loadError ? (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          {loadError.message}
          <button type="button" onClick={() => accountsQuery.refetch()} className="ml-2 font-semibold underline">Retry</button>
        </div>
      ) : loading ? (
        <p role="status" className="py-12 text-center text-xs text-zinc-400">Loading unassigned channels...</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-xs font-semibold text-zinc-300">{availableAccounts.length} available {availableAccounts.length === 1 ? 'channel' : 'channels'}</p>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input aria-label="Search channels" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, handle or platform" className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-white/30" />
            </div>
          </div>
          {filteredAccounts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
              <Link2 className="mx-auto mb-3 h-7 w-7 text-zinc-500" />
              <p className="m-0 text-sm font-semibold">{search.trim() ? 'No matching channels' : 'No unassigned channels'}</p>
              <p className="m-0 mt-2 text-xs text-zinc-400">{search.trim() ? 'Try another name, handle or platform.' : 'No connected channels are currently unassigned. Connect another account from the Channels page.'}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAccounts.map((account) => {
                const creator = getCreator(account);
                return (
                  <div key={account._id} className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="space-y-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative shrink-0">
                          <AccountAvatar account={account} className="h-10 w-10 rounded-full object-cover border border-white/10" />
                          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-black bg-[#141417] p-0.5"><PlatformIcon platform={account.platform} className="h-3 w-3" /></span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-sm font-semibold">{account.name || account.displayName || account.username || 'Channel'}</p>
                          <p className="m-0 mt-1 truncate text-xs text-zinc-400">{formatHandle(account.username || account.accountId)} <span className="capitalize">· {account.platform}</span></p>
                        </div>
                      </div>

                      {(creator.name || creator.email) && (
                        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 space-y-1 text-xs">
                          {creator.name && (
                            <div className="flex items-center gap-1.5 text-zinc-300">
                              <UserIcon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate font-medium">{creator.name}</span>
                            </div>
                          )}
                          {creator.email && (
                            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                              <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                              <span className="truncate">{creator.email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => addToCampaign(account)} disabled={!campaignId || Boolean(addingAccountId)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#7831d6] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50">
                      <Plus className="h-4 w-4" /> {addingAccountId === account._id ? 'Adding...' : 'Add to Campaign'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
