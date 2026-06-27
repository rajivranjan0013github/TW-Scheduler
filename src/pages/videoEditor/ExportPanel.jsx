import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

/**
 * Center column — processing progress, result video player,
 * download and save-to-library buttons.
 * Uses the auth token passed as a prop instead of reading localStorage directly.
 */
export const ExportPanel = ({
  processing,
  progressMsg,
  resultVideoUrl,
  saving,
  statusMessage,
  generatedCaption,
  generatingCaption,
  onGenerateCaption,
  onCaptionChange,
  onSave,
}) => {
  if (!processing && !resultVideoUrl && !progressMsg) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Export Output</h4>

      {processing && (
        <div className="py-3 flex flex-col items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-[11px] font-semibold text-gray-700 animate-pulse">{progressMsg}</p>
        </div>
      )}

      {resultVideoUrl && !processing && (
        <div className="space-y-3">
          {/* Inline success message instead of alert() */}
          <div className="flex gap-2 items-center text-green-600 bg-green-50 border border-green-200 rounded-lg py-2 px-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="text-[11px] font-semibold">Video processed successfully!</span>
          </div>

          <div className="aspect-[9/16] h-[480px] max-w-[270px] mx-auto rounded-xl bg-black overflow-hidden relative">
            <video src={resultVideoUrl} controls className="w-full h-full object-contain" />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Media Caption</h5>
              <button
                type="button"
                disabled={generatingCaption || saving}
                onClick={onGenerateCaption}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff5500] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingCaption ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {generatingCaption ? 'Generating' : 'Generate Caption'}
              </button>
            </div>
            {(generatedCaption || generatingCaption) && (
              <textarea
                value={generatedCaption}
                onChange={(event) => onCaptionChange(event.target.value)}
                rows={3}
                placeholder="Generated caption will appear here..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium leading-relaxed text-gray-800 outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/10"
              />
            )}
          </div>

          {/* Inline status message for save success/failure (replaces alert()) */}
          {statusMessage && (
            <div className={`flex gap-2 items-center rounded-lg py-2 px-3 text-[11px] font-semibold ${
              statusMessage.type === 'success'
                ? 'text-green-600 bg-green-50 border border-green-200'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}>
              {statusMessage.text}
            </div>
          )}

          <div className="flex gap-2.5 pt-1.5">
            <a
              href={resultVideoUrl}
              download="merged_video.mp4"
              className="flex-1 py-2 bg-gray-100 text-center text-xs font-semibold text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-150 transition-colors"
            >
              Download MP4 File
            </a>

            <button
              disabled={saving}
              onClick={onSave}
              className="flex-1 py-2 bg-[#0071e3] text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save to Media Library'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
