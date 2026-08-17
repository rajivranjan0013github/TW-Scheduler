import { Layers3, Music2, Plus } from 'lucide-react';
import { TimelineClip } from './TimelineClip';
import { getTrackType } from './timelineUtils';

export const TimelineTrack = ({
  track,
  height,
  duration,
  pixelsPerSecond,
  fps,
  selectedClipId,
  minClipDuration,
  snapInterval,
  magneticSnapEnabled,
  magneticSnapTargets,
  magneticSnapThresholdPx,
  onLanePointerDown,
  onSelectClip,
  onMoveClip,
  onTrimClip,
  onDeleteClip,
  onRequestAudio,
  onSnapGuideChange,
}) => {
  const type = getTrackType(track);
  const hidden = Boolean(track.hidden);
  const clips = Array.isArray(track.clips) ? track.clips : [];

  return (
    <div
      className="mx-2 mt-2 overflow-hidden rounded-xl border border-white/[0.06] bg-[#1d1e22] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
      style={{ height, minWidth: duration * pixelsPerSecond, width: duration * pixelsPerSecond }}
    >
      <div
        className={`relative h-full ${hidden ? 'bg-[#1b1b1e] opacity-45' : 'bg-[#202126]'}`}
        aria-label={track.name || `${type} track`}
        style={{ width: duration * pixelsPerSecond }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onLanePointerDown?.(event);
        }}
      >
        {!clips.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center px-5 text-zinc-400">
            {type === 'overlay' && (
              <div className="flex items-center gap-3 text-[12px] font-bold">
                <Layers3 className="h-4 w-4" />
                <span>Add elements</span>
              </div>
            )}
            {type === 'video' && (
              <div className="flex items-center gap-4 text-[12px] font-semibold text-zinc-300">
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-white/[0.07] text-zinc-300">
                  <Plus className="h-6 w-6" />
                </span>
                <span>or drag and drop media</span>
              </div>
            )}
            {type === 'audio' && (
              <button
                type="button"
                className="pointer-events-auto flex items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] font-bold outline-none transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-orange-400"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestAudio?.();
                }}
              >
                <Music2 className="h-4 w-4" />
                <span>Add audio</span>
              </button>
            )}
          </div>
        )}

        {clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackId={track.id}
            trackType={type}
            pixelsPerSecond={pixelsPerSecond}
            height={Math.max(24, height - 12)}
            fps={fps}
            timelineDuration={duration}
            selected={clip.id === selectedClipId}
            minDuration={minClipDuration}
            snapInterval={snapInterval}
            magneticSnapEnabled={magneticSnapEnabled}
            magneticSnapTargets={magneticSnapTargets}
            magneticSnapThresholdPx={magneticSnapThresholdPx}
            onSelectClip={onSelectClip}
            onMoveClip={onMoveClip}
            onTrimClip={onTrimClip}
            onDeleteClip={onDeleteClip}
            onSnapGuideChange={onSnapGuideChange}
          />
        ))}
      </div>
    </div>
  );
};
