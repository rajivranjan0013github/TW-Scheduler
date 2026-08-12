import {
  Eye,
  EyeOff,
  Film,
  Image,
  Layers3,
  Lock,
  Music2,
  Type,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TimelineClip } from './TimelineClip';
import { getTrackType } from './timelineUtils';

const TRACK_ICONS = {
  video: Film,
  text: Type,
  audio: Music2,
  image: Image,
};

const TRACK_ACCENTS = {
  video: 'bg-sky-500',
  text: 'bg-violet-500',
  audio: 'bg-emerald-500',
  image: 'bg-amber-500',
};

const TrackControlButton = ({ active = false, label, onClick, children }) => (
  <button
    type="button"
    className={`grid h-6 w-6 place-items-center rounded-md outline-none transition-colors focus-visible:ring-1 focus-visible:ring-orange-400 ${
      active
        ? 'bg-[#ff5500]/15 text-orange-300 ring-1 ring-inset ring-[#ff5500]/20'
        : 'text-zinc-500 hover:bg-[#2b2b2f] hover:text-zinc-200'
    }`}
    onClick={onClick}
    aria-label={label}
    title={label}
  >
    {children}
  </button>
);

export const TimelineTrack = ({
  track,
  labelWidth,
  height,
  duration,
  pixelsPerSecond,
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
  onUpdateTrack,
  onSnapGuideChange,
}) => {
  const type = getTrackType(track);
  const TrackIcon = TRACK_ICONS[type] || Layers3;
  const supportsMute = type === 'video' || type === 'audio';
  const hidden = Boolean(track.hidden);
  const muted = Boolean(track.muted);
  const locked = Boolean(track.locked);
  const clips = Array.isArray(track.clips) ? track.clips : [];

  const updateTrack = (changes) => onUpdateTrack?.({ trackId: track.id, changes });

  return (
    <div className="flex border-b border-[#2b2b2f]" style={{ height, minWidth: labelWidth + (duration * pixelsPerSecond) }}>
      <div
        className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r border-[#303034] bg-[#1c1c1f] px-2 shadow-[4px_0_10px_rgba(0,0,0,0.24)]"
        style={{ width: labelWidth }}
      >
        <span className={`h-7 w-1 shrink-0 rounded-full ${TRACK_ACCENTS[type] || 'bg-slate-400'}`} />
        <TrackIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-wide text-zinc-300">
          {track.name || `${type} track`}
        </span>
        <div className="flex shrink-0 items-center">
          {supportsMute && (
            <TrackControlButton
              active={muted}
              label={muted ? `Unmute ${track.name || type} track` : `Mute ${track.name || type} track`}
              onClick={() => updateTrack({ muted: !muted })}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </TrackControlButton>
          )}
          <TrackControlButton
            active={hidden}
            label={hidden ? `Show ${track.name || type} track` : `Hide ${track.name || type} track`}
            onClick={() => updateTrack({ hidden: !hidden })}
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </TrackControlButton>
          <TrackControlButton
            active={locked}
            label={locked ? `Unlock ${track.name || type} track` : `Lock ${track.name || type} track`}
            onClick={() => updateTrack({ locked: !locked })}
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </TrackControlButton>
        </div>
      </div>

      <div
        className={`relative shrink-0 ${hidden ? 'bg-[#1b1b1e] opacity-45' : 'bg-[#141416]'}`}
        style={{ width: duration * pixelsPerSecond }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onLanePointerDown?.(event);
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px)',
            backgroundSize: `${pixelsPerSecond}px 100%`,
          }}
          aria-hidden="true"
        />

        {!clips.length && (
          <span className="pointer-events-none absolute inset-0 flex items-center px-3 text-[10px] font-medium text-zinc-700">
            Drop {type} here
          </span>
        )}

        {clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackId={track.id}
            trackType={type}
            pixelsPerSecond={pixelsPerSecond}
            timelineDuration={duration}
            selected={clip.id === selectedClipId}
            locked={locked}
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
