import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Calendar, CheckCircle, Share2, RefreshCw } from 'lucide-react';
import { getMediaUrl } from '../utils/mediaUrls';
import PlatformIcon from '../components/PlatformIcon';
import { PwaInstallButton } from '../components/PwaInstallButton';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });
const POST_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const copyToClipboard = (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
};

export const CreatorCampaigns = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [campaigns, setCampaigns] = useState([]);
  const [posts, setPosts] = useState([]);
  const [todayTracking, setTodayTracking] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharingPostId, setSharingPostId] = useState(null);
  const [markingPostId, setMarkingPostId] = useState(null);
  const [postedToast, setPostedToast] = useState(null);
  const [nowMs, setNowMs] = useState(0);
  const shareBlobRef = useRef(null);

  // Pull-to-refresh state & refs
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const isReadyToPullRef = useRef(false);

  const isCreatorActionable = (post) => (
    ['manual', 'hybrid'].includes(post.scheduleMode)
    && !['posted_manual', 'published', 'published_auto', 'failed', 'cancelled'].includes(post.status)
  );
  const isAwaitingPostedDecision = (post) => (
    Boolean(post?.manualDownloadedAt) || post?.status === 'downloaded'
  );
  const getPostShareReadyStatus = (post) => (
    post?.scheduleMode === 'manual' ? 'manual_ready' : 'scheduled'
  );

  const getTodayTrackingQuery = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
    }).toString();
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const normalizedValue = typeof value === 'object' && value !== null
      ? value.iso || value.local || value.timestamp
      : value;
    const date = new Date(normalizedValue);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatPostTime = (value) => {
    const date = parseDateValue(value);
    if (!date) return '--:--';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return minutes === 0
      ? `${hour12}${period}`
      : `${hour12}:${String(minutes).padStart(2, '0')}${period}`;
  };

  const getPostDisplayPublishedAt = (post) => post?.publishedAt || post?.manualPostedAt;

  const sortPostsByPublishedAt = (items = []) => (
    [...items].sort((a, b) => {
      const aTime = parseDateValue(getPostDisplayPublishedAt(a))?.getTime() || 0;
      const bTime = parseDateValue(getPostDisplayPublishedAt(b))?.getTime() || 0;
      return aTime - bTime;
    })
  );

  const isTodayDate = (value) => {
    const date = parseDateValue(value);
    if (!date) return false;
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  };

  const formatCooldownRemaining = (remainingMs) => {
    const totalMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const getPostingCooldown = (tracking = {}, manualPostedAt = null) => {
    const trackedPublishedAt = parseDateValue(
      tracking.lastPublishedAt || tracking.posts?.[0]?.publishedAt
    );
    const trackedManualPostedAt = parseDateValue(manualPostedAt);
    const latestPublishedAt = [trackedPublishedAt, trackedManualPostedAt]
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    if (!latestPublishedAt) {
      return { isLocked: false, remainingMs: 0, label: '' };
    }
    if (!nowMs) {
      return { isLocked: true, remainingMs: 0, label: 'Checking availability' };
    }
    const unlocksAt = latestPublishedAt.getTime() + POST_COOLDOWN_MS;
    const remainingMs = unlocksAt - nowMs;
    if (remainingMs <= 0) {
      return { isLocked: false, remainingMs: 0, label: '' };
    }
    return {
      isLocked: true,
      remainingMs,
      label: `Available in ${formatCooldownRemaining(remainingMs)}`,
    };
  };

  const fetchTodayTracking = useCallback((headers, { force = false } = {}) => {
    const query = getTodayTrackingQuery();
    return queryClient.fetchQuery({
      queryKey: ['creator', 'today-tracking', query],
      queryFn: async () => {
        const response = await fetch(`${API_BASE_URL}/api/scheduler/creator/today-tracking?${query}`, { headers });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
          return { accounts: {} };
        }
        try {
          return await response.json();
        } catch (error) {
          console.warn('Creator tracking response was not valid JSON:', error);
          return { accounts: {} };
        }
      },
      staleTime: force ? 0 : 60 * 1000,
    });
  }, [queryClient]);

  const updatePostInList = (updatedPost) => {
    setPosts((current) => current.map((post) => (
      post._id === updatedPost._id ? updatedPost : post
    )));
  };

  const markPostDownloaded = async (post) => {
    const response = await fetch(`${API_BASE_URL}/api/scheduler/${post._id}/downloaded`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const updatedPost = await response.json();
      updatePostInList(updatedPost);
      void queryClient.invalidateQueries({ queryKey: ['creator'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      return updatedPost;
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Could not prepare this post for sharing.');
  };

  const handleCopyCaption = async (post) => {
    const text = post.caption?.trim();
    if (!text) {
      alert('No caption or description is attached to this post.');
      return false;
    }

    try {
      await copyToClipboard(text);
      return true;
    } catch (err) {
      console.warn('Caption copy failed:', err);
      alert('Could not copy the caption. Please select and copy it manually.');
      return false;
    }
  };

  const getMediaFileName = (media) => {
    const rawName = media?.name || media?.url?.split('/').pop()?.split('?')[0] || 'creator-video.mp4';
    return rawName.includes('.') ? rawName : `${rawName}.mp4`;
  };

  const handleSharePost = async (post, cooldown = {}) => {
    if (cooldown.isLocked) {
      alert(`You can share the next video after ${formatCooldownRemaining(cooldown.remainingMs)}.`);
      return;
    }

    const media = post.mediaIds?.[0];
    if (!media?.url) {
      alert('No video is attached to this post.');
      return;
    }

    if (post.caption?.trim()) {
      void handleCopyCaption(post);
    }
    setSharingPostId(post._id);

    try {
      if (typeof navigator.share !== 'function') {
        alert('Native sharing is not available in this browser.');
        return;
      }

      const fileName = getMediaFileName(media);
      await markPostDownloaded(post);

      if (window.isSecureContext) {
        try {
          const cached = shareBlobRef.current;
          let blob = cached?.postId === post._id && cached?.mediaUrl === media.url
            ? cached.blob
            : null;

          if (!blob) {
            const response = await fetch(getAssetUrl(media.url));
            blob = response.ok ? await response.blob() : null;
          }

          if (blob) {
            const file = new File([blob], fileName, { type: blob.type || 'video/mp4' });
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: fileName,
                text: post.caption || '',
              });
              return;
            }
          }
        } catch (fileShareError) {
          if (fileShareError.name === 'AbortError') return;
          console.warn('File share failed, falling back to URL share:', fileShareError);
        }
      }

      await navigator.share({
        title: fileName,
        text: post.caption || '',
        url: media.url,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        alert(err.message || 'Could not open the share sheet for this video.');
      }
    } finally {
      setSharingPostId(null);
    }
  };

  const handleMarkManualPosted = async (post) => {
    if (!isAwaitingPostedDecision(post)) {
      alert('Share this queued video first. Mark Posted appears after it is downloaded.');
      return;
    }

    setMarkingPostId(post._id);
    setPostedToast(null);
    try {
      const postForCheck = post;
      const postAccounts = getPostAccounts(postForCheck);
      const connectedMetaAccountIds = postAccounts
        .filter((account) => ['facebook', 'instagram'].includes(account?.platform))
        .filter((account) => account?.isConnected !== false && account?.status !== 'manual_only')
        .map(getAccountId)
        .filter(Boolean);
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`${API_BASE_URL}/api/scheduler/${post._id}/manual-posted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ manualPostUrl: '' }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const trackingData = await fetchTodayTracking(headers, { force: true });
          setTodayTracking(trackingData.accounts || {});
          setPostedToast({
            type: 'pending',
            message: data.message || 'No live post detected yet. Post this video first, then tap Mark Posted again.',
          });
          return;
        }
        throw new Error(data.message || 'Could not mark this post as posted.');
      }
      updatePostInList(data);
      const trackingData = await fetchTodayTracking(headers, { force: true });
      setTodayTracking(trackingData.accounts || {});
      setPostedToast({
        type: 'marked',
        message: connectedMetaAccountIds.length > 0
          ? 'Live post detected. Next video is ready.'
          : 'Manual post time saved. Next video is ready.',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['creator'] }),
        queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    } catch (err) {
      alert(err.message);
    } finally {
      setMarkingPostId(null);
    }
  };

  const handleNotPosted = (post) => {
    setPostedToast(null);
    const shareReadyPost = {
      ...post,
      status: getPostShareReadyStatus(post),
      manualDownloadedAt: null,
      manualPostedAt: null,
      manualPostUrl: '',
      publishSource: null,
    };
    updatePostInList(shareReadyPost);

    fetch(`${API_BASE_URL}/api/scheduler/${post._id}/not-posted`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not reset this post.');
        updatePostInList(data);
        void queryClient.invalidateQueries({ queryKey: ['creator'] });
        void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      })
      .catch((err) => {
        alert(err.message);
        updatePostInList(shareReadyPost);
      });
  };

  const loadData = useCallback(async (opts = {}) => {
    if (!opts.silent) {
      setLoading(true);
    }
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const fetchJson = async (url) => {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      };

      if (opts.force) {
        await queryClient.invalidateQueries({ queryKey: ['creator'] });
      }

      const [campData, postData, trackingData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['creator', 'campaigns'],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/accounts/creator/campaigns`),
          staleTime: opts.force ? 0 : 2 * 60 * 1000,
        }),
        queryClient.fetchQuery({
          queryKey: ['creator', 'posts'],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/scheduler/creator/posts`),
          staleTime: opts.force ? 0 : 20 * 1000,
        }),
        fetchTodayTracking(headers, { force: opts.force }),
      ]);

      setCampaigns(campData);
      setPosts(postData);
      setTodayTracking(trackingData.accounts || {});
    } catch (err) {
      setError(err.message);
    } finally {
      if (!opts.silent) {
        setLoading(false);
      }
    }
  }, [fetchTodayTracking, queryClient, token]);

  const handleTouchStart = (e) => {
    if (isRefreshing) return;
    const mainElement = e.currentTarget.closest('main');
    const isAtTop = !mainElement || mainElement.scrollTop <= 0;
    if (isAtTop) {
      startYRef.current = e.touches[0].clientY;
      isReadyToPullRef.current = true;
      setIsDragging(true);
    } else {
      isReadyToPullRef.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isReadyToPullRef.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diffY = currentY - startYRef.current;
    if (diffY > 0) {
      const distance = Math.min(diffY * 0.4, 80);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isReadyToPullRef.current) return;
    setIsDragging(false);
    isReadyToPullRef.current = false;
    startYRef.current = null;

    if (pullDistance >= 60) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await loadData({ silent: true, force: true });
      } catch (err) {
        console.error('Pull to refresh failed:', err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  useEffect(() => {
    let active = true;
    const initialFetch = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const fetchJson = async (url) => {
          const response = await fetch(url, { headers });
          if (!response.ok) throw new Error(`Request failed: ${response.status}`);
          return response.json();
        };
        const [campData, postData, trackingData] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['creator', 'campaigns'],
            queryFn: () => fetchJson(`${API_BASE_URL}/api/accounts/creator/campaigns`),
            staleTime: 2 * 60 * 1000,
          }),
          queryClient.fetchQuery({
            queryKey: ['creator', 'posts'],
            queryFn: () => fetchJson(`${API_BASE_URL}/api/scheduler/creator/posts`),
            staleTime: 20 * 1000,
          }),
          fetchTodayTracking(headers),
        ]);

        if (!active) return;

        setCampaigns(campData);
        setPosts(postData);
        setTodayTracking(trackingData.accounts || {});
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (token) {
      initialFetch();
    }

    return () => {
      active = false;
    };
  }, [fetchTodayTracking, queryClient, token]);

  useEffect(() => {
    const updateNow = () => {
      setNowMs(Date.now());
    };
    const initialTimer = window.setTimeout(updateNow, 0);
    const timer = window.setInterval(updateNow, 60 * 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!postedToast) return undefined;
    const timer = window.setTimeout(() => setPostedToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [postedToast]);

  const assignedCampaigns = campaigns.filter((camp) => (camp.channels || []).length > 0);
  const creatorQueuePosts = posts.filter((post) => (
    ['manual', 'hybrid'].includes(post.scheduleMode)
    && !['failed', 'cancelled'].includes(post.status)
  ));
  const actionablePosts = posts
    .filter(isCreatorActionable)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const nextQueuedPost = actionablePosts[0] || null;
  const getIdValue = (value) => (typeof value === 'object' && value !== null ? value._id : value);
  const getCampaignCreatorPosts = (campaignId) => (
    creatorQueuePosts.filter((post) => String(getIdValue(post.campaignId)) === String(campaignId))
  );

  const getPrimaryMedia = (post) => post.mediaIds?.[0] || null;
  const getPostAccounts = (post) => (
    (post.socialAccountIds || []).length > 0
      ? post.socialAccountIds
      : post.campaignChannelIds || []
  );
  const getAccountId = (account) => String(getIdValue(account) || '');
  const getChannelAccountIds = (channel) => (
    [
      channel?.socialAccountId,
      channel?.matchedAccountId,
      channel?._id,
    ].map(getAccountId).filter(Boolean)
  );
  const getAccountLabel = (account) => account?.username || account?.name || account?.handle || account?.requestedHandle || 'Account';
  const shouldShowManualPostedTimes = (account) => (
    ['manual_only', 'pending_verification', 'disconnected'].includes(account?.status)
    || account?.isVerified === false
    || account?.isConnected === false
  );
  const getManualPostedToday = (items = []) => (
    items
      .filter((post) => post.status === 'posted_manual' && isTodayDate(post.manualPostedAt))
      .map((post) => ({
        id: `manual-${post._id}`,
        platform: getPostAccounts(post)?.[0]?.platform || '',
        publishedAt: post.manualPostedAt,
        manualPostedAt: post.manualPostedAt,
        source: 'manual',
      }))
  );
  const getLatestManualPostedAt = (items = []) => (
    items
      .filter((post) => post.status === 'posted_manual')
      .map((post) => parseDateValue(post.manualPostedAt))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null
  );
  const getAccountQueueGroups = (camp) => {
    const campaignPosts = getCampaignCreatorPosts(camp._id);
    const groups = new Map();
    const groupAliasMap = new Map();

    (camp.channels || []).forEach((channel) => {
      const channelAccountIds = getChannelAccountIds(channel);
      const accountId = channelAccountIds[0];
      if (!accountId) return;
      groups.set(accountId, {
        accountId,
        account: channel,
        posts: [],
      });
      channelAccountIds.forEach((aliasId) => {
        groupAliasMap.set(aliasId, accountId);
      });
    });

    campaignPosts.forEach((post) => {
      const postAccounts = getPostAccounts(post);
      postAccounts.forEach((account) => {
        const accountId = getAccountId(account);
        if (!accountId) return;
        const groupId = groupAliasMap.get(accountId) || accountId;
        if (!groups.has(groupId)) {
          groups.set(groupId, {
            accountId: groupId,
            account,
            posts: [],
          });
          groupAliasMap.set(accountId, groupId);
        }
        groups.get(groupId).posts.push(post);
      });
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedPosts = [...group.posts].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
        const actionableQueue = sortedPosts.filter(isCreatorActionable);
        return {
          ...group,
          posts: sortedPosts,
          actionableQueue,
          nextPost: actionableQueue[0] || null,
        };
      })
      .filter(Boolean);
  };
  const nextShareMedia = !isAwaitingPostedDecision(nextQueuedPost)
    ? getPrimaryMedia(nextQueuedPost || {})
    : null;
  const campaignQueueViews = assignedCampaigns.map((camp) => ({
    camp,
    accountQueues: getAccountQueueGroups(camp),
  }));

  useEffect(() => {
    shareBlobRef.current = null;
    if (!nextQueuedPost?._id || !nextShareMedia?.url || typeof navigator.share !== 'function' || !window.isSecureContext) {
      return undefined;
    }

    let cancelled = false;
    fetch(getAssetUrl(nextShareMedia.url))
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!cancelled && blob) {
          shareBlobRef.current = {
            postId: nextQueuedPost._id,
            mediaUrl: nextShareMedia.url,
            blob,
          };
        }
      })
      .catch((err) => {
        console.warn('Share preload failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [nextQueuedPost?._id, nextShareMedia?.url]);

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="px-4 pb-4 pt-2 text-[#1d1d1f] sm:px-6 sm:pt-3 md:px-8 md:py-5 min-h-screen"
    >
      {postedToast && (
        <div className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:top-6">
          <div className={`animate-in fade-in slide-in-from-top-2 duration-200 rounded-lg border px-3 py-2 text-xs font-semibold shadow-[0_12px_32px_rgba(15,23,42,0.16)] ${
            ['verified', 'marked'].includes(postedToast.type)
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            {postedToast.message}
          </div>
        </div>
      )}

      {/* Pull-to-refresh elegant indicator */}
      <div 
        style={{ height: `${pullDistance}px` }}
        className={`flex items-center justify-center overflow-hidden w-full bg-transparent ${
          isDragging ? '' : 'transition-all duration-300 ease-out'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1 py-1.5 text-[#8e8e93]">
          <RefreshCw 
            className={`w-5 h-5 text-[#3478f6] ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={!isRefreshing ? { transform: `rotate(${pullDistance * 6}deg)` } : undefined}
          />
          <span className="text-[10px] font-bold tracking-wide uppercase">
            {isRefreshing 
              ? 'Syncing campaigns...' 
              : pullDistance >= 60 
                ? 'Release to refresh' 
                : 'Pull to refresh'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-2 sm:space-y-3 md:space-y-4">
       

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[#d2d2d7] bg-white p-8 text-center text-sm text-[#6e6e73]">
            Syncing campaigns and calendar...
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            <section className="space-y-5 md:space-y-6">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="m-0 text-2xl font-semibold text-black">My Campaigns</h2>
                <PwaInstallButton
                  collapsed
                  popoverClassName="right-0"
                />
              </div>
              {assignedCampaigns.length > 0 ? (
                <div className="grid gap-x-5 gap-y-5 md:gap-x-7 md:gap-y-6 lg:grid-cols-2">
                  {campaignQueueViews.flatMap(({ camp, accountQueues }) => {
                    if (accountQueues.length === 0) {
                      return (
                        <div key={`${camp._id}-empty`} className="rounded-lg border border-[#e5e5ea] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                          {/* 
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="truncate text-xs font-semibold text-[#6e6e73]">{camp.name}</span>
                            <span className="shrink-0 rounded-full border border-[#e5e5ea] bg-white px-1.5 py-0.5 text-[9px] font-bold capitalize text-[#8e8e93]">
                              {camp.status || 'active'}
                            </span>
                          </div>
                          */}
                          <div className="py-2 text-center">
                            <p className="m-0 text-[10px] font-bold uppercase text-[#6e6e73]">Videos</p>
                            <p className="m-0 mt-0.5 text-xs font-semibold text-[#1d1d1f]">No videos yet</p>
                          </div>
                        </div>
                      );
                    }

                    return accountQueues.map((queue) => {
                      const queuePost = queue.nextPost;
                      const tracking = todayTracking[queue.accountId] || { count: 0, posts: [] };
                      const manualPostedToday = shouldShowManualPostedTimes(queue.account)
                        ? getManualPostedToday(queue.posts)
                        : [];
                      const latestManualPostedAt = shouldShowManualPostedTimes(queue.account)
                        ? getLatestManualPostedAt(queue.posts)
                        : null;
                      const postedToday = sortPostsByPublishedAt([
                        ...(tracking.posts || []),
                        ...manualPostedToday,
                      ]);
                      const awaitingPostedDecision = isAwaitingPostedDecision(queuePost);
                      const postingCooldown = getPostingCooldown(tracking, latestManualPostedAt);

                      return (
                        <div key={`${camp._id}-${queue.accountId}`} className="rounded-lg border border-[#e5e5ea] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                          {/* 
                          <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#e5e5ea] pb-2">
                            <span className="truncate text-xs font-semibold text-[#6e6e73]">{camp.name}</span>
                            <span className="shrink-0 rounded-full border border-[#e5e5ea] bg-white px-1.5 py-0.5 text-[9px] font-bold capitalize text-[#8e8e93]">
                              {camp.status || 'active'}
                            </span>
                          </div>
                          */}

                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex items-center gap-2 shrink-0">
                                <PlatformIcon platform={queue.account?.platform} className="h-8 w-8" />
                                {queue.account?.avatarUrl ? (
                                  <img 
                                    src={queue.account.avatarUrl} 
                                    crossOrigin="anonymous" 
                                    className="h-8 w-8 rounded-full object-cover border border-[#e5e5ea]" 
                                    alt="" 
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-xs font-bold text-[#8e8e93]">
                                    {(getAccountLabel(queue.account)?.charAt(0) || '@').toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="m-0 truncate text-sm font-bold text-[#1d1d1f]">
                                  {getAccountLabel(queue.account).startsWith('@')
                                    ? getAccountLabel(queue.account)
                                    : `@${getAccountLabel(queue.account)}`}
                                </p>
                                {/* 
                                <p className="m-0 text-[10px] font-semibold text-[#8e8e93]">
                                  {queue.nextPost ? `Post ${queuePosition}/${queue.actionableQueue.length}` : 'No videos yet'}
                                </p>
                                */}
                              </div>
                            </div>
                            {queue.nextPost && (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                {queue.actionableQueue.length} left
                              </span>
                            )}
                          </div>

                          <div className="mb-2 rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-2.5 py-2">
                            {postedToday.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {postedToday.slice(0, 6).map((post) => (
                                  <span
                                    key={post.id}
                                    className="animate-in fade-in zoom-in-95 inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 transition-all duration-300 ease-out"
                                  >
                                    <input
                                      type="checkbox"
                                      checked
                                      readOnly
                                      aria-label={`Posted at ${formatPostTime(getPostDisplayPublishedAt(post))}`}
                                      className="h-3 w-3 accent-emerald-600"
                                    />
                                    {formatPostTime(getPostDisplayPublishedAt(post))}
                                  </span>
                                ))}
                                {postedToday.length > 6 && (
                                  <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-[#6e6e73]">
                                    +{postedToday.length - 6}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="m-0 text-[10px] font-semibold text-[#8e8e93]">No live posts detected today</p>
                            )}
                          </div>

                          {queuePost ? (
                            awaitingPostedDecision ? (
                              <div className="grid w-full grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleNotPosted(queuePost)}
                                  className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-800 bg-red-800 px-3 py-1.5 text-xs font-semibold text-red-50 transition-colors hover:bg-red-900"
                                >
                                  Not Posted
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkManualPosted(queuePost)}
                                  disabled={markingPostId === queuePost._id}
                                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-green-800 bg-green-800 px-3 py-1.5 text-xs font-semibold text-green-50 transition-colors hover:bg-green-900 disabled:opacity-60"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {markingPostId === queuePost._id ? 'Checking' : 'Mark as Posted'}
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSharePost(queuePost, postingCooldown)}
                                  disabled={sharingPostId === queuePost._id || postingCooldown.isLocked}
                                  className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                  {sharingPostId === queuePost._id
                                    ? 'Opening'
                                    : postingCooldown.isLocked
                                      ? postingCooldown.label
                                      : 'Share Video'}
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="py-2 text-center">
                              <p className="m-0 text-[10px] font-bold uppercase text-[#6e6e73]">Videos</p>
                              <p className="m-0 mt-0.5 text-xs font-semibold text-[#1d1d1f]">No videos yet</p>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-sm text-[#6e6e73] md:p-6">
                  <Calendar className="mx-auto h-7 w-7 text-[#8e8e93]/60" />
                  <p className="m-0 mt-2 font-semibold text-[#1d1d1f]">No campaign cards yet</p>
                  <p className="m-0 mt-1 text-xs">Assigned campaigns will appear here.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorCampaigns;
