import { Video, AlertCircle } from 'lucide-react';

/**
 * Left column panel — video file imports, overlay text, FFmpeg status, and merge button.
 */
export const VideoUploadPanel = ({
  video1,
  video2,
  onVideo1Change,
  onVideo2Change,
  text,
  onTextChange,
  ffmpegLoaded,
  ffmpegLoading,
  engineError,
  processing,
  onProcess,
}) => {
  return (
    <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <Video className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Import Assets</h3>
      </div>

      {/* Video uploads */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">First Video (Clips Starts)</label>
          <input
            type="file"
            accept="video/*"
            onChange={onVideo1Change}
            className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-lg p-2"
          />
          {video1 && <p className="text-[10px] text-gray-500 mt-1 truncate">Selected: {video1.name}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Second Video (Appended)</label>
          <input
            type="file"
            accept="video/*"
            onChange={onVideo2Change}
            className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-lg p-2"
          />
          {video2 && <p className="text-[10px] text-gray-500 mt-1 truncate">Selected: {video2.name}</p>}
        </div>
      </div>

      {/* Text input area */}
      <div className="pt-4 border-t border-gray-100 space-y-3">
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Overlay text</label>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows="3"
          placeholder="Enter text..."
          className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:bg-white transition-all outline-none resize-none"
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
        ) : (
          <button
            disabled={processing || !video1 || !video2}
            onClick={onProcess}
            className="w-full py-3 bg-[#0071e3] text-white rounded-lg text-xs font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Merge & Add Text'}
          </button>
        )}
      </div>
    </div>
  );
};
