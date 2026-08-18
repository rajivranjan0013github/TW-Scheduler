import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarPlus, Check, Clock, Info, Loader2, MessageSquareText, MoreVertical, PauseCircle, PlayCircle, Save, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getMediaUrl } from '../utils/mediaUrls';
import LoadingVideoPreview from './LoadingVideoPreview';
import PlatformIcon from './PlatformIcon';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

const QueueMediaPreview = ({ item }) => {
  const url = getAssetUrl(item?.url);
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f1f3f4] text-[10px] font-semibold text-[#9aa0a6]">
        Media
      </div>
    );
  }

  if (item?.type === 'video') {
    return (
      <LoadingVideoPreview
        src={url}
        videoClassName="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        crossOrigin="anonymous"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return <img src={url} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" alt="" />;
};

const formatQueueScheduleParts = (value) => {
  if (!value) {
    return { date: 'Date not set', time: 'Time not set' };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: 'Date not set', time: 'Time not set' };
  }
  return {
    date: date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  };
};

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getDetectedIntervalHours = (items = []) => {
  const scheduledTimes = items
    .map((item) => new Date(item?.post?.scheduledAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  if (scheduledTimes.length < 2) return '';

  for (let index = 1; index < scheduledTimes.length; index += 1) {
    const diffHours = (scheduledTimes[index] - scheduledTimes[index - 1]) / (60 * 60 * 1000);
    if (diffHours > 0) {
      return String(Math.round(diffHours * 100) / 100);
    }
  }

  return '';
};

const formatPreviewDateTime = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
};

const editableQueueStatuses = new Set(['scheduled', 'manual_ready', 'downloaded', 'paused']);
const postsLeftStatuses = new Set(['scheduled', 'manual_ready', 'downloaded', 'publishing', 'paused']);

const getPostedAt = (post) => post?.manualPostedAt || post?.publishedAt || post?.postedAt || null;
const getCaptionPreview = (caption) => {
  const characters = Array.from(caption || 'No caption');
  const preview = characters.slice(0, 20).join('');
  return characters.length > 20 ? `${preview}...` : preview;
};

const getQueueStatusMeta = (statusGroup) => {
  switch (statusGroup) {
    case 'done':
      return {
        icon: Check,
        className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
      };
    case 'manual':
      return {
        icon: Clock,
        className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
      };
    case 'failed':
      return {
        icon: X,
        className: 'border-rose-500/30 bg-rose-500/15 text-rose-400',
      };
    case 'cancelled':
      return {
        icon: PauseCircle,
        className: 'border-zinc-700 bg-zinc-800 text-zinc-400',
      };
    default:
      return {
        icon: Clock,
        className: 'border-[#7831d6]/30 bg-[#7831d6]/20 text-[#c4b5fd]',
      };
  }
};

const getReadOnlyReason = (post) => ({
  publishing: 'Publishing — editing is disabled',
  published: 'Published — read only',
  published_auto: 'Published — read only',
  posted_manual: 'Posted manually — read only',
  failed: 'Failed — review the publishing error',
  cancelled: 'Cancelled — read only',
}[post?.status] || 'Read only');

const AccountQueueEditor = ({
  title = 'Schedule Queue',
  showAccountLabel = true,
  showChannelColumn = true,
  account,
  items = [],
  loading = false,
  savingPostIds = [],
  deletingPostIds = [],
  onBulkSave,
  onBulkCaptionSave,
  onDeletePost,
  onMarkPublished,
  onMarkUnposted,
  onScheduleAgain,
  onClose,
  getStatusLabel,
}) => {
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [selectedRepeatPostIds, setSelectedRepeatPostIds] = useState([]);
  const [showCaptionEditor, setShowCaptionEditor] = useState(false);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleIntervalHours, setRescheduleIntervalHours] = useState('10');
  const [editingItem, setEditingItem] = useState(null);
  const [singleCaption, setSingleCaption] = useState('');
  const [singleScheduledAt, setSingleScheduledAt] = useState('');
  const [notice, setNotice] = useState('');
  const [actionMenu, setActionMenu] = useState(null);
  const [scheduleAgainItems, setScheduleAgainItems] = useState([]);
  const [scheduleAgainAt, setScheduleAgainAt] = useState('');
  const [scheduleAgainIntervalHours, setScheduleAgainIntervalHours] = useState('1');
  const selectableItems = useMemo(() => (
    items.filter((item) => editableQueueStatuses.has(item.post.status))
  ), [items]);
  const selectedItems = useMemo(() => (
    selectableItems.filter((item) => selectedPostIds.includes(item.post._id))
  ), [selectableItems, selectedPostIds]);
  const repeatSelectableItems = useMemo(() => (
    items.filter((item) => item.statusGroup === 'done')
  ), [items]);
  const selectedRepeatItems = useMemo(() => (
    repeatSelectableItems.filter((item) => selectedRepeatPostIds.includes(item.post._id))
  ), [repeatSelectableItems, selectedRepeatPostIds]);
  const selectedCount = selectedItems.length;
  const selectedRepeatCount = selectedRepeatItems.length;
  const canDeleteSelectedRepeat = selectedRepeatCount > 0
    && selectedRepeatItems.every((item) => item.post.status === 'posted_manual');
  const scheduleAgainPrimaryItem = scheduleAgainItems[0] || null;
  const postsLeftCount = useMemo(() => (
    items.filter((item) => postsLeftStatuses.has(item.post.status)).length
  ), [items]);
  const selectedSaving = selectedItems.some((item) => savingPostIds.includes(item.post._id));
  const selectedDeleting = selectedItems.some((item) => deletingPostIds.includes(item.post._id));
  const bulkBusy = selectedSaving || selectedDeleting;
  const repeatBusy = selectedRepeatItems.some((item) => savingPostIds.includes(item.post._id));
  const scheduleAgainBusy = scheduleAgainItems.some((item) => savingPostIds.includes(item.post._id));
  const allVisibleSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;
  const hasUnpausedSelection = selectedItems.some((item) => item.post.status !== 'paused');
  const allSelectedPaused = selectedCount > 0 && selectedItems.every((item) => item.post.status === 'paused');
  const hasCaptionChanges = selectedItems.some((item) => (
    (captionDrafts[item.post._id] ?? item.post.caption ?? '') !== (item.post.caption ?? '')
  ));
  const lastPostPreviewDate = useMemo(() => {
    if (selectedCount === 0) return null;
    const startTime = new Date(rescheduleStart).getTime();
    const intervalHours = Number(rescheduleIntervalHours);
    if (!Number.isFinite(startTime) || !Number.isFinite(intervalHours) || intervalHours <= 0) return null;
    return new Date(startTime + ((selectedCount - 1) * intervalHours * 60 * 60 * 1000));
  }, [rescheduleIntervalHours, rescheduleStart, selectedCount]);
  const scheduleAgainLastDate = useMemo(() => {
    if (scheduleAgainItems.length === 0) return null;
    const startTime = new Date(scheduleAgainAt).getTime();
    const intervalHours = Number(scheduleAgainIntervalHours);
    if (!Number.isFinite(startTime) || !Number.isFinite(intervalHours) || intervalHours <= 0) return null;
    return new Date(startTime + ((scheduleAgainItems.length - 1) * intervalHours * 60 * 60 * 1000));
  }, [scheduleAgainAt, scheduleAgainIntervalHours, scheduleAgainItems.length]);
  const initializeCaptionDrafts = (itemsToDraft = selectedItems) => {
    setCaptionDrafts((current) => {
      const next = { ...current };
      itemsToDraft.forEach((item) => {
        const postId = item.post._id;
        next[postId] = current[postId] ?? item.post.caption ?? '';
      });
      return next;
    });
  };

  const toggleSelectedPost = (postId) => {
    const selectedItem = selectableItems.find((item) => item.post._id === postId);
    if (!selectedItem) return;
    const isSelected = selectedPostIds.includes(postId);
    const nextSelectedPostIds = isSelected
      ? selectedPostIds.filter((id) => id !== postId)
      : [...selectedPostIds, postId];
    setSelectedPostIds(nextSelectedPostIds);

    if (nextSelectedPostIds.length === 0) {
      setRescheduleStart('');
      setShowCaptionEditor(false);
      setShowTimeEditor(false);
      return;
    }
    if (!isSelected && selectedPostIds.length === 0) {
      setRescheduleStart(toDateTimeLocalValue(selectedItem?.post?.scheduledAt));
    }
    if (!isSelected && showCaptionEditor) {
      if (selectedItem) initializeCaptionDrafts([selectedItem]);
    }
  };

  const toggleRepeatPost = (postId) => {
    if (!repeatSelectableItems.some((item) => item.post._id === postId)) return;
    setSelectedRepeatPostIds((current) => (
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    ));
  };

  const selectAllPosts = () => {
    if (selectableItems.length === 0) return;
    setSelectedPostIds(selectableItems.map((item) => item.post._id));
    setRescheduleStart(toDateTimeLocalValue(selectableItems[0]?.post?.scheduledAt));
    setRescheduleIntervalHours(getDetectedIntervalHours(selectableItems) || rescheduleIntervalHours);
  };

  const clearSelection = () => {
    setSelectedPostIds([]);
    setSelectedRepeatPostIds([]);
    setRescheduleStart('');
    setShowCaptionEditor(false);
    setShowTimeEditor(false);
  };

  const saveBulkChanges = async (updates) => {
    if (!selectedCount || !onBulkSave) return;
    const saved = await onBulkSave(selectedItems, updates);
    if (saved) {
      setNotice(`${selectedCount} post${selectedCount === 1 ? '' : 's'} updated.`);
      clearSelection();
    }
  };

  const openTimeEditor = () => {
    if (selectedCount === 0) return;
    setRescheduleStart((current) => current || toDateTimeLocalValue(selectedItems[0]?.post?.scheduledAt));
    const detectedInterval = getDetectedIntervalHours(selectedItems);
    if (detectedInterval) {
      setRescheduleIntervalHours(detectedInterval);
    }
    setShowCaptionEditor(false);
    setShowTimeEditor(true);
  };

  const openPostEditor = (item) => {
    setActionMenu(null);
    setEditingItem(item);
    setSingleCaption(item.post.caption || '');
    setSingleScheduledAt(toDateTimeLocalValue(item.post.scheduledAt));
    setShowCaptionEditor(false);
    setShowTimeEditor(false);
  };

  const openActionMenu = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 152;
    const canMarkPublished = editableQueueStatuses.has(item.post.status)
      && ['manual', 'hybrid'].includes(item.post.scheduleMode);
    const isManuallyPosted = item.post.status === 'posted_manual';
    const canMarkUnposted = isManuallyPosted && item.post.scheduleMode === 'manual';
    const canMarkNotDownloaded = item.post.status === 'downloaded'
      && item.post.scheduleMode === 'manual';
    const isCompleted = item.statusGroup === 'done';
    let actionCount = 1;
    if (editableQueueStatuses.has(item.post.status)) actionCount += 1;
    if (canMarkPublished) actionCount += 1;
    if (canMarkNotDownloaded && onMarkUnposted) actionCount += 1;
    if (canMarkUnposted && onMarkUnposted) actionCount += 1;
    if (isCompleted && onScheduleAgain) actionCount += 1;
    if ((editableQueueStatuses.has(item.post.status) || isManuallyPosted) && onDeletePost) actionCount += 1;
    const menuHeight = (actionCount * 36) + 12;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = rect.bottom + menuHeight + 8 <= window.innerHeight
      ? rect.bottom + 4
      : Math.max(8, rect.top - menuHeight - 4);
    setActionMenu({ item, left, top });
  };

  useEffect(() => {
    if (!actionMenu && !editingItem && scheduleAgainItems.length === 0) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setActionMenu(null);
      setEditingItem(null);
      setScheduleAgainItems([]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionMenu, editingItem, scheduleAgainItems.length]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const openScheduleAgain = (selected) => {
    const selectedItemsToRepeat = Array.isArray(selected) ? selected : [selected];
    if (selectedItemsToRepeat.length === 0) return;
    const nextTime = new Date(Date.now() + (60 * 60 * 1000));
    nextTime.setMinutes(Math.ceil(nextTime.getMinutes() / 15) * 15, 0, 0);
    setActionMenu(null);
    setEditingItem(null);
    setScheduleAgainItems(selectedItemsToRepeat);
    setScheduleAgainAt(toDateTimeLocalValue(nextTime));
    setScheduleAgainIntervalHours('1');
  };

  const schedulePostAgain = async () => {
    if (scheduleAgainItems.length === 0 || !onScheduleAgain) return;
    const scheduledDate = new Date(scheduleAgainAt);
    if (!scheduleAgainAt || Number.isNaN(scheduledDate.getTime())) {
      window.alert('Choose a valid date and time.');
      return;
    }
    if (scheduledDate.getTime() <= Date.now()) {
      window.alert('Choose a future date and time to prevent immediate duplicate publishing.');
      return;
    }
    const intervalHours = Number(scheduleAgainIntervalHours);
    if (scheduleAgainItems.length > 1 && (!Number.isFinite(intervalHours) || intervalHours <= 0)) {
      window.alert('Enter a valid interval greater than zero.');
      return;
    }
    const scheduled = await onScheduleAgain(
      scheduleAgainItems,
      scheduledDate.toISOString(),
      scheduleAgainItems.length > 1 ? intervalHours : 0
    );
    const successCount = scheduled === true
      ? scheduleAgainItems.length
      : Number(scheduled?.successCount || 0);
    if (successCount > 0) {
      setNotice(`${successCount} new ${successCount === 1 ? 'copy was' : 'copies were'} added to the schedule queue.`);
      clearSelection();
      setScheduleAgainItems([]);
    }
  };

  const saveSinglePost = async () => {
    if (!editingItem || !onBulkSave) return;
    const patch = {};
    if (singleCaption !== (editingItem.post.caption || '')) patch.caption = singleCaption;
    if (singleScheduledAt !== toDateTimeLocalValue(editingItem.post.scheduledAt)) {
      const nextDate = new Date(singleScheduledAt);
      if (!singleScheduledAt || Number.isNaN(nextDate.getTime())) {
        window.alert('Choose a valid scheduled date and time.');
        return;
      }
      patch.scheduledAt = nextDate.toISOString();
    }
    if (Object.keys(patch).length === 0) {
      setEditingItem(null);
      return;
    }
    const saved = await onBulkSave([editingItem], patch);
    if (saved) {
      setNotice('Post updated successfully.');
      setEditingItem(null);
      clearSelection();
    }
  };

  const changePostStatus = async (item, status) => {
    if (!item || !onBulkSave) return;
    setActionMenu(null);
    const saved = await onBulkSave([item], { status });
    if (saved) {
      setNotice(status === 'paused' ? 'Post paused.' : 'Post resumed.');
      clearSelection();
    }
  };

  const deletePost = async (item) => {
    if (!item || !onDeletePost) return;
    setActionMenu(null);
    const confirmation = item.post.status === 'posted_manual'
      ? 'Delete this queue record? The live social-media post will not be deleted.'
      : 'Delete this scheduled post? This cannot be undone.';
    if (!window.confirm(confirmation)) return;
    const deleted = await onDeletePost(item);
    if (deleted) {
      setNotice(item.post.status === 'posted_manual'
        ? 'Posted queue record deleted.'
        : 'Scheduled post deleted.');
      clearSelection();
    }
  };

  const deleteSelectedPosts = async (itemsToDelete) => {
    if (!onDeletePost || itemsToDelete.length === 0) return;
    const manuallyPostedOnly = itemsToDelete.every((item) => item.post.status === 'posted_manual');
    const confirmation = manuallyPostedOnly
      ? `Delete ${itemsToDelete.length} posted queue records? Live social-media posts will not be deleted.`
      : `Delete ${itemsToDelete.length} selected scheduled posts? This cannot be undone.`;
    if (!window.confirm(confirmation)) return;

    const failedIds = [];
    let deletedCount = 0;
    for (const item of itemsToDelete) {
      const deleted = await onDeletePost(item);
      if (deleted) deletedCount += 1;
      else failedIds.push(item.post._id);
    }

    if (deletedCount > 0) {
      setNotice(`${deletedCount} ${manuallyPostedOnly ? 'posted queue record' : 'scheduled post'}${deletedCount === 1 ? '' : 's'} deleted.`);
    }
    if (manuallyPostedOnly) setSelectedRepeatPostIds(failedIds);
    else setSelectedPostIds(failedIds);
    if (failedIds.length === 0) clearSelection();
  };

  const markPostPublished = async (item) => {
    if (!item || !editableQueueStatuses.has(item.post.status) || !onMarkPublished) return;
    if (!window.confirm('Confirm that this post is already live? This records your manual confirmation without requiring a download or provider detection.')) {
      setActionMenu(null);
      return;
    }
    const published = await onMarkPublished(item);
    setActionMenu(null);
    if (published) {
      setNotice('Post marked as published.');
      clearSelection();
    }
  };

  const markPostUnposted = async (item) => {
    if (!item || item.post.scheduleMode !== 'manual' || !onMarkUnposted) return;
    setActionMenu(null);
    if (!window.confirm('Mark this queue item as not posted? This will not remove the live social-media post.')) return;
    const updated = await onMarkUnposted(item);
    if (updated) {
      setNotice('Post returned to the active queue.');
      clearSelection();
    }
  };

  const markPostNotDownloaded = async (item) => {
    if (!item || item.post.status !== 'downloaded' || item.post.scheduleMode !== 'manual' || !onMarkUnposted) return;
    setActionMenu(null);
    if (!window.confirm('Mark this post as not downloaded and return it to Manual Ready?')) return;
    const updated = await onMarkUnposted(item);
    if (updated) {
      setNotice('Post marked as not downloaded and returned to Manual Ready.');
      clearSelection();
    }
  };

  const saveCaptionChanges = async () => {
    if (!selectedCount || !onBulkCaptionSave || !hasCaptionChanges) return;
    const changesByPostId = {};
    selectedItems.forEach((item) => {
      const postId = item.post._id;
      const nextCaption = captionDrafts[postId] ?? item.post.caption ?? '';
      if (nextCaption !== (item.post.caption ?? '')) {
        changesByPostId[postId] = nextCaption;
      }
    });
    const saved = await onBulkCaptionSave(selectedItems, changesByPostId);
    if (saved) {
      setNotice(`${Object.keys(changesByPostId).length} caption${Object.keys(changesByPostId).length === 1 ? '' : 's'} updated.`);
      clearSelection();
    }
  };

  const saveIntervalChanges = async () => {
    if (!selectedCount || !onBulkSave) return;
    const startDate = new Date(rescheduleStart);
    if (!rescheduleStart || Number.isNaN(startDate.getTime())) {
      window.alert('Choose a valid start date and time.');
      return;
    }
    if (selectedCount === 1) {
      const saved = await onBulkSave(selectedItems, {
        scheduledAt: startDate.toISOString(),
      });
      if (saved) {
        setNotice('Schedule time updated.');
        clearSelection();
      }
      return;
    }

    const intervalHours = Number(rescheduleIntervalHours);
    if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
      window.alert('Enter an interval greater than 0 hours.');
      return;
    }

    const saved = await onBulkSave(selectedItems, {
      reschedule: {
        startAt: startDate.toISOString(),
        intervalHours,
      },
    });
    if (saved) {
      setNotice(`${selectedCount} posts rescheduled.`);
      clearSelection();
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black text-white">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0a0a0a] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Back to calendar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <PlatformIcon platform={account?.platform} className="h-5 w-5 flex-shrink-0" showFallback />
          {title && (
            <h3 className="m-0 truncate text-base font-bold tracking-tight text-white">
              {title}
            </h3>
          )}
          {showAccountLabel && (
            <span className="truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-zinc-300">
              {account?.label === 'All channels' ? 'All channels' : `@${account?.label || 'account'}`}
            </span>
          )}
          {account?.label !== 'All channels' && (
            <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1">
              <p className="m-0 truncate text-[10px] font-semibold text-zinc-200">
                {account?.assignedHandlerName || 'Unassigned handler'}
              </p>
              <p className="m-0 mt-0.5 truncate text-[9px] text-zinc-400">
                {account?.assignedHandlerEmail || 'No email assigned'}
              </p>
            </div>
          )}
          <div className="flex-shrink-0 rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/15 px-2.5 py-1 text-center">
            <p className="m-0 text-xs font-bold text-[#c4b5fd]">{postsLeftCount}</p>
            <p className="m-0 mt-0.5 text-[9px] font-semibold text-[#c4b5fd]">
              post{postsLeftCount === 1 ? '' : 's'} left to post
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          {selectableItems.length > 0 && (
            <button
              type="button"
              onClick={allVisibleSelected ? clearSelection : selectAllPosts}
              disabled={bulkBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {allVisibleSelected ? 'Clear' : 'Select all'}
            </button>
          )}
          {selectedRepeatCount > 0 && onScheduleAgain && (
            <button
              type="button"
              onClick={() => openScheduleAgain(selectedRepeatItems)}
              disabled={repeatBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#7831d6] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Schedule again ({selectedRepeatCount})
            </button>
          )}
          {canDeleteSelectedRepeat && onDeletePost && (
            <button
              type="button"
              onClick={() => deleteSelectedPosts(selectedRepeatItems)}
              disabled={repeatBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/25 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedRepeatCount})
            </button>
          )}
          {selectedCount > 0 && (
            <div className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#7831d6]/40 bg-[#7831d6]/20 px-2.5 text-[11px] font-bold text-[#c4b5fd]">
              <Check className="h-3.5 w-3.5" />
              {selectedCount} selected
            </div>
          )}
          {selectedCount > 0 && hasUnpausedSelection && (
            <button
              type="button"
              onClick={() => saveBulkChanges({ status: 'paused' })}
              disabled={bulkBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Pause
            </button>
          )}
          {allSelectedPaused && (
            <button
              type="button"
              onClick={() => saveBulkChanges({ status: 'resume' })}
              disabled={bulkBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Resume
            </button>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={openTimeEditor}
              disabled={bulkBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
              Edit time
            </button>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                initializeCaptionDrafts();
                setShowTimeEditor(false);
                setShowCaptionEditor(true);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              Edit caption
            </button>
          )}
          {selectedCount > 0 && onDeletePost && (
            <button
              type="button"
              onClick={() => deleteSelectedPosts(selectedItems)}
              disabled={bulkBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/25 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedCount})
            </button>
          )}
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-300 shadow-sm">
            {loading ? 'Loading' : `${items.length} posts`}
          </div>
        </div>
      </div>
      {notice && (
        <div className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-400/70 hover:text-emerald-300" aria-label="Dismiss message">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {actionMenu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              if (!savingPostIds.includes(actionMenu.item.post._id)) setActionMenu(null);
            }}
            aria-label="Close post actions"
          />
          <div
            role="menu"
            className="fixed z-50 w-[160px] overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a] py-1 shadow-2xl"
            style={{ left: actionMenu.left, top: actionMenu.top }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => openPostEditor(actionMenu.item)}
              className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 hover:text-white"
            >
              {editableQueueStatuses.has(actionMenu.item.post.status) ? 'Edit post' : 'View details'}
            </button>
            {actionMenu.item.statusGroup === 'done' && onScheduleAgain && (
              <button
                type="button"
                role="menuitem"
                onClick={() => openScheduleAgain(actionMenu.item)}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-[#c4b5fd] hover:bg-white/10"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Schedule again
              </button>
            )}
            {editableQueueStatuses.has(actionMenu.item.post.status) && (
              <button
                type="button"
                role="menuitem"
                onClick={() => changePostStatus(
                  actionMenu.item,
                  actionMenu.item.post.status === 'paused' ? 'resume' : 'paused'
                )}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-zinc-200 hover:bg-white/10 hover:text-white"
              >
                {actionMenu.item.post.status === 'paused' ? (
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <PauseCircle className="h-3.5 w-3.5 text-amber-300" />
                )}
                {actionMenu.item.post.status === 'paused' ? 'Resume post' : 'Pause post'}
              </button>
            )}
            {editableQueueStatuses.has(actionMenu.item.post.status)
              && ['manual', 'hybrid'].includes(actionMenu.item.post.scheduleMode)
              && onMarkPublished && (
              <button
                type="button"
                role="menuitem"
                onClick={() => markPostPublished(actionMenu.item)}
                disabled={savingPostIds.includes(actionMenu.item.post._id)}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-emerald-400 hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
              >
                {savingPostIds.includes(actionMenu.item.post._id) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {savingPostIds.includes(actionMenu.item.post._id) ? 'Marking…' : 'Mark as published'}
              </button>
            )}
            {actionMenu.item.post.status === 'downloaded'
              && actionMenu.item.post.scheduleMode === 'manual'
              && onMarkUnposted && (
              <button
                type="button"
                role="menuitem"
                onClick={() => markPostNotDownloaded(actionMenu.item)}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-white/10"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Mark as not downloaded
              </button>
            )}
            {actionMenu.item.post.status === 'posted_manual'
              && actionMenu.item.post.scheduleMode === 'manual'
              && onMarkUnposted && (
              <button
                type="button"
                role="menuitem"
                onClick={() => markPostUnposted(actionMenu.item)}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-white/10"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Mark as not posted
              </button>
            )}
            {(editableQueueStatuses.has(actionMenu.item.post.status) || actionMenu.item.post.status === 'posted_manual') && onDeletePost && (
              <button
                type="button"
                role="menuitem"
                onClick={() => deletePost(actionMenu.item)}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-white/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete post
              </button>
            )}
          </div>
        </>
      )}
      {showTimeEditor && selectedCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <h4 className="m-0 text-sm font-bold text-white">Bulk edit post time</h4>
                <p className="m-0 mt-0.5 text-[11px] font-semibold text-zinc-400">
                  {selectedCount === 1
                    ? 'Choose the new date and time for this post.'
                    : `${selectedCount} selected posts will be rescheduled in queue order.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeEditor(false)}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
                title="Close time editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-400">Start date and time</span>
                <input
                  type="datetime-local"
                  value={rescheduleStart}
                  onChange={(event) => setRescheduleStart(event.target.value)}
                  disabled={bulkBusy}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20 disabled:opacity-60"
                />
              </label>
              {selectedCount > 1 && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-400">Interval between posts</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={rescheduleIntervalHours}
                        onChange={(event) => setRescheduleIntervalHours(event.target.value)}
                        disabled={bulkBusy}
                        className="h-10 w-28 rounded-lg border border-white/15 bg-black px-3 text-sm font-bold text-white outline-none transition focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20 disabled:opacity-60"
                      />
                      <span className="text-sm font-semibold text-zinc-400">hours</span>
                    </div>
                  </label>
                  <div className="rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/10 px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">Preview only</span>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-zinc-300">Last post date</span>
                      <span className="text-right text-xs font-bold text-white">
                        {formatPreviewDateTime(lastPostPreviewDate)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowTimeEditor(false)}
                className="h-9 rounded-md px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveIntervalChanges}
                disabled={bulkBusy}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#7831d6] px-3 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {bulkBusy ? 'Saving' : 'Apply time'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1 overflow-auto p-4">
            <div className="mx-auto max-w-[1500px]">
              {loading ? (
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0a0a0a] text-zinc-400 shadow-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-[#c4b5fd]" />
                  <p className="m-0 text-sm font-semibold text-white">Loading schedule queue...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-[#0a0a0a] text-center shadow-sm">
                  <Clock className="h-8 w-8 text-zinc-600" />
                  <p className="m-0 text-sm font-semibold text-zinc-300">No scheduled or posted content in this queue.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-sm">
                  <div className="divide-y divide-white/10 md:hidden">
                    {items.map((item) => {
                      const editable = editableQueueStatuses.has(item.post.status);
                      const isPosted = item.statusGroup === 'done';
                      const isSelected = selectedPostIds.includes(item.post._id);
                      const isRepeatSelected = selectedRepeatPostIds.includes(item.post._id);
                      const scheduleParts = formatQueueScheduleParts(item.post.scheduledAt);
                      const postedAt = getPostedAt(item.post);
                      const statusMeta = getQueueStatusMeta(item.statusGroup);
                      const StatusIcon = statusMeta.icon;
                      return (
                        <article key={`mobile-${item.post._id}`} className={`p-3 ${isPosted ? 'bg-emerald-950/25' : item.post.status === 'failed' ? 'bg-rose-950/25' : 'bg-[#0a0a0a]'}`}>
                          <div className="flex items-start gap-3">
                            {(editable || (isPosted && onScheduleAgain)) && (
                              <input
                                type="checkbox"
                                checked={editable ? isSelected : isRepeatSelected}
                                onChange={() => (editable
                                  ? toggleSelectedPost(item.post._id)
                                  : toggleRepeatPost(item.post._id))}
                                disabled={editable ? bulkBusy : repeatBusy}
                                aria-label={isPosted ? `Select posted video ${item.queueIndex} to schedule again` : `Select post ${item.queueIndex}`}
                                className="mt-4 h-4 w-4 flex-shrink-0 accent-[#7831d6]"
                              />
                            )}
                            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                              <QueueMediaPreview item={item.mediaItem} />
                            </div>
                            <div className="min-w-0 flex-1">
                              {showChannelColumn && <p className="m-0 truncate text-[10px] font-bold text-[#c4b5fd]">@{item.accountLabel}</p>}
                              <p className="m-0 mt-0.5 truncate text-xs font-semibold text-white">{getCaptionPreview(item.post.caption)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${statusMeta.className}`}>
                                  <StatusIcon className="h-2.5 w-2.5" />
                                  {getStatusLabel(item.post)}
                                </span>
                                <span className="text-[9px] font-medium text-zinc-400">{scheduleParts.date} {scheduleParts.time}</span>
                              </div>
                              {postedAt && <p className="m-0 mt-1 text-[9px] font-semibold text-emerald-400">Posted {formatPreviewDateTime(postedAt)}</p>}
                            </div>
                            {(!isPosted || item.post.status === 'posted_manual' || onScheduleAgain) && (
                              <button
                                type="button"
                                onClick={(event) => openActionMenu(event, item)}
                                disabled={editable && bulkBusy}
                                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                                aria-label="Post actions"
                                aria-haspopup="menu"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-black/90 backdrop-blur-xs border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                        <tr>
                          <th className="w-10 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={allVisibleSelected ? clearSelection : selectAllPosts}
                              disabled={selectableItems.length === 0 || bulkBusy}
                              aria-label="Select all editable posts"
                              className="h-3.5 w-3.5 accent-[#7831d6]"
                            />
                          </th>
                          <th className="px-3 py-2.5">Media</th>
                          {showChannelColumn && <th className="px-3 py-2.5">Channel</th>}
                          <th className="px-3 py-2.5">Caption</th>
                          <th className="px-3 py-2.5">Scheduled time</th>
                          <th className="px-3 py-2.5">Posted time</th>
                          <th className="px-3 py-2.5">Mode</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const postId = item.post._id;
                          const editable = editableQueueStatuses.has(item.post.status);
                          const isSelected = selectedPostIds.includes(postId);
                          const isPosted = item.statusGroup === 'done';
                          const isRepeatSelected = selectedRepeatPostIds.includes(postId);
                          const scheduleParts = formatQueueScheduleParts(item.post.scheduledAt);
                          const postedAt = getPostedAt(item.post);
                          const postedParts = postedAt ? formatQueueScheduleParts(postedAt) : null;
                          const statusMeta = getQueueStatusMeta(item.statusGroup);
                          const StatusIcon = statusMeta.icon;

                          return (
                            <tr
                              key={postId}
                              className={`border-t border-white/10 transition ${
                                isPosted
                                  ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                                  : item.post.status === 'failed'
                                    ? 'bg-rose-950/20 hover:bg-rose-950/30'
                                    : item.post.status === 'paused'
                                      ? 'bg-zinc-900/40 text-zinc-400 hover:bg-zinc-900/60'
                                      : 'bg-[#0a0a0a] hover:bg-white/[0.06]'
                              } ${(isSelected || isRepeatSelected) ? 'bg-[#7831d6]/15 hover:bg-[#7831d6]/20 shadow-[inset_3px_0_0_#7831d6]' : ''}`}
                            >
                              <td className="px-3 py-2.5">
                                {(editable || (isPosted && onScheduleAgain)) ? (
                                  <input
                                    type="checkbox"
                                    checked={editable ? isSelected : isRepeatSelected}
                                    onChange={() => (editable
                                      ? toggleSelectedPost(postId)
                                      : toggleRepeatPost(postId))}
                                    disabled={editable ? bulkBusy : repeatBusy}
                                    aria-label={isPosted ? `Select posted video ${item.queueIndex} to schedule again` : `Select post ${item.queueIndex}`}
                                    className="h-3.5 w-3.5 accent-[#7831d6]"
                                  />
                                ) : (
                                  <Check className={`h-4 w-4 ${isPosted ? 'text-emerald-400' : 'text-zinc-600'}`} />
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="h-11 w-11 overflow-hidden rounded-md border border-white/10 bg-black">
                                  <QueueMediaPreview item={item.mediaItem} />
                                </div>
                              </td>
                              {showChannelColumn && (
                                <td className="max-w-40 px-3 py-2.5 font-semibold text-[#c4b5fd]">
                                  <span className="block truncate">@{item.accountLabel || account?.label || 'account'}</span>
                                </td>
                              )}
                              <td className="max-w-[260px] px-3 py-2.5">
                                <p className="m-0 font-medium leading-4 text-white" title={item.post.caption || 'No caption'}>{getCaptionPreview(item.post.caption)}</p>
                                <p className="m-0 mt-1 truncate text-[10px] text-zinc-400">{item.mediaLabel}</p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <p className="m-0 font-semibold text-white">{scheduleParts.time}</p>
                                <p className="m-0 mt-0.5 text-[10px] text-zinc-400">{scheduleParts.date}</p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                {postedParts ? (
                                  <>
                                    <p className="m-0 font-semibold text-emerald-400">{postedParts.time}</p>
                                    <p className="m-0 mt-0.5 text-[10px] text-emerald-400/75">{postedParts.date}</p>
                                  </>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 capitalize text-zinc-300">{item.post.scheduleMode || 'auto'}</td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${statusMeta.className}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {getStatusLabel(item.post)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                {(!isPosted || item.post.status === 'posted_manual' || onScheduleAgain) && (
                                  <button
                                    type="button"
                                    onClick={(event) => openActionMenu(event, item)}
                                    disabled={editable && bulkBusy}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-50"
                                    aria-label="Post actions"
                                    aria-haspopup="menu"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {editingItem && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="post-editor-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
              onClick={() => setEditingItem(null)}
            >
              <div
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] text-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <h4 id="post-editor-title" className="m-0 text-sm font-bold text-white">
                    {editableQueueStatuses.has(editingItem.post.status) ? 'Edit scheduled post' : 'Post details'}
                  </h4>
                  <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-zinc-400">
                    @{editingItem.accountLabel || account?.label || 'account'} · {getStatusLabel(editingItem.post)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  title="Close editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                    <QueueMediaPreview item={editingItem.mediaItem} />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-bold text-white">{editingItem.mediaLabel}</p>
                    <p className="m-0 mt-1 text-[10px] text-zinc-400">Scheduled: {formatPreviewDateTime(editingItem.post.scheduledAt)}</p>
                    <p className="m-0 mt-0.5 text-[10px] text-zinc-400">
                      Posted: {getPostedAt(editingItem.post) ? formatPreviewDateTime(getPostedAt(editingItem.post)) : 'Not posted'}
                    </p>
                  </div>
                </div>

                {editableQueueStatuses.has(editingItem.post.status) ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-400">Scheduled date and time</span>
                      <input
                        type="datetime-local"
                        value={singleScheduledAt}
                        onChange={(event) => setSingleScheduledAt(event.target.value)}
                        disabled={savingPostIds.includes(editingItem.post._id)}
                        className="h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-400">Caption</span>
                      <textarea
                        value={singleCaption}
                        onChange={(event) => setSingleCaption(event.target.value)}
                        disabled={savingPostIds.includes(editingItem.post._id)}
                        className="h-40 w-full resize-none rounded-lg border border-white/15 bg-black px-3 py-2.5 text-sm leading-5 text-white outline-none transition focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />
                      <span>{getReadOnlyReason(editingItem.post)}</span>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Caption</p>
                      <p className="m-0 whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-5 text-zinc-200">
                        {editingItem.post.caption || 'No caption'}
                      </p>
                    </div>
                    {editingItem.post.status === 'failed' && (
                      <div>
                        <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-rose-400">Publishing error</p>
                        <p className="m-0 whitespace-pre-wrap rounded-lg border border-rose-500/30 bg-rose-500/15 p-3 text-xs leading-5 text-rose-300">
                          {editingItem.post.publishError || 'No provider error details were recorded.'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditingItem(null)} className="h-9 rounded-md px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white">
                    Close
                  </button>
                  {editableQueueStatuses.has(editingItem.post.status) && (
                    <button
                      type="button"
                      onClick={saveSinglePost}
                      disabled={savingPostIds.includes(editingItem.post._id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#7831d6] px-3 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingPostIds.includes(editingItem.post._id) ? 'Saving' : 'Save changes'}
                    </button>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

          {scheduleAgainPrimaryItem && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-again-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              onClick={() => setScheduleAgainItems([])}
            >
              <div
                className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] text-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="min-w-0">
                    <h4 id="schedule-again-title" className="m-0 text-sm font-bold text-white">
                      Schedule {scheduleAgainItems.length === 1 ? 'video' : `${scheduleAgainItems.length} videos`} again
                    </h4>
                    <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-zinc-400">
                      {scheduleAgainItems.length === 1
                        ? `@${scheduleAgainPrimaryItem.accountLabel || account?.label || 'account'} · ${scheduleAgainPrimaryItem.post.scheduleMode || 'auto'} mode`
                        : 'Copies will be scheduled in their current table order'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScheduleAgainItems([])}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close schedule again dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                      <QueueMediaPreview item={scheduleAgainPrimaryItem.mediaItem} />
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-xs font-bold text-white">
                        {scheduleAgainPrimaryItem.mediaLabel}
                        {scheduleAgainItems.length > 1 ? ` + ${scheduleAgainItems.length - 1} more` : ''}
                      </p>
                      <p className="m-0 mt-1 text-[10px] leading-4 text-zinc-400">
                        A new queue item will use the same channel, caption, video, and posting mode.
                      </p>
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-400">New scheduled date and time</span>
                    <input
                      type="datetime-local"
                      value={scheduleAgainAt}
                      min={toDateTimeLocalValue(new Date())}
                      onChange={(event) => setScheduleAgainAt(event.target.value)}
                      disabled={scheduleAgainBusy}
                      className="h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20"
                    />
                  </label>
                  {scheduleAgainItems.length > 1 && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-400">Interval between videos</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={scheduleAgainIntervalHours}
                            onChange={(event) => setScheduleAgainIntervalHours(event.target.value)}
                            disabled={scheduleAgainBusy}
                            className="h-10 w-28 rounded-lg border border-white/15 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20"
                          />
                          <span className="text-xs font-semibold text-zinc-400">hours</span>
                        </div>
                      </label>
                      <div className="rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/10 px-3 py-2.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">Schedule preview</span>
                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-zinc-300">Last video time</span>
                          <span className="text-right text-xs font-bold text-white">
                            {formatPreviewDateTime(scheduleAgainLastDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/10 p-3 text-xs leading-4 text-[#c4b5fd]">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>The original posted record and the live social-media post will remain unchanged.</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setScheduleAgainItems([])}
                    className="h-9 rounded-md px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={schedulePostAgain}
                    disabled={scheduleAgainBusy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#7831d6] px-3 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-50"
                  >
                    {scheduleAgainBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    {scheduleAgainBusy ? 'Scheduling' : 'Add to schedule'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCaptionEditor && selectedCount > 0 && (
            <aside className="flex w-[380px] flex-shrink-0 flex-col border-l border-white/10 bg-[#0a0a0a] text-white">
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <h4 className="m-0 text-sm font-bold text-white">Edit captions</h4>
                  <p className="m-0 mt-0.5 text-[11px] font-semibold text-zinc-400">
                    {selectedCount} media selected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCaptionEditor(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  title="Close caption editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {selectedItems.map((item) => {
                  const postId = item.post._id;
                  const scheduleParts = formatQueueScheduleParts(item.post.scheduledAt);
                  return (
                    <div key={`caption-${postId}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#7831d6] text-[10px] font-black text-white">
                          {item.queueIndex}
                        </span>
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                          <QueueMediaPreview item={item.mediaItem} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-xs font-bold text-white">{item.mediaLabel}</p>
                          <p className="m-0 text-[10px] font-semibold text-zinc-400">
                            {scheduleParts.date} {scheduleParts.time}
                          </p>
                        </div>
                      </div>
                      <textarea
                        value={captionDrafts[postId] ?? item.post.caption ?? ''}
                        onChange={(event) => setCaptionDrafts((current) => ({
                          ...current,
                          [postId]: event.target.value,
                        }))}
                        className="h-28 w-full resize-none rounded-md border border-white/15 bg-black px-2.5 py-2 text-xs leading-4 text-white outline-none transition-all placeholder:text-zinc-500 focus:border-[#7831d6] focus:ring-[3px] focus:ring-[#7831d6]/20"
                        placeholder="Write caption..."
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowCaptionEditor(false)}
                  className="h-8 rounded-md px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={saveCaptionChanges}
                  disabled={bulkBusy || !hasCaptionChanges}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#7831d6] px-3 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {bulkBusy ? 'Saving' : 'Save captions'}
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
};

export default AccountQueueEditor;
