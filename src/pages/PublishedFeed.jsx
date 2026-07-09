import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, ExternalLink, RefreshCw, MoreVertical } from 'lucide-react';
import { withCampaignScope } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';
import { getMediaUrl } from '../utils/mediaUrls';
import LoadingVideoPreview from '../components/LoadingVideoPreview';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

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

const getAccountAvatarUrl = (account) => (
  account?.avatarUrl
  || account?.profilePictureUrl
  || account?.profile_picture_url
  || account?.picture
  || ''
);

const AccountAvatar = ({ account, sizeClass = 'h-10 w-10', textClass = 'text-xs' }) => {
  const avatarUrl = getAccountAvatarUrl(account);
  const label = account?.username || account?.handle || account?.name || 'Account';
  const initials = (label || 'A')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 border border-slate-200 bg-slate-100 relative`}>
        <img
          src={avatarUrl}
          alt={label}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
          className="h-full w-full object-cover"
        />
        <div className="hidden h-full w-full items-center justify-center">
          <span className={`${textClass} font-bold text-slate-500`}>{initials}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200`}>
      <span className={`${textClass} font-bold text-slate-500`}>{initials}</span>
    </div>
  );
};

export const PublishedFeed = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [channel, setChannel] = useState(null);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [errorPosts, setErrorPosts] = useState(null);

  const [activeTab, setActiveTab] = useState('published'); // 'published' | 'queued'
  const [queuedPosts, setQueuedPosts] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [errorQueue, setErrorQueue] = useState(null);
  const [activeMenuPostId, setActiveMenuPostId] = useState(null);

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this scheduled post?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${postId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`,
        },
      });
      if (response.ok) {
        setQueuedPosts((current) => current.filter((post) => post._id !== postId));
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

  useEffect(() => {
    fetchChannelAndPosts();
    fetchQueuedPosts();
  }, [id]);

  const getTimeSince = (dateStr) => {
    const now = Date.now();
    const past = new Date(dateStr).getTime();
    const diffMs = now - past;
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

  const getPostDisplayDate = (post) => {
    if (!post) return new Date();
    const isManualPosted = post.status === 'posted_manual';
    if (isManualPosted && post.manualPostedAt) {
      const d = new Date(post.manualPostedAt);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(post.scheduledAt || Date.now());
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
  const getFeedSyncedAt = () => {
    const syncTimes = publishedPosts
      .map((post) => (post.lastSyncedAt ? new Date(post.lastSyncedAt).getTime() : null))
      .filter((time) => Number.isFinite(time));

    if (syncTimes.length === 0) return null;
    return new Date(Math.min(...syncTimes)).toISOString();
  };

  const fetchChannelAndPosts = async (forceRefresh = false) => {
    if (forceRefresh) {
      setLoadingPosts(true);
    } else {
      setLoading(true);
    }
    setErrorPosts(null);

    try {
      const token = localStorage.getItem('tw_token');

      // 1. Fetch channel metadata if not already loaded
      if (!channel) {
        if (location.state?.channel?._id === id) {
          setChannel(location.state.channel);
        } else {
          const headers = { 'Authorization': `Bearer ${token}` };
          const chanRes = await fetch(`${API_BASE_URL}/api/accounts${withCampaignScope()}`, { headers });
          let channels = chanRes.ok ? await chanRes.json() : [];
          let targetChan = channels.find(c => c._id === id);

          if (!targetChan) {
            const adminRes = await fetch(`${API_BASE_URL}/api/admin/social-accounts`, { headers });
            channels = adminRes.ok ? await adminRes.json() : [];
            targetChan = channels.find(c => c._id === id);
          }

          if (targetChan) {
            setChannel(targetChan);
          } else {
            setErrorPosts('Channel not found');
            setLoading(false);
            return;
          }
        }
      }

      // 2. Fetch posts
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      const response = await fetch(`${API_BASE_URL}/api/accounts/${id}/posts${refreshParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPublishedPosts(data);
        if (forceRefresh) {
          await queryClient.invalidateQueries({ queryKey: ['admin'] });
        }
      } else {
        const errData = await response.json();
        setErrorPosts(errData.message || 'Failed to retrieve published posts.');
      }
    } catch (error) {
      console.error('Failed to load page data:', error);
      setErrorPosts('Network error: Failed to connect to server.');
    } finally {
      setLoading(false);
      setLoadingPosts(false);
    }
  };

  const fetchQueuedPosts = async () => {
    setLoadingQueue(true);
    setErrorQueue(null);
    try {
      const token = localStorage.getItem('tw_token');
      const params = new URLSearchParams();
      params.set('accountIds', id);
      params.set('statuses', 'scheduled,manual_ready,downloaded,publishing,paused,posted_manual,published,published_auto');
      const url = `${API_BASE_URL}/api/scheduler${withCampaignScope(params.toString())}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const posts = Array.isArray(data) ? data : [];
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDate = new Date(todayStart);
        startDate.setDate(startDate.getDate() - 2);
        const endDate = new Date(todayStart);
        endDate.setDate(endDate.getDate() + 4);
        endDate.setHours(23, 59, 59, 999);
        
        const filtered = posts.filter((post) => {
          const displayDate = getPostDisplayDate(post);
          return displayDate >= startDate && displayDate <= endDate;
        });

        setQueuedPosts(filtered);
      } else {
        const errData = await response.json().catch(() => null);
        setErrorQueue(errData?.message || 'Failed to retrieve queued posts.');
      }
    } catch (error) {
      console.error('Failed to load queued posts:', error);
      setErrorQueue('Network error: Failed to connect to server.');
    } finally {
      setLoadingQueue(false);
    }
  };

  const calculateViewsByRange = () => {
    const now = new Date();
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
      const pubDate = post.createdAt ? new Date(post.createdAt) : null;
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
  };

  const getSevenDaysRange = () => {
    const range = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = -2; i <= 4; i++) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() + i);
      range.push(date);
    }
    return range;
  };

  const isSameDay = (date1, date2) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const getDayLabel = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (isSameDay(date, today)) {
      return 'Today';
    }
    return date.toLocaleDateString([], { weekday: 'short' });
  };

  const getFormattedDateLabel = (date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-4 text-[#1d1d1f]">
      {/* Header Container */}
      <div className="mb-3 w-full">
        <button
          onClick={() => navigate(location.state?.fromAdmin ? '/dashboard' : '/channels')}
          className="mb-2 flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-black"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{location.state?.fromAdmin ? 'Back to Campaign Manager' : 'Back to Channels'}</span>
        </button>

        {loading ? (
          <div className="h-14 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : channel ? (
          <div className="flex items-center justify-between rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={channel.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                crossOrigin="anonymous"
                alt=""
                className="h-10 w-10 rounded-full border border-black/10 object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-[#6e6e73]">Published feed</p>
                <h2 className="m-0 mt-0.5 truncate text-base font-semibold leading-tight text-black">
                  {channel.name}
                </h2>
                <p className="m-0 mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                  <PlatformIcon platform={channel.platform} className="h-3.5 w-3.5" />
                  <span className="truncate">@{channel.username || 'unspecified'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-[10px] font-medium text-gray-400">
                {getFeedSyncedAt()
                  ? `Last synced ${getTimeSince(getFeedSyncedAt())}`
                  : 'Cached data'
                }
              </span>
              <button
                onClick={() => {
                  fetchChannelAndPosts(true);
                  fetchQueuedPosts();
                }}
                disabled={loadingPosts || loadingQueue}
                className="flex items-center gap-1.5 text-xs text-[#0071e3] hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 px-3.5 py-1.5 rounded-lg border border-blue-100 transition-all font-semibold disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPosts || loadingQueue ? 'animate-spin' : ''}`} />
                <span>{loadingPosts || loadingQueue ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Views Metrics Summary */}
      {!loading && channel && publishedPosts.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(() => {
            const stats = calculateViewsByRange();
            const format = (num) => Intl.NumberFormat().format(num);
            return [
              { label: 'Today', value: stats.today },
              { label: 'Yesterday', value: stats.yesterday },
              { label: 'Last 7 Days', value: stats.last7Days },
              { label: 'This Month', value: stats.thisMonth },
              { label: 'All Time', value: stats.allTime },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-[#e5e5ea] bg-white p-2.5 shadow-sm">
                <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-[#6e6e73]">{card.label}</p>
                <p className="m-0 mt-1 text-base font-bold leading-none text-[#1d1d1f]">{format(card.value)}</p>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Tabs Selector */}
      {!loading && channel && (
        <div className="mb-3 flex border-b border-[#e5e5ea] gap-4">
          <button
            onClick={() => setActiveTab('published')}
            className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'published'
                ? 'border-[#0071e3] text-[#0071e3]'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Published Feed ({publishedPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('queued')}
            className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'queued'
                ? 'border-[#0071e3] text-[#0071e3]'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            Scheduled Queue ({queuedPosts.length})
          </button>
        </div>
      )}

      {/* Body Container */}
      <div className="w-full mt-2">
        {activeTab === 'published' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400 font-medium">Loading published posts...</span>
            </div>
          ) : errorPosts ? (
            <div className="bg-white border border-[#e5e5ea] rounded-xl p-8 text-center space-y-2 shadow-sm">
              <p className="text-sm text-red-500 font-bold m-0">⚠️ Error Fetching Feed</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed m-0">{errorPosts}</p>
            </div>
          ) : publishedPosts.length === 0 ? (
            <div className="bg-white border border-[#e5e5ea] rounded-xl p-16 text-center text-sm text-gray-400 font-medium shadow-sm">
              No cached published posts from the last 30 days. Refresh to sync this channel.
            </div>
          ) : (
            <div className="w-full rounded-xl border border-[#d2d2d7] bg-white">
              <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.7fr] gap-3 border-b border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                <span>Published</span>
                <span>Views</span>
                <span>Likes</span>
                <span>Comments</span>
                <span>Actions</span>
              </div>
              <div>
                {publishedPosts.map((post) => {
                  const publishedDate = getPublishedDate(post);
                  const publishedDisplay = formatPublishedDate(publishedDate);
                  return (
                    <div key={post.id} className="border-b border-[#e5e5ea] last:border-b-0">
                      <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.7fr] items-center gap-3 px-3 py-2 text-xs transition hover:bg-[#f5f5f7]">
                        <div className="min-w-0">
                          <p className="m-0 truncate font-semibold text-[#1d1d1f]">{publishedDisplay.date}</p>
                          {publishedDisplay.time && (
                            <p className="m-0 mt-0.5 text-[10px] font-semibold text-[#6e6e73]">{publishedDisplay.time}</p>
                          )}
                        </div>
                        <span className="font-semibold text-[#515154]">{compactNumber(post.views)}</span>
                        <span className="font-semibold text-[#515154]">{compactNumber(post.likes)}</span>
                        <span className="font-semibold text-[#515154]">{compactNumber(post.comments)}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openLivePost(post)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d2d2d7] bg-white text-[#515154] transition hover:border-[#0071e3] hover:text-[#0071e3]"
                            title="Open live post"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openInsights(post)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0071e3] text-white transition hover:bg-[#147ce5]"
                            title="Open insights"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          loadingQueue ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400 font-medium">Loading scheduled queue...</span>
            </div>
          ) : errorQueue ? (
            <div className="bg-white border border-[#e5e5ea] rounded-xl p-8 text-center space-y-2 shadow-sm">
              <p className="text-sm text-red-500 font-bold m-0">⚠️ Error Fetching Queue</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed m-0">{errorQueue}</p>
            </div>
          ) : queuedPosts.length === 0 ? (
            <div className="bg-white border border-[#e5e5ea] rounded-xl p-16 text-center text-sm text-gray-400 font-medium shadow-sm">
              No upcoming scheduled posts in the queue.
            </div>
          ) : (
            <div className="w-full overflow-x-auto p-1 pb-4">
              <div className="flex gap-3 items-start pb-1 w-full">
                {getSevenDaysRange().map((dayDate) => {
                  const dayPosts = queuedPosts.filter((post) => {
                    const displayDate = getPostDisplayDate(post);
                    return isSameDay(displayDate, dayDate);
                  });

                  const dayLabel = getDayLabel(dayDate);
                  const dateLabel = getFormattedDateLabel(dayDate);
                  const isToday = dayLabel === 'Today';

                  return (
                    <div key={dayDate.getTime()} className={`flex-1 min-w-[105px] w-full flex flex-col h-fit rounded-lg border p-1.5 bg-slate-50/50 shadow-sm ${
                      isToday ? 'border-blue-200 bg-blue-50/10' : 'border-[#e5e5ea]'
                    }`}>
                      {/* Column Header */}
                      <div className={`p-1 rounded mb-1.5 flex items-center justify-between border ${
                        isToday 
                          ? 'bg-blue-50 border-blue-200 text-blue-800' 
                          : 'bg-[#f1f3f4]/80 border-transparent text-[#6e6e73]'
                      }`}>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[8px] font-black uppercase tracking-wider leading-none">{dayLabel}</span>
                          <span className={`text-[9px] font-extrabold mt-0.5 truncate ${isToday ? 'text-blue-900' : 'text-slate-700'}`}>{dateLabel}</span>
                        </div>
                        <span className={`px-1 py-0.2 rounded-full text-[8px] font-black shrink-0 ${
                          isToday ? 'bg-blue-200/60 text-blue-900' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {dayPosts.length}
                        </span>
                      </div>

                      {/* Column Body */}
                      <div className="space-y-2">
                        {dayPosts.length === 0 ? (
                          <div className="flex h-16 items-center justify-center text-[9px] text-gray-400 italic font-medium">
                            No posts
                          </div>
                        ) : (
                          dayPosts.map((post) => {
                            const displayDate = getPostDisplayDate(post);
                            const pubDisplay = formatPublishedDate(displayDate);
                            const mediaItem = post.mediaIds?.[0];
                            
                            const isManualPosted = post.status === 'posted_manual' || Boolean(post.manualPostedAt);
                            const isAutoPublished = ['published', 'published_auto'].includes(post.status);
                            const isPosted = isManualPosted || isAutoPublished;
                            const postedCardClass = 'border-green-500 border-2 bg-green-50';
                            const getStatusDotBg = (status) => {
                              if (isPosted) return 'bg-green-500';
                              switch (status) {
                                case 'manual_ready': return 'bg-amber-500';
                                case 'downloaded': return 'bg-emerald-500';
                                case 'paused': return 'bg-slate-400';
                                default: return 'bg-blue-500';
                              }
                            };
                            return (
                              <div key={post._id} className={`group flex flex-col items-center shrink-0 relative rounded-lg border p-1 shadow-sm hover:shadow-md transition-all w-full ${
                                isPosted ? postedCardClass : 'border-[#e5e5ea] bg-white'
                              }`}>
                                {/* Media Preview on top */}
                                <div className="w-full aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center rounded-md">
                                  {mediaItem ? (
                                    <MediaPreview item={mediaItem} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                  ) : (
                                    <span className="text-[8px] text-gray-400 font-medium">No media</span>
                                  )}

                                  {/* More Actions Dropdown overlay */}
                                  <div className="absolute top-0.5 right-0.5 z-10">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuPostId(activeMenuPostId === post._id ? null : post._id);
                                      }}
                                      className="h-4 w-4 rounded bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white shadow-sm hover:text-black transition-colors backdrop-blur-sm"
                                      title="Actions"
                                    >
                                      <MoreVertical className="h-2.5 w-2.5" />
                                    </button>
                                    
                                    {activeMenuPostId === post._id && (
                                      <>
                                        <div 
                                          className="fixed inset-0 z-40 cursor-default" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuPostId(null);
                                          }}
                                        />
                                        <div className="absolute right-0 top-5 z-50 w-28 rounded-lg border border-[#e5e5ea] bg-white py-1 shadow-lg">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveMenuPostId(null);
                                              alert(post.caption || "No caption");
                                            }}
                                            className="w-full px-2.5 py-1.5 text-left text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                          >
                                            View Caption
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveMenuPostId(null);
                                              handleDeletePost(post._id);
                                            }}
                                            className="w-full px-2.5 py-1.5 text-left text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
                                          >
                                            Delete Post
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Content details below */}
                                <div className="mt-1 flex items-center justify-center gap-0.5 w-full text-center px-1 py-0.5">
                                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${getStatusDotBg(post.status)}`} />
                                  <span className={`text-[9px] font-bold truncate ${isPosted ? 'text-green-800' : 'text-gray-700'}`}>{pubDisplay.time}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default PublishedFeed;
