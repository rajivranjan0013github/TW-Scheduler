import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Share2, Trash2, ShieldCheck, Link2, Eye, X, Heart, MessageSquare } from 'lucide-react';

export const Channels = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Feed Modal States
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorPosts, setErrorPosts] = useState(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch('http://localhost:5001/api/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChannels(data);
      }
    } catch (error) {
      console.error('Failed to fetch connected channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectChannel = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this account? This will stop future automatic publications targeting it.')) {
      return;
    }

    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`http://localhost:5001/api/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setChannels(channels.filter(chan => chan._id !== id));
      } else {
        alert('Failed to disconnect channel');
      }
    } catch (error) {
      console.error('Error disconnecting channel:', error);
    }
  };

  const openFeedModal = async (channel) => {
    setSelectedChannel(channel);
    setIsModalOpen(true);
    setLoadingPosts(true);
    setPublishedPosts([]);
    setErrorPosts(null);

    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`http://localhost:5001/api/accounts/${channel._id}/posts`, {
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
      console.error('Failed to fetch published posts:', error);
      setErrorPosts('Network error: Failed to connect to server.');
    } finally {
      setLoadingPosts(false);
    }
  };

  const connectMetaOAuth = () => {
    const appId = import.meta.env.VITE_META_APP_ID || 'your-meta-app-id';
    const redirectUri = encodeURIComponent('http://localhost:5173/auth/facebook/callback');
    const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights,instagram_manage_insights,instagram_manage_comments');
    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    window.location.href = oauthUrl;
  };

  return (
    <div className="p-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f] space-y-8">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Connected Channels</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Manage Facebook Pages and Instagram Business Accounts</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Info card */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="p-2.5 bg-blue-50 text-[#0071e3] rounded-lg">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-black m-0">Meta Integration</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed m-0">
              Users connect their Facebook Pages. If a Page is linked to an Instagram Business account, both channels are automatically synced to our publisher queue engine.
            </p>
          </div>
        </div>

        {/* Channels Listing */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e5ea] flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Connected Accounts ({channels.length})</span>
            <button
              onClick={connectMetaOAuth}
              className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Connect Facebook & Instagram</span>
            </button>
          </div>

          <div className="divide-y divide-[#e5e5ea]">
            {loading ? (
              <div className="text-center py-12 text-xs text-gray-400 font-medium">
                Fetching connected channels...
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-16 text-xs text-gray-400 font-medium">
                No active social channels connected yet. Click the button above to authorize your Facebook page.
              </div>
            ) : (
              channels.map(chan => (
                <div key={chan._id} className="px-6 py-5 flex items-center justify-between hover:bg-[#f5f5f7]/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <img 
                      src={chan.avatarUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150'} 
                      className="w-10 h-10 rounded-full object-cover border border-[#d2d2d7]" 
                      alt="" 
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-black">{chan.name}</span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border uppercase ${
                          chan.platform === 'instagram' 
                            ? 'bg-purple-50 text-purple-600 border-purple-200' 
                            : 'bg-blue-50 text-blue-600 border-blue-200'
                        }`}>
                          {chan.platform}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Username: @{chan.username || 'unspecified'} • ID: {chan.accountId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => openFeedModal(chan)}
                      className="flex items-center gap-1.5 text-[10px] text-[#0071e3] hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all font-semibold active:scale-95"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View Feed</span>
                    </button>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Connected</span>
                    </div>
                    <button
                      onClick={() => disconnectChannel(chan._id)}
                      className="p-2 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-all"
                      title="Disconnect Channel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Published Feed Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e5e5ea] w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e5e5ea] flex items-center justify-between bg-[#f5f5f7]">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedChannel?.avatarUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150'} 
                  className="w-8 h-8 rounded-full object-cover border border-[#d2d2d7]" 
                  alt="" 
                />
                <div>
                  <h3 className="text-sm font-semibold text-black leading-tight">
                    {selectedChannel?.name}'s Published Feed
                  </h3>
                  <p className="text-[10px] text-gray-500">@{selectedChannel?.username || 'unspecified'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-gray-200 text-gray-500 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingPosts ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-gray-400 font-medium">Fetching published posts from Meta...</span>
                </div>
              ) : errorPosts ? (
                <div className="text-center py-16 px-4 space-y-2">
                  <p className="text-xs text-red-500 font-bold m-0">⚠️ Error Fetching Feed</p>
                  <p className="text-[11px] text-gray-500 max-w-md mx-auto leading-relaxed m-0">{errorPosts}</p>
                </div>
              ) : publishedPosts.length === 0 ? (
                <div className="text-center py-20 text-xs text-gray-400 font-medium">
                  No published posts found on this channel.
                </div>
              ) : (
                <div className="space-y-4">
                  {publishedPosts.map(post => (
                    <div key={post.id} className="bg-white border border-[#e5e5ea] rounded-xl p-4 flex gap-4 hover:shadow-sm transition-shadow">
                      {post.mediaUrl && (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-[#e5e5ea]">
                          <img src={post.mediaUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-1">
                          <p className="text-xs text-black font-normal line-clamp-3 leading-relaxed whitespace-pre-wrap">
                            {post.content}
                          </p>
                          <p className="text-[9px] text-[#8e8e93] mt-1">
                            {new Date(post.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-3">
                          <div className="flex items-center gap-4 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                              <span>{post.likes}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                              <span>{post.comments}</span>
                            </span>
                          </div>
                          <a 
                            href={post.permalink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 font-semibold hover:underline"
                          >
                            View Live Post →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Channels;
