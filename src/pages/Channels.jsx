import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, ShieldCheck, Link2, Eye } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';

export const Channels = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [disconnectedChannelIds, setDisconnectedChannelIds] = useState([]);
  const isCreator = user?.userType === 'account_handler';
  const activeConnectCampaignId = isCreator
    ? (location.state?.campaignId || sessionStorage.getItem('connect_campaign_id') || null)
    : (location.state?.campaignId
       || sessionStorage.getItem('connect_campaign_id')
       || getActiveCampaignId());
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
        headers: withHandlerPreviewHeaders({ 'Authorization': `Bearer ${token}` })
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch connected channels: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(user),
  });
  const creatorCampaignsQuery = useQuery({
    queryKey: ['creator', adminViewUserId, 'campaigns', 'channels-verification'],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/creator/campaigns`, {
        headers: withHandlerPreviewHeaders({ 'Authorization': `Bearer ${token}` })
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
    const returnUrl = window.location.origin + '/instagram-callback';
    const params = new URLSearchParams({ returnUrl });
    if (targetCampaignId) {
      params.set('campaignId', targetCampaignId);
    }
    const connectUrl = `${API_BASE_URL}/api/accounts/connect/instagram?token=${token}&${params.toString()}`;
    window.location.assign(connectUrl);
  };

  const connectYoutubeOAuth = (targetCampaignId = activeConnectCampaignId) => {
    const token = localStorage.getItem('tw_token');
    const returnUrl = window.location.origin + '/youtube-callback';
    const params = new URLSearchParams({ returnUrl });
    if (targetCampaignId) {
      params.set('campaignId', targetCampaignId);
    }
    const connectUrl = `${API_BASE_URL}/api/accounts/connect/youtube?token=${token}&${params.toString()}`;
    window.location.assign(connectUrl);
  };

  const connectMetaOAuth = (targetCampaignId = activeConnectCampaignId, targetSocialAccountId = null) => {
    const token = localStorage.getItem('tw_token');
    const returnUrl = window.location.origin + '/facebook-callback';
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
      connectMetaOAuth(channel.campaignId, channel.socialAccountId);
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

  const allCreatorChannels = useMemo(() => {
    if (!isCreator) return normalizedChannels;

    const campaignChannels = (creatorCampaignsQuery.data || []).flatMap((campaign) => (
      (campaign.channels || []).map((channel) => ({
        ...channel,
        campaignId: campaign._id,
        campaignName: campaign.name,
      }))
    ));

    const combined = [...normalizedChannels, ...campaignChannels];
    const seen = new Set();
    return combined.filter((channel) => {
      const key = channel.socialAccountId
        ? `social-${channel.socialAccountId}`
        : channel._id
          ? `channel-${channel._id}`
          : `${channel.platform}:${channel.handle || channel.username}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [isCreator, normalizedChannels, creatorCampaignsQuery.data]);

  const channelsToDisplay = isCreator ? allCreatorChannels : normalizedChannels;

  const visibleChannels = channelsToDisplay.filter((channel) => {
    const accountId = getChannelAccountId(channel);
    return !disconnectedChannelIds.includes(accountId) && !disconnectedChannelIds.includes(channel._id);
  });
  const channelsMissingAnalyticsPermission = visibleChannels.filter((channel) => (
    channel.platform === 'facebook' && channel.analyticsStatus === 'permission_missing'
  ));
  const loading = isCreator
    ? (creatorCampaignsQuery.isLoading && channelsQuery.isLoading && visibleChannels.length === 0)
    : (channelsQuery.isLoading && visibleChannels.length === 0);

  return (
    <div className="p-4 sm:p-8 bg-[#0c0c0e] min-h-screen text-white space-y-6 sm:space-y-8 font-sans antialiased">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/[0.08] gap-2">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Publishing Channels
          </p>
          <h2 className="text-xl font-bold text-white tracking-tight m-0 mt-1">Connected Accounts</h2>
          <p className="text-zinc-400 text-xs mt-1">
            {adminViewUserId
              ? `Viewing channels for ${adminViewContext?.userName || 'selected user'}`
              : 'Manage Facebook, Instagram, and YouTube publishing channels'}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {pendingVerificationChannels.length > 0 && (
          <section className="bg-[#141417]/95 border border-amber-500/20 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 border-b border-amber-500/20 bg-amber-500/5">
              <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Channels To Verify</h3>
            </div>
            <div className="grid gap-2 p-3 md:gap-3 md:p-4 lg:grid-cols-2">
              {pendingVerificationChannels.map((channel) => (
                <div
                  key={`${channel.campaignId}-${channel.platform}-${channel.handle || channel.requestedHandle}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1.5">
                      <PlatformIcon platform={channel.platform} className="h-7 w-7 md:h-8 md:w-8" />
                      {channel.avatarUrl ? (
                        <img
                          src={channel.avatarUrl}
                          crossOrigin="anonymous"
                          className="h-7 w-7 rounded-full border border-white/10 object-cover shadow-sm md:h-8 md:w-8"
                          alt=""
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-xs font-bold text-zinc-300 md:h-8 md:w-8">
                          {((channel.handle || channel.requestedHandle || '@').charAt(0) || '@').toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-xs font-semibold text-white">
                        {(channel.handle || channel.requestedHandle || '').startsWith('@')
                          ? (channel.handle || channel.requestedHandle)
                          : `@${channel.handle || channel.requestedHandle || 'channel'}`}
                      </p>
                      <p className="m-0 truncate text-[10px] text-zinc-400">{channel.campaignName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVerifyChannel(channel)}
                    className="shrink-0 rounded-[10px] bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                  >
                    Verify
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {channelsMissingAnalyticsPermission.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[#141417]/95 shadow-xl">
            <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:px-6">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Facebook Analytics Access Needed</h3>
            </div>
            <div className="grid gap-2 p-3 md:gap-3 md:p-4 lg:grid-cols-2">
              {channelsMissingAnalyticsPermission.map((channel) => (
                <div
                  key={`analytics-${channel._id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PlatformIcon platform={channel.platform} className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="m-0 truncate text-xs font-semibold text-white">
                        @{channel.username || channel.handle || 'facebook-page'}
                      </p>
                      <p className="m-0 truncate text-[10px] text-amber-400">Publishing remains connected</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => connectMetaOAuth(channel.campaignId, getChannelAccountId(channel))}
                    className="shrink-0 rounded-[10px] bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                  >
                    Reconnect
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Channels Listing */}
        <div className="bg-[#141417]/95 border border-white/[0.08] rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl">
          <div className="px-4 sm:px-6 py-4 border-b border-white/[0.08] flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.16em]">
              {isCreator ? 'Connected Accounts' : 'Campaign Publishing Channels'} ({visibleChannels.length})
            </span>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => connectInstagramOAuth()}
                className="flex items-center justify-center gap-1.5 bg-white hover:bg-zinc-200 text-black px-3.5 py-2 sm:py-1.5 rounded-[12px] text-xs font-semibold active:scale-95 transition-all shadow-sm w-full sm:w-auto"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect Instagram</span>
              </button>
              <button
                onClick={() => connectYoutubeOAuth()}
                className="flex items-center justify-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.08] px-3.5 py-2 sm:py-1.5 rounded-[12px] text-xs font-semibold active:scale-95 transition-all shadow-sm w-full sm:w-auto"
              >
                <Link2 className="w-3.5 h-3.5 text-red-400" />
                <span>Connect YouTube</span>
              </button>
              <button
                onClick={() => connectMetaOAuth()}
                className="flex items-center justify-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.08] px-3.5 py-2 sm:py-1.5 rounded-[12px] text-xs font-semibold active:scale-95 transition-all shadow-sm w-full sm:w-auto"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Connect Facebook</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {loading ? (
              <div className="text-center py-12 text-xs text-zinc-400 font-medium">
                Fetching connected channels...
              </div>
            ) : visibleChannels.length === 0 ? (
              <div className="text-center py-16 text-xs text-zinc-400 font-medium">
                {isCreator 
                  ? 'No connected accounts found. Connect an account to get started.'
                  : 'No publishing channels are assigned to this campaign yet. Add them in Campaign Setup.'}
              </div>
            ) : (
              visibleChannels.map(chan => (
                <div key={chan._id} className="px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start sm:items-center gap-3.5 w-full md:w-auto">
                    <div className="relative w-10 h-10 shrink-0">
                      {chan.avatarUrl ? (
                        <img 
                          src={chan.avatarUrl} 
                          crossOrigin="anonymous"
                          className="w-10 h-10 rounded-[10px] object-cover border border-white/10" 
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="w-10 h-10 rounded-[10px] bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300"
                        style={{ display: chan.avatarUrl ? 'none' : 'flex' }}
                      >
                        <PlatformIcon platform={chan.platform} className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{chan.name || chan.displayName || chan.handle}</span>
                        <PlatformIcon platform={chan.platform} className="h-4 w-4" />
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase flex-shrink-0 ${getStatusBadgeClasses(chan.status)}`}>
                          {getStatusLabel(chan.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                        Handle: @{chan.username || chan.handle || 'unspecified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto justify-start md:justify-end pt-3 md:pt-0 border-t border-white/[0.06] md:border-t-0">
                    {chan.status === 'verified' && getChannelAccountId(chan) ? (
                      <button
                        onClick={() => navigate(`/channels/${getChannelAccountId(chan)}/feed`, {
                          state: adminViewUserId ? { fromAdmin: true, channel: chan } : undefined,
                        })}
                        className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-[10px] border border-white/[0.08] transition-all font-semibold active:scale-95"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Feed</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Needs verification</span>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${
                      chan.status === 'verified' ? 'text-emerald-400' : chan.status === 'disconnected' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{getStatusLabel(chan.status)}</span>
                    </div>
                    {getChannelAccountId(chan) && (
                      <button
                        onClick={() => disconnectChannel(getChannelAccountId(chan))}
                        className="p-2 hover:bg-rose-500/10 hover:text-rose-400 text-zinc-400 rounded-[8px] transition-all ml-auto md:ml-0"
                        title="Disconnect Channel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Channels;
