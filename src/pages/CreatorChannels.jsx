import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle2, Unlink } from 'lucide-react';
import { API_BASE_URL } from '../config';
import PlatformIcon from '../components/PlatformIcon';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';
import {
  connectInstagramOAuth,
  connectYoutubeOAuth,
  connectMetaOAuth,
  formatHandle,
  getStatusBadgeClasses,
  getStatusLabel,
} from '../utils/channelOAuth';

export const CreatorChannels = () => {
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
  const activeConnectCampaignId = location.state?.campaignId || sessionStorage.getItem('connect_campaign_id') || null;

  // Confirmation dialog state for disconnecting an account
  const [channelToRemove, setChannelToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  // Floating notification toast
  const [toast, setToast] = useState(() => location.state?.channelToast || null);

  // Channel Connected success dialog
  const [connectedDialogAccount, setConnectedDialogAccount] = useState(
    () => location.state?.connectedAccount || null
  );

  useEffect(() => {
    if (location.state?.channelToast) {
      setToast(location.state.channelToast);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.connectedAccount) {
      setConnectedDialogAccount(location.state.connectedAccount);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    queryKey: ['creator-channels', adminViewUserId],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts`, {
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch connected accounts: ${response.status}`);
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
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign channels: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(user),
  });

  const normalizedChannels = useMemo(
    () => normalizeChannels(channelsQuery.data),
    [channelsQuery.data]
  );

  const pendingVerificationChannels = useMemo(() => (
    (creatorCampaignsQuery.data || []).flatMap((campaign) => (
      (campaign.channels || [])
        .filter((channel) => !channel.isVerified)
        .map((channel) => ({
          ...channel,
          campaignId: campaign._id,
          campaignName: campaign.name,
        }))
    ))
  ), [creatorCampaignsQuery.data]);

  const handleVerifyChannel = (channel) => {
    if (channel.platform === 'instagram') {
      connectInstagramOAuth(channel.campaignId);
    } else if (channel.platform === 'youtube') {
      connectYoutubeOAuth(channel.campaignId);
    } else {
      connectMetaOAuth(channel.campaignId, channel.socialAccountId);
    }
  };

  const confirmDisconnectAccount = async () => {
    if (!channelToRemove) return;
    const accountId = channelToRemove.socialAccountId || channelToRemove._id;
    const accountLabel = channelToRemove.displayName || channelToRemove.name || formatHandle(channelToRemove.handle || channelToRemove.username || 'Account');
    setRemoving(true);
    setRemoveError('');
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to disconnect account.');
      }

      queryClient.invalidateQueries({ queryKey: ['creator-channels'] });
      queryClient.invalidateQueries({ queryKey: ['creator'] });
      setChannelToRemove(null);
      setToast({
        type: 'success',
        message: `${accountLabel} has been disconnected successfully.`,
      });
    } catch (err) {
      console.error('Failed to disconnect account:', err);
      setRemoveError(err.message || 'Failed to disconnect account.');
    } finally {
      setRemoving(false);
    }
  };

  const channelsMissingAnalyticsPermission = normalizedChannels.filter((channel) => (
    channel.platform === 'facebook' && channel.analyticsStatus === 'permission_missing'
  ));

  const loading = channelsQuery.isLoading && normalizedChannels.length === 0;

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] p-4 lg:p-6 text-white space-y-6 font-sans antialiased pb-20">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl backdrop-blur-md ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-[#0d1f17]/95 text-emerald-300'
              : 'border-rose-500/30 bg-[#240e11]/95 text-rose-300'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header & OAuth Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white m-0">My Channels</h2>
          <p className="text-xs text-zinc-400 mt-1 m-0">
            Connect your own social accounts to publish and track performance. No campaign is required.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => connectInstagramOAuth(activeConnectCampaignId)}
            className="flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] active:scale-95"
          >
            <PlatformIcon platform="instagram" className="h-4 w-4 shrink-0" />
            <span>Connect Instagram</span>
          </button>
          <button
            type="button"
            onClick={() => connectYoutubeOAuth(activeConnectCampaignId)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15 active:scale-95 shadow-sm"
          >
            <PlatformIcon platform="youtube" className="h-4 w-4 shrink-0" />
            <span>Connect YouTube</span>
          </button>
          <button
            type="button"
            onClick={() => connectMetaOAuth(activeConnectCampaignId)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15 active:scale-95 shadow-sm"
          >
            <PlatformIcon platform="facebook" className="h-4 w-4 shrink-0" />
            <span>Connect Facebook</span>
          </button>
        </div>
      </div>

      {/* Channels To Verify */}
      {pendingVerificationChannels.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
              Channels To Verify ({pendingVerificationChannels.length})
            </h3>
          </div>
          <p className="text-xs text-amber-200/80 m-0">
            A brand has assigned the following channels to you. Click verify to link your social account.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {pendingVerificationChannels.map((channel) => (
              <div
                key={`${channel.campaignId}-${channel.platform}-${channel.handle || channel.requestedHandle}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-black/40 p-3"
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

      {/* Facebook Analytics Reconnect Notice */}
      {channelsMissingAnalyticsPermission.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
              Facebook Analytics Access Needed
            </h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {channelsMissingAnalyticsPermission.map((channel) => (
              <div
                key={`analytics-${channel._id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-black/40 p-3"
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
                  onClick={() => connectMetaOAuth(activeConnectCampaignId, channel.socialAccountId || channel._id)}
                  className="shrink-0 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95"
                >
                  Reconnect
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connected Accounts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-sm font-semibold text-white m-0">
            Connected Accounts
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {normalizedChannels.length}
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-zinc-400 font-medium">
            Fetching connected accounts...
          </div>
        ) : normalizedChannels.length === 0 ? (
          <div className="text-center py-14 text-xs text-zinc-400 font-medium space-y-3 rounded-xl border border-white/10 bg-white/[0.01]">
            <p className="m-0">No social media channels connected yet.</p>
            <p className="text-zinc-500 text-[11px] m-0">
              Use the connection buttons above to link your Instagram, YouTube, or Facebook account.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {normalizedChannels.map((chan) => {
              const channelOwnerId = String(chan.userId?._id || chan.userId || '');
              const canDisconnect = channelOwnerId === String(user?._id || '');
              return (
              <div
                key={chan._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 hover:bg-white/[0.04] transition shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0">
                    <AccountAvatar account={chan} className="h-10 w-10 rounded-full object-cover border border-white/10" />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-[#141417] shadow-sm">
                      <PlatformIcon platform={chan.platform} className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">
                        {chan.name || chan.displayName || chan.handle || 'Channel'}
                      </span>
                    </div>
                    <p className="m-0 text-[11px] font-mono text-zinc-400 truncate">
                      {formatHandle(chan.username || chan.handle || chan.requestedHandle || '')}
                    </p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-semibold border ${getStatusBadgeClasses(chan.status)}`}>
                      {getStatusLabel(chan.status)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {canDisconnect ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveError('');
                      setChannelToRemove(chan);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition shadow-sm"
                    title="Disconnect Account"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>Disconnect</span>
                  </button>
                  ) : (
                    <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500">
                      Assigned access
                    </span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disconnect Account Confirmation Dialog */}
      {channelToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121215] p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                <Unlink className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-white m-0">Disconnect Social Account</h3>
                <p className="mt-1 text-xs text-zinc-400 m-0">
                  Please review the account you are about to disconnect.
                </p>
              </div>
            </div>

            {/* Account Details Preview Box */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="relative h-11 w-11 shrink-0">
                <AccountAvatar account={channelToRemove} className="h-11 w-11 rounded-full object-cover border border-white/10" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-[#141417] shadow-sm">
                  <PlatformIcon platform={channelToRemove.platform} className="h-2.5 w-2.5" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {channelToRemove.name || channelToRemove.displayName || 'Channel'}
                  </span>
                  <span className="capitalize text-[10px] font-semibold text-zinc-300 rounded-md bg-white/10 border border-white/15 px-1.5 py-0.5">
                    {channelToRemove.platform === 'youtube' ? 'YouTube' : channelToRemove.platform}
                  </span>
                </div>
                <p className="m-0 text-xs font-mono text-zinc-400 truncate mt-0.5">
                  {formatHandle(channelToRemove.username || channelToRemove.handle || channelToRemove.requestedHandle || '')}
                </p>
              </div>
            </div>

            {/* Clear Impact Details */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3.5 space-y-1.5 text-xs text-zinc-300 leading-relaxed">
              <p className="m-0 font-semibold text-rose-300">
                What will happen:
              </p>
              <ul className="m-0 list-disc list-inside space-y-1 text-[11px] text-zinc-400 pl-0.5">
                <li>
                  Access tokens for this <span className="capitalize text-zinc-200">{channelToRemove.platform}</span> account will be revoked.
                </li>
                <li>
                  Scheduled or queued posts targeting this channel will not be published.
                </li>
                <li>
                  You can reconnect this channel anytime using the connect buttons above.
                </li>
              </ul>
            </div>

            {removeError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{removeError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setChannelToRemove(null);
                  setRemoveError('');
                }}
                disabled={removing}
                className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisconnectAccount}
                disabled={removing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/30 hover:text-white shadow-sm disabled:opacity-50"
              >
                <Unlink className="h-3.5 w-3.5" />
                <span>{removing ? 'Disconnecting...' : 'Disconnect Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Connected Success Modal Dialog */}
      {connectedDialogAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121215] p-6 shadow-2xl text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <AccountAvatar
                  account={connectedDialogAccount}
                  className="h-20 w-20 rounded-full border-2 border-emerald-500/50 object-cover shadow-xl"
                />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-[#141417] shadow-md">
                  <PlatformIcon platform={connectedDialogAccount.platform} className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>This channel is connected</span>
              </div>
              <h3 className="text-base font-bold tracking-tight text-white m-0 truncate">
                {connectedDialogAccount.name || connectedDialogAccount.displayName || 'Channel'}
              </h3>
              {Boolean(connectedDialogAccount.username || connectedDialogAccount.handle || connectedDialogAccount.requestedHandle) && (
                <p className="mt-1 text-xs font-mono text-zinc-400 m-0 truncate">
                  {formatHandle(connectedDialogAccount.username || connectedDialogAccount.handle || connectedDialogAccount.requestedHandle)}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed m-0">
                Your <span className="capitalize text-zinc-200">{connectedDialogAccount.platform === 'youtube' ? 'YouTube' : connectedDialogAccount.platform}</span> account is now linked and verified. You can now view and share scheduled content.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConnectedDialogAccount(null)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white hover:bg-zinc-200 px-4 py-2.5 text-xs font-bold text-black transition active:scale-95 shadow-md"
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorChannels;
