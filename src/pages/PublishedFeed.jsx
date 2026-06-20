import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, BarChart3, ChevronDown, ChevronUp, ExternalLink, Eye, Heart, MessageSquare, Play, RefreshCw } from 'lucide-react';

export const PublishedFeed = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [channel, setChannel] = useState(null);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [errorPosts, setErrorPosts] = useState(null);
  const [expandedPostId, setExpandedPostId] = useState(null);

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

  const PostMedia = ({ post }) => {
    const isVideo = post.mediaType === 'VIDEO' || Boolean(post.videoUrl);
    const mediaSrc = isVideo ? (post.videoUrl || post.mediaUrl) : post.mediaUrl;

    if (!mediaSrc) {
      return (
        <div className="flex aspect-square items-center justify-center bg-[#f5f5f7] text-xs font-semibold text-[#8e8e93]">
          No media preview
        </div>
      );
    }

    return (
      <div className="relative aspect-square bg-black">
        {isVideo ? (
          <video
            src={mediaSrc}
            poster={post.mediaUrl || undefined}
            crossOrigin="anonymous"
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <img src={mediaSrc} crossOrigin="anonymous" className="h-full w-full object-cover" alt="" />
        )}
        {isVideo && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            <Play className="h-3 w-3 fill-white" />
            Video
          </div>
        )}
      </div>
    );
  };

  const PostTile = ({ post }) => {
    const isExpanded = expandedPostId === post.id;

    return (
      <div className="overflow-hidden rounded-xl border border-[#e5e5ea] bg-white shadow-sm">
        <div
          onClick={() => openLivePost(post)}
          className="group relative cursor-pointer bg-black"
        >
          <PostMedia post={post} />
          <div className="absolute inset-0 flex items-center justify-center gap-5 bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Heart className="h-5 w-5 fill-white" />
              {compactNumber(post.likes)}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <MessageSquare className="h-5 w-5 fill-white" />
              {compactNumber(post.comments)}
            </span>
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openLivePost(post);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black"
              title="Open live post"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openInsights(post);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3] text-white transition hover:bg-[#147ce5]"
              title="Open insights"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] font-semibold text-[#515154]">
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-[#6e6e73]" />
                {compactNumber(post.views)}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                {compactNumber(post.likes)}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5 text-[#0071e3]" />
                {compactNumber(post.comments)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
            >
              <span>Details</span>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-2 space-y-2 border-t border-[#e5e5ea] pt-2">
              <p className="m-0 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-[#1d1d1f]">
                {post.content || 'No caption'}
              </p>
              <div className="rounded-lg bg-[#f5f5f7] px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#6e6e73]">Comments</span>
                  <span className="text-[9px] font-semibold text-[#8e8e93]">{compactNumber(post.comments)} total</span>
                </div>
                {(post.commentsPreview || []).length > 0 ? (
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {post.commentsPreview.map((comment, index) => (
                      <p key={comment.id || `${post.id}-comment-${index}`} className="m-0 text-[10px] leading-relaxed text-[#1d1d1f]">
                        <span className="font-semibold">{comment.username || 'User'}</span>{' '}
                        <span className="text-[#515154]">{comment.text}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 text-[10px] text-[#8e8e93]">
                    {post.comments > 0 ? 'Refresh from Meta to load comment previews.' : 'No comments yet.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
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
          const chanRes = await fetch('http://localhost:5001/api/accounts', { headers });
          let channels = chanRes.ok ? await chanRes.json() : [];
          let targetChan = channels.find(c => c._id === id);

          if (!targetChan) {
            const adminRes = await fetch('http://localhost:5001/api/admin/social-accounts', { headers });
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
      const response = await fetch(`http://localhost:5001/api/accounts/${id}/posts${refreshParam}`, {
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
    <div className="p-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f] flex flex-col">
      {/* Header Container */}
      <div className="max-w-4xl mx-auto w-full mb-6">
        <button
          onClick={() => navigate(location.state?.fromAdmin ? '/admin' : '/channels')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{location.state?.fromAdmin ? 'Back to Campaign Manager' : 'Back to Channels'}</span>
        </button>

        {loading ? (
          <div className="h-14 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : channel ? (
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={channel.avatarUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150'}
                crossOrigin="anonymous"
                className="w-12 h-12 rounded-full object-cover border border-[#d2d2d7]"
                alt=""
              />
              <div>
                <h2 className="text-base font-semibold text-black leading-tight">
                  {channel.name}'s Published Feed
                </h2>
                <p className="text-xs text-gray-500 mt-1">@{channel.username || 'unspecified'} • {channel.platform}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-[10px] text-gray-400 font-medium">
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
      <div className="mx-auto w-full max-w-6xl flex-1">
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
          <div className="grid grid-cols-2 gap-3 pb-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {publishedPosts.map(post => (
              <PostTile key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishedFeed;
