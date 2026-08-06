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
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'manual':
      return {
        icon: Clock,
        className: 'border-orange-200 bg-orange-50 text-orange-600',
      };
    case 'failed':
      return {
        icon: X,
        className: 'border-red-200 bg-red-50 text-red-700',
      };
    case 'cancelled':
      return {
        icon: PauseCircle,
        className: 'border-slate-200 bg-slate-100 text-slate-500',
      };
    default:
      return {
        icon: Clock,
        className: 'border-blue-200 bg-blue-50 text-blue-700',
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#e5e5ea] bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#5f6368] transition hover:bg-[#f2f2f7] hover:text-[#1a73e8]"
            title="Back to calendar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <PlatformIcon platform={account?.platform} className="h-5 w-5 flex-shrink-0" showFallback />
          {title && (
            <h3 className="m-0 truncate text-base font-bold tracking-tight text-[#1a1a2e]">
              {title}
            </h3>
          )}
          {showAccountLabel && (
            <span className="truncate rounded-full bg-[#f2f2f7] px-2.5 py-0.5 text-[10px] font-medium text-[#5f6368]">
              {account?.label === 'All channels' ? 'All channels' : `@${account?.label || 'account'}`}
            </span>
          )}
          {account?.label !== 'All channels' && (
            <div className="min-w-0 rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-2.5 py-1">
              <p className="m-0 truncate text-[10px] font-semibold text-[#334155]">
                {account?.assignedHandlerName || 'Unassigned handler'}
              </p>
              <p className="m-0 mt-0.5 truncate text-[9px] text-[#64748b]">
                {account?.assignedHandlerEmail || 'No email assigned'}
              </p>
            </div>
          )}
          <div className="flex-shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-center">
            <p className="m-0 text-xs font-bold text-[#0071e3]">{postsLeftCount}</p>
            <p className="m-0 mt-0.5 text-[9px] font-semibold text-[#0071e3]">
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#d2d2d7] bg-white px-2.5 text-[11px] font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#1a73e8] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#1558b0] disabled:opacity-50"
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedRepeatCount})
            </button>
          )}
          {selectedCount > 0 && (
            <div className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#eff6ff] px-2.5 text-[11px] font-bold text-[#1a73e8]">
              <Check className="h-3.5 w-3.5" />
              {selectedCount} selected
            </div>
          )}
          {selectedCount > 0 && hasUnpausedSelection && (
            <button
              type="button"
              onClick={() => saveBulkChanges({ status: 'paused' })}
              disabled={bulkBusy}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 text-[11px] font-semibold text-[#1a73e8] transition hover:bg-[#dbeafe] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#5f6368]" />
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 text-[11px] font-semibold text-[#1a73e8] transition hover:bg-[#dbeafe]"
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
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedCount})
            </button>
          )}
          <div className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
            {loading ? 'Loading' : `${items.length} posts`}
          </div>
        </div>
	      </div>
      {notice && (
        <div className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-700/70 hover:text-emerald-900" aria-label="Dismiss message">
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
            className="fixed z-50 w-[152px] overflow-hidden rounded-lg border border-[#d2d2d7] bg-white py-1 shadow-xl"
            style={{ left: actionMenu.left, top: actionMenu.top }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => openPostEditor(actionMenu.item)}
              className="w-full px-3 py-2 text-left text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              {editableQueueStatuses.has(actionMenu.item.post.status) ? 'Edit post' : 'View details'}
            </button>
            {actionMenu.item.statusGroup === 'done' && onScheduleAgain && (
              <button
                type="button"
                role="menuitem"
                onClick={() => openScheduleAgain(actionMenu.item)}
                className="flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-xs font-semibold text-[#1a73e8] hover:bg-blue-50"
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
                className="flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
              >
                {actionMenu.item.post.status === 'paused' ? (
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
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
                className="flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-70"
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
                className="flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50"
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
                className="flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50"
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
                className="flex w-full items-center gap-2 border-t border-[#f1f5f9] px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete post
              </button>
            )}
          </div>
        </>
      )}
      {showTimeEditor && selectedCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#d2d2d7] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#e5e5ea] px-4 py-3">
              <div className="min-w-0">
                <h4 className="m-0 text-sm font-bold text-[#1c1c1e]">Bulk edit post time</h4>
                <p className="m-0 mt-0.5 text-[11px] font-semibold text-[#6b7280]">
                  {selectedCount === 1
                    ? 'Choose the new date and time for this post.'
                    : `${selectedCount} selected posts will be rescheduled in queue order.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeEditor(false)}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f2f2f7] hover:text-[#1c1c1e]"
                title="Close time editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Start date and time</span>
                <input
                  type="datetime-local"
                  value={rescheduleStart}
                  onChange={(event) => setRescheduleStart(event.target.value)}
                  disabled={bulkBusy}
                  className="h-10 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 text-sm font-semibold text-[#1c1c1e] outline-none transition focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10 disabled:opacity-60"
                />
              </label>
              {selectedCount > 1 && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Interval between posts</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={rescheduleIntervalHours}
                        onChange={(event) => setRescheduleIntervalHours(event.target.value)}
                        disabled={bulkBusy}
                        className="h-10 w-28 rounded-lg border border-[#d2d2d7] bg-white px-3 text-sm font-bold text-[#1c1c1e] outline-none transition focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10 disabled:opacity-60"
                      />
                      <span className="text-sm font-semibold text-[#6b7280]">hours</span>
                    </div>
                  </label>
                  <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[#1a73e8]">Preview only</span>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#3c4043]">Last post date</span>
                      <span className="text-right text-xs font-bold text-[#1c1c1e]">
                        {formatPreviewDateTime(lastPostPreviewDate)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#e5e5ea] px-4 py-3">
              <button
                type="button"
                onClick={() => setShowTimeEditor(false)}
                className="h-9 rounded-md px-3 text-xs font-semibold text-[#6b7280] transition hover:bg-[#f2f2f7] hover:text-[#1c1c1e]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveIntervalChanges}
                disabled={bulkBusy}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 text-xs font-semibold text-white transition hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-[#d2d2d7] bg-white text-[#6e6e73] shadow-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1a73e8]" />
                  <p className="m-0 text-sm font-semibold">Loading schedule queue...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#d2d2d7] bg-white text-center shadow-sm">
                  <Clock className="h-8 w-8 text-[#c7c7cc]" />
                  <p className="m-0 text-sm font-semibold text-[#3c4043]">No scheduled or posted content in this queue.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#d2d2d7] bg-white shadow-sm">
                  <div className="divide-y divide-[#e5e7eb] md:hidden">
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
                        <article key={`mobile-${item.post._id}`} className={`p-3 ${isPosted ? 'bg-emerald-50/80' : item.post.status === 'failed' ? 'bg-red-50/60' : 'bg-white'}`}>
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
                                className="mt-4 h-4 w-4 flex-shrink-0 accent-[#1a73e8]"
                              />
                            )}
                            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f2f2f7]">
                              <QueueMediaPreview item={item.mediaItem} />
                            </div>
                            <div className="min-w-0 flex-1">
                              {showChannelColumn && <p className="m-0 truncate text-[10px] font-bold text-[#4f46e5]">@{item.accountLabel}</p>}
                              <p className="m-0 mt-0.5 truncate text-xs font-semibold text-[#1f2937]">{getCaptionPreview(item.post.caption)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${statusMeta.className}`}>
                                  <StatusIcon className="h-2.5 w-2.5" />
                                  {getStatusLabel(item.post)}
                                </span>
                                <span className="text-[9px] font-medium text-[#64748b]">{scheduleParts.date} {scheduleParts.time}</span>
                              </div>
                              {postedAt && <p className="m-0 mt-1 text-[9px] font-semibold text-emerald-700">Posted {formatPreviewDateTime(postedAt)}</p>}
                            </div>
                            {(!isPosted || item.post.status === 'posted_manual' || onScheduleAgain) && (
                              <button
                                type="button"
                                onClick={(event) => openActionMenu(event, item)}
                                disabled={editable && bulkBusy}
                                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#d2d2d7] bg-white text-[#475569] disabled:opacity-50"
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
                      <thead className="sticky top-0 z-10 bg-[#f8fafc] text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                        <tr>
                          <th className="w-10 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={allVisibleSelected ? clearSelection : selectAllPosts}
                              disabled={selectableItems.length === 0 || bulkBusy}
                              aria-label="Select all editable posts"
                              className="h-3.5 w-3.5 accent-[#1a73e8]"
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
                              className={`border-t border-[#e5e7eb] transition ${
                                isPosted
                                  ? 'bg-emerald-50/80 hover:bg-emerald-100/70'
                                  : item.post.status === 'failed'
                                    ? 'bg-red-50/60 hover:bg-red-50'
                                    : item.post.status === 'paused'
                                      ? 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                      : 'bg-white hover:bg-[#f8fafc]'
                              } ${(isSelected || isRepeatSelected) ? 'shadow-[inset_3px_0_0_#1a73e8]' : ''}`}
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
                                    className="h-3.5 w-3.5 accent-[#1a73e8]"
                                  />
                                ) : (
                                  <Check className={`h-4 w-4 ${isPosted ? 'text-emerald-600' : 'text-slate-300'}`} />
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="h-11 w-11 overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f2f2f7]">
                                  <QueueMediaPreview item={item.mediaItem} />
                                </div>
                              </td>
                              {showChannelColumn && (
                                <td className="max-w-40 px-3 py-2.5 font-semibold text-[#334155]">
                                  <span className="block truncate">@{item.accountLabel || account?.label || 'account'}</span>
                                </td>
                              )}
                              <td className="max-w-[260px] px-3 py-2.5">
                                <p className="m-0 font-medium leading-4 text-[#1f2937]" title={item.post.caption || 'No caption'}>{getCaptionPreview(item.post.caption)}</p>
                                <p className="m-0 mt-1 truncate text-[10px] text-[#64748b]">{item.mediaLabel}</p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <p className="m-0 font-semibold text-[#334155]">{scheduleParts.time}</p>
                                <p className="m-0 mt-0.5 text-[10px] text-[#64748b]">{scheduleParts.date}</p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                {postedParts ? (
                                  <>
                                    <p className="m-0 font-semibold text-emerald-700">{postedParts.time}</p>
                                    <p className="m-0 mt-0.5 text-[10px] text-emerald-700/75">{postedParts.date}</p>
                                  </>
                                ) : (
                                  <span className="text-[#94a3b8]">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 capitalize text-[#475569]">{item.post.scheduleMode || 'auto'}</td>
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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#64748b] hover:border-[#d2d2d7] hover:bg-white hover:text-[#1a73e8] disabled:opacity-50"
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
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#d2d2d7] bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
              <div className="flex items-start justify-between gap-3 border-b border-[#e5e5ea] px-4 py-3">
                <div className="min-w-0">
                  <h4 id="post-editor-title" className="m-0 text-sm font-bold text-[#1c1c1e]">
                    {editableQueueStatuses.has(editingItem.post.status) ? 'Edit scheduled post' : 'Post details'}
                  </h4>
                  <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">
                    @{editingItem.accountLabel || account?.label || 'account'} · {getStatusLabel(editingItem.post)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f2f7]"
                  title="Close editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#fbfbfd] p-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f2f2f7]">
                    <QueueMediaPreview item={editingItem.mediaItem} />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-bold text-[#111827]">{editingItem.mediaLabel}</p>
                    <p className="m-0 mt-1 text-[10px] text-[#64748b]">Scheduled: {formatPreviewDateTime(editingItem.post.scheduledAt)}</p>
                    <p className="m-0 mt-0.5 text-[10px] text-[#64748b]">
                      Posted: {getPostedAt(editingItem.post) ? formatPreviewDateTime(getPostedAt(editingItem.post)) : 'Not posted'}
                    </p>
                  </div>
                </div>

                {editableQueueStatuses.has(editingItem.post.status) ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">Scheduled date and time</span>
                      <input
                        type="datetime-local"
                        value={singleScheduledAt}
                        onChange={(event) => setSingleScheduledAt(event.target.value)}
                        disabled={savingPostIds.includes(editingItem.post._id)}
                        className="h-10 w-full rounded-lg border border-[#d2d2d7] px-3 text-sm font-semibold outline-none focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">Caption</span>
                      <textarea
                        value={singleCaption}
                        onChange={(event) => setSingleCaption(event.target.value)}
                        disabled={savingPostIds.includes(editingItem.post._id)}
                        className="h-40 w-full resize-none rounded-lg border border-[#d2d2d7] px-3 py-2.5 text-sm leading-5 outline-none focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{getReadOnlyReason(editingItem.post)}</span>
                    </div>
                    <div>
                      <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">Caption</p>
                      <p className="m-0 whitespace-pre-wrap rounded-lg border border-[#e5e7eb] bg-[#fbfbfd] p-3 text-sm leading-5 text-[#334155]">
                        {editingItem.post.caption || 'No caption'}
                      </p>
                    </div>
                    {editingItem.post.status === 'failed' && (
                      <div>
                        <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Publishing error</p>
                        <p className="m-0 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                          {editingItem.post.publishError || 'No provider error details were recorded.'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#e5e5ea] px-4 py-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditingItem(null)} className="h-9 rounded-md px-3 text-xs font-semibold text-[#6b7280] hover:bg-[#f2f2f7]">
                    Close
                  </button>
                  {editableQueueStatuses.has(editingItem.post.status) && (
                    <button
                      type="button"
                      onClick={saveSinglePost}
                      disabled={savingPostIds.includes(editingItem.post._id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 text-xs font-semibold text-white hover:bg-[#1558b0] disabled:opacity-50"
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
              onClick={() => setScheduleAgainItems([])}
            >
              <div
                className="w-full max-w-md overflow-hidden rounded-xl border border-[#d2d2d7] bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#e5e5ea] px-4 py-3">
                  <div className="min-w-0">
                    <h4 id="schedule-again-title" className="m-0 text-sm font-bold text-[#1c1c1e]">
                      Schedule {scheduleAgainItems.length === 1 ? 'video' : `${scheduleAgainItems.length} videos`} again
                    </h4>
                    <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">
                      {scheduleAgainItems.length === 1
                        ? `@${scheduleAgainPrimaryItem.accountLabel || account?.label || 'account'} · ${scheduleAgainPrimaryItem.post.scheduleMode || 'auto'} mode`
                        : 'Copies will be scheduled in their current table order'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScheduleAgainItems([])}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f2f2f7]"
                    aria-label="Close schedule again dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] bg-[#fbfbfd] p-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f2f2f7]">
                      <QueueMediaPreview item={scheduleAgainPrimaryItem.mediaItem} />
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-xs font-bold text-[#111827]">
                        {scheduleAgainPrimaryItem.mediaLabel}
                        {scheduleAgainItems.length > 1 ? ` + ${scheduleAgainItems.length - 1} more` : ''}
                      </p>
                      <p className="m-0 mt-1 text-[10px] leading-4 text-[#64748b]">
                        A new queue item will use the same channel, caption, video, and posting mode.
                      </p>
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">New scheduled date and time</span>
                    <input
                      type="datetime-local"
                      value={scheduleAgainAt}
                      min={toDateTimeLocalValue(new Date())}
                      onChange={(event) => setScheduleAgainAt(event.target.value)}
                      disabled={scheduleAgainBusy}
                      className="h-10 w-full rounded-lg border border-[#d2d2d7] px-3 text-sm font-semibold outline-none focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10"
                    />
                  </label>
                  {scheduleAgainItems.length > 1 && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">Interval between videos</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={scheduleAgainIntervalHours}
                            onChange={(event) => setScheduleAgainIntervalHours(event.target.value)}
                            disabled={scheduleAgainBusy}
                            className="h-10 w-28 rounded-lg border border-[#d2d2d7] px-3 text-sm font-semibold outline-none focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10"
                          />
                          <span className="text-xs font-semibold text-[#64748b]">hours</span>
                        </div>
                      </label>
                      <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-[#1a73e8]">Schedule preview</span>
                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-[#3c4043]">Last video time</span>
                          <span className="text-right text-xs font-bold text-[#1c1c1e]">
                            {formatPreviewDateTime(scheduleAgainLastDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-4 text-blue-800">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>The original posted record and the live social-media post will remain unchanged.</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-[#e5e5ea] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setScheduleAgainItems([])}
                    className="h-9 rounded-md px-3 text-xs font-semibold text-[#6b7280] hover:bg-[#f2f2f7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={schedulePostAgain}
                    disabled={scheduleAgainBusy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 text-xs font-semibold text-white hover:bg-[#1558b0] disabled:opacity-50"
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
            <aside className="flex w-[380px] flex-shrink-0 flex-col border-l border-[#e5e5ea] bg-white">
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#e5e5ea] px-4 py-3">
                <div className="min-w-0">
                  <h4 className="m-0 text-sm font-bold text-[#1c1c1e]">Edit captions</h4>
                  <p className="m-0 mt-0.5 text-[11px] font-semibold text-[#6b7280]">
                    {selectedCount} media selected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCaptionEditor(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f2f2f7] hover:text-[#1c1c1e]"
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
                    <div key={`caption-${postId}`} className="rounded-lg border border-[#e5e7eb] bg-[#fbfbfd] p-3">
                      <div className="mb-2 flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-[10px] font-black text-white">
                          {item.queueIndex}
                        </span>
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f2f2f7]">
                          <QueueMediaPreview item={item.mediaItem} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-xs font-bold text-[#111827]">{item.mediaLabel}</p>
                          <p className="m-0 text-[10px] font-semibold text-[#6b7280]">
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
                        className="h-28 w-full resize-none rounded-md border border-[#d2d2d7] bg-white px-2.5 py-2 text-xs leading-4 text-[#1c1c1e] outline-none transition-all placeholder:text-[#9aa0a6] focus:border-[#1a73e8] focus:ring-[3px] focus:ring-[#1a73e8]/10"
                        placeholder="Write caption..."
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[#e5e5ea] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowCaptionEditor(false)}
                  className="h-8 rounded-md px-3 text-xs font-semibold text-[#6b7280] transition hover:bg-[#f2f2f7] hover:text-[#1c1c1e]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={saveCaptionChanges}
                  disabled={bulkBusy || !hasCaptionChanges}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 text-xs font-semibold text-white transition hover:bg-[#1558b0] disabled:cursor-not-allowed disabled:opacity-50"
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
