import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Sparkles, Upload, User, VolumeX, X } from 'lucide-react';

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const AudioCard = ({
  track,
  selected,
  duration,
  onDuration,
  onHoverStart,
  onHoverEnd,
  onSelect,
}) => {
  const isNoAudio = track.sourceType === 'none';

  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={() => onHoverStart(track)}
      onPointerLeave={onHoverEnd}
      onFocus={() => onHoverStart(track)}
      onBlur={onHoverEnd}
      className={`group relative flex min-h-[88px] items-center gap-3 rounded-xl border bg-[#f7f7f8] px-4 text-left transition-all hover:border-[#ff5500]/45 hover:bg-white hover:shadow-sm ${
        selected ? 'border-[#ff5500] ring-2 ring-[#ff5500]/15' : 'border-gray-200'
      }`}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white text-gray-950 shadow-sm">
        {isNoAudio ? <VolumeX className="h-5 w-5" /> : <Music className="h-5 w-5" />}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-gray-950">{track.name}</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-gray-950">
          {isNoAudio ? '' : duration || track.description || ''}
        </span>
      </span>

      {track.url && (
        <audio
          src={track.url}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(event) => onDuration(track.id, event.currentTarget.duration)}
        />
      )}
    </button>
  );
};

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
  onUploadAudio,
  onClearAudio,
  onClose,
}) => {
  const hoverAudioRef = useRef(null);
  const [trackDurations, setTrackDurations] = useState({});

  const stopHoverAudio = useCallback(() => {
    if (hoverAudioRef.current) {
      hoverAudioRef.current.pause();
      hoverAudioRef.current.src = '';
      hoverAudioRef.current = null;
    }
  }, []);

  useEffect(() => stopHoverAudio, [stopHoverAudio]);

  const playHoverAudio = useCallback((track) => {
    stopHoverAudio();
    if (!track?.url || track.sourceType === 'none') return;

    const audio = new Audio(track.url);
    audio.volume = 0.85;
    hoverAudioRef.current = audio;
    void audio.play().catch(() => {
      stopHoverAudio();
    });
  }, [stopHoverAudio]);

  const handleDuration = useCallback((trackId, duration) => {
    setTrackDurations((currentDurations) => {
      const formattedDuration = formatDuration(duration);
      if (!formattedDuration || currentDurations[trackId] === formattedDuration) {
        return currentDurations;
      }
      return {
        ...currentDurations,
        [trackId]: formattedDuration,
      };
    });
  }, []);

  const handleClose = useCallback(() => {
    stopHoverAudio();
    onClose();
  }, [onClose, stopHoverAudio]);

  const handleClearAudio = useCallback(() => {
    stopHoverAudio();
    onClearAudio();
    onClose();
  }, [onClearAudio, onClose, stopHoverAudio]);

  const handleSelectTrack = useCallback((track) => {
    stopHoverAudio();
    onSelectTrack(track);
    onClose();
  }, [onClose, onSelectTrack, stopHoverAudio]);

  const tracks = audioDialogTab === 'platform' ? platformAudioTracks : myAudioTracks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-[18px] bg-[#f4f4f5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-xl font-bold tracking-tight text-gray-950">Select Audio</h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close audio dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-950 transition-colors hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 bg-[#f4f4f5]">
          <button
            type="button"
            onClick={() => onTabChange('platform')}
            className={`flex h-12 items-center gap-2 border-b-2 px-6 text-sm font-bold transition-colors ${
              audioDialogTab === 'platform'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Platform
          </button>
          <button
            type="button"
            onClick={() => onTabChange('my')}
            className={`flex h-12 items-center gap-2 border-b-2 px-6 text-sm font-bold transition-colors ${
              audioDialogTab === 'my'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <User className="h-4 w-4" />
            My Audios
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {audioDialogTab === 'my' && (
            <label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-gray-600 shadow-sm transition-colors hover:text-gray-950">
              <Upload className="h-3.5 w-3.5" />
              Upload audio
              <input type="file" accept="audio/*" onChange={onUploadAudio} className="hidden" />
            </label>
          )}

          {platformAudioLoading && audioDialogTab === 'platform' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500">
              Loading platform audio...
            </div>
          ) : platformAudioError && audioDialogTab === 'platform' ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm font-semibold text-red-600">
              {platformAudioError}
            </div>
          ) : tracks.length === 0 && audioDialogTab === 'my' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500">
              No audio saved yet.
            </div>
          ) : tracks.length === 0 && audioDialogTab === 'platform' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500">
              No platform audio found in this folder.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <AudioCard
                track={{ id: 'no-audio', name: 'No audio', sourceType: 'none' }}
                selected={!selectedAudio}
                duration=""
                onDuration={handleDuration}
                onHoverStart={() => {}}
                onHoverEnd={stopHoverAudio}
                onSelect={handleClearAudio}
              />

              {tracks.map((track) => (
                <AudioCard
                  key={track.id}
                  track={track}
                  selected={selectedAudio?.id === track.id}
                  duration={trackDurations[track.id]}
                  onDuration={handleDuration}
                  onHoverStart={playHoverAudio}
                  onHoverEnd={stopHoverAudio}
                  onSelect={() => handleSelectTrack(track)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-[#f4f4f5] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-500 shadow-sm transition-colors hover:text-gray-950"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
