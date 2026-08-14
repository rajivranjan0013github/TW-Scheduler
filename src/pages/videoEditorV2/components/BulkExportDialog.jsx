import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  Loader2,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';

const STATUS_META = {
  queued: { label: 'Waiting', className: 'text-violet-300', Icon: Loader2 },
  processing: { label: 'Rendering', className: 'text-orange-300', Icon: Loader2 },
  rendered: { label: 'Rendered', className: 'text-emerald-300', Icon: CheckCircle2 },
  saving: { label: 'Saving', className: 'text-blue-300', Icon: Loader2 },
  done: { label: 'Complete', className: 'text-emerald-300', Icon: CheckCircle2 },
  error: { label: 'Failed', className: 'text-red-300', Icon: AlertCircle },
  cancelled: { label: 'Cancelled', className: 'text-zinc-400', Icon: X },
  ready: { label: 'Ready', className: 'text-zinc-400', Icon: CheckCircle2 },
};

const getRowStatus = (row) => String(row.queueStatus || row.status || 'ready').toLowerCase();

const getRowName = (row, index) => (
  row.resultMediaName || row.video1?.name || row.caption || `Video ${index + 1}`
);

const getPreviewUrl = (row) => (
  row.renderedVideoUrl
  || row.queueResultUrl
  || row.resultVideoUrl
  || row.resultMediaUrl
  || row.video1Url
  || row.video1?.url
  || ''
);

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const getFolderId = (folder) => normalizeFolderId(folder?._id || folder?.id);
const getFolderParentId = (folder) => normalizeFolderId(folder?.parentFolderId) || 'root';

const RenderedVideoCard = ({ row, index, savingDisabled = false, onSave }) => {
  const status = getRowStatus(row);
  const meta = STATUS_META[status] || STATUS_META.ready;
  const StatusIcon = meta.Icon;
  const videoUrl = getPreviewUrl(row);
  const rendered = Boolean(row.renderedVideoUrl);
  const working = ['queued', 'processing', 'saving'].includes(status);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#181b21]">
      <div className="relative aspect-[9/16] overflow-hidden bg-black">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls={rendered}
            muted={!rendered}
            playsInline
            preload="metadata"
            className={`h-full w-full object-contain ${working && !rendered ? 'opacity-40' : ''}`}
          />
        ) : (
          <div className="h-full w-full bg-[#08090b]" />
        )}
        {working && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 p-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
            <p className="text-[8px] font-extrabold uppercase tracking-wider text-white">
              {status === 'saving' ? 'Saving video' : status === 'queued' ? 'Waiting' : 'Generating video'}
            </p>
            <p className="line-clamp-2 text-[8px] font-semibold text-white/70">
              {row.queueMessage || (status === 'saving' ? 'Uploading to Media Library…' : 'FFmpeg is preparing the video…')}
            </p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/75 p-3 text-center">
            <AlertCircle className="h-6 w-6 text-red-300" />
            <p className="text-[8px] font-bold text-red-100">{row.bulkExportError || 'This video failed.'}</p>
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-extrabold text-[#e4e6ea]">
            Video {index + 1}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {status !== 'rendered' && (
              <span className={`flex items-center gap-1 rounded-full bg-black/25 px-1.5 py-1 text-[7px] font-extrabold uppercase ${meta.className}`}>
                <StatusIcon className={`h-2.5 w-2.5 ${working ? 'animate-spin' : ''}`} />
                {meta.label}
              </span>
            )}
            {rendered && (
              <>
                <a
                  href={row.renderedVideoUrl}
                  download={row.renderedFileName || `bulk-video-${index + 1}.mp4`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[#b7bcc5] hover:bg-white/10 hover:text-white"
                  aria-label={`Download video ${index + 1}`}
                  title="Download video"
                >
                  <Download className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => onSave?.(String(row.id))}
                  disabled={savingDisabled}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0071e3] text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`${status === 'done' ? 'Save again' : 'Add'} video ${index + 1} to Media Library`}
                  title={status === 'done' ? 'Save again to Media Library' : 'Add to Media Library'}
                >
                  {status === 'saving'
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <UploadCloud className="h-3 w-3" />}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="truncate text-[8px] font-semibold text-[#777e89]">{getRowName(row, index)}</p>
        {row.generatedCaption && (
          <p className="line-clamp-3 whitespace-pre-line border-t border-white/[0.08] pt-1.5 text-[8px] font-medium leading-relaxed text-[#9ba1ab]">
            📝 {row.generatedCaption}
          </p>
        )}
      </div>
    </article>
  );
};

export const BulkExportDialog = ({
  open,
  rows = [],
  folders = [],
  foldersLoading = false,
  folderError = '',
  selectedFolderId = 'root',
  generatingCaptions = false,
  queueState = null,
  phase = 'rendering',
  onFolderChange,
  onGenerateCaptions,
  onStart,
  onCancel,
  onClose,
}) => {
  const [folderSearch, setFolderSearch] = useState('');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerTargetId, setFolderPickerTargetId] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
  const running = Boolean(queueState?.running);
  const choosingDestination = phase === 'ready-to-save';
  const finished = phase === 'complete';
  const progress = Math.max(0, Math.min(100, Number(queueState?.progress) || 0));
  const renderedCount = rows.filter((row) => Boolean(row.renderedVideoUrl)).length;
  const folderPickerTargetIndex = rows.findIndex((row) => (
    String(row.id) === folderPickerTargetId
  ));
  const choosingFolderForOne = folderPickerTargetIndex >= 0;
  const searchedRootFolders = useMemo(() => {
    const search = folderSearch.trim().toLowerCase();
    return [...folders]
      .filter((folder) => (
        getFolderParentId(folder) === 'root'
        && String(folder.name || '').toLowerCase().includes(search)
      ))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }));
  }, [folderSearch, folders]);

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openFolderPicker = (rowId = '') => {
    setFolderSearch('');
    setExpandedFolderIds(new Set());
    setFolderPickerTargetId(String(rowId || ''));
    onFolderChange?.('root');
    setFolderPickerOpen(true);
  };

  const closeFolderPicker = () => {
    setFolderPickerOpen(false);
    setFolderPickerTargetId('');
  };

  const renderFolderTree = (parentId = 'root', depth = 0) => {
    const levelFolders = folders
      .filter((folder) => getFolderParentId(folder) === parentId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      }));

    return levelFolders.map((folder) => {
      const id = getFolderId(folder);
      const hasSubfolders = folders.some((candidate) => getFolderParentId(candidate) === id);
      const expanded = expandedFolderIds.has(id);
      const selected = String(selectedFolderId) === id;
      return (
        <div key={id}>
          <div
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            className={`flex items-center rounded-xl border py-1.5 pr-2 ${selected
              ? 'border-[#ff5500]/50 bg-[#ff5500]/10'
              : 'border-transparent bg-white/[0.035] hover:bg-white/[0.07]'}`}
          >
            {hasSubfolders ? (
              <button
                type="button"
                onClick={() => toggleFolderExpanded(id)}
                className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#777e89] hover:bg-white/10 hover:text-white"
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.name || 'folder'}`}
                aria-expanded={expanded}
              >
                {expanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="mr-1 h-6 w-6 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => onFolderChange?.(id)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] font-bold ${selected
                ? 'text-[#ff8a61]'
                : 'text-[#b5bac3] hover:text-white'}`}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{folder.name || 'Untitled folder'}</span>
            </button>
          </div>
          {hasSubfolders && expanded && (
            <div className="mt-1 space-y-1">{renderFolderTree(id, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0d11]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-export-title"
        className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#111318] text-white"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="bulk-export-title" className="text-sm font-extrabold !text-white">Export videos</h2>
            <p className="mt-1 text-[11px] font-medium !text-[#aeb4bd]">
              Render {rows.length} {rows.length === 1 ? 'video' : 'videos'} and save them to Media Library.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {choosingDestination && (
              <>
                <button
                  type="button"
                  onClick={onGenerateCaptions}
                  disabled={renderedCount === 0 || generatingCaptions || running}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-extrabold text-[#c4c8cf] hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generatingCaptions
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff7043]" />
                    : <FileText className="h-3.5 w-3.5 text-[#ff7043]" />}
                  {generatingCaptions ? 'Generating captions…' : 'Generate captions'}
                </button>
                <button
                  type="button"
                  onClick={() => openFolderPicker()}
                  disabled={renderedCount === 0 || running || generatingCaptions}
                  className="rounded-xl bg-[#0071e3] px-4 py-2 text-[11px] font-extrabold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add all to Media Library ({renderedCount})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={running ? onCancel : onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8d949f] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]"
              aria-label={running ? 'Cancel bulk export' : 'Close export dialog'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!choosingDestination && (
            <div role="status" aria-live="polite" className="rounded-xl border border-[#ff5500]/20 bg-[#ff5500]/[0.06] p-3">
              <div className="flex items-center gap-3">
                {running ? <Loader2 className="h-4 w-4 animate-spin text-[#ff7043]" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-extrabold">
                    {phase === 'rendering'
                      ? (queueState?.message || 'Rendering videos…')
                      : phase === 'saving'
                        ? (queueState?.message || 'Saving videos…')
                        : 'Bulk export finished'}
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold text-[#8d949f]">
                    {queueState?.completed || 0} of {queueState?.total || rows.length} processed
                  </p>
                </div>
                <span className="text-[11px] font-extrabold tabular-nums text-[#ff8a61]">{Math.round(progress)}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff4d00] to-[#ff8a4c] transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className={`${choosingDestination ? '' : 'mt-4'} grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10`}>
            {rows.map((row, index) => (
              <RenderedVideoCard
                key={row.id || index}
                row={row}
                index={index}
                savingDisabled={running || generatingCaptions}
                onSave={openFolderPicker}
              />
            ))}
          </div>

        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/15 px-5 py-4">
          {running ? (
            <button type="button" onClick={onCancel} className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-[11px] font-extrabold text-red-300 hover:bg-red-400/15">
              Cancel export
            </button>
          ) : (
            <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-extrabold text-[#b7bcc5] hover:bg-white/[0.08] hover:text-white">
              {finished ? 'Close' : 'Cancel'}
            </button>
          )}
        </footer>
      </section>

      {folderPickerOpen && choosingDestination && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-folder-title"
            className="flex h-[520px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15171c] shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 id="bulk-folder-title" className="text-sm font-extrabold !text-white">Choose Save Folder</h3>
                <p className="mt-1 text-[10px] font-semibold !text-[#aeb4bd]">
                  {choosingFolderForOne
                    ? `Select where Video ${folderPickerTargetIndex + 1} should be saved.`
                    : 'Select where all rendered videos should be saved.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFolderPicker}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#858c97] hover:bg-white/10 hover:text-white"
                aria-label="Close folder picker"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {folderError && (
                <p className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-[10px] font-bold text-red-300">
                  {folderError}
                </p>
              )}
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[#777e89] focus-within:border-[#ff5500]/50">
                <Search className="h-3.5 w-3.5" />
                <input
                  type="search"
                  value={folderSearch}
                  onChange={(event) => setFolderSearch(event.target.value)}
                  placeholder="Search folders"
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-[#666d78]"
                />
              </label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onFolderChange?.('root')}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold ${selectedFolderId === 'root'
                    ? 'border-[#ff5500]/60 bg-[#ff5500]/10 text-[#ff8a61]'
                    : 'border-white/10 bg-white/[0.03] text-[#c8ccd3] hover:bg-white/[0.06]'}`}
                >
                  <Folder className="h-4 w-4" />
                  Media Library root
                </button>
                {foldersLoading && (
                  <div className="flex items-center gap-2 p-4 text-[10px] font-semibold text-[#8d949f]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading folders…
                  </div>
                )}
                {!foldersLoading && (folderSearch.trim() ? (
                  searchedRootFolders.map((folder) => {
                    const id = getFolderId(folder);
                    const selected = String(selectedFolderId) === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onFolderChange?.(id)}
                        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold ${selected
                          ? 'border-[#ff5500]/50 bg-[#ff5500]/10 text-[#ff8a61]'
                          : 'border-transparent bg-white/[0.035] text-[#b5bac3] hover:bg-white/[0.07] hover:text-white'}`}
                      >
                        <Folder className="h-4 w-4 shrink-0" />
                        <span className="truncate">{folder.name || 'Untitled folder'}</span>
                      </button>
                    );
                  })
                ) : renderFolderTree('root'))}
                {!foldersLoading && folderSearch.trim() && searchedRootFolders.length === 0 && !folderError && (
                  <p className="p-4 text-center text-[10px] font-semibold text-[#666d78]">No root folders found.</p>
                )}
                {!foldersLoading && !folderSearch.trim() && folders.filter((folder) => getFolderParentId(folder) === 'root').length === 0 && !folderError && (
                  <p className="p-4 text-center text-[10px] font-semibold text-[#666d78]">No folders found.</p>
                )}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-white/10 bg-black/15 px-5 py-4">
              <button type="button" onClick={closeFolderPicker} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-extrabold text-[#b7bcc5] hover:bg-white/[0.08]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setFolderPickerOpen(false);
                  onStart?.(folderPickerTargetId || null);
                  setFolderPickerTargetId('');
                }}
                disabled={foldersLoading}
                className="rounded-xl bg-[#0071e3] px-4 py-2 text-[11px] font-extrabold text-white hover:bg-blue-600 disabled:opacity-40"
              >
                {choosingFolderForOne ? 'Save Here' : 'Save All Here'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
