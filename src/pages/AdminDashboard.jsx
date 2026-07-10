import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Eye, Megaphone, RefreshCw, Rows3, Loader2 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getActiveCampaignId } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';

const numberFormat = new Intl.NumberFormat();
const upcomingStatuses = 'scheduled,manual_ready,downloaded,publishing,paused';

const emptyMetrics = {
  accounts: 0,
  posts: 0,
  todayPosts: 0,
  yesterdayPosts: 0,
  last7DaysPosts: 0,
  thisMonthPosts: 0,
  lifetimeViews: 0,
  lifetimeAccountInsight: 0,
  todayViews: 0,
  todayAccountInsight: 0,
  yesterdayViews: 0,
  yesterdayAccountInsight: 0,
  last7DaysViews: 0,
  last7DaysAccountInsight: 0,
  thisMonthViews: 0,
  thisMonthAccountInsight: 0,
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
  upcomingPosts: 0,
  last30DaysPostedViews: [],
  accountRows: [],
};

const timeRanges = {
  today: {
    label: 'Today',
    viewsKey: 'todayViews',
    postsKey: 'todayPosts',
    likesKey: 'todayLikes',
    commentsKey: 'todayComments',
  },
  yesterday: {
    label: 'Yesterday',
    viewsKey: 'yesterdayViews',
    postsKey: 'yesterdayPosts',
    likesKey: 'yesterdayLikes',
    commentsKey: 'yesterdayComments',
  },
  last7Days: {
    label: 'Last 7 days',
    viewsKey: 'last7DaysViews',
    postsKey: 'last7DaysPosts',
    likesKey: 'last7DaysLikes',
    commentsKey: 'last7DaysComments',
  },
  thisMonth: {
    label: 'This month',
    viewsKey: 'thisMonthViews',
    postsKey: 'thisMonthPosts',
    likesKey: 'thisMonthLikes',
    commentsKey: 'thisMonthComments',
  },
  lifetime: {
    label: 'Lifetime',
    viewsKey: 'lifetimeViews',
    postsKey: 'posts',
    likesKey: 'latestLikes',
    commentsKey: 'latestComments',
  },
};

const MetricCard = ({ icon: Icon, label, value, note }) => (
  <div className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">{label}</p>
        <p className="m-0 mt-1 truncate text-xl font-semibold leading-none text-[#1d1d1f]">{value}</p>
      </div>
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#f0f7ff] text-[#3478f6]">
        <Icon className="h-3.5 w-3.5" />
      </span>
    </div>
    {note && <p className="m-0 mt-1.5 truncate text-[10px] text-[#8e8e93]">{note}</p>}
  </div>
);

const DailyViewsChart = ({ data = [] }) => {
  const chartData = data.map((item) => {
    const date = item.dateStr ? new Date(`${item.dateStr}T00:00:00`) : null;
    return {
      ...item,
      label: date ? `${date.getDate()}` : '',
      views: Number(item.views || 0),
      posts: Number(item.posts || 0),
    };
  });

  return (
    <div className="mt-3 rounded-xl border border-[#d2d2d7] bg-white px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Last 30 days</p>
          <p className="m-0 mt-0.5 text-sm font-semibold text-[#1d1d1f]">Views by publish day</p>
        </div>
        <p className="m-0 text-[10px] font-medium text-[#8e8e93]">Published posts only</p>
      </div>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#6e6e73' }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#6e6e73' }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(value) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(52, 120, 246, 0.08)' }}
              formatter={(value, name) => [
                name === 'views' ? numberFormat.format(value) : value,
                name === 'views' ? 'Views' : 'Posts',
              ]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                return item?.dateStr || '';
              }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #d2d2d7',
                fontSize: 11,
              }}
            />
            <Bar dataKey="views" fill="#3478f6" radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const formatPostTime = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
};

const formatPostDateTime = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return `${date.toLocaleDateString([], { dateStyle: 'medium' })}, ${formatPostTime(value)}`;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeHandle = (value = '') => String(value).replace(/^@/, '').trim().toLowerCase();

const getItemId = (item) => String(item?._id || item || '');

const getUpcomingCountsByAccount = (accountRows = [], queuePosts = []) => {
  const accountIds = new Set(accountRows.map((account) => getItemId(account)).filter(Boolean));
  const accountHandleMap = new Map();

  accountRows.forEach((account) => {
    [account.username, account.name].forEach((value) => {
      const handle = normalizeHandle(value);
      if (handle) {
        accountHandleMap.set(`${account.platform}:${handle}`, getItemId(account));
      }
    });
  });

  return queuePosts.reduce((counts, post) => {
    const targetAccountIds = new Set();

    (post.socialAccountIds || []).forEach((account) => {
      const accountId = getItemId(account);
      if (accountIds.has(accountId)) {
        targetAccountIds.add(accountId);
      }
    });

    (post.campaignChannelIds || []).forEach((channel) => {
      const linkedAccountId = getItemId(channel?.socialAccountId);
      if (accountIds.has(linkedAccountId)) {
        targetAccountIds.add(linkedAccountId);
        return;
      }

      [channel?.normalizedHandle, channel?.requestedHandle, channel?.displayName].forEach((value) => {
        const handle = normalizeHandle(value);
        const accountId = accountHandleMap.get(`${channel?.platform}:${handle}`);
        if (accountId) {
          targetAccountIds.add(accountId);
        }
      });
    });

    targetAccountIds.forEach((accountId) => {
      counts[accountId] = (counts[accountId] || 0) + 1;
    });

    return counts;
  }, {});
};

const applyUpcomingCounts = (metrics = emptyMetrics, queuePosts = []) => {
  const accountRows = metrics.accountRows || [];
  const upcomingCountsByAccount = getUpcomingCountsByAccount(accountRows, queuePosts);

  return {
    ...metrics,
    upcomingPosts: queuePosts.length,
    accountRows: accountRows.map((account) => ({
      ...account,
      upcomingPosts: upcomingCountsByAccount[getItemId(account)] || 0,
    })),
  };
};

const ActivityCell = ({ account, selectedTimeRange, selectedRange }) => {
  const getDayTitle = (day) => {
    const dateLabel = day.dateStr
      ? new Date(`${day.dateStr}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })
      : 'Unknown date';

    if (!day.posts?.length) {
      return `${dateLabel}\nNo posts`;
    }

    const times = day.posts.map((post, index) => {
      const timeLabel = post.publishedAt ? formatPostDateTime(post.publishedAt) : 'Unknown time';
      return `${index + 1}. ${timeLabel}`;
    });

    return `${dateLabel}\n${times.join('\n')}`;
  };

  if (selectedTimeRange === 'today' || selectedTimeRange === 'yesterday') {
    const activityDate = selectedTimeRange === 'today'
      ? new Date()
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activityDateStr = formatDateKey(activityDate);
    const activityDay = (account.last7DaysActivity || []).find((day) => day.dateStr === activityDateStr);
    const visiblePosts = (activityDay?.posts || [])
      .slice()
      .sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
    const checkedCount = Math.min(Number(account[selectedRange.postsKey] || 0), 3);

    return (
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((slot) => {
          const post = visiblePosts[slot];
          const hasPost = slot < checkedCount;
          const timeLabel = post?.publishedAt ? formatPostTime(post.publishedAt) : '';
          return (
            <span
              key={slot}
              title={post?.publishedAt ? formatPostDateTime(post.publishedAt) : hasPost ? 'Posted time unavailable' : 'No post'}
              className={`flex h-5 min-w-8 items-center justify-center rounded border px-1 text-[8px] font-bold leading-none ${hasPost
                  ? 'border-[#3478f6] bg-[#3478f6] text-white'
                  : 'border-[#d2d2d7] bg-white text-transparent'
                }`}
            >
              {hasPost ? timeLabel || '✓' : '✓'}
            </span>
          );
        })}
        {Number(account[selectedRange.postsKey] || 0) > 3 && (
          <span
            className="text-[9px] font-semibold text-[#6e6e73]"
            title={`${account[selectedRange.postsKey]} posts in ${selectedRange.label.toLowerCase()}`}
          >
            +{Number(account[selectedRange.postsKey] || 0) - 3}
          </span>
        )}
      </div>
    );
  }

  if (selectedTimeRange === 'last7Days') {
    return (
      <div className="flex flex-wrap gap-1">
        {(account.last7DaysActivity || []).map((day) => (
          <span
            key={day.dateStr}
            title={getDayTitle(day)}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold ${Number(day.count || 0) >= 3
                ? 'border-[#34c759] bg-[#34c759] text-white'
                : 'border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]'
              }`}
          >
            {day.count || 0}
          </span>
        ))}
      </div>
    );
  }

  return (
    <span className="text-xs text-[#515154]">
      {numberFormat.format(account[selectedRange.postsKey] || 0)} posts
    </span>
  );
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [campaignMetricsById, setCampaignMetricsById] = useState({});
  const [error, setError] = useState('');

  // Local table filtering states
  const [searchChannel, setSearchChannel] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchUser, setSearchUser] = useState('');

  const fetchCampaigns = async ({ force = false } = {}) => {
    if (campaigns.length === 0) setLoading(true);
    setError('');
    try {
      const queryKey = ['admin', 'campaigns', 'overview'];
      if (force) {
        await queryClient.invalidateQueries({ queryKey });
      }
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/list`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.message || 'Failed to load campaign dashboard.');
          }
          return payload;
        },
        staleTime: 60 * 1000,
      });
      setCampaigns(data);
      setSelectedCampaignId((current) => {
        const activeCampaignId = getActiveCampaignId();
        if (data.some((campaign) => campaign._id === activeCampaignId)) {
          return activeCampaignId;
        }
        if (data.some((campaign) => campaign._id === current)) {
          return current;
        }
        return data[0]?._id || '';
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignMetrics = async (campaignId, { force = false } = {}) => {
    if (!campaignId) return;
    setMetricsLoading(true);
    setError('');
    try {
      const queryKey = ['admin', 'campaign', campaignId, 'metrics'];
      if (force) {
        await queryClient.invalidateQueries({ queryKey });
      }
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/${campaignId}/metrics`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.message || 'Failed to load campaign metrics.');
          }
          return payload;
        },
        staleTime: 60 * 1000,
      });
      const metrics = data.metrics || emptyMetrics;
      const schedulerParams = new URLSearchParams();
      schedulerParams.set('campaignId', campaignId);
      schedulerParams.set('statuses', upcomingStatuses);
      const schedulerResponse = await fetch(`${API_BASE_URL}/api/scheduler?${schedulerParams.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
        cache: 'no-store',
      });
      const schedulerPayload = await schedulerResponse.json().catch(() => null);
      const metricsWithUpcoming = schedulerResponse.ok && Array.isArray(schedulerPayload)
        ? applyUpcomingCounts(metrics, schedulerPayload)
        : metrics;

      setCampaignMetricsById((current) => ({
        ...current,
        [campaignId]: metricsWithUpcoming,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      fetchCampaignMetrics(selectedCampaignId);
      // Reset filter states when campaign changes
      setSearchChannel('');
      setFilterPlatform('all');
      setSearchUser('');
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    const syncSelectedCampaign = (event) => {
      if (event.detail?.campaignId) {
        setSelectedCampaignId(event.detail.campaignId);
      }
    };

    window.addEventListener('campaign-selected', syncSelectedCampaign);
    return () => window.removeEventListener('campaign-selected', syncSelectedCampaign);
  }, []);

  const activeMetrics = campaignMetricsById[selectedCampaignId] || emptyMetrics;
  const selectedRange = timeRanges[selectedTimeRange];
  const selectedViews = activeMetrics[selectedRange.viewsKey] || 0;
  const selectedPosts = activeMetrics[selectedRange.postsKey] || 0;
  const selectedLikes = activeMetrics[selectedRange.likesKey] || 0;
  const selectedComments = activeMetrics[selectedRange.commentsKey] || 0;
  const upcomingPosts = activeMetrics.upcomingPosts || 0;

  // Filter channels based on text inputs and platform selection
  const filteredAccountRows = (activeMetrics.accountRows || []).filter((account) => {
    const channelName = (account.name || '').toLowerCase();
    const channelUsername = (account.username || '').toLowerCase();
    const userName = (account.user?.name || '').toLowerCase();
    const userEmail = (account.user?.email || '').toLowerCase();
    const platform = (account.platform || '').toLowerCase();

    const matchesChannel = !searchChannel ||
      channelName.includes(searchChannel.toLowerCase()) ||
      channelUsername.includes(searchChannel.toLowerCase());

    const matchesPlatform = filterPlatform === 'all' || platform === filterPlatform;

    const matchesUser = !searchUser ||
      userName.includes(searchUser.toLowerCase()) ||
      userEmail.includes(searchUser.toLowerCase());

    return matchesChannel && matchesPlatform && matchesUser;
  });
  const selectedTimeLabel = selectedRange.label;
  const openAccountFeed = (account) => {
    sessionStorage.removeItem('admin_view_context');
    navigate(`/channels/${account._id}/feed`, {
      state: {
        fromAdmin: true,
        preserveWorkspace: true,
        channel: account,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-3 pb-6 text-[#1d1d1f]">
      <div className="mb-2 flex flex-col gap-2 border-b border-[#e5e5ea] pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">Campaign Manager</p>
          <h2 className="m-0 text-base font-semibold tracking-tight text-[#1d1d1f]">Performance</h2>
        </div>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-0.5 sm:w-56">
            <label htmlFor="campaign-select" className="text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Campaign
            </label>
            <select
              id="campaign-select"
              value={selectedCampaignId}
              onChange={(event) => {
                const campaign = campaigns.find((item) => item._id === event.target.value);
                setSelectedCampaignId(event.target.value);
                if (campaign) {
                  localStorage.setItem('active-campaign-id', campaign._id);
                  localStorage.setItem('active-campaign-name', campaign.name || '');
                  localStorage.setItem('active-campaign-main-email', campaign.mainEmail || campaign.createdBy?.email || '');
                  window.dispatchEvent(new CustomEvent('campaign-selected', {
                    detail: {
                      campaignId: campaign._id,
                      campaignName: campaign.name || '',
                      mainEmail: campaign.mainEmail || campaign.createdBy?.email || '',
                    },
                  }));
                }
              }}
              disabled={campaigns.length === 0}
              className="h-7 rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6] disabled:bg-[#f5f5f7] disabled:text-[#8e8e93]"
            >
              {campaigns.length === 0 ? (
                <option value="">No campaigns</option>
              ) : campaigns.map((campaign) => (
                <option key={campaign._id} value={campaign._id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5 sm:w-32">
            <label htmlFor="time-range-select" className="text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Time
            </label>
            <select
              id="time-range-select"
              value={selectedTimeRange}
              onChange={(event) => setSelectedTimeRange(event.target.value)}
              className="h-7 rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6]"
            >
              {Object.entries(timeRanges).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              fetchCampaigns({ force: true });
              if (selectedCampaignId) {
                fetchCampaignMetrics(selectedCampaignId, { force: true });
              }
            }}
            disabled={loading || metricsLoading}
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-[#d2d2d7] bg-white px-2.5 text-[11px] font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3 w-3 ${loading || metricsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#d2d2d7] bg-white p-12 text-center text-sm text-[#6e6e73] flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#3478f6]" />
          <span className="font-medium">Loading campaign dashboard...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-[#d2d2d7] bg-white p-8 text-center">
          <Megaphone className="mx-auto h-7 w-7 text-[#c7c7cc]" />
          <p className="m-0 mt-2 text-sm font-semibold text-[#1d1d1f]">No campaigns yet</p>
          <p className="m-0 mt-1 text-xs text-[#6e6e73]">Create campaigns from Campaign Setup and attach publishing channels.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {metricsLoading && (
            <div className="mb-2 rounded-lg border border-[#e5e5ea] bg-white px-3 py-2 text-xs font-semibold text-[#6e6e73] flex items-center gap-2 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3478f6]" />
              <span>Updating campaign metrics...</span>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Eye}
              label={`${selectedTimeLabel} views`}
              value={numberFormat.format(selectedViews)}
              note={selectedTimeRange === 'lifetime' ? 'Current total on cached posts' : 'Posts published in selected range'}
            />
            <MetricCard
              icon={CalendarClock}
              label="Upcoming posts"
              value={numberFormat.format(upcomingPosts)}
              note="Queued scheduled posts"
            />
            <MetricCard
              icon={Megaphone}
              label="Engagement"
              value={`${numberFormat.format(selectedLikes)} / ${numberFormat.format(selectedComments)}`}
              note="Likes / comments"
            />
            <MetricCard
              icon={Rows3}
              label="Posts"
              value={numberFormat.format(selectedPosts)}
              note={`${activeMetrics.accounts || 0} associated channels`}
            />
          </div>

          <DailyViewsChart data={activeMetrics.last30DaysPostedViews || []} />

          {/* Table Filters Bar */}
          <div className="mt-3 grid gap-2.5 rounded-xl border border-[#d2d2d7] bg-white p-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="search-channel" className="text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                Search Channel
              </label>
              <input
                id="search-channel"
                type="text"
                value={searchChannel}
                onChange={(e) => setSearchChannel(e.target.value)}
                placeholder="Search channel or username..."
                className="h-7 rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6]"
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label htmlFor="filter-platform" className="text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                Filter Channel / Platform
              </label>
              <select
                id="filter-platform"
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="h-7 rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6]"
              >
                <option value="all">All Platforms</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <label htmlFor="search-user" className="text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                Search User (Name/Email)
              </label>
              <input
                id="search-user"
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search by user name or email..."
                className="h-7 rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6]"
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-[#d2d2d7] bg-white">
            <div className="grid grid-cols-[1.1fr_0.85fr_1.15fr_0.4fr_0.6fr_0.55fr_0.65fr] gap-3 border-b border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              <span>Channel</span>
              <span>User</span>
              <span>Activity</span>
              <span>Posts</span>
              <span>{selectedTimeLabel} views</span>
              <span>Upcoming</span>
              <span>Engagement</span>
            </div>
            {(activeMetrics.accountRows || []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#6e6e73]">
                No publishing channels are associated with this campaign.
              </div>
            ) : filteredAccountRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#6e6e73]">
                No publishing channels match the filter criteria.
              </div>
            ) : (
              <div>
                {filteredAccountRows.map((account) => (
                  <div
                    key={account._id}
                    onClick={() => openAccountFeed(account)}
                    className="grid cursor-pointer grid-cols-[1.1fr_0.85fr_1.15fr_0.4fr_0.6fr_0.55fr_0.65fr] items-center gap-3 border-b border-[#e5e5ea] px-3 py-2 text-xs transition hover:bg-[#f5f5f7] last:border-b-0"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openAccountFeed(account);
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        crossOrigin="anonymous"
                        alt=""
                        className="h-7 w-7 rounded-full border border-black/10 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="m-0 truncate font-semibold text-[#1d1d1f]">{account.name}</p>
                        <p className="m-0 flex items-center gap-1 truncate text-[10px] text-[#6e6e73]">
                          <PlatformIcon platform={account.platform} className="h-3.5 w-3.5" />
                          <span className="truncate">@{account.username || 'account'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 truncate font-semibold text-[#1d1d1f]">{account.user?.name || 'Unknown user'}</p>
                      <p className="m-0 truncate text-[10px] text-[#6e6e73]">{account.user?.email || 'No email'}</p>
                    </div>
                    <ActivityCell account={account} selectedTimeRange={selectedTimeRange} selectedRange={selectedRange} />
                    <span className="text-[#515154]">{account[selectedRange.postsKey] || 0}</span>
                    <span className="text-[#515154]">{numberFormat.format(account[selectedRange.viewsKey] || 0)}</span>
                    <span className={(account.upcomingPosts || 0) < 3 ? 'text-[#ff3b30] font-medium' : 'text-[#515154]'}>
                      {numberFormat.format(account.upcomingPosts || 0)}
                    </span>
                    <span className="text-[#515154]">
                      {numberFormat.format(account[selectedRange.likesKey] || 0)} / {numberFormat.format(account[selectedRange.commentsKey] || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
