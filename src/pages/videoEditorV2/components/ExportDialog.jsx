import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Film,
  Folder,
  Loader2,
  Music2,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { getMediaUrl } from '../../../utils/mediaUrls';
import { API_BASE_URL } from '../../videoEditor/videoEditorConstants';

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

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const getFolderId = (folder) => normalizeFolderId(folder?._id || folder?.id);
const getFolderParentId = (folder) => normalizeFolderId(folder?.parentFolderId) || 'root';
const resolveFolderPreview = (folder) => folder?.coverMedia || folder?.previewMedia || null;
const getItemStatus = (item) => String(item.queueStatus || item.status || 'ready').toLowerCase();
const getItemPreviewUrl = (item) => (
  item.renderedVideoUrl
  || item.previewUrl
  || item.queueResultUrl
  || item.resultVideoUrl
  || item.resultMediaUrl
  || ''
);

const FolderCoverPreview = ({ folder }) => {
  const preview = resolveFolderPreview(folder);
  const previewSource = preview?.type === 'video'
    ? preview.thumbnailUrl
    : preview?.thumbnailUrl || preview?.url;
  const [useProxy, setUseProxy] = useState(false);
  const imageSource = previewSource
    ? getMediaUrl(previewSource, { proxy: useProxy, apiBaseUrl: API_BASE_URL })
    : '';

  return (
    <span className="relative block h-9 w-11 shrink-0" aria-hidden="true">
      <span className="absolute left-0.5 top-0 h-2.5 w-5 rounded-t-md bg-[#323740]" />
      <span className="absolute inset-x-0 bottom-0 top-1 overflow-hidden rounded-lg border border-white/10 bg-[#282c33] shadow-sm">
        <span className="absolute inset-x-1 bottom-0 top-1.5 overflow-hidden rounded-t-md bg-[#282c33]">
          {imageSource ? (
            <img
              src={imageSource}
              alt=""
              loading="lazy"
              className="relative z-[1] mx-auto h-full w-3/4 rounded-t-md object-cover object-[center_40%]"
              onError={() => setUseProxy(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#666d78]">
              <Folder className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
      </span>
    </span>
  );
};

const BulkExportCard = ({ item, index, savingDisabled, onSave }) => {
  const status = getItemStatus(item);
  const meta = STATUS_META[status] || STATUS_META.ready;
  const StatusIcon = meta.Icon;
  const videoUrl = getItemPreviewUrl(item);
  const rendered = Boolean(item.renderedVideoUrl);
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
              {status === 'saving' ? 'Saving video' : status === 'queued' ? 'Waiting' : 'Rendering video'}
            </p>
            <p className="line-clamp-2 text-[8px] font-semibold text-white/70">
              {item.queueMessage || (status === 'saving'
                ? 'Uploading to Media Library…'
                : 'Preparing the video…')}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/75 p-3 text-center">
            <AlertCircle className="h-6 w-6 text-red-300" />
            <p className="text-[8px] font-bold text-red-100">{item.error || 'This video failed.'}</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center justify-end gap-1">
            {!rendered && (
              <span className={`flex items-center gap-1 rounded-full bg-black/25 px-1.5 py-1 text-[7px] font-extrabold uppercase ${meta.className}`}>
                <StatusIcon className={`h-2.5 w-2.5 ${working ? 'animate-spin' : ''}`} />
                {meta.label}
              </span>
            )}
            {rendered && (
              <>
                <a
                  href={item.renderedVideoUrl}
                  download={item.renderedFileName || `bulk-video-${index + 1}.mp4`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[#b7bcc5] hover:bg-white/10 hover:text-white"
                  aria-label={`Download video ${index + 1}`}
                  title="Download video"
                >
                  <Download className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => onSave?.(String(item.id))}
                  disabled={savingDisabled}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0071e3] text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Add video ${index + 1} to Media Library`}
                  title="Add to Media Library"
                >
                  {status === 'saving'
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <UploadCloud className="h-3 w-3" />}
                </button>
              </>
            )}
        </div>
        {item.generatedCaption && (
          <p className="line-clamp-3 whitespace-pre-line border-t border-white/[0.08] pt-1.5 text-[8px] font-medium leading-relaxed text-[#9ba1ab]">
            📝 {item.generatedCaption}
          </p>
        )}
      </div>
    </article>
  );
};

export const ExportDialog = ({
  open,
  mode = 'single',
  items = [],
  projectName = '',
  exporting,
  format = 'video',
  progress,
  message,
  error,
  phase = 'config',
  resultUrl,
  resultFileName,
  resultMimeType,
  saving,
  folders = [],
  foldersLoading = false,
  folderError = '',
  selectedFolderId = 'root',
  generatingCaptions = false,
  onStartExport,
  onClose,
  onCancel,
  onLoadFolders,
  onFolderChange,
  onSaveToLibrary,
  onGenerateCaptions,
}) => {
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerTargetId, setFolderPickerTargetId] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
  const isBulk = mode === 'bulk';
  const isAudio = !isBulk && format === 'audio';
  const outputLabel = isAudio ? 'audio' : 'video';
  const extension = isAudio ? 'MP3' : 'MP4';
  const downloadName = resultFileName || `timeline-${outputLabel}.${extension.toLowerCase()}`;
  const renderedCount = items.filter((item) => Boolean(item.renderedVideoUrl)).length;
  const choosingDestination = isBulk && phase === 'ready-to-save';
  const resultsReady = choosingDestination || (!isBulk && !isAudio && Boolean(resultUrl));
  const singleGeneratedCaption = !isBulk ? items[0]?.generatedCaption || '' : '';
  const folderPickerTargetIndex = items.findIndex((item) => (
    String(item.id) === folderPickerTargetId
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

  if (!open) return null;

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openFolderPicker = (itemId = '') => {
    setFolderSearch('');
    setExpandedFolderIds(new Set());
    setFolderPickerTargetId(String(itemId || ''));
    onFolderChange?.('');
    onLoadFolders?.();
    setFolderPickerOpen(true);
  };

  const closeFolderPicker = () => {
    if (saving) return;
    setFolderPickerOpen(false);
    setFolderPickerTargetId('');
  };

  const saveToSelectedFolder = async () => {
    const saved = await onSaveToLibrary?.(
      folderPickerTargetId || null,
      { folderId: selectedFolderId },
    );
    if (saved) closeFolderPicker();
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
              className={`flex min-w-0 flex-1 items-center gap-2.5 text-left text-[11px] font-bold ${selected
                ? 'text-[#ff8a61]'
                : 'text-[#b5bac3] hover:text-white'}`}
            >
              <FolderCoverPreview folder={folder} />
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

  const closeAction = exporting ? onCancel : onClose;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0d11]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-export-title"
        className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#17181c] text-zinc-100"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-white/[0.02] px-5 py-4">
          <div className="min-w-0">
            <h2 id="project-export-title" className="truncate text-sm font-bold text-white">
              Export
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {resultsReady && (
              <>
                <button type="button" onClick={onGenerateCaptions} disabled={renderedCount === 0 || generatingCaptions || saving} className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[9px] font-extrabold text-[#c4c8cf] hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">
                  {generatingCaptions ? <Loader2 className="h-3 w-3 animate-spin text-[#ff7043]" /> : <FileText className="h-3 w-3 text-[#ff7043]" />}
                  {generatingCaptions ? 'Generating captions…' : 'Generate captions'}
                </button>
                {isBulk && (
                  <button type="button" onClick={() => openFolderPicker()} disabled={renderedCount === 0 || generatingCaptions || saving} className="h-7 rounded-lg bg-[#0071e3] px-3 text-[9px] font-extrabold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40">
                    Add all to Media Library ({renderedCount})
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={closeAction}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70"
              aria-label={exporting ? 'Cancel export' : 'Close export'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isBulk ? (
            <>
              {error && !exporting && (
                <div role="alert" className="mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-xs font-semibold leading-relaxed text-red-200">{error}</div>
              )}

              {(exporting || phase === 'saving' || phase === 'complete') && (
                <div role="status" aria-live="polite" className="mb-4 rounded-xl border border-[#ff5500]/20 bg-[#ff5500]/[0.06] p-3">
                  <div className="flex items-center gap-3">
                    {exporting || phase === 'saving'
                      ? <Loader2 className="h-4 w-4 animate-spin text-[#ff7043]" />
                      : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    <p className="min-w-0 flex-1 truncate text-[11px] font-extrabold">
                      {message || (phase === 'saving' ? 'Saving videos…' : phase === 'complete' ? 'Bulk export finished' : 'Rendering videos…')}
                    </p>
                    <span className="text-[11px] font-extrabold tabular-nums text-[#ff8a61]">{Math.round(progress || 0)}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/40">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#ff4d00] to-[#ff8a4c] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {items.map((item, index) => (
                  <BulkExportCard key={item.id || index} item={item} index={index} savingDisabled={exporting || generatingCaptions || saving} onSave={openFolderPicker} />
                ))}
              </div>
            </>
          ) : (
            <>
              {exporting && (
                <div className="py-8 text-center" aria-live="polite">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff7043]/25 bg-[#ff5a1f]/10 text-[#ff7043] shadow-[0_10px_30px_rgba(255,90,31,0.12)]"><Loader2 className="h-6 w-6 animate-spin" /></span>
                  <p className="mt-4 text-sm font-bold text-white">Rendering your {outputLabel}</p>
                  <p className="mt-1 text-[10px] font-semibold text-zinc-400">{message || `Preparing timeline ${outputLabel}…`}</p>
                  <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#ff4d00] to-[#ff7a45] shadow-[0_0_14px_rgba(255,90,31,0.45)] transition-all duration-300" style={{ width: `${Math.max(3, Math.min(100, progress || 0))}%` }} /></div>
                  <p className="mt-2 text-[10px] font-bold tabular-nums text-zinc-500">{Math.round(progress || 0)}%</p>
                  <button type="button" onClick={onCancel} className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold text-zinc-300 hover:bg-white/[0.08] hover:text-white">Cancel export</button>
                </div>
              )}

              {error && !exporting && (
                <div role="alert" className="mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-xs font-semibold leading-relaxed text-red-200">{error}</div>
              )}

              {resultUrl && !exporting && (
                <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-white/10 bg-[#181b21] shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                  <div className="flex aspect-[9/16] max-h-[calc(100dvh-11rem)] items-center justify-center overflow-hidden bg-black">
                    {isAudio ? (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-[#111d1a] to-black p-5">
                        <Music2 className="h-10 w-10 text-emerald-300" />
                        <audio src={resultUrl} controls className="mt-5 h-9 w-full" aria-label="Exported MP3 preview" />
                      </div>
                    ) : (
                      <video src={resultUrl} controls className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <h3 className="truncate text-[10px] font-extrabold text-white">{projectName || `${extension} export`}</h3>
                      </div>
                      <p className="mt-0.5 text-[8px] font-semibold text-zinc-500">{extension} export completed</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <a
                        href={resultUrl}
                        download={downloadName}
                        type={resultMimeType}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[#b7bcc5] transition hover:bg-white/10 hover:text-white"
                        aria-label={`Download ${extension}`}
                        title={`Download ${extension}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openFolderPicker()}
                        disabled={saving}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0071e3] text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Add to Media Library"
                        title="Add to Media Library"
                      >
                        {saving
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <UploadCloud className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {singleGeneratedCaption && (
                    <p className="whitespace-pre-line border-t border-white/[0.08] px-3 py-2.5 text-[9px] font-medium leading-relaxed text-[#9ba1ab]">
                      📝 {singleGeneratedCaption}
                    </p>
                  )}
                </div>
              )}

              {!exporting && !resultUrl && (
                <button type="button" onClick={() => onStartExport?.()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] text-[11px] font-extrabold text-white hover:bg-[#ff6a33]">
                  {isAudio ? <Music2 className="h-4 w-4" /> : <Film className="h-4 w-4" />}{error ? `Try ${extension} export again` : `Export ${extension}`}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {folderPickerOpen && !exporting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="export-folder-title" className="flex h-[520px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15171c] text-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div>
                <h3 id="export-folder-title" className="text-sm font-extrabold !text-white">Choose Save Folder</h3>
              </div>
              <button type="button" onClick={closeFolderPicker} disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#858c97] hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Close folder picker"><X className="h-3.5 w-3.5" /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {(folderError || error) && <p className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-[10px] font-bold text-red-300">{folderError || error}</p>}
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[#777e89] focus-within:border-[#ff5500]/50">
                <Search className="h-3.5 w-3.5" />
                <input type="search" value={folderSearch} onChange={(event) => setFolderSearch(event.target.value)} placeholder="Search folders" className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-[#666d78]" />
              </label>
              <div className="space-y-1.5">
                <button type="button" onClick={() => onFolderChange?.('root')} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold ${selectedFolderId === 'root' ? 'border-[#ff5500]/60 bg-[#ff5500]/10 text-[#ff8a61]' : 'border-white/10 bg-white/[0.03] text-[#c8ccd3] hover:bg-white/[0.06]'}`}><Folder className="h-4 w-4" /> Media Library root</button>
                {foldersLoading && <div className="flex items-center gap-2 p-4 text-[10px] font-semibold text-[#8d949f]"><Loader2 className="h-4 w-4 animate-spin" /> Loading folders…</div>}
                {!foldersLoading && (folderSearch.trim() ? searchedRootFolders.map((folder) => {
                  const id = getFolderId(folder);
                  const selected = String(selectedFolderId) === id;
                  return (
                    <button key={id} type="button" onClick={() => onFolderChange?.(id)} className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left text-[11px] font-bold ${selected ? 'border-[#ff5500]/50 bg-[#ff5500]/10 text-[#ff8a61]' : 'border-transparent bg-white/[0.035] text-[#b5bac3] hover:bg-white/[0.07] hover:text-white'}`}><FolderCoverPreview folder={folder} /><span className="truncate">{folder.name || 'Untitled folder'}</span></button>
                  );
                }) : renderFolderTree('root'))}
                {!foldersLoading && folderSearch.trim() && searchedRootFolders.length === 0 && !folderError && <p className="p-4 text-center text-[10px] font-semibold text-[#666d78]">No root folders found.</p>}
                {!foldersLoading && !folderSearch.trim() && folders.filter((folder) => getFolderParentId(folder) === 'root').length === 0 && !folderError && <p className="p-4 text-center text-[10px] font-semibold text-[#666d78]">No folders found.</p>}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-white/10 bg-black/15 px-4 py-2.5">
              <button type="button" onClick={closeFolderPicker} disabled={saving} className="h-7 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10px] font-extrabold text-[#b7bcc5] hover:bg-white/[0.08] disabled:opacity-40">Cancel</button>
              <button type="button" onClick={saveToSelectedFolder} disabled={foldersLoading || saving || !selectedFolderId} className="flex h-7 items-center gap-1.5 rounded-lg bg-[#0071e3] px-3 text-[10px] font-extrabold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saving ? 'Saving…' : isBulk && !choosingFolderForOne ? 'Save All Here' : 'Save Here'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
