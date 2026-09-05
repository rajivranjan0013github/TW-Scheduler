import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Rows3,
  Heart,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import PlatformIcon from '../components/PlatformIcon';
import {
  MetricCard,
  DailyViewsChart,
  AccountAvatar,
} from '../components/adminDashboard/DashboardPresentation';
import { timeRanges } from '../components/adminDashboard/dashboardConfig';

const numberFormat = new Intl.NumberFormat();
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const formatHandle = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
};

const emptyMetrics = {
  accounts: 0,
  posts: 0,
  todayPosts: 0,
  yesterdayPosts: 0,
  last7DaysPosts: 0,
  thisMonthPosts: 0,
  lifetimeViews: 0,
  todayViews: 0,
  yesterdayViews: 0,
  last7DaysViews: 0,
  thisMonthViews: 0,
  latestLikes: 0,
  latestComments: 0,
  todayLikes: 0,
  todayComments: 0,
  yesterdayLikes: 0,
  yesterdayComments: 0,
  last7DaysLikes: 0,
  last7DaysComments: 0,
  thisMonthLikes: 0,
  thisMonthComments: 0,
  lastSyncedAt: null,
  last30DaysPostedViews: [],
  accountRows: [],
};

export const CreatorAnalytics = () => {
  const navigate = useNavigate();
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [selectedGraphDate, setSelectedGraphDate] = useState(null);

  const analyticsQuery = useQuery({
    queryKey: ['creator', 'analytics', localTimeZone],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeZone: localTimeZone,
      });
      const headers = withHandlerPreviewHeaders({
        Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
      });
      const res = await fetch(`${API_BASE_URL}/api/accounts/creator/analytics?${params.toString()}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch analytics.');
      }
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const payload = analyticsQuery.data || {};
  const metrics = payload.metrics || emptyMetrics;
  const currentRange = timeRanges[selectedTimeRange] || timeRanges.today;

  const currentViews = metrics[currentRange.viewsKey] ?? metrics.todayViews ?? 0;
  const currentPosts = metrics[currentRange.postsKey] ?? metrics.todayPosts ?? 0;
  const currentLikes = metrics[currentRange.likesKey] ?? metrics.todayLikes ?? 0;
  const currentComments = metrics[currentRange.commentsKey] ?? metrics.todayComments ?? 0;

  // Filter channels if graph date selected
  const displayAccountRows = useMemo(() => {
    return metrics.accountRows || [];
  }, [metrics.accountRows]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans antialiased">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white m-0">Analytics</h2>
        <p className="text-xs text-zinc-400 mt-1 m-0">
          Track views, published content, and engagement across your connected channels.
        </p>
        <p className="text-xs text-zinc-400 mt-1 m-0">
          {metrics.lastSyncedAt
            ? `Metrics synced ${new Date(metrics.lastSyncedAt).toLocaleString()}`
            : 'Metrics have not synced yet'}
        </p>
      </div>

      {/* Time Range Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
        {Object.entries(timeRanges).map(([key, config]) => {
          const isActive = selectedTimeRange === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedTimeRange(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {analyticsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400 gap-2 text-xs font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-[#7831d6]" />
          <span>Loading analytics data...</span>
        </div>
      ) : analyticsQuery.isError ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 font-medium">
          {analyticsQuery.error?.message || 'Failed to load analytics.'}
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={Eye}
              label="Views"
              value={numberFormat.format(currentViews)}
              note={currentRange.label}
            />
            <MetricCard
              icon={Rows3}
              label="Posts"
              value={numberFormat.format(currentPosts)}
              note={currentRange.label}
            />
            <MetricCard
              icon={Heart}
              label="Likes"
              value={numberFormat.format(currentLikes)}
              note={currentRange.label}
            />
            <MetricCard
              icon={MessageSquare}
              label="Comments"
              value={numberFormat.format(currentComments)}
              note={currentRange.label}
            />
          </div>

          {/* 30-Day Views Chart */}
          <DailyViewsChart
            data={metrics.last30DaysPostedViews}
            selectedDate={selectedGraphDate}
            onSelectDate={setSelectedGraphDate}
          />

          {/* Channel Performance Table */}
          <div className="pt-2">

            {displayAccountRows.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-400 font-medium">
                No channels found for this selection. Connect accounts in Channels to see metrics.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/[0.04] text-xs font-bold uppercase tracking-wider text-zinc-200">
                      <th className="py-3 px-4 rounded-l-xl">Channel</th>
                      <th className="py-3 px-4 text-right">Views</th>
                      <th className="py-3 px-4 text-right">Posts</th>
                      <th className="py-3 px-4 text-right">Likes</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {displayAccountRows.map((channel) => {
                      const channelViews = channel[currentRange.viewsKey] ?? channel.lifetimeViews ?? 0;
                      const channelPosts = channel[currentRange.postsKey] ?? channel.posts ?? 0;
                      const channelLikes = channel[currentRange.likesKey] ?? channel.latestLikes ?? 0;
                      const channelComments = channel[currentRange.commentsKey] ?? channel.latestComments ?? 0;

                      return (
                        <tr
                          key={channel._id}
                          onClick={() => navigate(`/channels/${channel._id}/feed`)}
                          className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                          title={`View feed for ${channel.name}`}
                        >
                          {/* Channel Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <AccountAvatar account={channel} className="h-10 w-10 rounded-xl object-cover" />
                                <div className="absolute -bottom-1 -right-1">
                                  <PlatformIcon platform={channel.platform} className="h-4 w-4" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="m-0 text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                                  {channel.name}
                                </p>
                                <p className="m-0 text-[10px] text-zinc-400 truncate">
                                  {formatHandle(channel.username || channel.name)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Views */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-xs font-bold text-white">
                              {numberFormat.format(channelViews)}
                            </span>
                          </td>

                          {/* Posts */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-xs font-bold text-white">
                              {numberFormat.format(channelPosts)}
                            </span>
                          </td>

                          {/* Likes */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-xs font-bold text-white">
                              {numberFormat.format(channelLikes)}
                            </span>
                          </td>

                          {/* Comments */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-xs font-bold text-white">
                              {numberFormat.format(channelComments)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CreatorAnalytics;
