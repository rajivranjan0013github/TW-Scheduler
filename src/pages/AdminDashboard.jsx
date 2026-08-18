import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Eye, Megaphone, RefreshCw, Rows3, Loader2 } from 'lucide-react';
import { getActiveCampaignId } from '../utils/campaignScope';
import {
  AccountIdentity,
  ActivityCell,
  DailyViewsChart,
  MetricCard,
} from '../components/adminDashboard/DashboardPresentation';
import { timeRanges } from '../components/adminDashboard/dashboardConfig';

const numberFormat = new Intl.NumberFormat();
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

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
  lastSyncedAt: null,
  syncIssues: 0,
  recentViewDelta: 0,
  recentLikeDelta: 0,
  recentCommentDelta: 0,
  last30DaysPostedViews: [],
  accountRows: [],
};

const getErrorMessage = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => null);
  return payload?.message || `${fallbackMessage} (${response.status})`;
};

const fetchCampaignList = async () => {
  const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/list`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load campaign dashboard.'));
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
};

const fetchMetrics = async (campaignId) => {
  const params = new URLSearchParams({ timeZone: localTimeZone });
  const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/${campaignId}/metrics?${params.toString()}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to load campaign metrics.'));
  }
  const payload = await response.json();
  return payload.metrics || emptyMetrics;
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [requestedCampaignId, setRequestedCampaignId] = useState(getActiveCampaignId);
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [searchChannel, setSearchChannel] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchUser, setSearchUser] = useState('');
  const [selectedGraphDate, setSelectedGraphDate] = useState(null);

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'campaigns', 'overview'],
    queryFn: fetchCampaignList,
    staleTime: 60 * 1000,
  });
  const campaigns = campaignsQuery.data || [];
  const selectedCampaignId = campaigns.some((campaign) => campaign._id === requestedCampaignId)
    ? requestedCampaignId
    : campaigns[0]?._id || '';
  const metricsQuery = useQuery({
    queryKey: ['admin', 'campaign', selectedCampaignId, 'metrics', localTimeZone],
    queryFn: () => fetchMetrics(selectedCampaignId),
    enabled: Boolean(selectedCampaignId),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const selectCampaign = (campaignId, { persist = true } = {}) => {
    const campaign = campaigns.find((item) => item._id === campaignId);
    if (!campaign) return;

    setRequestedCampaignId(campaignId);
    setSearchChannel('');
    setFilterPlatform('all');
    setSearchUser('');
    setSelectedGraphDate(null);
    if (!persist) return;

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
  };

  useEffect(() => {
    const syncSelectedCampaign = (event) => {
      if (event.detail?.campaignId) {
        setRequestedCampaignId(event.detail.campaignId);
        setSearchChannel('');
        setFilterPlatform('all');
        setSearchUser('');
        setSelectedGraphDate(null);
      }
    };

    window.addEventListener('campaign-selected', syncSelectedCampaign);
    return () => window.removeEventListener('campaign-selected', syncSelectedCampaign);
  }, []);

  const activeMetrics = metricsQuery.data || emptyMetrics;
  const selectedRange = timeRanges[selectedTimeRange];
  const selectedViews = activeMetrics[selectedRange.viewsKey] || 0;
  const selectedPosts = activeMetrics[selectedRange.postsKey] || 0;
  const selectedLikes = activeMetrics[selectedRange.likesKey] || 0;
  const selectedComments = activeMetrics[selectedRange.commentsKey] || 0;
  const upcomingPosts = activeMetrics.upcomingPosts || 0;

  const filteredAccountRows = useMemo(() => {
    const normalizedChannelSearch = searchChannel.trim().toLowerCase();
    const normalizedUserSearch = searchUser.trim().toLowerCase();
    return (activeMetrics.accountRows || []).filter((account) => {
      const channelName = (account.name || '').toLowerCase();
      const channelUsername = (account.username || '').toLowerCase();
      const userName = (account.user?.name || '').toLowerCase();
      const userEmail = (account.user?.email || '').toLowerCase();
      const platform = (account.platform || '').toLowerCase();
      const matchesChannel = !normalizedChannelSearch
        || channelName.includes(normalizedChannelSearch)
        || channelUsername.includes(normalizedChannelSearch);
      const matchesPlatform = filterPlatform === 'all' || platform === filterPlatform;
      const matchesUser = !normalizedUserSearch
        || userName.includes(normalizedUserSearch)
        || userEmail.includes(normalizedUserSearch);
      return matchesChannel && matchesPlatform && matchesUser;
    });
  }, [activeMetrics.accountRows, filterPlatform, searchChannel, searchUser]);
  const loading = campaignsQuery.isPending;
  const metricsLoading = metricsQuery.isFetching;
  const error = campaignsQuery.error?.message || metricsQuery.error?.message || '';
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
          <p className={`m-0 mt-0.5 text-[10px] ${activeMetrics.syncIssues > 0 ? 'font-semibold text-red-600' : 'text-[#8e8e93]'}`}>
            {activeMetrics.lastSyncedAt
              ? `Metrics synced ${new Date(activeMetrics.lastSyncedAt).toLocaleString()}`
              : 'Metrics have not synced yet'}
            {activeMetrics.syncIssues > 0 ? ` · ${activeMetrics.syncIssues} channel sync issue${activeMetrics.syncIssues === 1 ? '' : 's'}` : ''}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-0.5 sm:w-56">
            <label htmlFor="campaign-select" className="text-[9px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Campaign
            </label>
            <select
              id="campaign-select"
              value={selectedCampaignId}
              onChange={(event) => selectCampaign(event.target.value)}
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
              onChange={(event) => {
                setSelectedTimeRange(event.target.value);
                setSelectedGraphDate(null);
              }}
              className="h-7 rounded-md border border-[#d2d2d7] bg-white px-2 text-[11px] font-semibold text-[#1d1d1f] outline-none transition focus:border-[#3478f6]"
            >
              {Object.entries(timeRanges).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => Promise.all([
              campaignsQuery.refetch(),
              selectedCampaignId ? metricsQuery.refetch() : Promise.resolve(),
            ])}
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
      ) : metricsQuery.isError && !metricsQuery.data ? (
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
          <p className="m-0 text-sm font-semibold text-[#1d1d1f]">Campaign metrics could not be loaded</p>
          <button
            type="button"
            onClick={() => metricsQuery.refetch()}
            className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-[#d2d2d7] bg-white px-3 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
          >
            Try again
          </button>
        </div>
      ) : metricsQuery.isPending ? (
        <div className="rounded-xl border border-[#d2d2d7] bg-white p-12 text-center text-sm text-[#6e6e73] flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#3478f6]" />
          <span className="font-medium">Loading campaign metrics...</span>
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
              note={`+${numberFormat.format(activeMetrics.recentViewDelta || 0)} during the last 2 hours`}
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
              note={`+${numberFormat.format(activeMetrics.recentLikeDelta || 0)} likes / +${numberFormat.format(activeMetrics.recentCommentDelta || 0)} comments in 2h`}
            />
            <MetricCard
              icon={Rows3}
              label="Posts"
              value={numberFormat.format(selectedPosts)}
              note={`${activeMetrics.accounts || 0} associated channels`}
            />
          </div>

          <DailyViewsChart
            data={activeMetrics.last30DaysPostedViews || []}
            selectedDate={selectedGraphDate}
            onSelectDate={setSelectedGraphDate}
          />

          {selectedGraphDate && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm">
              <span>
                Filtering channel activity for date: <strong>{new Date(`${selectedGraphDate}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })}</strong> ({selectedGraphDate})
              </span>
              <button
                type="button"
                onClick={() => setSelectedGraphDate(null)}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-emerald-700 shadow-xs"
              >
                Clear Selection (Reset to {selectedTimeLabel})
              </button>
            </div>
          )}

          {/* Table Filters Bar */}
          <div className="mt-3 grid gap-2.5 rounded-xl border border-white/10 bg-[#0a0a0a] p-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="search-channel" className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Search Channel
              </label>
              <input
                id="search-channel"
                type="text"
                value={searchChannel}
                onChange={(e) => setSearchChannel(e.target.value)}
                placeholder="Search channel or username..."
                className="h-7 rounded-md border border-white/10 bg-black px-2 text-[11px] font-semibold text-white outline-none transition focus:border-[#7831d6]"
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label htmlFor="filter-platform" className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Filter Channel / Platform
              </label>
              <select
                id="filter-platform"
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="h-7 rounded-md border border-white/10 bg-black px-2 text-[11px] font-semibold text-white outline-none transition focus:border-[#7831d6]"
              >
                <option value="all">All Platforms</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <label htmlFor="search-user" className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Search User (Name/Email)
              </label>
              <input
                id="search-user"
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search by user name or email..."
                className="h-7 rounded-md border border-white/10 bg-black px-2 text-[11px] font-semibold text-white outline-none transition focus:border-[#7831d6]"
              />
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0a0a0a]">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[1.1fr_0.85fr_1.15fr_0.4fr_0.6fr_0.55fr_0.65fr] gap-3 border-b border-white/10 bg-black/60 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>Channel</span>
                <span>User</span>
                <span>{selectedGraphDate ? `Activity (${selectedGraphDate})` : 'Activity'}</span>
                <span>{selectedGraphDate ? `Posts (${selectedGraphDate})` : 'Posts'}</span>
                <span>{selectedGraphDate ? `Views (${selectedGraphDate})` : `${selectedTimeLabel} views`}</span>
                <span>Upcoming</span>
                <span>{selectedGraphDate ? `Engagement (${selectedGraphDate})` : 'Engagement'}</span>
              </div>
              {(activeMetrics.accountRows || []).length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-zinc-400">
                  No publishing channels are associated with this campaign.
                </div>
              ) : filteredAccountRows.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-zinc-400">
                  No publishing channels match the filter criteria.
                </div>
              ) : (
                <div>
                  {filteredAccountRows.map((account) => {
                    const dateActivity = selectedGraphDate
                      ? (account.last30DaysActivity || []).find((day) => day.dateStr === selectedGraphDate)
                      : null;

                    return (
                      <div
                        key={account._id}
                        onClick={() => openAccountFeed(account)}
                        className="grid cursor-pointer grid-cols-[1.1fr_0.85fr_1.15fr_0.4fr_0.6fr_0.55fr_0.65fr] items-center gap-3 border-b border-white/10 px-3 py-2 text-xs transition hover:bg-white/[0.08] last:border-b-0 text-white"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openAccountFeed(account);
                          }
                        }}
                      >
                        <AccountIdentity account={account} />
                        <div className="min-w-0">
                          <p className="m-0 truncate font-semibold text-white">{account.user?.name || 'Unknown user'}</p>
                          <p className="m-0 truncate text-[10px] text-zinc-400">{account.user?.email || 'No email'}</p>
                        </div>
                        <ActivityCell
                          account={account}
                          selectedTimeRange={selectedTimeRange}
                          selectedRange={selectedRange}
                          selectedGraphDate={selectedGraphDate}
                        />
                        <span className="text-zinc-300">
                          {selectedGraphDate ? (dateActivity?.count || 0) : (account[selectedRange.postsKey] || 0)}
                        </span>
                        <div>
                          {selectedGraphDate ? (
                            <span className="font-semibold text-white">
                              {numberFormat.format(dateActivity?.views || 0)}
                            </span>
                          ) : (
                            <span className="text-zinc-300">
                              {numberFormat.format(account[selectedRange.viewsKey] || 0)}
                              {(account.recentViewDelta || 0) > 0 && (
                                <span className="ml-1 text-[9px] font-semibold text-emerald-400">+{numberFormat.format(account.recentViewDelta)}</span>
                              )}
                            </span>
                          )}
                        </div>
                        <span className={(account.upcomingPosts || 0) < 3 ? 'text-rose-400 font-medium' : 'text-zinc-300'}>
                          {numberFormat.format(account.upcomingPosts || 0)}
                        </span>
                        <span className="text-zinc-300">
                          {selectedGraphDate ? (
                            `${numberFormat.format(dateActivity?.likes || 0)} / ${numberFormat.format(dateActivity?.comments || 0)}`
                          ) : (
                            `${numberFormat.format(account[selectedRange.likesKey] || 0)} / ${numberFormat.format(account[selectedRange.commentsKey] || 0)}`
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
