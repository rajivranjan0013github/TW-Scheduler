import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock, Image as ImageIcon, Loader2, MessageSquareText, MoreHorizontal, PauseCircle, PlayCircle, Save, Video, X } from 'lucide-react';
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

const getStartOfLocalDay = (date) => (
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
);

const getQueueSectionLabel = (value) => {
  const date = new Date(value);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return 'Upcoming';

  const day = getStartOfLocalDay(date);
  const today = getStartOfLocalDay(now);
  const tomorrow = today + 24 * 60 * 60 * 1000;

  if (day === today) return 'Today';
  if (day === tomorrow) return 'Tomorrow';
  return 'Upcoming';
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

const AccountQueueEditor = ({
  account,
  items = [],
  loading = false,
  savingPostIds = [],
  deletingPostIds = [],
  onBulkSave,
  onBulkCaptionSave,
  onClose,
  getStatusLabel,
}) => {
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [showCaptionEditor, setShowCaptionEditor] = useState(false);
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleIntervalHours, setRescheduleIntervalHours] = useState('10');
  const selectedItems = useMemo(() => (
    items.filter((item) => selectedPostIds.includes(item.post._id))
  ), [items, selectedPostIds]);
  const selectedCount = selectedItems.length;
  const selectedSaving = selectedItems.some((item) => savingPostIds.includes(item.post._id));
  const selectedDeleting = selectedItems.some((item) => deletingPostIds.includes(item.post._id));
  const bulkBusy = selectedSaving || selectedDeleting;
  const allVisibleSelected = items.length > 0 && selectedCount === items.length;
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
  const groupedItems = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const label = getQueueSectionLabel(item?.post?.scheduledAt);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });
    return ['Today', 'Tomorrow', 'Upcoming']
      .map((label) => ({ label, items: groups.get(label) || [] }))
      .filter((group) => group.items.length > 0);
  }, [items]);

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
      const selectedItem = items.find((item) => item.post._id === postId);
      setRescheduleStart(toDateTimeLocalValue(selectedItem?.post?.scheduledAt));
    }
    if (!isSelected && showCaptionEditor) {
      const selectedItem = items.find((item) => item.post._id === postId);
      if (selectedItem) initializeCaptionDrafts([selectedItem]);
    }
  };

  const selectAllPosts = () => {
    if (items.length === 0) return;
    setSelectedPostIds(items.map((item) => item.post._id));
    setRescheduleStart(toDateTimeLocalValue(items[0]?.post?.scheduledAt));
    setRescheduleIntervalHours(getDetectedIntervalHours(items) || rescheduleIntervalHours);
  };

  const clearSelection = () => {
    setSelectedPostIds([]);
    setRescheduleStart('');
    setShowCaptionEditor(false);
    setShowTimeEditor(false);
  };

  const saveBulkChanges = async (updates) => {
    if (!selectedCount || !onBulkSave) return;
    await onBulkSave(selectedItems, updates);
  };

  const openTimeEditor = () => {
    if (selectedCount === 0) return;
    setRescheduleStart((current) => current || toDateTimeLocalValue(selectedItems[0]?.post?.scheduledAt));
    const detectedInterval = getDetectedIntervalHours(selectedItems);
    if (detectedInterval) {
      setRescheduleIntervalHours(detectedInterval);
    }
    setShowTimeEditor(true);
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
    await onBulkCaptionSave(selectedItems, changesByPostId);
  };

  const saveIntervalChanges = async () => {
    if (!selectedCount || !onBulkSave) return;
    const startDate = new Date(rescheduleStart);
    if (!rescheduleStart || Number.isNaN(startDate.getTime())) {
      window.alert('Choose a valid start date and time.');
      return;
    }
    if (selectedCount === 1) {
      await onBulkSave(selectedItems, {
        scheduledAt: startDate.toISOString(),
      });
      setShowTimeEditor(false);
      return;
    }

    const intervalHours = Number(rescheduleIntervalHours);
    if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
      window.alert('Enter an interval greater than 0 hours.');
      return;
    }

    await onBulkSave(selectedItems, {
      reschedule: {
        startAt: startDate.toISOString(),
        intervalHours,
      },
    });
    setShowTimeEditor(false);
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
          <h3 className="m-0 truncate text-base font-bold tracking-tight text-[#1a1a2e]">
            Upcoming Queue
          </h3>
          <span className="truncate rounded-full bg-[#f2f2f7] px-2.5 py-0.5 text-[10px] font-medium text-[#5f6368]">
            @{account?.label || 'account'}
          </span>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          {items.length > 0 && (
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
                setShowCaptionEditor(true);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 text-[11px] font-semibold text-[#1a73e8] transition hover:bg-[#dbeafe]"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              Edit caption
            </button>
          )}
          <div className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
            {loading ? 'Loading' : `${items.length} queued`}
          </div>
        </div>
	      </div>
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
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-7xl">
              {loading ? (
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-[#d2d2d7] bg-white text-[#6e6e73] shadow-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1a73e8]" />
                  <p className="m-0 text-sm font-semibold">Loading upcoming queue...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#d2d2d7] bg-white text-center shadow-sm">
                  <Clock className="h-8 w-8 text-[#c7c7cc]" />
                  <p className="m-0 text-sm font-semibold text-[#3c4043]">No upcoming queued media for this account.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedItems.map((group) => (
                    <div key={group.label}>
                      <h4 className="m-0 mb-2 text-sm font-bold text-[#111827]">{group.label}</h4>
                      <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
                        {group.items.map((item, index) => {
                          const postId = item.post._id;
                          const isSelected = selectedPostIds.includes(postId);
                          const isPaused = item.post.status === 'paused';
                          const scheduleParts = formatQueueScheduleParts(item.post.scheduledAt);
                          const StatusIcon = getQueueStatusMeta(item.statusGroup).icon;
                          const statusClassName = getQueueStatusMeta(item.statusGroup).className;
                          const MediaTypeIcon = item.mediaItem?.type === 'video' ? Video : ImageIcon;

                          return (
                            <article
                              key={postId}
                              className={`flex items-center gap-3 border-b border-[#e5e7eb] px-3 py-2.5 transition last:border-b-0 ${
                                isPaused ? 'bg-[#f8fafc] text-[#6b7280]' : 'bg-white hover:bg-[#fbfdff]'
                              } ${
                                isSelected ? 'shadow-[inset_3px_0_0_#1a73e8] ring-1 ring-inset ring-[#1a73e8]/20' : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleSelectedPost(postId)}
                                className={`group relative h-[72px] w-28 overflow-hidden rounded-md border bg-[#f2f2f7] text-left shadow-sm transition lg:h-20 lg:w-32 ${
                                  isPaused ? 'border-[#d1d5db] grayscale opacity-75' : 'border-[#e5e7eb]'
                                } ${isSelected ? 'ring-2 ring-[#1a73e8]' : 'hover:ring-2 hover:ring-[#1a73e8]/25'}`}
                                title={isSelected ? 'Deselect media' : 'Select media'}
                              >
                                <QueueMediaPreview item={item.mediaItem} />
                                <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded bg-black/55 text-white shadow-sm">
                                  <MediaTypeIcon className="h-3 w-3" />
                                </span>
                                <span className={`absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded border transition ${
                                  isSelected ? 'border-[#1a73e8] bg-[#1a73e8] text-white' : 'border-white/80 bg-white/90 text-transparent'
                                }`}>
                                  <Check className="h-2.5 w-2.5" />
                                </span>
                                <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-black text-[#1a73e8] shadow-sm">
                                  #{item.queueIndex || index + 1}
                                </span>
                              </button>

                              <div className="min-w-0 flex-1 self-center">
                                <p className={`m-0 line-clamp-2 text-[13px] font-medium leading-5 ${isPaused ? 'text-[#4b5563]' : 'text-[#111827]'}`}>
                                  {item.post.caption || item.mediaLabel || 'No caption'}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  {item.mediaLabel && (
                                    <span className="truncate text-xs font-medium text-[#657089]">
                                      {item.mediaLabel}
                                    </span>
                                  )}
                                  {item.folderLabel && (
                                    <span className="truncate text-xs font-medium text-[#657089]">
                                      {item.folderLabel}
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${statusClassName}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {getStatusLabel(item.post)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex w-[112px] flex-shrink-0 flex-col items-start self-center">
                                <p className="m-0 text-xs font-medium text-[#475569]">{scheduleParts.time}</p>
                                <p className="m-0 mt-0.5 text-xs font-medium text-[#475569]">{scheduleParts.date}</p>
                              </div>

                              <div className="flex flex-shrink-0 items-start justify-end self-start">
                                <button
                                  type="button"
                                  onClick={() => toggleSelectedPost(postId)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#526179] transition hover:bg-[#f1f5f9] hover:text-[#111827]"
                                  title={isSelected ? 'Deselect media' : 'Select media'}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
