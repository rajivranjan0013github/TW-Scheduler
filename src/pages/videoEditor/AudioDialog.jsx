import { Music, RefreshCw, Upload, X } from 'lucide-react';

/**
 * Modal dialog for selecting/uploading audio tracks.
 */
export const AudioDialog = ({
  audioDialogTab,
  onTabChange,
  selectedAudio,
  platformAudioTracks,
  platformAudioLoading,
  platformAudioError,
  myAudioTracks,
  onSelectTrack,
  onSavePlatformTrack,
  onRefreshPlatformAudio,
  onUploadAudio,
  onClearAudio,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Swap Audio</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">Replace the merged video audio track.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audio dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-3">
          {[
            ['platform', 'Platform Audio'],
            ['my', 'My Audio'],
          ].map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => onTabChange(tabId)}
              className={`border-b-2 px-3 pb-2 text-xs font-bold transition-colors ${
                audioDialogTab === tabId
                  ? 'border-[#ff5500] text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {audioDialogTab === 'platform' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-gray-500">
                  Audio from platform library
                </p>
                <button
                  type="button"
                  onClick={onRefreshPlatformAudio}
                  disabled={platformAudioLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${platformAudioLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {platformAudioLoading ? (
                <div className="rounded-lg border border-gray-200 p-4 text-center text-xs text-gray-400">
                  Loading platform audio...
                </div>
              ) : platformAudioError ? (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-center text-xs text-red-600">
                  {platformAudioError}
                </div>
              ) : platformAudioTracks.length === 0 ? (
                <div className="rounded-lg border border-gray-200 p-4 text-center text-xs text-gray-400">
                  No platform audio found in this folder.
                </div>
              ) : (
                platformAudioTracks.map((track) => {
                const isSelected = selectedAudio?.id === track.id;
                const isSaved = myAudioTracks.some((item) => item.id === track.id);

                return (
                  <div
                    key={track.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isSelected ? 'border-[#ff5500] bg-orange-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                          <p className="truncate text-xs font-bold text-gray-900">{track.name}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">{track.description}</p>
                      </div>

                      <div className="flex flex-shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectTrack(track)}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-[#ff5500] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Use'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSavePlatformTrack(track)}
                          disabled={isSaved}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-45"
                        >
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </div>

                    {track.url && (
                      <audio src={track.url} controls className="mt-3 h-8 w-full" />
                    )}
                  </div>
                );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-100">
                <Upload className="h-4 w-4" />
                <span>Upload audio to My Audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={onUploadAudio}
                  className="hidden"
                />
              </label>

              {myAudioTracks.length === 0 ? (
                <div className="rounded-lg border border-gray-200 p-4 text-center text-xs text-gray-400">
                  No audio saved yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {myAudioTracks.map((track) => {
                    const isSelected = selectedAudio?.id === track.id;

                    return (
                      <div
                        key={track.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isSelected ? 'border-[#ff5500] bg-orange-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                              <p className="truncate text-xs font-bold text-gray-900">{track.name}</p>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">{track.description || 'Saved audio'}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onSelectTrack(track)}
                            className={`flex-shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${
                              isSelected
                                ? 'bg-[#ff5500] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Use'}
                          </button>
                        </div>

                        {track.url && (
                          <audio src={track.url} controls className="mt-3 h-8 w-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onClearAudio}
            className="text-xs font-semibold text-gray-500 underline hover:text-black"
          >
            Use original audio
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
