import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Music2,
  Save,
  X,
} from 'lucide-react';

const FORMAT_OPTIONS = [
  {
    id: 'video',
    label: 'Video',
    extension: 'MP4',
    detail: 'H.264 video with AAC audio',
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
  onFormatChange,
  onStartExport,
  onClose,
  onCancel,
  onSaveToLibrary,
}) => {
  if (!open) return null;

  const isAudio = format === 'audio';
  const outputLabel = isAudio ? 'audio' : 'video';
  const extension = isAudio ? 'MP3' : 'MP4';
  const downloadName = resultFileName || `timeline-${outputLabel}.${extension.toLowerCase()}`;

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
                : 'H.264 MP4 · AAC audio · browser rendering'}
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
                  onClick={onSaveToLibrary}
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
    </div>
  );
};
