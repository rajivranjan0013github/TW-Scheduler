import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';

const platformOptions = ['instagram', 'youtube', 'facebook'];

export const Channels = () => {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (location.state?.campaignId) {
      sessionStorage.setItem('connect_campaign_id', location.state.campaignId);
    } else {
      sessionStorage.removeItem('connect_campaign_id');
    }
  }, [location.state]);

  const adminViewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const adminViewUserId = adminViewContext?.userId || '';
  const isCreator = user?.userType === 'account_handler';
  const activeConnectCampaignId = isCreator
    ? (location.state?.campaignId || sessionStorage.getItem('connect_campaign_id') || null)
    : (location.state?.campaignId
       || sessionStorage.getItem('connect_campaign_id')
       || getActiveCampaignId());

  // Inline "Assign Channel to Creator" states
  const [assignPlatform, setAssignPlatform] = useState('instagram');
  const [assignHandle, setAssignHandle] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignDisplayName, setAssignDisplayName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Confirmation dialog state for removing a channel
  const [channelToRemove, setChannelToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const channelQueryParam = activeConnectCampaignId
    ? `?${new URLSearchParams({ campaignId: activeConnectCampaignId }).toString()}`
    : isCreator
      ? ''
      : withCampaignScope(adminViewUserId ? `userId=${adminViewUserId}` : '');
  const channelEndpoint = activeConnectCampaignId ? '/api/accounts/publishing-channels' : '/api/accounts';

  const normalizeChannels = (data) => (
    (Array.isArray(data) ? data : []).map((channel) => {
      if (channel.status) return channel;
      const isConnectedAccount = Boolean(channel._id && channel.accountId && channel.isConnected !== false);
      return {
        ...channel,
        socialAccountId: channel.socialAccountId || (isConnectedAccount ? channel._id : null),
        status: isConnectedAccount ? 'verified' : 'pending_verification',
        isVerified: isConnectedAccount,
      };
    })
  );

  const channelsQuery = useQuery({
    queryKey: ['channels', channelEndpoint, channelQueryParam, adminViewUserId, isCreator],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}${channelEndpoint}${channelQueryParam}`, {
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch connected channels: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(user),
  });

  // Query all user accounts to discover unlinked accounts for 1-click linking
  const allAccountsQuery = useQuery({
    queryKey: ['all-social-accounts', adminViewUserId],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts${adminViewUserId ? `?userId=${adminViewUserId}` : ''}`, {
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(user && activeConnectCampaignId && !isCreator),
  });

  const creatorCampaignsQuery = useQuery({
    queryKey: ['creator', adminViewUserId, 'campaigns', 'channels-verification'],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/creator/campaigns`, {
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign channels: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(user) && isCreator,
  });

  const normalizedChannels = useMemo(
    () => normalizeChannels(channelsQuery.data),
    [channelsQuery.data]
  );

  useEffect(() => {
    if (channelsQuery.error) {
      console.error('Failed to fetch connected channels:', channelsQuery.error);
    }
  }, [channelsQuery.error]);

  const disconnectChannel = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this channel? Scheduled posts might fail.')) {
      return;
    }
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/${id}`, {
        method: 'DELETE',
        headers: withHandlerPreviewHeaders({ 'Authorization': `Bearer ${token}` })
      });
      if (response.ok) {
        setDisconnectedChannelIds(prev => [...prev, id]);
        queryClient.invalidateQueries({ queryKey: ['channels'] });
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const connectInstagramOAuth = (targetCampaignId = activeConnectCampaignId) => {
    const token = localStorage.getItem('tw_token');
    const returnUrl = `${window.location.origin}/instagram-callback`;
    const params = new URLSearchParams({ returnUrl });
    if (targetCampaignId) {
      params.set('campaignId', targetCampaignId);
    }
    const connectUrl = `${API_BASE_URL}/api/accounts/connect/instagram?token=${token}&${params.toString()}`;
    window.location.assign(connectUrl);
  };

  const connectYoutubeOAuth = (targetCampaignId = activeConnectCampaignId) => {
    const token = localStorage.getItem('tw_token');
    const returnUrl = `${window.location.origin}/youtube-callback`;
    const params = new URLSearchParams({ returnUrl });
    if (targetCampaignId) {
      params.set('campaignId', targetCampaignId);
    }
    const connectUrl = `${API_BASE_URL}/api/accounts/connect/youtube?token=${token}&${params.toString()}`;
    window.location.assign(connectUrl);
  };

  const connectMetaOAuth = (targetCampaignId = activeConnectCampaignId, targetSocialAccountId = null) => {
    const token = localStorage.getItem('tw_token');
    const returnUrl = `${window.location.origin}/facebook-callback`;
    const params = new URLSearchParams({ returnUrl });
    if (targetCampaignId) {
      params.set('campaignId', targetCampaignId);
    }
    if (targetSocialAccountId) {
      params.set('socialAccountId', targetSocialAccountId);
      params.set('reconnect', 'true');
    }
    const connectUrl = `${API_BASE_URL}/api/accounts/connect/facebook?token=${token}&${params.toString()}`;
    window.location.assign(connectUrl);
  };

  const handleVerifyChannel = (channel) => {
    if (channel.platform === 'instagram') {
      connectInstagramOAuth(channel.campaignId);
    } else if (channel.platform === 'youtube') {
      connectYoutubeOAuth(channel.campaignId);
    } else {
      connectMetaOAuth(channel.campaignId,channel.socialAccountId);
    }
  };

  // Toggle link for an existing connected account to the active campaign
  const handleToggleCampaignLink = async (socialAccountId) => {
    if (!activeConnectCampaignId || !socialAccountId) return;
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/toggle-campaign-link`, {
        method: 'POST',
        headers: withHandlerPreviewHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({
          campaignId: activeConnectCampaignId,
          socialAccountId,
        }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        queryClient.invalidateQueries({ queryKey: ['all-social-accounts'] });
        queryClient.invalidateQueries({ queryKey: ['admin'] });
      }
    } catch (err) {
      console.error('Failed to toggle campaign link:', err);
    }
  };

  // Assign external creator channel
  const handleAssignChannel = async (e) => {
    e.preventDefault();
    if (!assignHandle.trim()) return;
    setAssigning(true);
    setAssignError('');
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/campaign-channels`, {
        method: 'POST',
        headers: withHandlerPreviewHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({
          campaignId: activeConnectCampaignId,
          platform: assignPlatform,
          requestedHandle: assignHandle.trim(),
          displayName: assignDisplayName.trim(),
          assignedHandlerEmail: assignEmail.trim().toLowerCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to assign channel.');
      }
      setAssignHandle('');
      setAssignEmail('');
      setAssignDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  // Remove channel from campaign (invoked from confirmation dialog)
  const confirmRemoveChannel = async () => {
    if (!channelToRemove) return;
    const channelId = channelToRemove._id || channelToRemove.socialAccountId;
    setRemoving(true);
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/campaign-channels/${channelId}`, {
        method: 'DELETE',
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['channels'] });
        queryClient.invalidateQueries({ queryKey: ['all-social-accounts'] });
        queryClient.invalidateQueries({ queryKey: ['admin'] });
        setChannelToRemove(null);
      }
    } catch (err) {
      console.error('Failed to remove campaign channel:', err);
    } finally {
      setRemoving(false);
    }
  };

  const getStatusBadgeClasses = (status) => {
    if (status === 'verified') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (status === 'disconnected') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  };

  const getStatusLabel = (status) => {
    if (status === 'verified') return 'Connected';
    if (status === 'disconnected') return 'Disconnected';
    return 'Pending verification';
  };

  const formatHandle = (handle) => {
    if (!handle) return '';
    const clean = String(handle).trim().replace(/^@+/, '');
    return clean ? `@${clean}` : '';
  };

  const getChannelAccountId = (channel) => channel.socialAccountId || (channel.accountId ? channel._id : null);

  const pendingVerificationChannels = isCreator
    ? (creatorCampaignsQuery.data || []).flatMap((campaign) => (
      (campaign.channels || [])
        .filter((channel) => !channel.isVerified)
        .map((channel) => ({
          ...channel,
          campaignId: campaign._id,
          campaignName: campaign.name,
        }))
    ))
    : [];

  const visibleChannels = normalizedChannels;

  const channelsMissingAnalyticsPermission = visibleChannels.filter((channel) => (
    channel.platform === 'facebook' && channel.analyticsStatus === 'permission_missing'
  ));

  // Find authorized accounts not yet linked to this campaign
  const otherUnlinkedAccounts = useMemo(() => {
    if (!activeConnectCampaignId || isCreator) return [];
    const allAccounts = Array.isArray(allAccountsQuery.data) ? allAccountsQuery.data : [];
    const linkedAccountIds = new Set(
      visibleChannels.map((ch) => getChannelAccountId(ch)).filter(Boolean)
    );
    return allAccounts.filter((acc) => !linkedAccountIds.has(acc._id));
  }, [allAccountsQuery.data, visibleChannels, activeConnectCampaignId, isCreator]);

  const loading = channelsQuery.isLoading && normalizedChannels.length === 0;

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] p-4 lg:p-6 text-white space-y-6 font-sans antialiased pb-16">
      
      {/* Header with Title, Context, and Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white m-0">Publishing Channels</h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => connectInstagramOAuth()}
            className="flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] active:scale-95"
          >
            <PlatformIcon platform="instagram" className="h-4 w-4 shrink-0" />
            <span>Connect Instagram</span>
          </button>
          <button
            type="button"
            onClick={() => connectYoutubeOAuth()}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15 active:scale-95 shadow-sm"
          >
            <PlatformIcon platform="youtube" className="h-4 w-4 shrink-0" />
            <span>Connect YouTube</span>
          </button>
          <button
            type="button"
            onClick={() => connectMetaOAuth()}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15 active:scale-95 shadow-sm"
          >
            <PlatformIcon platform="facebook" className="h-4 w-4 shrink-0" />
            <span>Connect Facebook</span>
          </button>
        </div>
      </div>

      {/* Inline Form: Assign Channel to Creator (Always shown) */}
      {!isCreator && activeConnectCampaignId && (
        <form
          onSubmit={handleAssignChannel}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-4 shadow-sm"
        >
          <div className="pb-2">
            <h3 className="text-sm font-semibold text-white m-0">Assign Channel to External Creator</h3>
          </div>

          {assignError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          {/* Platform selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-300">Platform</label>
            <div className="flex gap-2">
              {platformOptions.map((plat) => {
                const isSelected = assignPlatform === plat;
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setAssignPlatform(plat)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold capitalize transition shadow-sm ${
                      isSelected
                        ? 'bg-[#7831d6] text-white border-transparent shadow-[#7831d6]/25'
                        : 'bg-white/10 border-white/15 text-zinc-300 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <PlatformIcon platform={plat} className="h-3.5 w-3.5" />
                    <span>{plat === 'youtube' ? 'YouTube' : plat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-300">
                Target Handle / ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={assignHandle}
                onChange={(e) => setAssignHandle(e.target.value)}
                placeholder={assignPlatform === 'instagram' ? '@creatorhandle' : assignPlatform === 'youtube' ? '@channel or UC...' : 'Page Name or ID'}
                className="w-full h-9 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-300">Display Name (Optional)</label>
              <input
                type="text"
                value={assignDisplayName}
                onChange={(e) => setAssignDisplayName(e.target.value)}
                placeholder="e.g. John Creator"
                className="w-full h-9 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-300">Creator Email (Manual Tasks)</label>
              <input
                type="email"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                placeholder="creator@example.com"
                className="w-full h-9 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={assigning || !assignHandle.trim()}
                className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg bg-[#7831d6] px-4 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Assign to Campaign'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Pending Verification section (Creators) */}
      {pendingVerificationChannels.length > 0 && (
        <section className="space-y-3 border-b border-white/10 pb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Channels To Verify</h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {pendingVerificationChannels.map((channel) => (
              <div
                key={`${channel.campaignId}-${channel.platform}-${channel.handle || channel.requestedHandle}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <AccountAvatar account={channel} className="h-9 w-9 rounded-lg object-cover" />
                    <div className="absolute -bottom-1 -right-1">
                      <PlatformIcon platform={channel.platform} className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-semibold text-white">
                      {formatHandle(channel.handle || channel.requestedHandle || 'channel')}
                    </p>
                    <p className="m-0 truncate text-[10px] text-zinc-400">{channel.campaignName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleVerifyChannel(channel)}
                  className="shrink-0 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95"
                >
                  Verify
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Facebook Analytics Access Needed */}
      {channelsMissingAnalyticsPermission.length > 0 && (
        <section className="space-y-3 border-b border-white/10 pb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Facebook Analytics Access Needed</h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {channelsMissingAnalyticsPermission.map((channel) => (
              <div
                key={`analytics-${channel._id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PlatformIcon platform={channel.platform} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-semibold text-white">
                      {formatHandle(channel.username || channel.handle || 'facebook-page')}
                    </p>
                    <p className="m-0 truncate text-[10px] text-amber-400">Publishing remains connected</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => connectMetaOAuth(channel.campaignId, getChannelAccountId(channel))}
                  className="shrink-0 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95"
                >
                  Reconnect
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Campaign Publishing Channels List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-sm font-semibold text-white m-0">
            {isCreator ? 'Connected Accounts' : 'Publishing Channels'}
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {visibleChannels.length}
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-zinc-400 font-medium">
            Fetching publishing channels...
          </div>
        ) : visibleChannels.length === 0 ? (
          <div className="text-center py-14 text-xs text-zinc-400 font-medium space-y-3">
            <p className="m-0">
              No channels are currently assigned to this product.
            </p>
            <p className="text-zinc-500 text-[11px] m-0">
              Use the connection buttons above to link accounts or pre-register a creator handle.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                  <th className="py-3 px-4 font-semibold">Channel</th>
                  <th className="py-3 px-4 font-semibold w-52">Handle / ID</th>
                  <th className="py-3 px-4 font-semibold w-56">Assigned Creator</th>
                  <th className="py-3 px-4 font-semibold w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visibleChannels.map((chan) => (
                  <tr key={chan._id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 shrink-0">
                          <AccountAvatar account={chan} className="h-9 w-9 rounded-full object-cover border border-white/10" />
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-[#141417] shadow-sm">
                            <PlatformIcon platform={chan.platform} className="h-2.5 w-2.5" />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {chan.name || chan.displayName || chan.handle || 'Channel'}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold border ${getStatusBadgeClasses(chan.status)}`}>
                              {getStatusLabel(chan.status)}
                            </span>
                          </div>
                          <p className="m-0 mt-0.5 text-[11px] text-zinc-500 capitalize">
                            {chan.platform}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      {formatHandle(chan.username || chan.handle || chan.requestedHandle || 'unspecified')}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {chan.assignedHandlerEmail ? (
                        <span className="truncate">{chan.assignedHandlerEmail}</span>
                      ) : (
                        <span className="text-zinc-500 italic">Self / Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setChannelToRemove(chan)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-zinc-300 transition hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-300 shadow-sm"
                          title="Remove from Campaign"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1-Click Link: Other Authorized Accounts Not Yet Linked to this Product */}
      {!isCreator && otherUnlinkedAccounts.length > 0 && (
        <section className="space-y-3 pt-6 border-t border-white/[0.08]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 m-0">
              Other Connected Accounts in Workspace ({otherUnlinkedAccounts.length})
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5 m-0">
              These social accounts are authorized in your workspace but not yet assigned to this campaign.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {otherUnlinkedAccounts.map((acc) => (
              <div
                key={acc._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative shrink-0">
                    <AccountAvatar account={acc} className="h-8 w-8 rounded-full object-cover" />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black bg-[#141417]">
                      <PlatformIcon platform={acc.platform} className="h-2 w-2" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-semibold text-white">
                      {acc.name || acc.displayName || acc.username}
                    </p>
                    <p className="m-0 truncate text-[10px] text-zinc-400">
                      {formatHandle(acc.username || acc.name)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleCampaignLink(acc._id)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition active:scale-95"
                >
                  <Plus className="h-3 w-3" />
                  <span>Link</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Remove Channel Confirmation Dialog */}
      {channelToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121215] p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-white m-0">Remove Channel from Campaign</h3>
                <p className="mt-1.5 text-xs text-zinc-300 m-0 leading-relaxed">
                  Are you sure you want to remove{' '}
                  <strong className="text-white font-semibold">
                    {channelToRemove.displayName || channelToRemove.name || formatHandle(channelToRemove.handle || channelToRemove.requestedHandle || 'this channel')}
                  </strong>{' '}
                  from this campaign?
                </p>
                <p className="mt-2 text-[11px] text-zinc-500 m-0 leading-relaxed">
                  This will unlink the channel from this product. The account remains connected to your workspace and can be re-linked anytime.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setChannelToRemove(null)}
                disabled={removing}
                className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveChannel}
                disabled={removing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/30 hover:text-white shadow-sm disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{removing ? 'Removing...' : 'Remove Channel'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Channels;
