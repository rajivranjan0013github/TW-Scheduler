import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import { withCampaignScope } from '../utils/campaignScope';

export const PublishedFeed = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [channel, setChannel] = useState(null);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [errorPosts, setErrorPosts] = useState(null);

  useEffect(() => {
    fetchChannelAndPosts();
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

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f5f5f7] p-4 text-[#1d1d1f]">
      {/* Header Container */}
      <div className="mb-3 w-full">
        <button
          onClick={() => navigate(location.state?.fromAdmin ? '/admin' : '/channels')}
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
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-[#6e6e73]">Published feed</p>
              <h2 className="m-0 mt-0.5 truncate text-base font-semibold leading-tight text-black">
                {channel.name}
              </h2>
              <p className="m-0 mt-0.5 truncate text-xs text-gray-500">@{channel.username || 'unspecified'} • {channel.platform}</p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-[10px] font-medium text-gray-400">
                {publishedPosts.length > 0 && publishedPosts[0].lastSyncedAt
                  ? `Last synced ${getTimeSince(publishedPosts[0].lastSyncedAt)}`
                  : 'Cached data'
                }
              </span>
              <button
                onClick={() => fetchChannelAndPosts(true)}
                disabled={loadingPosts}
                className="flex items-center gap-1.5 text-xs text-[#0071e3] hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 px-3.5 py-1.5 rounded-lg border border-blue-100 transition-all font-semibold disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPosts ? 'animate-spin' : ''}`} />
                <span>{loadingPosts ? 'Refreshing...' : 'Refresh from Meta'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Body Container */}
      <div className="min-h-0 w-full flex-1">
        {loading ? (
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
            No published posts found on this channel.
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#d2d2d7] bg-white">
            <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.7fr] gap-3 border-b border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              <span>Published</span>
              <span>Views</span>
              <span>Likes</span>
              <span>Comments</span>
              <span>Actions</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {publishedPosts.map((post) => {
                const publishedDate = getPublishedDate(post);
                return (
                  <div key={post.id} className="border-b border-[#e5e5ea] last:border-b-0">
                    <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.7fr] items-center gap-3 px-3 py-2 text-xs transition hover:bg-[#f5f5f7]">
                      <span className="font-semibold text-[#1d1d1f]">
                        {publishedDate ? new Date(publishedDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                      </span>
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
        )}
      </div>
    </div>
  );
};

export default PublishedFeed;
