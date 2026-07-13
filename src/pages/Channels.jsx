import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, ShieldCheck, Link2, Eye } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';

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
        headers: { 'Authorization': `Bearer ${token}` }
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
    queryKey: ['creator', 'campaigns', 'channels-verification'],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/creator/campaigns`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
    if (!window.confirm('Are you sure you want to disconnect this account? This will stop future automatic publications targeting it.')) {
      return;
    }

    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setDisconnectedChannelIds((current) => (
          current.includes(id) ? current : [...current, id]
        ));
        await queryClient.invalidateQueries({ queryKey: ['channels'] });
        await queryClient.invalidateQueries({ queryKey: ['scheduler'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        alert('Failed to disconnect channel');
      }
    } catch (error) {
      console.error('Error disconnecting channel:', error);
    }
  };

  const setConnectCampaignContext = (campaignId = activeConnectCampaignId) => {
    if (campaignId) {
      sessionStorage.setItem('connect_campaign_id', campaignId);
    }
  };

  const connectMetaOAuth = (campaignId = activeConnectCampaignId) => {
    setConnectCampaignContext(campaignId);
    const appId = import.meta.env.VITE_META_APP_ID || 'your-meta-app-id';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/facebook/callback');
    const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights,instagram_manage_insights');
    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    window.location.assign(oauthUrl);
  };

  const connectInstagramOAuth = (campaignId = activeConnectCampaignId) => {
    const appId = import.meta.env.VITE_INSTAGRAM_APP_ID;
    const facebookAppId = import.meta.env.VITE_META_APP_ID;
    if (!appId || appId === facebookAppId) {
      alert('Set VITE_INSTAGRAM_APP_ID to the Instagram App ID from Meta Dashboard > Instagram > API setup with Instagram login. It cannot be the Facebook App ID.');
      return;
    }
    setConnectCampaignContext(campaignId);
    const rawRedirectUri = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || `${window.location.origin}/auth/instagram/callback`;
    sessionStorage.setItem('instagram_oauth_redirect_uri', rawRedirectUri);
    const redirectUri = encodeURIComponent(rawRedirectUri);
    const scope = encodeURIComponent('instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights');
    const oauthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.assign(oauthUrl);
  };

  const connectYoutubeOAuth = async (campaignId = activeConnectCampaignId) => {
    try {
      setConnectCampaignContext(campaignId);
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/youtube/auth-url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.message || 'Failed to start YouTube connection.');
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error('Failed to start YouTube OAuth:', error);
      alert('Failed to connect to the backend for YouTube OAuth.');
    }
  };

  const handleVerifyChannel = (channel) => {
    if (channel.platform === 'instagram') {
      connectInstagramOAuth(channel.campaignId);
      return;
    }

    if (channel.platform === 'youtube') {
      void connectYoutubeOAuth(channel.campaignId);
      return;
    }

    if (channel.platform === 'facebook') {
      connectMetaOAuth(channel.campaignId);
      return;
    }
  };

  const getStatusBadgeClasses = (status) => {
    if (status === 'verified') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'disconnected') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
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
  const visibleChannels = normalizedChannels.filter((channel) => {
    const accountId = getChannelAccountId(channel);
    return !disconnectedChannelIds.includes(accountId) && !disconnectedChannelIds.includes(channel._id);
  });
  const loading = channelsQuery.isLoading && normalizedChannels.length === 0;

  return (
    <div className="p-4 sm:p-8 text-[#1d1d1f] space-y-6 sm:space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#e5e5ea] gap-2">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Publishing Channels</h2>
          <p className="text-[#8e8e93] text-xs mt-1">
            {adminViewUserId
              ? `Viewing channels for ${adminViewContext?.userName || 'selected user'}`
              : 'Manage Facebook, Instagram, and YouTube publishing channels'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Info card */}
       
        {pendingVerificationChannels.length > 0 && (
          <section className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-[#e5e5ea]">
              <h3 className="m-0 text-sm font-semibold text-black">Channels To Verify</h3>
            </div>
            <div className="grid gap-2 p-3 md:gap-3 md:p-4 lg:grid-cols-2">
              {pendingVerificationChannels.map((channel) => (
                <div
                  key={`${channel.campaignId}-${channel.platform}-${channel.handle || channel.requestedHandle}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 md:p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1.5">
                      <PlatformIcon platform={channel.platform} className="h-7 w-7 md:h-8 md:w-8" />
                      {channel.avatarUrl ? (
                        <img
                          src={channel.avatarUrl}
                          crossOrigin="anonymous"
                          className="h-7 w-7 rounded-full border border-amber-200/50 object-cover shadow-sm md:h-8 md:w-8"
                          alt=""
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/50 bg-amber-100 text-xs font-bold text-amber-700 md:h-8 md:w-8">
                          {((channel.handle || channel.requestedHandle || '@').charAt(0) || '@').toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">
                        {(channel.handle || channel.requestedHandle || '').startsWith('@')
                          ? (channel.handle || channel.requestedHandle)
                          : `@${channel.handle || channel.requestedHandle || 'channel'}`}
                      </p>
                      <p className="m-0 truncate text-xs text-[#8a6b1f]">{channel.campaignName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVerifyChannel(channel)}
                    className="shrink-0 rounded-lg bg-[#1d1d1f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
                  >
                    Verify
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Channels Listing */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#e5e5ea] flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              {isCreator ? 'Connected Accounts' : 'Campaign Publishing Channels'} ({visibleChannels.length})
            </span>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <button
                onClick={() => connectInstagramOAuth()}
                className="flex items-center justify-center gap-1.5 bg-black hover:bg-gray-800 text-white px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm w-full sm:w-auto"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect Instagram</span>
              </button>
              <button
                onClick={() => connectYoutubeOAuth()}
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm w-full sm:w-auto"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect YouTube</span>
              </button>
              <button
                onClick={() => connectMetaOAuth()}
                className="flex items-center justify-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm w-full sm:w-auto"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect Facebook & Instagram</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#e5e5ea]">
            {loading ? (
              <div className="text-center py-12 text-xs text-gray-400 font-medium">
                Fetching connected channels...
              </div>
            ) : visibleChannels.length === 0 ? (
              <div className="text-center py-16 text-xs text-gray-400 font-medium">
                {isCreator 
                  ? 'No connected accounts found. Connect an account to get started.'
                  : 'No publishing channels are assigned to this campaign yet. Add them in Campaign Setup.'}
              </div>
            ) : (
              visibleChannels.map(chan => (
                <div key={chan._id} className="px-4 sm:px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-[#f5f5f7]/40 transition-colors">
                  <div className="flex items-start sm:items-center gap-4 w-full md:w-auto">
                    <img 
                      src={chan.avatarUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150'} 
                      crossOrigin="anonymous"
                      className="w-10 h-10 rounded-full object-cover border border-[#d2d2d7] flex-shrink-0" 
                      alt="" 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-black truncate">{chan.name || chan.displayName || chan.handle}</span>
                        <PlatformIcon platform={chan.platform} className="h-4 w-4" />
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${getStatusBadgeClasses(chan.status)}`}>
                          {getStatusLabel(chan.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 truncate">
                        Handle: @{chan.username || chan.handle || 'unspecified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto justify-start md:justify-end pt-3 md:pt-0 border-t border-[#e5e5ea]/50 md:border-t-0">
                    {chan.status === 'verified' && getChannelAccountId(chan) ? (
                      <button
                        onClick={() => navigate(`/channels/${getChannelAccountId(chan)}/feed`, {
                          state: adminViewUserId ? { fromAdmin: true, channel: chan } : undefined,
                        })}
                        className="flex items-center justify-center gap-1.5 text-[10px] text-[#0071e3] hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all font-semibold active:scale-95"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Feed</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Needs verification</span>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${
                      chan.status === 'verified' ? 'text-emerald-600' : chan.status === 'disconnected' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{getStatusLabel(chan.status)}</span>
                    </div>
                    {getChannelAccountId(chan) && (
                      <button
                        onClick={() => disconnectChannel(getChannelAccountId(chan))}
                        className="p-2 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-all ml-auto md:ml-0"
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
