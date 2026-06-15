import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, TrendingUp, Calendar, Heart, MessageSquare } from 'lucide-react';

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
  const [stats, setStats] = useState({
    accountsCount: 0,
    upcomingCount: 0,
    mediaCount: 0,
    commentsCount: 0
  });
  const [channels, setChannels] = useState([]);
  const [upcomingPosts, setUpcomingPosts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [errorInsights, setErrorInsights] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [selectedAccounts]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const accResponse = await fetch('http://localhost:5001/api/accounts', { headers });
      const accountsList = await accResponse.json();
      setChannels(accountsList);

      const schedResponse = await fetch('http://localhost:5001/api/scheduler', { headers });
      const posts = await schedResponse.json();
      const filteredPosts = posts.filter(p => selectedAccounts.includes(p.socialAccountIds?.[0]?._id || p.socialAccountIds?.[0]));
      
      const upcoming = filteredPosts.filter(p => p.status === 'scheduled' || p.status === 'publishing');
      setUpcomingPosts(upcoming.slice(0, 3));

      const medResponse = await fetch('http://localhost:5001/api/media', { headers });
      const mediaList = await medResponse.json();

      const commResponse = await fetch('http://localhost:5001/api/comments', { headers });
      const commentsList = await commResponse.json();

      setErrorInsights(null);
      try {
        const insResponse = await fetch('http://localhost:5001/api/accounts/insights', { headers });
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
        accountsCount: accountsList.length,
        upcomingCount: upcoming.length,
        mediaCount: mediaList.length,
        commentsCount: commentsList.filter(c => !c.isReplied).length
      });
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
    }
  };

  return (
    <div className="p-8 space-y-8 text-[#1d1d1f] min-h-screen bg-[#f5f5f7]">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight m-0">Overview</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Creator Suite campaign monitor</p>
        </div>
      </div>

      {/* Stats Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Connected accounts */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <span className="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">Connected Accounts</span>
          <div className="mt-2">
            <h3 className="text-2xl font-semibold text-black leading-none">{stats.accountsCount}</h3>
            <p className="text-[11px] text-[#8e8e93] mt-1.5">Social channels mapped</p>
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

        {/* Unread Comments */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
          <span className="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">Open Comments</span>
          <div className="mt-2">
            <h3 className="text-2xl font-semibold text-black leading-none">{stats.commentsCount}</h3>
            <p className="text-[11px] text-[#8e8e93] mt-1.5">Awaiting replies in inbox</p>
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
              <p className="text-[11px] text-[#8e8e93] mt-0.5">Weekly channel reach growth</p>
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
              <ResponsiveContainer width="100%" height="100%">
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
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Connected Channels</h3>
            <div className="space-y-3">
              {channels.map((chan) => (
                <div key={chan._id} className="flex items-center justify-between py-2 border-b border-[#e5e5ea] last:border-b-0">
                  <div className="flex items-center gap-3">
                    <img src={chan.avatarUrl} className="w-6 h-6 rounded-full object-cover border border-black/10" alt="" />
                    <div>
                      <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">{chan.name}</p>
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
                      <img src={post.mediaIds[0].url} className="w-full h-full object-cover" alt="" />
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

    </div>
  );
};
export default Dashboard;
