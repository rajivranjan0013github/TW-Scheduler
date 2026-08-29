import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Eye, Megaphone, RefreshCw, Rows3, Loader2, Sparkles, Search, Filter, X } from 'lucide-react';
import { getActiveCampaignId, invalidateAllCampaignQueries } from '../utils/campaignScope';
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
  const queryClient = useQueryClient();
  const [requestedCampaignId, setRequestedCampaignId] = useState(getActiveCampaignId);
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [selectedGraphDate, setSelectedGraphDate] = useState(null);
  const [syncingCampaign, setSyncingCampaign] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);

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
    setSearchQuery('');
    setFilterPlatform('all');
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
        setSearchQuery('');
        setFilterPlatform('all');
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
    const q = searchQuery.trim().toLowerCase();
    return (activeMetrics.accountRows || []).filter((account) => {
      const channelName = (account.name || '').toLowerCase();
      const channelUsername = (account.username || '').toLowerCase();
      const userName = (account.user?.name || '').toLowerCase();
      const userEmail = (account.user?.email || '').toLowerCase();
      const platform = (account.platform || '').toLowerCase();

      const matchesSearch = !q
        || channelName.includes(q)
        || channelUsername.includes(q)
        || userName.includes(q)
        || userEmail.includes(q);

      const matchesPlatform = filterPlatform === 'all' || platform === filterPlatform;
      return matchesSearch && matchesPlatform;
    });
  }, [activeMetrics.accountRows, filterPlatform, searchQuery]);
  const loading = campaignsQuery.isPending;
  const metricsLoading = metricsQuery.isFetching;
  const error = campaignsQuery.error?.message || metricsQuery.error?.message || '';
  const selectedTimeLabel = selectedRange.label;
  const handleSyncCampaign = async () => {
    if (!selectedCampaignId || syncingCampaign) return;
    setSyncingCampaign(true);
    setSyncBanner({ type: 'info', message: 'Starting background sync for campaign channels...' });

    try {
      const token = localStorage.getItem('tw_token');
      const res = await fetch(`${API_BASE_URL}/api/admin/campaigns/${selectedCampaignId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start campaign sync.');

      if (data.queued === 0) {
        setSyncBanner({ type: 'info', message: data.message || 'No connected accounts to sync.' });
        setSyncingCampaign(false);
        return;
      }

      setSyncBanner({ type: 'info', message: `Syncing ${data.queued} account(s)...` });

      let finishedStatus = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const statusRes = await fetch(`${API_BASE_URL}/api/admin/campaigns/${selectedCampaignId}/sync-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!statusRes.ok) continue;
        const statusPayload = await statusRes.json();
        if (statusPayload.status !== 'running') {
          finishedStatus = statusPayload;
          break;
        }
      }

      await invalidateAllCampaignQueries(queryClient, selectedCampaignId);
      await metricsQuery.refetch();

      if (finishedStatus?.syncIssues > 0) {
        setSyncBanner({
          type: 'warning',
          message: `Sync completed with ${finishedStatus.syncIssues} account issue(s). Check channel statuses below.`,
        });
      } else {
        setSyncBanner({
          type: 'success',
          message: 'Campaign synchronization completed successfully.',
        });
      }
    } catch (err) {
      setSyncBanner({ type: 'error', message: err.message || 'Campaign sync failed.' });
    } finally {
      setSyncingCampaign(false);
      setTimeout(() => setSyncBanner(null), 6000);
    }
  };

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
    <div className="min-h-screen bg-[#09090b] p-4 pb-8 text-zinc-100 lg:p-6">
      <div className="mb-3 flex flex-col gap-3 border-b border-white/10 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Campaign Manager</p>
          <h2 className="m-0 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">Performance</h2>
          <p className={`m-0 mt-1 text-xs ${activeMetrics.syncIssues > 0 ? 'font-semibold text-rose-400' : 'text-zinc-400'}`}>
            {activeMetrics.lastSyncedAt
              ? `Metrics synced ${new Date(activeMetrics.lastSyncedAt).toLocaleString()}`
              : 'Metrics have not synced yet'}
            {activeMetrics.syncIssues > 0 ? ` · ${activeMetrics.syncIssues} channel sync issue${activeMetrics.syncIssues === 1 ? '' : 's'}` : ''}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1 sm:w-60">
            <label htmlFor="campaign-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Campaign
            </label>
            <div className="group relative rounded-xl p-[1px] bg-gradient-to-r from-white/15 via-purple-500/20 to-white/10 hover:from-[#7831d6]/50 hover:via-purple-400/50 hover:to-[#6366f1]/50 focus-within:from-[#8a3ff2] focus-within:via-[#a855f7] focus-within:to-[#6366f1] focus-within:shadow-[0_0_14px_rgba(120,49,214,0.35)] transition-all duration-200">
              <div className="relative flex items-center rounded-[11px] bg-[#16161a]">
                <select
                  id="campaign-select"
                  value={selectedCampaignId}
                  onChange={(event) => selectCampaign(event.target.value)}
                  disabled={campaigns.length === 0}
                  className="h-9 w-full appearance-none rounded-[11px] bg-transparent pl-3 pr-7 text-xs font-semibold text-zinc-100 outline-none focus:outline-none disabled:text-zinc-500 cursor-pointer"
                >
                  {campaigns.length === 0 ? (
                    <option value="" className="bg-[#18181b] text-zinc-400">No campaigns</option>
                  ) : campaigns.map((campaign) => (
                    <option key={campaign._id} value={campaign._id} className="bg-[#18181b] text-zinc-100">
                      {campaign.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 text-[10px] text-zinc-400">▾</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:w-36">
            <label htmlFor="time-range-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Time
            </label>
            <div className="group relative rounded-xl p-[1px] bg-gradient-to-r from-white/15 via-purple-500/20 to-white/10 hover:from-[#7831d6]/50 hover:via-purple-400/50 hover:to-[#6366f1]/50 focus-within:from-[#8a3ff2] focus-within:via-[#a855f7] focus-within:to-[#6366f1] focus-within:shadow-[0_0_14px_rgba(120,49,214,0.35)] transition-all duration-200">
              <div className="relative flex items-center rounded-[11px] bg-[#16161a]">
                <select
                  id="time-range-select"
                  value={selectedTimeRange}
                  onChange={(event) => {
                    setSelectedTimeRange(event.target.value);
                    setSelectedGraphDate(null);
                  }}
                  className="h-9 w-full appearance-none rounded-[11px] bg-transparent pl-3 pr-7 text-xs font-semibold text-zinc-100 outline-none focus:outline-none cursor-pointer"
                >
                  {Object.entries(timeRanges).map(([value, config]) => (
                    <option key={value} value={value} className="bg-[#18181b] text-zinc-100">{config.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 text-[10px] text-zinc-400">▾</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => Promise.all([
              campaignsQuery.refetch(),
              selectedCampaignId ? metricsQuery.refetch() : Promise.resolve(),
            ])}
            disabled={loading || metricsLoading || syncingCampaign}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#16161a] px-3.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Reload metrics from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || metricsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleSyncCampaign}
            disabled={!selectedCampaignId || syncingCampaign || loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#7831d6] px-4 text-xs font-semibold text-white transition hover:bg-[#6825bc] shadow-sm shadow-[#7831d6]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fetch fresh views, likes, and comments from Meta Graph API"
          >
            {syncingCampaign ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Sync Campaign
              </>
            )}
          </button>
        </div>
      </div>

      {syncBanner && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-xs font-medium flex items-center justify-between ${
          syncBanner.type === 'error'
            ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
            : syncBanner.type === 'warning'
            ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
            : syncBanner.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
            : 'border-[#7831d6]/30 bg-[#7831d6]/15 text-[#c4b5fd]'
        }`}>
          <span>{syncBanner.message}</span>
          <button
            type="button"
            onClick={() => setSyncBanner(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-[#121215] p-12 text-center text-sm text-zinc-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#7831d6]" />
          <span className="font-medium">Loading campaign dashboard...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#121215] p-8 text-center">
          <Megaphone className="mx-auto h-7 w-7 text-zinc-600" />
          <p className="m-0 mt-2 text-sm font-semibold text-zinc-100">No campaigns yet</p>
          <p className="m-0 mt-1 text-xs text-zinc-400">Create campaigns from Campaign Setup and attach publishing channels.</p>
        </div>
      ) : metricsQuery.isError && !metricsQuery.data ? (
        <div className="rounded-xl border border-rose-500/30 bg-[#121215] p-8 text-center">
          <p className="m-0 text-sm font-semibold text-zinc-100">Campaign metrics could not be loaded</p>
          <button
            type="button"
            onClick={() => metricsQuery.refetch()}
            className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-white/10 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      ) : metricsQuery.isPending ? (
        <div className="rounded-xl border border-white/10 bg-[#121215] p-12 text-center text-sm text-zinc-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#7831d6]" />
          <span className="font-medium">Loading campaign metrics...</span>
        </div>
      ) : (
        <div className="flex flex-col">
          {metricsLoading && (
            <div className="mb-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 flex items-center gap-2 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7831d6]" />
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
            <div className="mt-3.5 flex flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                Filtering channel activity for date: <strong className="font-bold text-white">{new Date(`${selectedGraphDate}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })}</strong> ({selectedGraphDate})
              </span>
              <button
                type="button"
                onClick={() => setSelectedGraphDate(null)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 shadow-sm"
              >
                Clear Selection (Reset to {selectedTimeLabel})
              </button>
            </div>
          )}

          {/* Channel Table Card with Integrated Toolbar */}
          <div className="mt-3.5 overflow-hidden rounded-xl border border-white/10 bg-[#121215] shadow-sm">
            {/* Integrated Table Toolbar */}
            <div className="flex flex-col gap-3 border-b border-white/10 bg-[#151519] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search input with Gradient Outline */}
              <div className="group relative w-full sm:w-64 rounded-xl p-[1px] bg-gradient-to-r from-white/15 via-purple-500/20 to-white/10 hover:from-[#7831d6]/50 hover:via-purple-400/50 hover:to-[#6366f1]/50 focus-within:from-[#8a3ff2] focus-within:via-[#a855f7] focus-within:to-[#6366f1] focus-within:shadow-[0_0_14px_rgba(120,49,214,0.35)] transition-all duration-200">
                <div className="relative flex items-center rounded-[11px] bg-[#16161a]">
                  <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400 group-focus-within:text-[#c4b5fd] transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search channels, users..."
                    className="h-9 w-full rounded-[11px] bg-transparent pl-9 pr-8 text-xs font-medium text-zinc-100 placeholder:text-zinc-500 outline-none focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Controls & Counts */}
              <div className="flex items-center gap-2.5">
                <div className="group relative rounded-xl p-[1px] bg-gradient-to-r from-white/15 via-purple-500/20 to-white/10 hover:from-[#7831d6]/50 hover:via-purple-400/50 hover:to-[#6366f1]/50 focus-within:from-[#8a3ff2] focus-within:via-[#a855f7] focus-within:to-[#6366f1] focus-within:shadow-[0_0_14px_rgba(120,49,214,0.35)] transition-all duration-200">
                  <div className="relative flex items-center rounded-[11px] bg-[#16161a]">
                    <Filter className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-400 group-focus-within:text-[#c4b5fd] transition-colors" />
                    <select
                      id="filter-platform"
                      value={filterPlatform}
                      onChange={(e) => setFilterPlatform(e.target.value)}
                      className="h-9 appearance-none rounded-[11px] bg-transparent pl-8 pr-7 text-xs font-semibold text-zinc-200 outline-none focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-[#18181b] text-zinc-100">All Platforms</option>
                      <option value="youtube" className="bg-[#18181b] text-zinc-100">YouTube</option>
                      <option value="instagram" className="bg-[#18181b] text-zinc-100">Instagram</option>
                      <option value="tiktok" className="bg-[#18181b] text-zinc-100">TikTok</option>
                      <option value="facebook" className="bg-[#18181b] text-zinc-100">Facebook</option>
                    </select>
                    <span className="pointer-events-none absolute right-2.5 text-[10px] text-zinc-400">▾</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-1">
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300">
                    {filteredAccountRows.length} {filteredAccountRows.length === 1 ? 'channel' : 'channels'}
                  </span>
                  {(searchQuery || filterPlatform !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterPlatform('all');
                      }}
                      className="text-xs font-semibold text-[#c4b5fd] hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[1.1fr_0.85fr_1.15fr_0.4fr_0.6fr_0.55fr_0.65fr] gap-3 border-b border-white/10 bg-black/50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-300">
                  <span>Channel</span>
                  <span>User</span>
                  <span>{selectedGraphDate ? `Activity (${selectedGraphDate})` : 'Activity'}</span>
                  <span>{selectedGraphDate ? `Posts (${selectedGraphDate})` : 'Posts'}</span>
                  <span>{selectedGraphDate ? `Views (${selectedGraphDate})` : `${selectedTimeLabel} views`}</span>
                  <span>Upcoming</span>
                  <span>{selectedGraphDate ? `Engagement (${selectedGraphDate})` : 'Engagement'}</span>
                </div>
              {(activeMetrics.accountRows || []).length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-zinc-400">
                  No publishing channels are associated with this campaign.
                </div>
              ) : filteredAccountRows.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-zinc-400">
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
                        className="grid cursor-pointer grid-cols-[1.1fr_0.85fr_1.15fr_0.4fr_0.6fr_0.55fr_0.65fr] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm transition hover:bg-white/[0.04] last:border-b-0 text-zinc-200"
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
                          <p className="m-0 truncate text-sm font-semibold text-zinc-100">{account.user?.name || 'Unknown user'}</p>
                          <p className="m-0 truncate text-xs text-zinc-400">{account.user?.email || 'No email'}</p>
                        </div>
                        <ActivityCell
                          account={account}
                          selectedTimeRange={selectedTimeRange}
                          selectedRange={selectedRange}
                          selectedGraphDate={selectedGraphDate}
                        />
                        <span className="text-sm font-medium text-zinc-200">
                          {selectedGraphDate ? (dateActivity?.count || 0) : (account[selectedRange.postsKey] || 0)}
                        </span>
                        <div>
                          {selectedGraphDate ? (
                            <span className="text-sm font-semibold text-zinc-100">
                              {numberFormat.format(dateActivity?.views || 0)}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-zinc-200">
                              {numberFormat.format(account[selectedRange.viewsKey] || 0)}
                              {(account.recentViewDelta || 0) > 0 && (
                                <span className="ml-1.5 text-xs font-semibold text-emerald-400">+{numberFormat.format(account.recentViewDelta)}</span>
                              )}
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${(account.upcomingPosts || 0) < 3 ? 'text-rose-400' : 'text-zinc-200'}`}>
                          {numberFormat.format(account.upcomingPosts || 0)}
                        </span>
                        <span className="text-sm text-zinc-300">
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
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
