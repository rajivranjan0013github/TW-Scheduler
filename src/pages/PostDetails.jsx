import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, Heart, MessageSquare, ExternalLink, Calendar } from 'lucide-react';

export const PostDetails = () => {
  const { id: accountId, metaPostId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [channel, setChannel] = useState(null);
  const [post, setPost] = useState(null);
  const [dailyInsights, setDailyInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPostInsights();
  }, [accountId, metaPostId]);

  const fetchPostInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tw_token');

      // 1. Fetch channel details
      if (location.state?.channel?._id === accountId) {
        setChannel(location.state.channel);
      } else {
        const headers = { 'Authorization': `Bearer ${token}` };
        const chanRes = await fetch('http://localhost:5001/api/accounts', { headers });
        let channels = chanRes.ok ? await chanRes.json() : [];
        let targetChan = channels.find(c => c._id === accountId);

        if (!targetChan) {
          const adminRes = await fetch('http://localhost:5001/api/admin/social-accounts', { headers });
          channels = adminRes.ok ? await adminRes.json() : [];
          targetChan = channels.find(c => c._id === accountId);
        }

        if (targetChan) {
          setChannel(targetChan);
        }
      }

      // 2. Fetch post insights
      const response = await fetch(`http://localhost:5001/api/accounts/${accountId}/posts/${metaPostId}/insights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPost(data.post);
        // Reverse dailyInsights so newest dates show up first in table
        setDailyInsights((data.dailyInsights || []).reverse());
      } else {
        const errData = await response.json();
        setError(errData.message || 'Failed to retrieve post details.');
      }
    } catch (err) {
      console.error('Failed to load post insights:', err);
      setError('Network error: Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f] flex flex-col">
      {/* Header Navigation */}
      <div className="max-w-6xl mx-auto w-full mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(`/channels/${accountId}/feed`, {
            state: { fromAdmin: location.state?.fromAdmin, channel },
          })}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        {channel && (
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-semibold bg-white border border-[#e5e5ea] px-3 py-1 rounded-full shadow-sm">
            <img src={channel.avatarUrl} className="w-4 h-4 rounded-full object-cover" alt="" />
            <span>{channel.name} ({channel.platform})</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 gap-3">
          <div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-medium">Loading post insights...</span>
        </div>
      ) : error ? (
        <div className="max-w-2xl mx-auto w-full bg-white border border-[#e5e5ea] rounded-xl p-8 text-center space-y-2 shadow-sm">
          <p className="text-sm text-red-500 font-bold m-0">⚠️ Error Loading Details</p>
          <p className="text-xs text-gray-500 leading-relaxed m-0">{error}</p>
        </div>
      ) : post ? (
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 items-start flex-1 pb-12">
          
          {/* Left Side: Post Content & Preview */}
          <div className="md:col-span-1 bg-white border border-[#e5e5ea] rounded-xl overflow-hidden shadow-sm flex flex-col">
            {post.mediaUrl && (
              <div className="w-full aspect-square bg-gray-50 border-b border-[#e5e5ea] overflow-hidden flex items-center justify-center">
                <img src={post.mediaUrl} className="w-full h-full object-cover" alt="Post Media" />
              </div>
            )}
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Caption</span>
                <p className="text-xs text-black leading-relaxed whitespace-pre-wrap">{post.content || 'No text content.'}</p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-[10px] text-gray-500">
                  <span className="block font-bold text-gray-400 uppercase tracking-wider text-[8px] mb-0.5">Published At</span>
                  <span>{new Date(post.publishedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <a 
                  href={post.permalink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold hover:underline"
                >
                  <span>View on Platform</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Side: Metrics & Daily Insights */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Lifetime metrics banner */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-[#0071e3] rounded-lg">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Views</span>
                  <span className="text-base font-bold text-black">{post.latestViews || 0}</span>
                </div>
              </div>

              <div className="bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm flex items-center gap-3">
                <div className="p-2.5 bg-red-50 text-red-500 rounded-lg">
                  <Heart className="w-5 h-5 fill-red-500" />
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Likes</span>
                  <span className="text-base font-bold text-black">{post.latestLikes || 0}</span>
                </div>
              </div>

              <div className="bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                  <MessageSquare className="w-5 h-5 fill-purple-600" />
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Comments</span>
                  <span className="text-base font-bold text-black">{post.latestComments || 0}</span>
                </div>
              </div>
            </div>

            {/* Daily Trends Table */}
            <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-[#e5e5ea] flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider m-0">Daily Insight Trend (30 Days)</h3>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">Daily incremental changes (+Deltas)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#e5e5ea] bg-gray-50 text-gray-500 uppercase tracking-wider text-[9px] font-bold">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Views</th>
                      <th className="px-5 py-3 text-right">Likes</th>
                      <th className="px-5 py-3 text-right">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e5ea]">
                    {dailyInsights.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-5 py-8 text-center text-gray-400 font-medium">
                          No daily insights synced yet. Check back after the next scheduled insight run.
                        </td>
                      </tr>
                    ) : (
                      dailyInsights.map((day) => (
                        <tr key={day.date} className="hover:bg-gray-50/40 transition-colors font-medium">
                          <td className="px-5 py-3 text-black">
                            {new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3 text-right text-blue-600">
                            +{day.views} <span className="text-[10px] text-gray-400 font-normal">({day.cumulativeViews})</span>
                          </td>
                          <td className="px-5 py-3 text-right text-red-500">
                            +{day.likes} <span className="text-[10px] text-gray-400 font-normal">({day.cumulativeLikes})</span>
                          </td>
                          <td className="px-5 py-3 text-right text-purple-600">
                            +{day.comments} <span className="text-[10px] text-gray-400 font-normal">({day.cumulativeComments})</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      ) : null}
    </div>
  );
};

export default PostDetails;
