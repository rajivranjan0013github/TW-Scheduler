import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock, Loader2, MessageSquareText, PauseCircle, Save, X } from 'lucide-react';
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

const getStatusClasses = (statusGroup) => {
  switch (statusGroup) {
    case 'manual':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'done':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'failed':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'cancelled':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
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
  const [captionDrafts, setCaptionDrafts] = useState({});
  const selectedItems = useMemo(() => (
    items.filter((item) => selectedPostIds.includes(item.post._id))
  ), [items, selectedPostIds]);
  const selectedCount = selectedItems.length;
  const selectedSaving = selectedItems.some((item) => savingPostIds.includes(item.post._id));
  const selectedDeleting = selectedItems.some((item) => deletingPostIds.includes(item.post._id));
  const bulkBusy = selectedSaving || selectedDeleting;
  const hasUnpausedSelection = selectedItems.some((item) => item.post.status !== 'paused');
  const hasCaptionChanges = selectedItems.some((item) => (
    (captionDrafts[item.post._id] ?? item.post.caption ?? '') !== (item.post.caption ?? '')
  ));

  useEffect(() => {
    if (selectedCount === 0) {
      setShowCaptionEditor(false);
    }
  }, [selectedCount]);

  useEffect(() => {
    if (!showCaptionEditor) return;
    setCaptionDrafts((current) => {
      const next = {};
      selectedItems.forEach((item) => {
        const postId = item.post._id;
        next[postId] = current[postId] ?? item.post.caption ?? '';
      });
      return next;
    });
  }, [selectedItems, showCaptionEditor]);

  const toggleSelectedPost = (postId) => {
    setSelectedPostIds((current) => (
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    ));
  };

  const saveBulkChanges = async (updates) => {
    if (!selectedCount || !onBulkSave) return;
    await onBulkSave(selectedItems, updates);
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

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#e5e5ea] bg-white px-4 py-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#5f6368] transition hover:text-[#1a73e8]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to calendar
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <PlatformIcon platform={account?.platform} className="h-5 w-5 flex-shrink-0" showFallback />
            <h3 className="m-0 truncate text-base font-bold tracking-tight text-[#1a1a2e]">
              Upcoming Queue
            </h3>
            <span className="truncate rounded-full bg-[#f2f2f7] px-2.5 py-0.5 text-[10px] font-medium text-[#5f6368]">
              @{account?.label || 'account'}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
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
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCaptionEditor(true)}
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,200px))] justify-center gap-4">
                  {items.map((item, index) => {
                const postId = item.post._id;
                const isSelected = selectedPostIds.includes(postId);
                const isPaused = item.post.status === 'paused';
                const scheduleParts = formatQueueScheduleParts(item.post.scheduledAt);

                return (
                  <article key={postId} className={`group overflow-hidden rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${
                    isPaused ? 'bg-[#f1f3f5] text-[#6b7280]' : 'bg-white'
                  } ${
                    isSelected ? 'border-[#1a73e8] ring-2 ring-[#1a73e8]/20' : 'border-[#e5e5ea] hover:border-[#ccd0d9]'
                  }`}>
                    <div className={`flex items-center justify-between gap-2 border-b px-2.5 py-2 ${
                      isPaused ? 'border-[#d8dde3] bg-[#e5e7eb]' : 'border-[#f4f4f6] bg-gray-50/40'
                    }`}>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleSelectedPost(postId)}
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition ${
                                isSelected ? 'border-[#1a73e8] bg-[#1a73e8] text-white' : 'border-[#d1d5db] bg-white text-transparent hover:border-[#1a73e8]'
                              }`}
                              title={isSelected ? 'Deselect media' : 'Select media'}
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#1a73e8] to-[#3b82f6] text-[10px] font-extrabold text-white shadow-[0_1px_2px_rgba(26,115,232,0.2)]">
                              {item.queueIndex || index + 1}
                            </span>
                          </div>
                          <span className={`inline-flex flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wide transition-colors ${getStatusClasses(item.statusGroup)}`}>
                            {getStatusLabel(item.post)}
                          </span>
                        </div>

                        <div className="p-2.5">
                      <div className={`aspect-[9/16] overflow-hidden rounded-lg border shadow-inner relative ${
                        isPaused ? 'border-[#d1d5db] bg-[#e5e7eb] grayscale opacity-70' : 'border-[#e5e5ea] bg-[#f2f2f7]'
                      }`}>
                        <QueueMediaPreview item={item.mediaItem} />
                      </div>
                      <div className={`mt-2 rounded-md border px-2 py-1.5 ${
                        isPaused ? 'border-[#d1d5db] bg-[#e5e7eb]' : 'border-[#e7e9ee] bg-[#f8fafc]'
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                          <span className={`text-[11px] font-bold leading-4 ${isPaused ? 'text-[#6b7280]' : 'text-[#374151]'}`}>{scheduleParts.date}</span>
                          <span className={`text-[11px] font-black leading-4 ${isPaused ? 'text-[#4b5563]' : 'text-[#111827]'}`}>{scheduleParts.time}</span>
                        </div>
                      </div>
                      <div className="mt-2 min-w-0">
                        <p className={`m-0 truncate text-xs font-bold ${isPaused ? 'text-[#4b5563]' : 'text-[#1c1c1e]'}`}>{item.mediaLabel}</p>
                        <p className={`m-0 mt-1 line-clamp-2 text-[10px] font-normal leading-4 ${isPaused ? 'text-[#6b7280]' : 'text-[#8e8e93]'}`}>
                          {item.post.caption || 'No caption'}
                        </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
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
