import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Megaphone, RefreshCw, Rows3 } from 'lucide-react';

const numberFormat = new Intl.NumberFormat();

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
  accountRows: [],
};

const timeRanges = {
  today: {
    label: 'Today',
    viewsKey: 'todayViews',
    accountInsightKey: 'todayAccountInsight',
    postsKey: 'todayPosts',
    likesKey: 'todayLikes',
    commentsKey: 'todayComments',
  },
  yesterday: {
    label: 'Yesterday',
    viewsKey: 'yesterdayViews',
    accountInsightKey: 'yesterdayAccountInsight',
    postsKey: 'yesterdayPosts',
    likesKey: 'yesterdayLikes',
    commentsKey: 'yesterdayComments',
  },
  last7Days: {
    label: 'Last 7 days',
    viewsKey: 'last7DaysViews',
    accountInsightKey: 'last7DaysAccountInsight',
    postsKey: 'last7DaysPosts',
    likesKey: 'last7DaysLikes',
    commentsKey: 'last7DaysComments',
  },
  thisMonth: {
    label: 'This month',
    viewsKey: 'thisMonthViews',
    accountInsightKey: 'thisMonthAccountInsight',
    postsKey: 'thisMonthPosts',
    likesKey: 'thisMonthLikes',
    commentsKey: 'thisMonthComments',
  },
  lifetime: {
    label: 'Lifetime',
    viewsKey: 'lifetimeViews',
    accountInsightKey: 'lifetimeAccountInsight',
    postsKey: 'posts',
    likesKey: 'latestLikes',
    commentsKey: 'latestComments',
  },
};

const MetricCard = ({ icon: Icon, label, value, note }) => (
  <div className="rounded-lg border border-[#e5e5ea] bg-white p-5">
    <Icon className="h-4 w-4 text-[#3478f6]" />
    <p className="m-0 mt-4 text-2xl font-semibold text-[#1d1d1f]">{value}</p>
    <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">{label}</p>
    {note && <p className="m-0 mt-2 text-xs text-[#8e8e93]">{note}</p>}
  </div>
);

const ActivityCell = ({ account, selectedTimeRange, selectedRange }) => {
  const getDayTitle = (day) => {
    const dateLabel = day.dateStr
      ? new Date(`${day.dateStr}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })
      : 'Unknown date';

    if (!day.posts?.length) {
      return `${dateLabel}\nNo posts`;
    }

    const times = day.posts.map((post, index) => {
      const timeLabel = post.publishedAt
        ? new Date(post.publishedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'Unknown time';
      return `${index + 1}. ${timeLabel}`;
    });

    return `${dateLabel}\n${times.join('\n')}`;
  };

  if (selectedTimeRange === 'today' || selectedTimeRange === 'yesterday') {
    const checkedCount = Math.min(Number(account[selectedRange.postsKey] || 0), 3);
    return (
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((slot) => (
          <span
            key={slot}
            className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold ${
              slot < checkedCount
                ? 'border-[#3478f6] bg-[#3478f6] text-white'
                : 'border-[#d2d2d7] bg-white text-transparent'
            }`}
          >
            ✓
          </span>
        ))}
      </div>
    );
  }

  if (selectedTimeRange === 'last7Days') {
    return (
      <div className="flex flex-wrap gap-2">
        {(account.last7DaysActivity || []).map((day) => (
          <span
            key={day.dateStr}
            title={getDayTitle(day)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold ${
              Number(day.count || 0) >= 3
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
    <span className="text-[#515154]">
      {numberFormat.format(account[selectedRange.postsKey] || 0)} posts
    </span>
  );
};

export const AdminDashboard = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCampaigns = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5001/api/admin/campaigns', {
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load campaign dashboard.');
      }
      setCampaigns(data);
      setSelectedCampaignId((current) => {
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

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign._id === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );

  const activeMetrics = selectedCampaign?.metrics || emptyMetrics;
  const selectedRange = timeRanges[selectedTimeRange];
  const selectedViews = activeMetrics[selectedRange.viewsKey] || 0;
  const selectedAccountInsight = activeMetrics[selectedRange.accountInsightKey] || 0;
  const selectedPosts = activeMetrics[selectedRange.postsKey] || 0;
  const selectedLikes = activeMetrics[selectedRange.likesKey] || 0;
  const selectedComments = activeMetrics[selectedRange.commentsKey] || 0;
  const selectedTimeLabel = selectedRange.label;

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-8 text-[#1d1d1f]">
      <div className="mb-6 flex flex-col gap-4 border-b border-[#e5e5ea] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Administration</p>
          <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">Dashboard</h2>
          <p className="m-0 mt-1 text-xs text-[#8e8e93]">Campaign performance totals from cached published-post insights.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 sm:w-64">
            <label htmlFor="campaign-select" className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Campaign
            </label>
            <select
              id="campaign-select"
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              disabled={campaigns.length === 0}
              className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6] disabled:bg-[#f5f5f7] disabled:text-[#8e8e93]"
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

          <div className="flex flex-col gap-1.5 sm:w-40">
            <label htmlFor="time-range-select" className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Time
            </label>
            <select
              id="time-range-select"
              value={selectedTimeRange}
              onChange={(event) => setSelectedTimeRange(event.target.value)}
              className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6]"
            >
              {Object.entries(timeRanges).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchCampaigns}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-xl border border-[#d2d2d7] bg-white p-10 text-center text-sm text-[#6e6e73]">
          Loading campaign dashboard...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[#d2d2d7] bg-white p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-[#c7c7cc]" />
          <p className="m-0 mt-3 text-sm font-semibold text-[#1d1d1f]">No campaigns yet</p>
          <p className="m-0 mt-1 text-xs text-[#6e6e73]">Create campaigns from the Campaign section and attach social accounts.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Eye}
              label={`${selectedTimeLabel} views`}
              value={numberFormat.format(selectedViews)}
              note={selectedTimeRange === 'lifetimeViews' ? 'Current total on cached posts' : 'Based on daily snapshots when available'}
            />
            <MetricCard
              icon={Eye}
              label={`${selectedTimeLabel} account insight`}
              value={numberFormat.format(selectedAccountInsight)}
              note="Account-level cached insight total"
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
              note={`${activeMetrics.accounts || 0} associated accounts`}
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#d2d2d7] bg-white">
            <div className="grid grid-cols-[1.1fr_0.85fr_1.15fr_0.35fr_0.6fr_0.65fr_0.6fr] gap-5 border-b border-[#e5e5ea] bg-[#fbfbfd] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              <span>Account</span>
              <span>User</span>
              <span>Activity</span>
              <span>Posts</span>
              <span>{selectedTimeLabel} views</span>
              <span>Account insight</span>
              <span>Engagement</span>
            </div>
            {(activeMetrics.accountRows || []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#6e6e73]">
                No social accounts are associated with this campaign.
              </div>
            ) : activeMetrics.accountRows.map((account) => (
              <div
                key={account._id}
                className="grid grid-cols-[1.1fr_0.85fr_1.15fr_0.35fr_0.6fr_0.65fr_0.6fr] items-center gap-5 border-b border-[#e5e5ea] px-5 py-4 text-sm last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt=""
                    className="h-9 w-9 rounded-full border border-black/10 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="m-0 truncate font-semibold text-[#1d1d1f]">{account.name}</p>
                    <p className="m-0 mt-0.5 truncate text-xs text-[#6e6e73]">
                      @{account.username || 'account'} · {account.platform}
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="m-0 truncate font-semibold text-[#1d1d1f]">{account.user?.name || 'Unknown user'}</p>
                  <p className="m-0 mt-0.5 truncate text-xs text-[#6e6e73]">{account.user?.email || 'No email'}</p>
                </div>
                <ActivityCell account={account} selectedTimeRange={selectedTimeRange} selectedRange={selectedRange} />
                <span className="text-[#515154]">{account[selectedRange.postsKey] || 0}</span>
                <span className="text-[#515154]">{numberFormat.format(account[selectedRange.viewsKey] || 0)}</span>
                <span className="text-[#515154]">{numberFormat.format(account[selectedRange.accountInsightKey] || 0)}</span>
                <span className="text-[#515154]">
                  {numberFormat.format(account[selectedRange.likesKey] || 0)} / {numberFormat.format(account[selectedRange.commentsKey] || 0)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
