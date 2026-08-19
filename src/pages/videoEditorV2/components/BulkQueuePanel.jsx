import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Film,
  Layers3,
  ListChecks,
  Loader2,
  PencilLine,
  Play,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { getMediaUrl } from '../../../utils/mediaUrls';

const STATUS_ALIASES = {
  ready: 'ready',
  pending: 'ready',
  queued: 'queued',
  waiting: 'ready',
  draft: 'ready',
  changed: 'changed',
  dirty: 'changed',
  stale: 'changed',
  'needs-export': 'changed',
  'needs-reexport': 'changed',
  needs_export: 'changed',
  needs_reexport: 'changed',
  exporting: 'exporting',
  processing: 'exporting',
  rendering: 'exporting',
  rendered: 'ready',
  uploading: 'uploading',
  saving: 'uploading',
  done: 'done',
  success: 'done',
  complete: 'done',
  completed: 'done',
  failed: 'failed',
  error: 'failed',
};

const STATUS_META = {
  ready: {
    label: 'Ready',
    Icon: CheckCircle2,
    badgeClass: 'border-white/10 bg-white/[0.05] text-[#aeb3bc]',
    iconClass: 'text-[#8b929d]',
  },
  queued: {
    label: 'Queued',
    Icon: Clock3,
    badgeClass: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    iconClass: 'text-violet-300',
  },
  changed: {
    label: 'Changed',
    Icon: PencilLine,
    badgeClass: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    iconClass: 'text-amber-300',
  },
  exporting: {
    label: 'Exporting',
    Icon: Loader2,
    badgeClass: 'border-[#ff7043]/25 bg-[#ff5500]/10 text-[#ff8a61]',
    iconClass: 'animate-spin text-[#ff7043]',
  },
  uploading: {
    label: 'Uploading',
    Icon: UploadCloud,
    badgeClass: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
    iconClass: 'text-blue-300',
  },
  done: {
    label: 'Done',
    Icon: CheckCircle2,
    badgeClass: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    iconClass: 'text-emerald-300',
  },
  failed: {
    label: 'Failed',
    Icon: AlertCircle,
    badgeClass: 'border-red-400/20 bg-red-400/10 text-red-300',
    iconClass: 'text-red-300',
  },
};

const getStringUrl = (value) => {
  if (typeof value === 'string' && value.trim()) return getMediaUrl(value.trim());
  if (value && typeof value.url === 'string' && value.url.trim()) {
    return getMediaUrl(value.originalUrl || value.url);
  }
  return '';
};

const getRowStatus = (row) => {
  const rawStatus = String(
    row.queueStatus || row.exportStatus || row.status || 'ready',
  ).toLowerCase();
  const status = STATUS_ALIASES[rawStatus] || 'ready';
  const hasUnexportedChanges = Boolean(
    row.changed
    || row.dirty
    || row.isDirty
    || row.needsExport
    || row.needsReexport
    || row.editorProjectStale,
  );

  if (
    hasUnexportedChanges
    && !['exporting', 'uploading', 'failed'].includes(status)
  ) {
    return 'changed';
  }
  return status;
};

const getRowName = (row, index) => (
  row.name
  || row.title
  || row.resultMediaName
  || row.video1?.name
  || row.video?.name
  || row.caption
  || `Video ${index + 1}`
);

const getRowPreview = (row) => {
  if (!row) return null;

  // 1. Completed/rendered export video
  const completedUrl = getStringUrl(row.queueResultUrl)
    || getStringUrl(row.resultVideoUrl)
    || getStringUrl(row.resultMediaUrl);
  if (getRowStatus(row) === 'done' && completedUrl) {
    return { type: 'video', url: completedUrl };
  }

  // 2. Direct poster/thumbnail images
  const imageUrl = getStringUrl(row.thumbnailUrl)
    || getStringUrl(row.thumbnail)
    || getStringUrl(row.posterUrl)
    || getStringUrl(row.poster)
    || getStringUrl(row.video1?.thumbnailUrl)
    || getStringUrl(row.video1?.thumbnail)
    || getStringUrl(row.video1?.posterUrl)
    || getStringUrl(row.video1?.poster)
    || getStringUrl(row.video2?.thumbnailUrl)
    || getStringUrl(row.video2?.thumbnail)
    || getStringUrl(row.video2?.posterUrl)
    || getStringUrl(row.video2?.poster);

  if (imageUrl) return { type: 'image', url: imageUrl };

  // 3. Source videos
  let videoUrl = getStringUrl(row.video1)
    || getStringUrl(row.video1Url)
    || getStringUrl(row.previewVideoUrl)
    || getStringUrl(row.video2)
    || getStringUrl(row.video2Url)
    || getStringUrl(row.video?.url)
    || getStringUrl(row.resultVideoUrl)
    || getStringUrl(row.resultMediaUrl);

  // 4. If row has an editorProject attached, extract clip video asset
  if (!videoUrl && row.editorProject) {
    try {
      const proj = typeof row.editorProject === 'string' ? JSON.parse(row.editorProject) : row.editorProject;
      const allClips = (proj?.tracks || []).flatMap((t) => t.clips || []);
      const videoClip = allClips.find((c) => c?.asset?.url || c?.url);
      if (videoClip?.asset) {
        if (videoClip.asset.thumbnailUrl || videoClip.asset.posterUrl) {
          return {
            type: 'image',
            url: getStringUrl(videoClip.asset.thumbnailUrl || videoClip.asset.posterUrl),
          };
        }
        videoUrl = getStringUrl(videoClip.asset.originalUrl || videoClip.asset.url);
      } else if (videoClip?.url) {
        videoUrl = getStringUrl(videoClip.url);
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  return videoUrl ? { type: 'video', url: videoUrl } : null;
};

const QueueCheckbox = ({ checked, mixed = false, disabled, label, onChange }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-white/20 bg-[#0d0f13] accent-[#ff5500] disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
};

const QueueRowThumbnail = ({ preview }) => {
  const [failedUrl, setFailedUrl] = useState(null);
  const videoRef = useRef(null);
  const previewUrl = preview?.url || '';
  const hasError = Boolean(previewUrl && failedUrl === previewUrl);

  if (!previewUrl || hasError) {
    return (
      <span className="flex h-10 w-7.5 shrink-0 items-center justify-center rounded-md bg-[#0b0d10] text-[#727985] ring-1 ring-white/10">
        <Film className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (preview.type === 'image') {
    return (
      <span className="relative flex h-10 w-7.5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#0b0d10] ring-1 ring-white/10">
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(previewUrl)}
        />
      </span>
    );
  }

  const videoSrc = previewUrl.includes('#') ? previewUrl : `${previewUrl}#t=0.001`;

  return (
    <span className="relative flex h-10 w-7.5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#0b0d10] ring-1 ring-white/10">
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        className="h-full w-full object-cover"
        onLoadedMetadata={(e) => {
          try {
            if (e.currentTarget.currentTime === 0) {
              e.currentTarget.currentTime = 0.001;
            }
          } catch {
            // Ignore seek error
          }
        }}
        onError={() => setFailedUrl(previewUrl)}
      />
    </span>
  );
};

const QueueRow = ({
  entry,
  checked,
  current,
  interactionDisabled,
  selectionDisabled,
  onOpen,
  onToggle,
}) => {
  const { row, status, preview, name, index } = entry;
  const statusMeta = STATUS_META[status];
  const StatusIcon = statusMeta.Icon;
  const errorMessage = row.bulkExportError || row.errorMessage || row.error || '';
  const resultUrl = getStringUrl(row.queueResultUrl)
    || getStringUrl(row.resultVideoUrl)
    || getStringUrl(row.resultMediaUrl);
  const secondaryText = errorMessage || (
    row.caption && row.caption !== name ? row.caption : ''
  );

  return (
    <div
      className={`group relative flex min-h-[52px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${current
        ? 'bg-[#7831d6]/15'
        : 'hover:bg-white/[0.04]'}`}
    >
      <QueueCheckbox
        checked={checked}
        disabled={selectionDisabled}
        label={`${checked ? 'Deselect' : 'Select'} ${name}`}
        onChange={(nextChecked) => onToggle(entry, nextChecked)}
      />

      <button
        type="button"
        onPointerDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.currentTarget.blur();
          onOpen(entry);
        }}
        disabled={interactionDisabled || !onOpen}
        aria-current={current ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default"
      >
        <QueueRowThumbnail preview={preview} />

        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[10px] font-bold ${current ? 'text-white' : 'text-[#d7dbe2]'}`}>
            <span className="mr-1.5 tabular-nums text-[#666d78]">{index + 1}.</span>{name}
          </span>
          {secondaryText && (
            <span className={`mt-0.5 block truncate text-[8px] font-medium ${status === 'failed' ? 'text-red-300/80' : 'text-[#777e89]'}`}>
              {secondaryText}
            </span>
          )}
        </span>
      </button>
      <span className={`inline-flex shrink-0 items-center gap-1 text-[8px] font-bold ${statusMeta.iconClass.replace('animate-spin ', '')}`}>
        <StatusIcon className={`h-3 w-3 ${statusMeta.iconClass}`} />
        {statusMeta.label}
      </span>
      {status === 'done' && resultUrl && (
        <a
          href={resultUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-emerald-300 transition hover:bg-emerald-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          aria-label={`Open exported result for ${name}`}
          title="Open exported result"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

/**
 * Controlled bulk-export queue UI for the Timeline Editor's bulk mode.
 * The parent owns row selection, row navigation, and all export behavior.
 */
export const BulkQueuePanel = ({
  isBulkMode = true,
  rows = [],
  currentRowId = null,
  selectedRowIds = [],
  queueState = null,
  disabled = false,
  className = '',
  onSelectionChange,
  onOpenRow,
  onExportCurrent,
  onExportSelected,
  onExportAll,
  onRetryFailed,
  onCancel,
}) => {
  const entries = useMemo(() => (
    (Array.isArray(rows) ? rows : []).map((row, index) => {
      const id = row.id ?? row.rowId ?? index;
      return {
        id,
        key: String(id),
        row,
        index,
        name: getRowName(row, index),
        preview: getRowPreview(row),
        status: getRowStatus(row),
      };
    })
  ), [rows]);

  const selectedKeys = useMemo(() => new Set(
    (selectedRowIds instanceof Set ? [...selectedRowIds] : selectedRowIds || [])
      .map((id) => String(id)),
  ), [selectedRowIds]);
  const currentKey = currentRowId == null ? '' : String(currentRowId);
  const currentEntry = entries.find((entry) => entry.key === currentKey) || null;
  const selectedEntries = entries.filter((entry) => selectedKeys.has(entry.key));
  const failedEntries = entries.filter((entry) => entry.status === 'failed');
  const completedCount = entries.filter((entry) => entry.status === 'done').length;
  const queueRunning = Boolean(queueState?.running) || entries.some((entry) => (
    entry.status === 'exporting' || entry.status === 'uploading'
  ));
  const queueProgress = Math.max(0, Math.min(100, Number(queueState?.progress) || 0));
  const allSelected = entries.length > 0 && selectedEntries.length === entries.length;
  const someSelected = selectedEntries.length > 0 && !allSelected;
  const exportDisabled = disabled || queueRunning;
  const hasActions = Boolean(
    onExportCurrent || onExportSelected || onExportAll || onRetryFailed,
  );

  if (!isBulkMode) return null;

  const emitSelection = (nextKeys) => {
    const nextIds = entries
      .filter((entry) => nextKeys.has(entry.key))
      .map((entry) => entry.id);
    onSelectionChange?.(nextIds);
  };

  const toggleEntry = (entry, checked) => {
    const nextKeys = new Set(selectedKeys);
    if (checked) nextKeys.add(entry.key);
    else nextKeys.delete(entry.key);
    emitSelection(nextKeys);
  };

  const toggleAll = (checked) => {
    emitSelection(checked ? new Set(entries.map((entry) => entry.key)) : new Set());
  };

  return (
    <section
      aria-label="Bulk export queue"
      className={`flex h-full min-h-0 flex-col text-[#f5f7fa] ${className}`}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="text-[11px] font-extrabold !text-[#f5f7fa]">Bulk queue</h3>
          <span className="text-[8px] font-semibold tabular-nums text-[#777e89]">
            {completedCount}/{entries.length} done
          </span>
        </div>
        {queueRunning && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[8px] font-bold text-[#ff8a61]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running
          </span>
        )}
      </div>

      {queueRunning && (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-[#ff7043]/15 bg-[#ff5500]/[0.05] px-3.5 py-2"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#ff7043]" />
            <span className="min-w-0 flex-1 truncate text-[9px] font-bold text-[#e6e8ec]">
              {queueState?.message || 'Processing bulk queue…'}
            </span>
            <span className="shrink-0 text-[8px] font-extrabold tabular-nums text-[#ff8a61]">
              {Math.round(queueProgress)}%
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#aeb3bc] transition hover:border-red-400/25 hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                aria-label="Cancel bulk export"
                title="Cancel bulk export"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff4d00] to-[#ff7a45] transition-[width] duration-300"
              style={{ width: `${queueProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] px-3.5">
        <label className="flex min-w-0 items-center gap-2 text-[9px] font-bold text-[#aeb3bc]">
          <QueueCheckbox
            checked={allSelected}
            mixed={someSelected}
            disabled={disabled || !onSelectionChange || entries.length === 0}
            label={allSelected ? 'Deselect all videos' : 'Select all videos'}
            onChange={toggleAll}
          />
          <span className="truncate">
            {selectedEntries.length > 0
              ? `${selectedEntries.length} selected`
              : 'Select videos'}
          </span>
        </label>
        <span className="text-[8px] font-bold tabular-nums text-[#666d78]">
          {entries.length} {entries.length === 1 ? 'video' : 'videos'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
        {entries.map((entry) => (
          <QueueRow
            key={entry.key}
            entry={entry}
            checked={selectedKeys.has(entry.key)}
            current={entry.key === currentKey}
            interactionDisabled={disabled}
            selectionDisabled={disabled || !onSelectionChange}
            onOpen={onOpenRow
              ? (nextEntry) => onOpenRow(nextEntry.id, nextEntry.row)
              : null}
            onToggle={toggleEntry}
          />
        ))}

        {entries.length === 0 && (
          <div className="border-b border-dashed border-white/10 px-4 py-8 text-center">
            <Layers3 className="mx-auto h-5 w-5 text-[#555c67]" />
            <p className="mt-2 text-[10px] font-bold text-[#a6abb4]">No planned videos</p>
            <p className="mt-1 text-[9px] font-medium text-[#666d78]">
              Add videos on the Bulk Planning Board first.
            </p>
          </div>
        )}
      </div>

      {hasActions && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-white/[0.08] bg-[#0c0d12] p-3">
          <button
            type="button"
            disabled={exportDisabled || entries.length === 0}
            onClick={() => {
              if (selectedEntries.length > 0) {
                onExportSelected?.(
                  selectedEntries.map((entry) => entry.id),
                  selectedEntries.map((entry) => entry.row),
                );
              } else if (currentEntry) {
                onExportCurrent?.(currentEntry.id, currentEntry.row);
              } else if (entries.length > 0) {
                onExportAll?.(
                  entries.map((entry) => entry.id),
                  entries.map((entry) => entry.row),
                );
              }
            }}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#7831d6] hover:bg-[#6825bc] active:scale-[0.99] px-3 text-[10px] font-bold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allSelected ? (
              <>
                <Layers3 className="h-3.5 w-3.5" />
                <span>Export All ({entries.length})</span>
              </>
            ) : selectedEntries.length > 0 ? (
              <>
                <ListChecks className="h-3.5 w-3.5" />
                <span>Export Selected ({selectedEntries.length})</span>
              </>
            ) : currentEntry ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Export Current Video</span>
              </>
            ) : (
              <>
                <Layers3 className="h-3.5 w-3.5" />
                <span>Export All ({entries.length})</span>
              </>
            )}
          </button>

          {onRetryFailed && failedEntries.length > 0 && (
            <button
              type="button"
              disabled={exportDisabled}
              onClick={() => onRetryFailed(
                failedEntries.map((entry) => entry.id),
                failedEntries.map((entry) => entry.row),
              )}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[9px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Failed ({failedEntries.length})</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
};
