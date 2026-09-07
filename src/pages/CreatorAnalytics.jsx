import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Rows3,
  Heart,
  MessageSquare,
  Loader2,
  RefreshCw,
  Search,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
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
  byPlatform: {},
};

export const CreatorAnalytics = () => {
  const navigate = useNavigate();
  const [selectedCampaignId, setSelectedCampaignId] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [selectedGraphDate, setSelectedGraphDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [sortField, setSortField] = useState('views');
  const [sortOrder, setSortOrder] = useState('desc');

  const analyticsQuery = useQuery({
    queryKey: ['creator', 'analytics', selectedCampaignId, localTimeZone],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeZone: localTimeZone,
        ...(selectedCampaignId && selectedCampaignId !== 'all' ? { campaignId: selectedCampaignId } : {}),
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
  const campaigns = payload.campaigns || [];
  const metrics = payload.metrics || emptyMetrics;
  const byPlatform = metrics.byPlatform || {};
  const currentRange = timeRanges[selectedTimeRange] || timeRanges.today;

  const currentViews = metrics[currentRange.viewsKey] ?? 0;
  const currentPosts = metrics[currentRange.postsKey] ?? 0;
  const currentLikes = metrics[currentRange.likesKey] ?? 0;
  const currentComments = metrics[currentRange.commentsKey] ?? 0;

  // Selected date statistics from chart data
  const selectedDateStats = useMemo(() => {
    if (!selectedGraphDate || !Array.isArray(metrics.last30DaysPostedViews)) return null;
    return metrics.last30DaysPostedViews.find((day) => day.dateStr === selectedGraphDate) || null;
  }, [selectedGraphDate, metrics.last30DaysPostedViews]);

  // Filtered & sorted account rows
  const displayAccountRows = useMemo(() => {
    let rows = (metrics.accountRows || []).slice();

    // 1. Search filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      rows = rows.filter((channel) => {
        const name = (channel.name || '').toLowerCase();
        const username = (channel.username || '').toLowerCase();
        return name.includes(query) || username.includes(query);
      });
    }

    // 2. Platform filter
    if (filterPlatform !== 'all') {
      rows = rows.filter((channel) => (channel.platform || '').toLowerCase() === filterPlatform.toLowerCase());
    }

    // 3. Sorting
    rows.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      if (sortField === 'name') {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }

      if (selectedGraphDate) {
        const aDay = (a.last30DaysActivity || []).find((day) => day.dateStr === selectedGraphDate);
        const bDay = (b.last30DaysActivity || []).find((day) => day.dateStr === selectedGraphDate);
        if (sortField === 'views') {
          aVal = aDay?.views || 0;
          bVal = bDay?.views || 0;
        } else if (sortField === 'posts') {
          aVal = aDay?.posts || 0;
          bVal = bDay?.posts || 0;
        } else if (sortField === 'likes') {
          aVal = a[currentRange.likesKey] ?? 0;
          bVal = b[currentRange.likesKey] ?? 0;
        } else if (sortField === 'comments') {
          aVal = a[currentRange.commentsKey] ?? 0;
          bVal = b[currentRange.commentsKey] ?? 0;
        }
      } else {
        if (sortField === 'views') {
          aVal = a[currentRange.viewsKey] ?? 0;
          bVal = b[currentRange.viewsKey] ?? 0;
        } else if (sortField === 'posts') {
          aVal = a[currentRange.postsKey] ?? 0;
          bVal = b[currentRange.postsKey] ?? 0;
        } else if (sortField === 'likes') {
          aVal = a[currentRange.likesKey] ?? 0;
          bVal = b[currentRange.likesKey] ?? 0;
        } else if (sortField === 'comments') {
          aVal = a[currentRange.commentsKey] ?? 0;
          bVal = b[currentRange.commentsKey] ?? 0;
        }
      }

      if (aVal === bVal) {
        return (b.lifetimeViews || 0) - (a.lifetimeViews || 0);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return rows;
  }, [metrics.accountRows, searchQuery, filterPlatform, sortField, sortOrder, selectedGraphDate, currentRange]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-zinc-500 inline-block ml-1 opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === 'desc'
      ? <ArrowDown className="h-3 w-3 text-purple-400 inline-block ml-1" />
      : <ArrowUp className="h-3 w-3 text-purple-400 inline-block ml-1" />;
  };

  const platformKeys = ['youtube', 'instagram', 'facebook'];
  const hasPlatformData = platformKeys.some((p) => byPlatform[p]?.posts > 0 || byPlatform[p]?.views > 0);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white m-0">Analytics</h2>
          <p className="text-xs text-zinc-400 mt-1 m-0">
            Track views, published content, and engagement across your connected channels.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Campaign Selector if creator is in multiple campaigns */}
            {campaigns.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="campaign-filter" className="text-xs text-zinc-400">Campaign:</label>
                <select
                  id="campaign-filter"
                  value={selectedCampaignId}
                  onChange={(e) => {
                    setSelectedCampaignId(e.target.value);
                    setSelectedGraphDate(null);
                  }}
                  className="rounded-lg border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="all">All Campaigns</option>
                  {campaigns.map((camp) => (
                    <option key={camp._id} value={camp._id}>
                      {camp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50 cursor-pointer"
              title="Refresh analytics data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${analyticsQuery.isFetching ? 'animate-spin text-purple-400' : ''}`} />
              <span>{analyticsQuery.isFetching ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Metrics Synced Time */}
          <p className="text-xs text-zinc-400 m-0">
            {metrics.lastSyncedAt
              ? `Metrics synced ${new Date(metrics.lastSyncedAt).toLocaleString()}`
              : 'Metrics have not synced yet'}
          </p>
        </div>
      </div>

      {/* Time Range Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
        {Object.entries(timeRanges).map(([key, config]) => {
          const isActive = selectedTimeRange === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelectedTimeRange(key);
                setSelectedGraphDate(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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

          {/* Platform Performance Overview */}
          {hasPlatformData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {platformKeys.map((p) => {
                const stats = byPlatform[p] || { posts: 0, views: 0, likes: 0, comments: 0 };
                const isSelected = filterPlatform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFilterPlatform(isSelected ? 'all' : p)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-500/50 bg-purple-500/10 shadow-sm'
                        : 'border-white/10 bg-[#121215] hover:border-white/20 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlatformIcon platform={p} className="h-5 w-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-semibold capitalize text-white truncate">{p}</p>
                        <p className="m-0 text-[11px] text-zinc-400">
                          {numberFormat.format(stats.posts)} post{stats.posts === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="m-0 text-xs font-bold text-white">
                        {numberFormat.format(stats.views)}
                      </p>
                      <p className="m-0 text-[10px] text-zinc-400">views</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 30-Day Views Chart */}
          <DailyViewsChart
            data={metrics.last30DaysPostedViews}
            selectedDate={selectedGraphDate}
            onSelectDate={setSelectedGraphDate}
          />

          {/* Selected Date Activity Banner */}
          {selectedGraphDate && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs text-purple-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400 shrink-0" />
                <span>
                  Filtering channel activity for{' '}
                  <strong className="text-white font-semibold">
                    {new Date(`${selectedGraphDate}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })}
                  </strong>{' '}
                  ({numberFormat.format(selectedDateStats?.views || 0)} views,{' '}
                  {numberFormat.format(selectedDateStats?.posts || 0)} post
                  {(selectedDateStats?.posts || 0) === 1 ? '' : 's'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGraphDate(null)}
                className="flex items-center gap-1 font-semibold text-purple-300 hover:text-white hover:underline transition-colors shrink-0 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear date filter</span>
              </button>
            </div>
          )}

          {/* Channel Performance Section */}
          <div className="space-y-3 pt-2">
            {/* Table Header & Search/Filter Controls */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-white m-0">Channel Performance</h3>
                <p className="text-xs text-zinc-400 m-0 mt-0.5">
                  {selectedGraphDate
                    ? `Showing activity for ${selectedGraphDate}`
                    : `Sorted by ${currentRange.label.toLowerCase()} performance`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search channels..."
                    className="w-40 sm:w-48 rounded-lg border border-white/10 bg-[#18181b] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Platform Filter */}
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="all">All Platforms</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {displayAccountRows.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/5 bg-[#121215] text-xs text-zinc-400 font-medium">
                {searchQuery || filterPlatform !== 'all'
                  ? 'No channels match your search or filter.'
                  : 'No channels found. Connect accounts in Channels to see metrics.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#121215]">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/[0.04] text-xs font-bold uppercase tracking-wider text-zinc-200">
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-white group select-none"
                        onClick={() => toggleSort('name')}
                      >
                        <span className="inline-flex items-center">
                          Channel {renderSortIcon('name')}
                        </span>
                      </th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:text-white group select-none"
                        onClick={() => toggleSort('views')}
                      >
                        <span className="inline-flex items-center justify-end">
                          {selectedGraphDate ? `Views (${selectedGraphDate})` : `${currentRange.label} Views`} {renderSortIcon('views')}
                        </span>
                      </th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:text-white group select-none"
                        onClick={() => toggleSort('posts')}
                      >
                        <span className="inline-flex items-center justify-end">
                          {selectedGraphDate ? `Posts (${selectedGraphDate})` : `${currentRange.label} Posts`} {renderSortIcon('posts')}
                        </span>
                      </th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:text-white group select-none"
                        onClick={() => toggleSort('likes')}
                      >
                        <span className="inline-flex items-center justify-end">
                          Likes {renderSortIcon('likes')}
                        </span>
                      </th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:text-white group select-none"
                        onClick={() => toggleSort('comments')}
                      >
                        <span className="inline-flex items-center justify-end">
                          Comments {renderSortIcon('comments')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {displayAccountRows.map((channel) => {
                      const dateActivity = selectedGraphDate
                        ? (channel.last30DaysActivity || []).find((day) => day.dateStr === selectedGraphDate)
                        : null;
                      const channelViews = selectedGraphDate
                        ? (dateActivity?.views || 0)
                        : (channel[currentRange.viewsKey] ?? 0);
                      const channelPosts = selectedGraphDate
                        ? (dateActivity?.posts || 0)
                        : (channel[currentRange.postsKey] ?? 0);

                      const channelLikes = channel[currentRange.likesKey] ?? 0;
                      const channelComments = channel[currentRange.commentsKey] ?? 0;

                      return (
                        <tr
                          key={channel._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/channels/${channel._id}/feed`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/channels/${channel._id}/feed`);
                            }
                          }}
                          className="hover:bg-white/[0.04] transition-colors cursor-pointer group focus:outline-none focus:bg-white/[0.08]"
                          title={`View feed for ${channel.name}`}
                          aria-label={`View feed for ${channel.name}`}
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
