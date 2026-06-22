import { Video, AlertCircle, Sparkles } from 'lucide-react';

/**
 * Left column panel — video file imports, overlay text, and FFmpeg status.
 */
export const VideoUploadPanel = ({
  video1,
  video2,
  onChooseVideo1,
  onChooseVideo2,
  text,
  onTextChange,
  ffmpegLoaded,
  ffmpegLoading,
  engineError,
  onOpenTextGenerator,
}) => {
  return (
    <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-6 max-h-[608px] overflow-y-auto">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <Video className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Import Assets</h3>
      </div>

      {/* Video uploads */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">First Video (Clips Starts)</label>
          <button
            type="button"
            onClick={onChooseVideo1}
            className="w-full rounded-lg border border-gray-200 p-2 text-left text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            Choose file
          </button>
          {video1 && <p className="text-[10px] text-gray-500 mt-1 truncate">Selected: {video1.name}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Second Video (Appended)</label>
          <button
            type="button"
            onClick={onChooseVideo2}
            className="w-full rounded-lg border border-gray-200 p-2 text-left text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            Choose file
          </button>
          {video2 && <p className="text-[10px] text-gray-500 mt-1 truncate">Selected: {video2.name}</p>}
        </div>
      </div>

      {/* Text input area */}
      <div className="pt-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-bold text-gray-400 uppercase">Overlay text</label>
          <button
            type="button"
            onClick={onOpenTextGenerator}
            className="flex items-center gap-1 text-[10px] font-bold text-[#ff5500] hover:text-orange-600 transition-colors uppercase"
          >
            <Sparkles className="w-3 h-3" />
            Generate with AI
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows="3"
          placeholder="Enter text..."
          className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:bg-white transition-all outline-none resize-none text-gray-950"
        />
      </div>

      {/* Controls */}
      <div className="pt-4">
        {engineError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2.5 items-start">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-700 leading-normal">{engineError}</p>
          </div>
        ) : !ffmpegLoaded ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5 items-start">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 leading-normal">
              {ffmpegLoading ? 'Downloading editor engine core (~30MB)...' : 'Initializing engine...'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
