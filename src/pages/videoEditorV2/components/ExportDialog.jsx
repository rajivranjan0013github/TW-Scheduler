import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Film,
  Folder,
  Loader2,
  Music2,
  Save,
  Search,
  X,
} from 'lucide-react';

const FORMAT_OPTIONS = [
  {
    id: 'video',
    label: 'Video',
    extension: 'MP4',
    detail: 'Hardware acceleration when supported',
    icon: Film,
  },
  {
    id: 'audio',
    label: 'Audio',
    extension: 'MP3',
    detail: 'Full timeline mix · 192 kbps',
    icon: Music2,
  },
];

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const getFolderId = (folder) => normalizeFolderId(folder?._id || folder?.id);
const getFolderParentId = (folder) => normalizeFolderId(folder?.parentFolderId) || 'root';

export const ExportDialog = ({
  open,
  exporting,
  format = 'video',
  progress,
  message,
  error,
  resultUrl,
  resultFileName,
  resultMimeType,
  saving,
  folders = [],
  foldersLoading = false,
  folderError = '',
  selectedFolderId = 'root',
  onFormatChange,
  onStartExport,
  onClose,
  onCancel,
  onLoadFolders,
  onFolderChange,
  onSaveToLibrary,
}) => {
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
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

  const isAudio = format === 'audio';
  const outputLabel = isAudio ? 'audio' : 'video';
  const extension = isAudio ? 'MP3' : 'MP4';
  const downloadName = resultFileName || `timeline-${outputLabel}.${extension.toLowerCase()}`;

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openFolderPicker = () => {
    setFolderSearch('');
    setExpandedFolderIds(new Set());
    onFolderChange?.('root');
    onLoadFolders?.();
    setFolderPickerOpen(true);
  };

  const closeFolderPicker = () => {
    if (saving) return;
    setFolderPickerOpen(false);
  };

  const saveToSelectedFolder = async () => {
    const saved = await onSaveToLibrary?.(selectedFolderId);
    if (saved) setFolderPickerOpen(false);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-export-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#17181c] text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-4">
          <div>
            <h2 id="project-export-title" className="text-sm font-bold text-white">Export project</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-zinc-400">
              {isAudio
                ? 'MP3 · full timeline audio mix · browser rendering'
                : 'H.264 MP4 · AAC audio · hardware accelerated when supported'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close export"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {!exporting && !resultUrl && (
            <fieldset>
              <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-zinc-500">
                Export format
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {FORMAT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = format === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onFormatChange?.(option.id)}
                      aria-pressed={selected}
                      className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70 ${selected
                        ? 'border-[#ff5a1f]/65 bg-[#ff5a1f]/10 text-white shadow-[0_8px_24px_rgba(255,90,31,0.1)]'
                        : 'border-white/10 bg-white/[0.025] text-zinc-300 hover:border-white/20 hover:bg-white/[0.05]'}`}
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected
                        ? 'bg-[#ff5a1f]/15 text-[#ff7043]'
                        : 'bg-white/[0.06] text-zinc-400'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold">
                          {option.label} <span className="text-[9px] text-zinc-500">{option.extension}</span>
                        </span>
                        <span className="mt-0.5 block text-[9px] font-semibold leading-snug text-zinc-500">
                          {option.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {exporting && (
            <div className="py-8 text-center" aria-live="polite">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff7043]/25 bg-[#ff5a1f]/10 text-[#ff7043] shadow-[0_10px_30px_rgba(255,90,31,0.12)]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </span>
              <p className="mt-4 text-sm font-bold text-white">Rendering your {outputLabel}</p>
              <p className="mt-1 text-[10px] font-semibold text-zinc-400">
                {message || `Preparing timeline ${outputLabel}…`}
              </p>
              <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff4d00] to-[#ff7a45] shadow-[0_0_14px_rgba(255,90,31,0.45)] transition-all duration-300"
                  style={{ width: `${Math.max(3, Math.min(100, progress || 0))}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] font-bold tabular-nums text-zinc-500">
                {Math.round(progress || 0)}%
              </p>
              <button
                type="button"
                onClick={onCancel}
                className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70"
              >
                Cancel export
              </button>
            </div>
          )}

          {error && !exporting && !resultUrl && (
            <div role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-xs font-semibold leading-relaxed text-red-200">
              {error}
            </div>
          )}

          {resultUrl && !exporting && (
            <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
              {isAudio ? (
                <div className="mx-auto flex h-56 w-full max-w-[190px] flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-950 via-[#111d1a] to-black p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-300">
                    <Music2 className="h-8 w-8" />
                  </span>
                  <audio
                    src={resultUrl}
                    controls
                    className="mt-5 h-9 w-full"
                    aria-label="Exported MP3 preview"
                  />
                </div>
              ) : (
                <video
                  src={resultUrl}
                  controls
                  className="mx-auto aspect-[9/16] h-[330px] rounded-xl border border-white/10 bg-black object-contain shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                />
              )}
              <div className="flex flex-col justify-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-white">{extension} export completed</h3>
                <p className="mt-1 text-[10px] font-medium leading-relaxed text-zinc-400">
                  Download the {extension} or add it to your Media Library.
                </p>
                <a
                  href={resultUrl}
                  download={downloadName}
                  type={resultMimeType}
                  className="mt-5 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] text-[11px] font-bold text-white shadow-[0_8px_22px_rgba(255,90,31,0.22)] transition hover:bg-[#ff6a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a61] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181c]"
                >
                  <Download className="h-4 w-4" />
                  Download {extension}
                </a>
                <button
                  type="button"
                  onClick={openFolderPicker}
                  disabled={saving}
                  className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#ff7043]/35 bg-[#ff5a1f]/10 text-[11px] font-bold text-[#ff8a61] transition hover:border-[#ff7043]/55 hover:bg-[#ff5a1f]/15 hover:text-[#ffa07d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save to Media Library'}
                </button>
              </div>
            </div>
          )}

          {!exporting && !resultUrl && (
            <button
              type="button"
              onClick={() => onStartExport?.(format)}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] text-[11px] font-extrabold text-white shadow-[0_8px_22px_rgba(255,90,31,0.22)] transition hover:bg-[#ff6a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a61] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181c]"
            >
              {isAudio ? <Music2 className="h-4 w-4" /> : <Film className="h-4 w-4" />}
              {error ? `Try ${extension} export again` : `Export ${extension}`}
            </button>
          )}
        </div>
      </div>

      {folderPickerOpen && resultUrl && !exporting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="single-export-folder-title"
            className="flex h-[520px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15171c] text-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 id="single-export-folder-title" className="text-sm font-extrabold !text-white">Choose Save Folder</h3>
                <p className="mt-1 text-[10px] font-semibold !text-[#aeb4bd]">
                  Select where the exported {outputLabel} should be saved.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFolderPicker}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#858c97] hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label="Close folder picker"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {(folderError || error) && (
                <p className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-[10px] font-bold text-red-300">
                  {folderError || error}
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
              <button
                type="button"
                onClick={closeFolderPicker}
                disabled={saving}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-extrabold text-[#b7bcc5] hover:bg-white/[0.08] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveToSelectedFolder}
                disabled={foldersLoading || saving}
                className="flex items-center gap-2 rounded-xl bg-[#0071e3] px-4 py-2 text-[11px] font-extrabold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? 'Saving…' : 'Save Here'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
