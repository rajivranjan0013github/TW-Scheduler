import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, Heart, MessageSquare, RefreshCw } from 'lucide-react';

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

  const getGroupedPosts = (posts) => {
    const groups = [];
    posts.forEach(post => {
      const dateStr = new Date(post.createdAt).toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      let group = groups.find(g => g.dateStr === dateStr);
      if (!group) {
        group = { dateStr, posts: [] };
        groups.push(group);
      }
      group.posts.push(post);
    });
    return groups;
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
          <span>{location.state?.fromAdmin ? 'Back to Admin' : 'Back to Channels'}</span>
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
      <div className="max-w-4xl mx-auto w-full flex-1">
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
          <div className="space-y-6 pb-12">
            {getGroupedPosts(publishedPosts).map(group => (
              <div key={group.dateStr} className="space-y-3">
                {/* Date Separator */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {group.dateStr}
                  </span>
                  <div className="flex-grow border-t border-dashed border-gray-200"></div>
                </div>

                {/* Group Posts */}
                <div className="space-y-3">
                  {group.posts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/channels/${id}/posts/${post.id}`, {
                        state: { fromAdmin: location.state?.fromAdmin, channel },
                      })}
                      className="bg-white border border-[#e5e5ea] rounded-xl p-4 flex gap-4 hover:shadow-sm hover:border-[#0071e3]/40 cursor-pointer transition-all"
                    >
                      {post.mediaUrl && (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-[#e5e5ea]">
                          <img src={post.mediaUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-1">
                          <p className="text-xs text-black font-normal line-clamp-1 leading-relaxed whitespace-pre-wrap">
                            {post.content}
                          </p>
                          <p className="text-[9px] text-[#8e8e93] mt-1">
                            {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-3">
                          <div className="flex items-center gap-4 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-gray-500" />
                              <span>{post.views || 0}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                              <span>{post.likes}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                              <span>{post.comments}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-semibold">
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline"
                            >
                              View Live Post
                            </a>
                            <span className="text-gray-300">•</span>
                            <span className="text-[#0071e3] hover:underline">
                              Insights →
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishedFeed;
