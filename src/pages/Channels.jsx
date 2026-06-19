import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Share2, Trash2, ShieldCheck, Link2, Eye, Trash } from 'lucide-react';

export const Channels = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const adminViewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const adminViewUserId = adminViewContext?.userId || '';
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
  }, [adminViewUserId]);
  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch(`http://localhost:5001/api/accounts${adminViewUserId ? `?userId=${adminViewUserId}` : ''}`, {
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

  const connectMetaOAuth = () => {
    const appId = import.meta.env.VITE_META_APP_ID || 'your-meta-app-id';
    const redirectUri = encodeURIComponent('http://localhost:5173/auth/facebook/callback');
    const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights,instagram_manage_insights,instagram_manage_comments');
    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    window.location.href = oauthUrl;
  };

  const connectInstagramOAuth = () => {
    const appId = import.meta.env.VITE_INSTAGRAM_APP_ID;
    const facebookAppId = import.meta.env.VITE_META_APP_ID;
    if (!appId || appId === facebookAppId) {
      alert('Set VITE_INSTAGRAM_APP_ID to the Instagram App ID from Meta Dashboard > Instagram > API setup with Instagram login. It cannot be the Facebook App ID.');
      return;
    }
    const rawRedirectUri = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || `${window.location.origin}/auth/instagram/callback`;
    sessionStorage.setItem('instagram_oauth_redirect_uri', rawRedirectUri);
    const redirectUri = encodeURIComponent(rawRedirectUri);
    const scope = encodeURIComponent('instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights');
    const oauthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.href = oauthUrl;
  };

  const connectYoutubeOAuth = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch('http://localhost:5001/api/accounts/youtube/auth-url', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.message || 'Failed to start YouTube connection.');
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Failed to start YouTube OAuth:', error);
      alert('Failed to connect to the backend for YouTube OAuth.');
    }
  };

  const getPlatformBadgeClasses = (platform) => {
    if (platform === 'instagram') return 'bg-purple-50 text-purple-600 border-purple-200';
    if (platform === 'youtube') return 'bg-red-50 text-red-600 border-red-200';
    return 'bg-blue-50 text-blue-600 border-blue-200';
  };

  return (
    <div className="p-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f] space-y-8">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Connected Channels</h2>
          <p className="text-[#8e8e93] text-xs mt-1">
            {adminViewUserId
              ? `Viewing channels for ${adminViewContext?.userName || 'selected user'}`
              : 'Manage Facebook, Instagram, and YouTube publishing channels'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Info card */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm flex items-start gap-4">
          <div className="p-2.5 bg-blue-50 text-[#0071e3] rounded-lg">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-black m-0">Publishing Integrations</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed m-0">
              Users can connect Meta accounts and YouTube channels. Connected channels are available in the scheduled publishing queue.
            </p>
          </div>
        </div>

        {/* Channels Listing */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e5ea] flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Connected Accounts ({channels.length})</span>
            <div className="flex items-center gap-2">
              <button
                onClick={connectInstagramOAuth}
                className="flex items-center gap-1.5 bg-black hover:bg-gray-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect Instagram</span>
              </button>
              <button
                onClick={connectYoutubeOAuth}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect YouTube</span>
              </button>
              <button
                onClick={connectMetaOAuth}
                className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm"
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
            ) : channels.length === 0 ? (
              <div className="text-center py-16 text-xs text-gray-400 font-medium">
                No active social channels connected yet. Use the buttons above to authorize a publishing channel.
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
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border uppercase ${getPlatformBadgeClasses(chan.platform)}`}>
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
                      onClick={() => navigate(`/channels/${chan._id}/feed`, {
                        state: adminViewUserId ? { fromAdmin: true, channel: chan } : undefined,
                      })}
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

    </div>
  );
};

export default Channels;
