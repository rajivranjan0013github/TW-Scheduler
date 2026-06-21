import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, TrendingUp, Calendar, Heart, RefreshCw, MessageSquare } from 'lucide-react';
import { withCampaignScope } from '../utils/campaignScope';

const Instagram = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const Facebook = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const mockChartData = [
  { name: 'Mon', Instagram: 4000, Facebook: 2400 },
  { name: 'Tue', Instagram: 4500, Facebook: 2800 },
  { name: 'Wed', Instagram: 5100, Facebook: 3200 },
  { name: 'Thu', Instagram: 4800, Facebook: 3000 },
  { name: 'Fri', Instagram: 5900, Facebook: 4100 },
  { name: 'Sat', Instagram: 7500, Facebook: 4800 },
  { name: 'Sun', Instagram: 8200, Facebook: 5300 },
];

export const Dashboard = ({ selectedAccounts }) => {
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
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    accountsCount: 0,
    upcomingCount: 0,
    mediaCount: 0
  });
  const [channels, setChannels] = useState([]);
  const [upcomingPosts, setUpcomingPosts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [errorInsights, setErrorInsights] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    fetchStats(period);
  }, [selectedAccounts, period, adminViewUserId]);

  const fetchStats = async (selectedPeriod = '7d', forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = localStorage.getItem('tw_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const scopedSuffix = withCampaignScope(adminViewUserId ? `userId=${adminViewUserId}` : '');

      const accResponse = await fetch(`http://localhost:5001/api/accounts${scopedSuffix}`, { headers });
      const accountsList = await accResponse.json();
      const campaignAccounts = selectedAccounts.length > 0
        ? accountsList.filter(account => selectedAccounts.includes(account._id))
        : accountsList;
      const activeAccountIds = campaignAccounts.map(account => account._id);
      setChannels(campaignAccounts);

      const schedResponse = await fetch(`http://localhost:5001/api/scheduler${scopedSuffix}`, { headers });
      const posts = await schedResponse.json();
      const filteredPosts = posts.filter(p => activeAccountIds.includes(p.socialAccountIds?.[0]?._id || p.socialAccountIds?.[0]));
      
      const upcoming = filteredPosts.filter(p => p.status === 'scheduled' || p.status === 'publishing');
      setUpcomingPosts(upcoming.slice(0, 3));

      const medResponse = await fetch(`http://localhost:5001/api/media${scopedSuffix}`, { headers });
      const mediaList = await medResponse.json();

      setErrorInsights(null);
      try {
        const insightParams = new URLSearchParams({ period: selectedPeriod });
        if (forceRefresh) insightParams.set('refresh', 'true');
        if (adminViewUserId) insightParams.set('userId', adminViewUserId);
        const campaignId = localStorage.getItem('active-campaign-id');
        if (campaignId) insightParams.set('campaignId', campaignId);
        const insResponse = await fetch(`http://localhost:5001/api/accounts/insights?${insightParams.toString()}`, { headers });
        if (insResponse.ok) {
          const insightsList = await insResponse.json();
          setChartData(insightsList);
        } else {
          const errData = await insResponse.json();
          setErrorInsights(errData.message || 'Failed to fetch insights.');
        }
      } catch (insErr) {
        console.error('Failed to fetch aggregated insights:', insErr);
        setErrorInsights('Network error: Failed to connect to server.');
      }

      setStats({
        accountsCount: campaignAccounts.length,
        upcomingCount: upcoming.length,
        mediaCount: mediaList.length
      });

      // Fetch recent 25 published posts
      try {
        const recentResponse = await fetch(`http://localhost:5001/api/accounts/posts/recent${scopedSuffix}`, { headers });
        if (recentResponse.ok) {
          const recentData = await recentResponse.json();
          setRecentPosts(
            selectedAccounts.length > 0
              ? recentData.filter(post => activeAccountIds.includes(post.accountId))
              : recentData
          );
        }
      } catch (err) {
        console.error('Failed to fetch recent published posts:', err);
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
    } finally {
      if (forceRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  const totalViews = chartData.reduce((acc, curr) => acc + (curr.Instagram || 0) + (curr.Facebook || 0), 0);

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

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center min-h-[500px] w-full bg-[#f5f5f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[#8e8e93] font-semibold tracking-wide">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 text-[#1d1d1f] min-h-screen bg-[#f5f5f7]">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight m-0">Overview</h2>
          <p className="text-[#8e8e93] text-xs mt-1">EasyPost campaign monitor</p>
        </div>
        
        {/* Period Selector & Refresh Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Period:</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-white border border-[#e5e5ea] rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none text-[#1d1d1f] cursor-pointer shadow-sm hover:border-[#d2d2d7] transition-all"
            >
              <option value="7d">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <button
            type="button"
            onClick={() => fetchStats(period, true)}
            disabled={refreshing}
            title="Refresh views and insight metrics from Meta Graph API"
            className="flex items-center justify-center gap-1.5 bg-white border border-[#e5e5ea] hover:bg-[#f5f5f7] active:bg-[#e5e5ea] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] transition-all shadow-sm outline-none disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Publishing channels */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <span className="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">Publishing Channels</span>
          <div className="mt-2">
            <h3 className="text-2xl font-semibold text-black leading-none">{stats.accountsCount}</h3>
            <p className="text-[11px] text-[#8e8e93] mt-1.5">Channels mapped to this workspace</p>
          </div>
        </div>

        {/* Scheduled Content */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <span className="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">Scheduled Queue</span>
          <div className="mt-2">
            <h3 className="text-2xl font-semibold text-black leading-none">{stats.upcomingCount}</h3>
            <p className="text-[11px] text-[#8e8e93] mt-1.5">Upcoming automations</p>
          </div>
        </div>

        {/* Media Asset Count */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <span className="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">Media Assets</span>
          <div className="mt-2">
            <h3 className="text-2xl font-semibold text-black leading-none">{stats.mediaCount}</h3>
            <p className="text-[11px] text-[#8e8e93] mt-1.5">Library uploads</p>
          </div>
        </div>

        {/* Total Views Card */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <span className="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">Total Views</span>
          <div className="mt-2">
            <h3 className="text-2xl font-semibold text-black leading-none">{totalViews.toLocaleString()}</h3>
            <p className="text-[11px] text-[#8e8e93] mt-1.5">Views in selected period</p>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Growth Chart */}
        <div className="lg:col-span-2 bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-black m-0">Performance Insights</h3>
              <p className="text-[11px] text-[#8e8e93] mt-0.5">
                {period === '7d' ? 'Weekly' : period === 'this_month' ? 'Monthly' : '30-day'} channel reach growth
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1.5 text-black">
                <span className="w-2 h-2 rounded-full bg-[#0071e3]"></span>
                <span>Instagram</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-[#8e8e93]"></span>
                <span>Facebook</span>
              </div>
            </div>
          </div>
          
          <div className="h-64 w-full text-[10px] flex items-center justify-center">
            {errorInsights ? (
              <div className="text-center p-4 max-w-md bg-red-50/50 border border-red-100 rounded-xl">
                <p className="text-xs font-semibold text-red-600 m-0">⚠️ Performance Insights Error</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed m-0">{errorInsights}</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-center p-4">
                <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-500 m-0">No reach data available</p>
                <p className="text-[10px] text-gray-400 mt-0.5 m-0">Connect channels to start monitoring performance insights.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
                  <XAxis dataKey="name" stroke="#8e8e93" />
                  <YAxis stroke="#8e8e93" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e5ea', color: '#000' }} />
                  <Line type="monotone" dataKey="Instagram" stroke="#0071e3" strokeWidth={2} dot={{ fill: '#0071e3', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="Facebook" stroke="#8e8e93" strokeWidth={2} dot={{ fill: '#8e8e93', strokeWidth: 1 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          
          {/* Linked Portals */}
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Publishing Channels</h3>
            <div className="space-y-3">
              {channels.map((chan) => (
                <div 
                  key={chan._id} 
                  onClick={() => navigate(`/channels/${chan._id}/feed`, {
                    state: adminViewUserId ? { fromAdmin: true, channel: chan } : undefined,
                  })}
                  className="flex items-center justify-between py-2 px-1.5 border-b border-[#e5e5ea] last:border-b-0 cursor-pointer hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img src={chan.avatarUrl} crossOrigin="anonymous" className="w-6 h-6 rounded-full object-cover border border-black/10" alt="" />
                    <div>
                      <p className="text-xs font-semibold text-[#1d1d1f] leading-tight hover:text-[#0071e3] transition-colors">{chan.name}</p>
                      <p className="text-[10px] text-gray-500">@{chan.username}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-2 py-0.5 rounded border border-[#e5e5ea]">
                    {chan.platform}
                  </span>
                </div>
              ))}
              {channels.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No connected channels.</p>
              )}
            </div>
          </div>

          {/* Upcoming Publications */}
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Upcoming Queue</h3>
            <div className="space-y-3">
              {upcomingPosts.map((post) => (
                <div key={post._id} className="flex items-center gap-3 py-2 border-b border-[#e5e5ea] last:border-b-0">
                  <div className="w-8 h-8 rounded bg-[#f5f5f7] flex-shrink-0 flex items-center justify-center text-xs overflow-hidden border border-[#e5e5ea]">
                    {post.mediaIds?.[0]?.url ? (
                      <img src={post.mediaIds[0].url} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span>🎥</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-black truncate font-semibold">{post.caption || 'No Caption'}</p>
                    <p className="text-[9px] text-[#8e8e93] mt-0.5">
                      {new Date(post.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
              {upcomingPosts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No publications scheduled.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Recent Published Posts Section */}
      <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm space-y-6">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Recent Published Posts</h3>
        {recentPosts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No published posts found. Ensure your channels are synced.</p>
        ) : (
          <div className="space-y-6">
            {getGroupedPosts(recentPosts).map(group => (
              <div key={group.dateStr} className="space-y-3">
                {/* Date Separator */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {group.dateStr}
                  </span>
                  <div className="flex-grow border-t border-dashed border-gray-200"></div>
                </div>

                {/* Group Table */}
                <div className="overflow-x-auto border border-[#e5e5ea] rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#e5e5ea] bg-gray-50 text-gray-500 uppercase tracking-wider text-[9px] font-bold">
                        <th className="px-4 py-3">Post</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3 text-right">Views</th>
                        <th className="px-4 py-3 text-right">Likes</th>
                        <th className="px-4 py-3 text-right">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e5ea]">
                      {group.posts.map((post) => (
                        <tr 
                          key={post.id} 
                          onClick={() => navigate(`/channels/${post.accountId}/posts/${post.id}`, {
                            state: adminViewUserId ? { fromAdmin: true, channel: channels.find(chan => chan._id === post.accountId) } : undefined,
                          })}
                          className="hover:bg-gray-50/40 cursor-pointer transition-colors font-medium"
                        >
                          <td className="px-4 py-3 max-w-xs md:max-w-md">
                            <div className="flex items-center gap-3">
                              {post.mediaUrl && (
                                <img src={post.mediaUrl} crossOrigin="anonymous" className="w-8 h-8 rounded object-cover border border-[#e5e5ea]" alt="" />
                              )}
                              <span className="truncate block font-semibold text-black">
                                {post.content && post.content.length > 15 
                                  ? post.content.slice(0, 15) + '...' 
                                  : (post.content || 'No text content')
                                }
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600 font-semibold">{post.views || 0}</td>
                          <td className="px-4 py-3 text-right text-red-500 font-semibold">{post.likes || 0}</td>
                          <td className="px-4 py-3 text-right text-purple-600 font-semibold">{post.comments || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
export default Dashboard;
