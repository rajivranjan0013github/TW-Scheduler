import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import AccountQueueEditor from '../components/AccountQueueEditor';
import { withCampaignScope } from '../utils/campaignScope';

const getAccountKeys = (account, fallbackId) => [...new Set([
  fallbackId,
  account?._id,
  account?.socialAccountId?._id || account?.socialAccountId,
  account?.matchedAccountId?._id || account?.matchedAccountId,
  account?.campaignChannelId?._id || account?.campaignChannelId,
].map((value) => String(value || '')).filter(Boolean))];

const getAccountLabel = (account) => {
  const label = account?.username || account?.requestedHandle || account?.handle || account?.name || account?.displayName || 'Account';
  return String(label).replace(/^@/, '');
};

const getAccountAvatarUrl = (account) => (
  account?.avatarUrl
  || account?.profilePictureUrl
  || account?.profile_picture_url
  || account?.picture
  || ''
);

const getChannelAvatarSrc = (account) => {
  const avatarUrl = getAccountAvatarUrl(account).trim();
  if (!avatarUrl) return '';
  if (avatarUrl.startsWith('/')) return `${API_BASE_URL}${avatarUrl}`;

  try {
    const parsedUrl = new URL(avatarUrl);
    if (parsedUrl.hostname === 'media.theeasypost.com') {
      return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(avatarUrl)}`;
    }
  } catch {
    return `${API_BASE_URL}/${avatarUrl.replace(/^\/+/, '')}`;
  }
  return avatarUrl;
};

const ChannelAvatar = ({ account, className = 'h-8 w-8' }) => {
  const label = getAccountLabel(account);
  const avatarUrl = getChannelAvatarSrc(account);
  return (
    <span className={`${className} relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#eef2ff] text-[10px] font-bold uppercase text-[#4f46e5]`}>
      <span>{label.charAt(0) || 'C'}</span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={`${label} channel`}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
};

const getPostAccountKeys = (post) => [...new Set([
  ...(post?.socialAccountIds || []),
  ...(post?.campaignChannelIds || []),
].flatMap((value) => (
  typeof value === 'object'
    ? [value?._id, value?.socialAccountId?._id || value?.socialAccountId, value?.matchedAccountId]
    : [value]
)).map((value) => String(value || '')).filter(Boolean))];

const getDocumentIds = (values = []) => values
  .map((value) => (typeof value === 'object' ? value?._id : value))
  .map((value) => String(value || ''))
  .filter(Boolean);

const getStatusGroup = (post) => {
  if (['manual_ready', 'downloaded'].includes(post?.status)) return 'manual';
  if (['published', 'published_auto', 'posted_manual'].includes(post?.status)) return 'done';
  if (post?.status === 'failed') return 'failed';
  if (['paused', 'cancelled'].includes(post?.status)) return 'cancelled';
  return 'scheduled';
};

const getStatusLabel = (post) => ({
  manual_ready: 'Manual Ready',
  downloaded: 'Downloaded',
  posted_manual: 'Posted Manually',
  published_auto: 'Published Auto',
  published: 'Published',
  publishing: 'Publishing',
  paused: 'Paused',
  failed: 'Failed',
  cancelled: 'Cancelled',
}[post?.status] || 'Scheduled');

const QueueManagement = () => {
  const { accountId: routeAccountId } = useParams();
  const [searchParams] = useSearchParams();
  const selectedAccountId = searchParams.get('accountId') || routeAccountId || '';
  const parsedPage = Number.parseInt(searchParams.get('page') || '0', 10);
  const pageOffset = Number.isFinite(parsedPage) ? parsedPage : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPostIds, setSavingPostIds] = useState([]);
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const channelPickerRef = useRef(null);
  const dateWindow = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 7 + (pageOffset * 15));
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: `${start.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`,
    };
  }, [pageOffset]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('tw_token')}` };
      const accountsResponse = await fetch(`${API_BASE_URL}/api/accounts/publishing-channels${withCampaignScope()}`, {
        headers,
        cache: 'no-store',
      });
      const accountsData = await accountsResponse.json().catch(() => null);
      if (!accountsResponse.ok) {
        throw new Error(accountsData?.message || 'Unable to load the selected channel.');
      }

      const availableAccounts = Array.isArray(accountsData) ? accountsData : [];
      const queueParams = new URLSearchParams();
      queueParams.set('from', dateWindow.start.toISOString());
      queueParams.set('to', dateWindow.end.toISOString());
      queueParams.set('statuses', 'scheduled,manual_ready,downloaded,publishing,paused,posted_manual,published,published_auto,failed,cancelled');
      queueParams.set('includeManualPostedRange', 'true');
      const queueResponse = await fetch(`${API_BASE_URL}/api/scheduler${withCampaignScope(queueParams.toString())}`, {
        headers,
        cache: 'no-store',
      });
      const queueData = await queueResponse.json().catch(() => null);
      if (!queueResponse.ok) throw new Error(queueData?.message || 'Unable to load this queue.');

      setAccounts(availableAccounts);
      setPosts(Array.isArray(queueData) ? queueData : []);
    } catch (loadError) {
      setPosts([]);
      setError(loadError.message || 'Unable to load this queue.');
    } finally {
      setLoading(false);
    }
  }, [dateWindow.end, dateWindow.start]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadQueue]);

  const accountOptions = useMemo(() => accounts.map((candidate) => ({
    ...candidate,
    keys: getAccountKeys(candidate),
    label: getAccountLabel(candidate),
  })).sort((a, b) => a.label.localeCompare(b.label)), [accounts]);

  const selectedAccount = useMemo(() => accountOptions.find((candidate) => (
    candidate.keys.includes(String(selectedAccountId))
  )) || null, [accountOptions, selectedAccountId]);

  const filteredAccountOptions = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();
    if (!query) return accountOptions;
    return accountOptions.filter((candidate) => [
      candidate.label,
      candidate.platform,
      candidate.displayName,
      candidate.assignedHandlerName,
      candidate.assignedHandlerEmail,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [accountOptions, channelSearch]);

  useEffect(() => {
    if (!channelPickerOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!channelPickerRef.current?.contains(event.target)) setChannelPickerOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setChannelPickerOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [channelPickerOpen]);

  const items = useMemo(() => posts
    .filter((post) => {
      if (!selectedAccount) return !selectedAccountId;
      const postKeys = new Set(getPostAccountKeys(post));
      return selectedAccount.keys.some((key) => postKeys.has(String(key)));
    })
    .map((post) => {
      const postKeys = new Set(getPostAccountKeys(post));
      const postAccounts = accountOptions.filter((candidate) => candidate.keys.some((key) => postKeys.has(String(key))));
      return {
        post,
        statusGroup: getStatusGroup(post),
        scheduledDate: new Date(post.scheduledAt),
        mediaItem: post.mediaIds?.[0],
        mediaLabel: post.mediaIds?.[0]?.name || 'Scheduled media',
        folderLabel: post.mediaIds?.[0]?.folderId?.name || '',
        accountLabel: postAccounts.map((candidate) => candidate.label).join(', ') || 'Unknown channel',
      };
    })
    .sort((a, b) => new Date(a.post.scheduledAt) - new Date(b.post.scheduledAt))
    .map((item, index) => ({ ...item, queueIndex: index + 1 })), [accountOptions, posts, selectedAccount, selectedAccountId]);

  const savePatches = async (itemPatches) => {
    const selectedIds = itemPatches.map(({ item }) => item.post._id);
    setSavingPostIds((current) => [...new Set([...current, ...selectedIds])]);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/queue/bulk-update${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: JSON.stringify({
          updates: itemPatches.map(({ item, patch }) => ({ id: item.post._id, patch })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Unable to update the queue.');

      const savedById = new Map((data?.posts || []).map((post) => [String(post._id), post]));
      setPosts((current) => current.map((post) => savedById.get(String(post._id)) || post));
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return true;
    } catch (saveError) {
      setError(saveError.message || 'Unable to update the queue.');
      return false;
    } finally {
      setSavingPostIds((current) => current.filter((id) => !selectedIds.includes(id)));
    }
  };

  const handleBulkSave = async (selectedItems, updates = {}) => {
    const isTimeChange = Boolean(updates.scheduledAt || updates.reschedule);
    const selectedChannels = new Set(selectedItems.map((item) => item.accountLabel).filter(Boolean));
    if (
      isTimeChange
      && selectedChannels.size > 1
      && !window.confirm(`Reschedule posts across ${selectedChannels.size} different channels?`)
    ) {
      return false;
    }
    const startMs = updates.reschedule ? new Date(updates.reschedule.startAt).getTime() : null;
    const intervalMs = updates.reschedule ? Number(updates.reschedule.intervalHours) * 60 * 60 * 1000 : null;
    return savePatches(selectedItems.map((item, index) => {
      const patch = {};
      if (updates.status === 'resume') {
        patch.status = item.post.scheduleMode === 'manual' ? 'manual_ready' : 'scheduled';
      } else if (updates.status) {
        patch.status = updates.status;
      }
      if (updates.scheduledAt) patch.scheduledAt = updates.scheduledAt;
      if (Object.prototype.hasOwnProperty.call(updates, 'caption')) patch.caption = updates.caption;
      if (updates.reschedule) patch.scheduledAt = new Date(startMs + (index * intervalMs)).toISOString();
      return { item, patch };
    }));
  };

  const handleCaptionSave = async (selectedItems, captionsByPostId = {}) => savePatches(
    selectedItems
      .filter((item) => Object.prototype.hasOwnProperty.call(captionsByPostId, item.post._id))
      .map((item) => ({
        item,
        patch: { caption: captionsByPostId[item.post._id] ?? '' },
      }))
  );

  const handleDeletePost = async (item) => {
    setError('');
    setSavingPostIds((current) => [...new Set([...current, item.post._id])]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${item.post._id}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Unable to delete this post.');
      setPosts((current) => current.filter((post) => String(post._id) !== String(item.post._id)));
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return true;
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this post.');
      return false;
    } finally {
      setSavingPostIds((current) => current.filter((id) => id !== item.post._id));
    }
  };

  const handleMarkPublished = async (item) => {
    setError('');
    setSavingPostIds((current) => [...new Set([...current, item.post._id])]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${item.post._id}/manual-posted-override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: JSON.stringify({ queueManagementOverride: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Unable to confirm this post as published.');
      setPosts((current) => current.map((post) => (
        String(post._id) === String(item.post._id) ? { ...post, ...data } : post
      )));
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return true;
    } catch (publishError) {
      setError(publishError.message || 'Unable to confirm this post as published.');
      return false;
    } finally {
      setSavingPostIds((current) => current.filter((id) => id !== item.post._id));
    }
  };

  const handleMarkUnposted = async (item) => {
    setError('');
    setSavingPostIds((current) => [...new Set([...current, item.post._id])]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${item.post._id}/not-posted${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || 'Unable to mark this post as not posted.');
      setPosts((current) => current.map((post) => (
        String(post._id) === String(item.post._id) ? { ...post, ...data } : post
      )));
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      return true;
    } catch (unpostError) {
      setError(unpostError.message || 'Unable to mark this post as not posted.');
      return false;
    } finally {
      setSavingPostIds((current) => current.filter((id) => id !== item.post._id));
    }
  };

  const handleScheduleAgain = async (selectedItems, scheduledAt, intervalHours = 0) => {
    const itemsToSchedule = Array.isArray(selectedItems) ? selectedItems : [selectedItems];
    const selectedIds = itemsToSchedule.map((item) => item.post._id);
    setError('');
    setSavingPostIds((current) => [...new Set([...current, ...selectedIds])]);
    let successCount = 0;
    const failures = [];
    try {
      for (let index = 0; index < itemsToSchedule.length; index += 1) {
        const post = itemsToSchedule[index].post;
        const socialAccountIds = getDocumentIds(post.socialAccountIds);
        const campaignChannelIds = getDocumentIds(post.campaignChannelIds);
        const mediaIds = getDocumentIds(post.mediaIds);
        if (mediaIds.length === 0 || (socialAccountIds.length === 0 && campaignChannelIds.length === 0)) {
          failures.push('A posted record is missing its original video or channel.');
          continue;
        }

        const targetCount = Math.max(socialAccountIds.length, campaignChannelIds.length);
        const channelTargets = Array.from({ length: targetCount }, (_, targetIndex) => ({
          socialAccountId: socialAccountIds[targetIndex] || null,
          campaignChannelId: campaignChannelIds[targetIndex] || null,
        }));
        const nextScheduledAt = new Date(
          new Date(scheduledAt).getTime() + (index * Number(intervalHours || 0) * 60 * 60 * 1000)
        ).toISOString();
        const response = await fetch(`${API_BASE_URL}/api/scheduler${withCampaignScope()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
          },
          body: JSON.stringify({
            channelTargets,
            mediaIds,
            caption: post.caption || '',
            scheduledAt: nextScheduledAt,
            scheduleMode: post.scheduleMode || 'auto',
            platformSpecifics: post.platformSpecifics || {},
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          failures.push(data?.message || 'Unable to schedule one of the selected videos.');
          continue;
        }
        successCount += 1;
      }

      if (successCount > 0) {
        await loadQueue();
        void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
      if (failures.length > 0) {
        setError(`${successCount} of ${itemsToSchedule.length} videos were scheduled. ${failures[0]}`);
      }
      return { successCount, failedCount: failures.length };
    } catch (scheduleError) {
      setError(scheduleError.message || 'Unable to schedule this video again.');
      return { successCount, failedCount: itemsToSchedule.length - successCount };
    } finally {
      setSavingPostIds((current) => current.filter((id) => !selectedIds.includes(id)));
    }
  };

  const navigateToWindow = (nextPage, nextAccountId = selectedAccountId) => {
    const params = new URLSearchParams();
    if (nextAccountId) params.set('accountId', nextAccountId);
    if (nextPage !== 0) params.set('page', String(nextPage));
    const query = params.toString();
    navigate(query ? `/scheduler/queue?${query}` : '/scheduler/queue');
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-black text-white">
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-[#0a0a0a] px-4 py-2">
        <div ref={channelPickerRef} className="relative flex items-center gap-2 text-xs font-semibold text-zinc-400">
          <span>Channel</span>
          <button
            type="button"
            onClick={() => {
              setChannelPickerOpen((open) => !open);
              setChannelSearch('');
            }}
            className={`flex h-9 min-w-60 items-center justify-between gap-3 rounded-lg border px-3 text-left outline-none transition ${
              channelPickerOpen
                ? 'border-[#7831d6] bg-[#7831d6]/10 ring-2 ring-[#7831d6]/20 text-white'
                : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
            }`}
            aria-haspopup="listbox"
            aria-expanded={channelPickerOpen}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selectedAccount && <ChannelAvatar account={selectedAccount} className="h-6 w-6" />}
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-white">
                  {selectedAccount ? `@${selectedAccount.label}` : 'All channels'}
                </span>
                {selectedAccount && (
                  <span className="block truncate text-[9px] font-medium capitalize text-zinc-400">
                    {selectedAccount.platform || 'Social channel'}
                  </span>
                )}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${channelPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {channelPickerOpen && (
            <div className="absolute left-[58px] top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
              <div className="border-b border-white/10 p-2.5">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-black px-2.5 focus-within:border-[#7831d6]">
                  <Search className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                  <input
                    type="search"
                    value={channelSearch}
                    onChange={(event) => setChannelSearch(event.target.value)}
                    placeholder="Search channel, platform or handler"
                    className="min-w-0 flex-1 border-0 bg-transparent text-xs font-medium text-white outline-none placeholder:text-zinc-500"
                    autoFocus
                  />
                </div>
              </div>
              <div role="listbox" aria-label="Select channel" className="max-h-72 overflow-y-auto p-1.5">
                {!channelSearch.trim() && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedAccount}
                    onClick={() => {
                      setChannelPickerOpen(false);
                      navigateToWindow(pageOffset, '');
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-white/10"
                  >
                    <span className="text-xs font-semibold text-white">All channels</span>
                    {!selectedAccount && <Check className="h-4 w-4 text-[#c4b5fd]" />}
                  </button>
                )}
                {filteredAccountOptions.map((candidate) => {
                  const selected = selectedAccount?._id === candidate._id;
                  return (
                    <button
                      key={candidate._id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setChannelPickerOpen(false);
                        navigateToWindow(pageOffset, candidate._id);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left ${selected ? 'bg-[#7831d6]/20 text-[#c4b5fd]' : 'hover:bg-white/10 text-white'}`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <ChannelAvatar account={candidate} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-white">@{candidate.label}</span>
                          <span className="block truncate text-[10px] font-medium capitalize text-zinc-400">
                            {candidate.platform || 'Social channel'}
                            {candidate.assignedHandlerName ? ` · ${candidate.assignedHandlerName}` : ''}
                          </span>
                        </span>
                      </span>
                      {selected && <Check className="h-4 w-4 flex-shrink-0 text-[#c4b5fd]" />}
                    </button>
                  );
                })}
                {filteredAccountOptions.length === 0 && (
                  <p className="m-0 px-3 py-6 text-center text-xs font-medium text-zinc-500">No matching channels</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigateToWindow(pageOffset - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            title="Previous 15 days"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigateToWindow(0)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold ${
              pageOffset === 0
                ? 'border-[#7831d6]/40 bg-[#7831d6]/20 text-[#c4b5fd]'
                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
            }`}
            title="Show seven days before and after today"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {dateWindow.label}
          </button>
          <button
            type="button"
            onClick={() => navigateToWindow(pageOffset + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            title="Next 15 days"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <AccountQueueEditor
        title=""
        showAccountLabel={false}
        showChannelColumn={!selectedAccount}
        account={selectedAccount ? { ...selectedAccount, label: selectedAccount.label } : { label: 'All channels' }}
        items={items}
        loading={loading}
        savingPostIds={savingPostIds}
        onBulkSave={handleBulkSave}
        onBulkCaptionSave={handleCaptionSave}
        onDeletePost={handleDeletePost}
        onMarkPublished={handleMarkPublished}
        onMarkUnposted={handleMarkUnposted}
        onScheduleAgain={handleScheduleAgain}
        onClose={() => navigate('/scheduler')}
        getStatusLabel={getStatusLabel}
      />
    </div>
  );
};

export default QueueManagement;
