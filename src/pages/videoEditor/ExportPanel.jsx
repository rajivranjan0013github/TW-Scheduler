import { CheckCircle2 } from 'lucide-react';

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
  onSave,
}) => {
  if (!processing && !resultVideoUrl && !progressMsg) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Export Output</h4>

      {processing && (
        <div className="py-6 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-xs font-semibold text-gray-700 animate-pulse">{progressMsg}</p>
        </div>
      )}

      {resultVideoUrl && !processing && (
        <div className="space-y-4">
          {/* Inline success message instead of alert() */}
          <div className="flex gap-2 items-center text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-semibold">Video processed successfully!</span>
          </div>

          <div className="aspect-[9/16] h-[520px] max-w-[292px] mx-auto rounded-xl bg-black overflow-hidden relative">
            <video src={resultVideoUrl} controls className="w-full h-full object-contain" />
          </div>

          {/* Inline status message for save success/failure (replaces alert()) */}
          {statusMessage && (
            <div className={`flex gap-2 items-center rounded-lg p-3 text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'text-green-600 bg-green-50 border border-green-200'
                : 'text-red-600 bg-red-50 border border-red-200'
            }`}>
              {statusMessage.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <a
              href={resultVideoUrl}
              download="merged_video.mp4"
              className="flex-1 py-2.5 bg-gray-100 text-center text-xs font-semibold text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-150 transition-colors"
            >
              Download MP4 File
            </a>

            <button
              disabled={saving}
              onClick={onSave}
              className="flex-1 py-2.5 bg-[#0071e3] text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save to Media Library'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
