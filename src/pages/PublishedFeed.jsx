import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';
import { getMediaUrl } from '../utils/mediaUrls';
import LoadingVideoPreview from '../components/LoadingVideoPreview';
import { useAuth } from '../context/AuthContext';
import { DailyViewsChart } from '../components/adminDashboard/DashboardPresentation';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });
const cancellableStatuses = new Set(['scheduled', 'manual_ready', 'downloaded', 'paused']);
const completedStatuses = new Set(['posted_manual', 'published', 'published_auto']);

const getQueueStatusLabel = (status) => ({
  manual_ready: 'Manual Ready',
  downloaded: 'Downloaded',
  paused: 'Paused',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  posted_manual: 'Posted',
  published: 'Posted',
  published_auto: 'Posted',
}[status] || status || 'Scheduled');

const getQueueStatusClass = (status) => {
  if (completedStatuses.has(status)) return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400';
  if (status === 'manual_ready') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300';
  if (status === 'downloaded') return 'border border-teal-500/30 bg-teal-500/15 text-teal-300';
  if (status === 'paused') return 'border border-zinc-700 bg-zinc-800 text-zinc-400';
  if (status === 'publishing') return 'border border-[#7831d6]/30 bg-[#7831d6]/20 text-[#c4b5fd]';
  return 'border border-[#7831d6]/30 bg-[#7831d6]/15 text-[#c4b5fd]';
};

const getCaptionPreview = (caption) => Array.from(caption || 'No caption').slice(0, 10).join('');

const getPostDisplayDate = (post, fallbackDate) => {
  if (!post) return fallbackDate;
  if (post.status === 'posted_manual' && post.manualPostedAt) {
    const manualDate = new Date(post.manualPostedAt);
    if (!Number.isNaN(manualDate.getTime())) return manualDate;
  }
  const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
  return scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate : fallbackDate;
};

const MediaPreview = ({ item, className = 'h-full w-full object-cover block' }) => {
  const url = getAssetUrl(item?.url);

  if (!url) return null;

  if (item?.type === 'video') {
    return (
      <LoadingVideoPreview
        src={url}
        videoClassName={className}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return <img src={url} className={className} alt="" />;
};

const getAccountLabel = (account) => {
  const label = account?.username || account?.requestedHandle || account?.handle || account?.name || account?.displayName || 'Account';
  return String(label).replace(/^@/, '');
};

const getAccountAvatarUrl = (account) => (
  account?.avatarUrl
  || account?.profilePictureUrl
  || account?.profile_picture_url
  || account?.picture
  || ''
);

const getChannelAvatarSrc = (account) => {
  const avatarUrl = getAccountAvatarUrl(account).trim();
  if (!avatarUrl) return '';
  if (avatarUrl.startsWith('/')) return `${API_BASE_URL}${avatarUrl}`;

  try {
    const parsedUrl = new URL(avatarUrl);
    if (parsedUrl.hostname === 'media.theeasypost.com') {
      return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(avatarUrl)}`;
    }
  } catch {
    return `${API_BASE_URL}/${avatarUrl.replace(/^\/+/, '')}`;
  }
  return avatarUrl;
};

const AccountAvatar = ({ account, sizeClass = 'h-10 w-10', textClass = 'text-xs' }) => {
  const label = getAccountLabel(account);
  const avatarUrl = getChannelAvatarSrc(account);
  return (
    <span className={`${sizeClass} relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#7831d6]/20 ${textClass} font-bold uppercase text-[#c4b5fd]`}>
      <span>{label.charAt(0) || 'C'}</span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={`${label} channel`}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
};

export const PublishedFeed = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const campaignId = getActiveCampaignId();

  const [activeTab, setActiveTab] = useState('published'); // 'published' | 'queued'
  const [captionPost, setCaptionPost] = useState(null);
  const [renderNow, setRenderNow] = useState(() => new Date());
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [selectedGraphDate, setSelectedGraphDate] = useState(null);
  const canDeleteQueuePost = ['owner', 'admin', 'editor'].includes(user?.role);

  useEffect(() => {
    const intervalId = window.setInterval(() => setRenderNow(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!captionPost) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCaptionPost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captionPost]);

  // 1. Channel Details Query
  const channelQuery = useQuery({
    queryKey: ['channel', id, campaignId],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const chanRes = await fetch(`${API_BASE_URL}/api/accounts${withCampaignScope()}`, { headers });
      let channels = chanRes.ok ? await chanRes.json() : [];
      let targetChan = channels.find(c => c._id === id);

      if (!targetChan) {
        const adminRes = await fetch(`${API_BASE_URL}/api/admin/social-accounts`, { headers });
        channels = adminRes.ok ? await adminRes.json() : [];
        targetChan = channels.find(c => c._id === id);
      }

      if (!targetChan) {
        throw new Error('Channel not found');
      }
      return targetChan;
    },
    initialData: () => {
      if (location.state?.channel?._id === id) {
        return location.state.channel;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Published Posts Query
  const publishedPostsQuery = useQuery({
    queryKey: ['publishedPosts', id, campaignId],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/accounts/${id}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'Failed to retrieve published posts.');
      }
      return response.json();
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  // 3. Queued Scheduler Posts Query
  const queuedPostsQuery = useQuery({
    queryKey: ['queuedPosts', id, campaignId],
    queryFn: async () => {
      const token = localStorage.getItem('tw_token');
      const params = new URLSearchParams();
      params.set('accountIds', id);
      params.set('statuses', 'scheduled,manual_ready,downloaded,publishing,paused,posted_manual,published,published_auto');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const startDate = new Date(todayStart);
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date(todayStart);
      endDate.setDate(endDate.getDate() + 4);
      endDate.setHours(23, 59, 59, 999);
      params.set('from', startDate.toISOString());
      params.set('to', endDate.toISOString());
      params.set('includeManualPostedRange', 'true');
      const url = `${API_BASE_URL}/api/scheduler${withCampaignScope(params.toString())}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || 'Failed to retrieve queued posts.');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const channel = channelQuery.data;
  const publishedPosts = useMemo(() => publishedPostsQuery.data || [], [publishedPostsQuery.data]);
  const queuedPosts = useMemo(() => queuedPostsQuery.data || [], [queuedPostsQuery.data]);

  const loading = channelQuery.isLoading || (publishedPostsQuery.isLoading && publishedPosts.length === 0);
  const loadingPosts = publishedPostsQuery.isFetching;
  const loadingQueue = queuedPostsQuery.isPending;
  const refreshingQueue = queuedPostsQuery.isFetching;
  const errorChannel = channelQuery.error?.message || null;
  const errorPosts = publishedPostsQuery.error?.message || null;
  const errorQueue = queuedPostsQuery.error?.message || null;

  const handleDeletePost = async (post) => {
    if (!canDeleteQueuePost || !cancellableStatuses.has(post?.status)) return;
    if (!window.confirm('Are you sure you want to delete this scheduled post?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${post._id}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`,
        },
      });
      if (response.ok) {
        await queuedPostsQuery.refetch();
        await queryClient.invalidateQueries({ queryKey: ['admin'] });
      } else {
        const data = await response.json().catch(() => null);
        alert(data?.message || 'Failed to delete post.');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post.');
    }
  };

  const handleRefresh = async () => {
    setManualRefreshing(true);
    setRefreshError('');
    try {
      const token = localStorage.getItem('tw_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const startResponse = await fetch(`${API_BASE_URL}/api/accounts/${id}/sync`, {
        method: 'POST',
        headers,
      });
      if (!startResponse.ok) {
        const payload = await startResponse.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to start channel synchronization.');
      }

      let completedStatus = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const statusResponse = await fetch(`${API_BASE_URL}/api/accounts/${id}/sync-status`, { headers });
        if (!statusResponse.ok) continue;
        const status = await statusResponse.json();
        if (!['queued', 'running'].includes(status.status)) {
          completedStatus = status;
          break;
        }
      }
      if (!completedStatus) throw new Error('Synchronization is still running. The feed will update on the next refresh.');
      if (['failed', 'rate_limited'].includes(completedStatus.status)) {
        throw new Error(completedStatus.lastError || 'Channel synchronization failed.');
      }
      await Promise.all([
        publishedPostsQuery.refetch(),
        queuedPostsQuery.refetch(),
      ]);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      if (completedStatus.status === 'partial') {
        setRefreshError(completedStatus.lastError || 'Some post metrics could not be refreshed.');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      setRefreshError(error.message || 'Refresh failed.');
    } finally {
      setManualRefreshing(false);
    }
  };

  const getTimeSince = (dateStr) => {
    const past = new Date(dateStr).getTime();
    const diffMs = renderNow.getTime() - past;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const compactNumber = (value = 0) => (
    Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)
  );

  const formatPublishedDate = (value) => {
    if (!value) return { date: 'Unknown', time: '' };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: 'Unknown', time: '' };
    return {
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  };

  const openLivePost = (post) => {
    if (post.permalink) {
      window.open(post.permalink, '_blank', 'noopener,noreferrer');
    }
  };

  const openInsights = (post) => {
    navigate(`/channels/${id}/posts/${post.id}`, {
      state: { fromAdmin: location.state?.fromAdmin, channel },
    });
  };

  const getPublishedDate = (post) => post.publishedAt || post.createdAt || post.timestamp || null;

  const feedSyncedAt = useMemo(() => {
    const syncTimes = publishedPosts
      .map((post) => (post.lastSyncedAt ? new Date(post.lastSyncedAt).getTime() : null))
      .filter((time) => Number.isFinite(time));

    if (syncTimes.length === 0) return null;
    return new Date(Math.max(...syncTimes)).toISOString();
  }, [publishedPosts]);

  const getFeedSyncedAt = () => feedSyncedAt;

  const viewsStats = useMemo(() => {
    const now = renderNow;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0;
    let yesterday = 0;
    let last7Days = 0;
    let thisMonth = 0;
    let allTime = 0;

    publishedPosts.forEach((post) => {
      const publishedAt = getPublishedDate(post);
      const pubDate = publishedAt ? new Date(publishedAt) : null;
      const views = Number(post.views) || 0;
      
      allTime += views;
      
      if (pubDate) {
        if (pubDate >= todayStart) {
          today += views;
        }
        if (pubDate >= yesterdayStart && pubDate < todayStart) {
          yesterday += views;
        }
        if (pubDate >= sevenDaysAgo) {
          last7Days += views;
        }
        if (pubDate >= monthStart) {
          thisMonth += views;
        }
      }
    });

    return { today, yesterday, last7Days, thisMonth, allTime };
  }, [publishedPosts, renderNow]);

  const last30DaysPostedViews = useMemo(() => {
    const now = renderNow;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = [];
    const dateMap = new Map();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = {
        dateStr,
        views: 0,
        posts: 0,
      };
      days.push(entry);
      dateMap.set(dateStr, entry);
    }

    publishedPosts.forEach((post) => {
      const publishedAt = getPublishedDate(post);
      if (!publishedAt) return;
      const pubDate = new Date(publishedAt);
      if (Number.isNaN(pubDate.getTime())) return;
      const dateStr = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`;
      const entry = dateMap.get(dateStr);
      if (entry) {
        entry.posts += 1;
        entry.views += Number(post.views || 0);
      }
    });

    return days;
  }, [publishedPosts, renderNow]);

  const displayedPublishedPosts = useMemo(() => {
    if (!selectedGraphDate) return publishedPosts;
    return publishedPosts.filter((post) => {
      const publishedAt = getPublishedDate(post);
      if (!publishedAt) return false;
      const pubDate = new Date(publishedAt);
      if (Number.isNaN(pubDate.getTime())) return false;
      const dateStr = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')}`;
      return dateStr === selectedGraphDate;
    });
  }, [publishedPosts, selectedGraphDate]);

  const upcomingQueuedCount = useMemo(() => {
    return queuedPosts.filter((post) => {
      const isManualPosted = post.status === 'posted_manual' || Boolean(post.manualPostedAt);
      const isAutoPublished = ['published', 'published_auto'].includes(post.status);
      const isPosted = isManualPosted || isAutoPublished;
      return !isPosted;
    }).length;
  }, [queuedPosts]);

  return (
    <div className="min-h-screen bg-[#09090b] p-4 text-zinc-100">
      {/* Header Container */}
      <div className="mb-3 w-full">
        <button
          onClick={() => navigate(location.state?.fromAdmin ? '/dashboard' : '/channels')}
          className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{location.state?.fromAdmin ? 'Back to Campaign Manager' : 'Back to Channels'}</span>
        </button>

        {loading ? (
          <div className="h-14 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#7831d6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : errorChannel ? (
          <div className="rounded-xl border border-rose-500/30 bg-[#121215] p-4 text-sm font-semibold text-rose-400">
            {errorChannel}
          </div>
        ) : channel ? (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#121215] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <AccountAvatar account={channel} />
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Published feed</p>
                <h2 className="m-0 mt-0.5 truncate text-base font-semibold leading-tight text-zinc-100">
                  {channel.name}
                </h2>
                <p className="m-0 mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-400">
                  <PlatformIcon platform={channel.platform} className="h-3.5 w-3.5" />
                  <span className="truncate">@{channel.username || 'unspecified'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-[10px] font-medium text-zinc-400">
                {getFeedSyncedAt()
                  ? `Recent posts synced ${getTimeSince(getFeedSyncedAt())}`
                  : 'Cached data'
                }
              </span>
              <button
                onClick={handleRefresh}
                disabled={manualRefreshing || loadingPosts || refreshingQueue}
                className="flex items-center gap-1.5 text-xs text-[#c4b5fd] hover:text-white bg-[#7831d6]/20 hover:bg-[#7831d6]/30 px-3.5 py-1.5 rounded-lg border border-[#7831d6]/40 transition-all font-semibold disabled:opacity-50 active:scale-95 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${manualRefreshing || loadingPosts || refreshingQueue ? 'animate-spin' : ''}`} />
                <span>{manualRefreshing || loadingPosts || refreshingQueue ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        ) : null}
        {refreshError && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-300">
            {refreshError}
          </div>
        )}
      </div>

      {/* Views Metrics Summary */}
      {!loading && channel && publishedPosts.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(() => {
            const stats = viewsStats;
            const format = (num) => Intl.NumberFormat().format(num);
            return [
              { label: 'Published Today', value: stats.today },
              { label: 'Published Yesterday', value: stats.yesterday },
              { label: 'Published in 7 Days', value: stats.last7Days },
              { label: 'Published This Month', value: stats.thisMonth },
              { label: '30-Day Feed', value: stats.allTime },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-white/10 bg-[#121215] p-2.5 shadow-sm">
                <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-zinc-400">{card.label}</p>
                <p className="m-0 mt-1 text-base font-bold leading-none text-zinc-100">{format(card.value)}</p>
                <p className="m-0 mt-1 text-[8px] text-zinc-400">Current lifetime views</p>
              </div>
            ));
          })()}
        </div>
      )}

      {/* 30-Day Daily Views Chart */}
      {!loading && channel && publishedPosts.length > 0 && (
        <div className="mb-3">
          <DailyViewsChart
            data={last30DaysPostedViews}
            selectedDate={selectedGraphDate}
            onSelectDate={setSelectedGraphDate}
          />
        </div>
      )}

      {/* Tabs Selector */}
      {!loading && channel && (
        <div className="mb-3 flex border-b border-white/10 gap-4">
          <button
            onClick={() => setActiveTab('published')}
            className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'published'
                ? 'border-[#7831d6] text-[#c4b5fd]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Published Feed ({selectedGraphDate ? `${displayedPublishedPosts.length} of ${publishedPosts.length}` : publishedPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('queued')}
            className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'queued'
                ? 'border-[#7831d6] text-[#c4b5fd]'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Scheduled Queue ({upcomingQueuedCount})
          </button>
        </div>
      )}

      {/* Body Container */}
      <div className="w-full mt-2">
        {activeTab === 'published' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-6 h-6 border-2 border-[#7831d6] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-zinc-400 font-medium">Loading published posts...</span>
            </div>
          ) : errorPosts ? (
            <div className="bg-[#121215] border border-rose-500/30 rounded-xl p-8 text-center space-y-2 shadow-sm text-white">
              <p className="text-sm text-rose-400 font-bold m-0">⚠️ Error Fetching Feed</p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed m-0">{errorPosts}</p>
            </div>
          ) : publishedPosts.length === 0 ? (
            <div className="bg-[#121215] border border-white/10 rounded-xl p-16 text-center text-sm text-zinc-400 font-medium shadow-sm">
              No cached published posts from the last 30 days. Refresh to sync this channel.
            </div>
          ) : (
            <div className="w-full">
              {selectedGraphDate && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/10 px-3 py-2 text-xs text-white">
                  <span>
                    Showing <strong>{displayedPublishedPosts.length}</strong> post{displayedPublishedPosts.length === 1 ? '' : 's'} published on <strong>{selectedGraphDate}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedGraphDate(null)}
                    className="font-semibold text-[#c4b5fd] hover:underline"
                  >
                    Show all 30 days
                  </button>
                </div>
              )}
              <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-[#121215]">
                <div className="min-w-[620px]">
                <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.7fr] gap-3 border-b border-white/10 bg-black/40 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Published</span>
                  <span>Views</span>
                  <span>Likes</span>
                  <span>Comments</span>
                  <span>Actions</span>
                </div>
                <div>
                  {displayedPublishedPosts.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400">
                      No posts found for {selectedGraphDate}.
                    </div>
                  ) : (
                    displayedPublishedPosts.map((post) => {
                      const publishedDate = getPublishedDate(post);
                      const publishedDisplay = formatPublishedDate(publishedDate);
                      return (
                        <div key={post.id} className="border-b border-white/10 last:border-b-0">
                          <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.7fr] items-center gap-3 px-3 py-2 text-xs transition hover:bg-white/[0.04] text-zinc-200">
                            <div className="min-w-0">
                              <p className="m-0 truncate font-semibold text-zinc-100">{publishedDisplay.date}</p>
                              {publishedDisplay.time && (
                                <p className="m-0 mt-0.5 text-[10px] font-semibold text-zinc-400">{publishedDisplay.time}</p>
                              )}
                            </div>
                            <span className="font-semibold text-zinc-300">
                              {post.views === null || post.views === undefined ? '—' : compactNumber(post.views)}
                            </span>
                            <span className="font-semibold text-zinc-300">{compactNumber(post.likes)}</span>
                            <span className="font-semibold text-zinc-300">{compactNumber(post.comments)}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openLivePost(post)}
                                disabled={!post.permalink}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-300 transition hover:border-[#7831d6] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                title={post.permalink ? 'Open live post' : 'Live-post link unavailable'}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openInsights(post)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#7831d6] text-white transition hover:bg-[#6825bc]"
                                title="View performance insights"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            </div>
          )
        ) : (
          loadingQueue ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-6 h-6 border-2 border-[#7831d6] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-zinc-400 font-medium">Loading scheduled queue...</span>
            </div>
          ) : errorQueue ? (
            <div className="bg-[#121215] border border-rose-500/30 rounded-xl p-8 text-center space-y-2 shadow-sm text-white">
              <p className="text-sm text-rose-400 font-bold m-0">⚠️ Error Fetching Queue</p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed m-0">{errorQueue}</p>
            </div>
          ) : queuedPosts.length === 0 ? (
            <div className="bg-[#121215] border border-white/10 rounded-xl p-16 text-center text-sm text-zinc-400 font-medium shadow-sm">
              No posts in this seven-day queue window.
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-[#121215]">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="bg-black/40 border-b border-white/10 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Media</th>
                    <th className="px-3 py-2">Schedule</th>
                    <th className="px-3 py-2">Caption</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...queuedPosts]
                    .sort((a, b) => getPostDisplayDate(a, renderNow) - getPostDisplayDate(b, renderNow))
                    .map((post) => {
                      const displayDate = getPostDisplayDate(post, renderNow);
                      const display = formatPublishedDate(displayDate);
                      const mediaItem = post.mediaIds?.[0];
                      const isPosted = completedStatuses.has(post.status) || Boolean(post.manualPostedAt);

                      return (
                        <tr key={post._id} className={`border-t border-white/10 transition hover:bg-white/[0.04] ${isPosted ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : ''}`}>
                          <td className="w-20 px-3 py-2">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
                              {mediaItem ? (
                                <MediaPreview item={mediaItem} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[8px] font-medium text-zinc-500">No media</span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <p className="m-0 font-semibold text-zinc-100">{display.date}</p>
                            <p className="m-0 mt-0.5 text-[10px] text-zinc-400">{display.time || 'Time unavailable'}</p>
                          </td>
                          <td className="max-w-[320px] px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setCaptionPost(post)}
                              className="block w-full truncate text-left font-medium text-zinc-200 hover:text-[#c4b5fd]"
                              title="View full caption"
                            >
                              {getCaptionPreview(post.caption)}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 capitalize text-zinc-300">{post.scheduleMode || 'auto'}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getQueueStatusClass(post.status)}`}>
                              {getQueueStatusLabel(post.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setCaptionPost(post)}
                              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-200 transition hover:border-[#7831d6] hover:text-white"
                            >
                              View
                            </button>
                            {canDeleteQueuePost && cancellableStatuses.has(post.status) && (
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post)}
                                className="ml-2 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-500/25"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
      {captionPost && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="queued-caption-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setCaptionPost(null)}
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#18181b] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h3 id="queued-caption-title" className="m-0 text-sm font-semibold text-zinc-100">Post caption</h3>
              <button type="button" onClick={() => setCaptionPost(null)} className="text-xs font-semibold text-[#c4b5fd] hover:underline">Close</button>
            </div>
            <p className="m-0 mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{captionPost.caption || 'No caption'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishedFeed;
