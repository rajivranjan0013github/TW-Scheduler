import { useEffect, useState } from 'react';
import { Film, Image, Music2, Type } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { VideoFrameStrip } from './VideoFrameStrip';
import {
  clamp,
  DEFAULT_MIN_CLIP_DURATION,
  DEFAULT_MAGNETIC_SNAP_THRESHOLD_PX,
  DEFAULT_SNAP_INTERVAL,
  findNearestMagneticSnap,
  getClipLabel,
  roundTime,
  snapTime,
} from './timelineUtils';

const TYPE_STYLES = {
  video: {
    Icon: Film,
    className: 'border-[#34363b] bg-[#0b0c0f] text-white',
  },
  text: {
    Icon: Type,
    className: 'border-[#188f94] bg-[#0d7479] text-white',
  },
  audio: {
    Icon: Music2,
    className: 'border-[#2f817b] bg-[#185f5a] text-white',
  },
  image: {
    Icon: Image,
    className: 'border-[#59616d] bg-[#343a43] text-white',
  },
};

const getInteractionValues = ({ interaction, clip }) => ({
  timelineStart: interaction?.timelineStart ?? (Number(clip.timelineStart) || 0),
  sourceStart: interaction?.sourceStart ?? (Number(clip.sourceStart) || 0),
  duration: interaction?.duration ?? (Number(clip.duration) || DEFAULT_MIN_CLIP_DURATION),
});

export const TimelineClip = ({
  clip,
  trackId,
  trackType,
  pixelsPerSecond,
  height,
  fps = 30,
  timelineDuration,
  selected = false,
  locked = false,
  minDuration = DEFAULT_MIN_CLIP_DURATION,
  snapInterval = DEFAULT_SNAP_INTERVAL,
  magneticSnapEnabled = true,
  magneticSnapTargets = [],
  magneticSnapThresholdPx = DEFAULT_MAGNETIC_SNAP_THRESHOLD_PX,
  onSelectClip,
  onMoveClip,
  onTrimClip,
  onDeleteClip,
  onSeekFromPointer,
  onSnapGuideChange,
}) => {
  const [interaction, setInteraction] = useState(null);
  const clipType = String(clip.type || trackType || 'video').toLowerCase();
  const visual = TYPE_STYLES[clipType] || TYPE_STYLES.video;
  const { Icon } = visual;
  const values = getInteractionValues({ interaction, clip });
  const clipWidth = Math.max(8, values.duration * pixelsPerSecond);
  const committedClipWidth = Math.max(
    8,
    (Number(clip.duration) || DEFAULT_MIN_CLIP_DURATION) * pixelsPerSecond,
  );
  const sourceDuration = Number(clip.sourceDuration);
  const playbackRate = Number(clip.playbackRate) > 0 ? Number(clip.playbackRate) : 1;
  const hasSourceDurationLimit = sourceDuration > 0 && !(clipType === 'audio' && clip.loop);
  const eligibleSnapTargets = magneticSnapTargets.filter((target) => (
    !target || target.clipId !== clip.id
  ));
  const magneticThresholdSeconds = Math.max(0, Number(magneticSnapThresholdPx) || 0)
    / Math.max(1, pixelsPerSecond);
  const showFrameStrip = clipType === 'video' && Boolean(clip.sourceUrl);
  const clipBorderRadius = Math.min(20, Math.max(8, Number(height || 0) * 0.4));

  useEffect(() => () => onSnapGuideChange?.(null), [onSnapGuideChange]);

  const resolveMagneticSnap = (edges, isValid) => {
    if (!magneticSnapEnabled) return null;
    return findNearestMagneticSnap({
      edges,
      targets: eligibleSnapTargets,
      threshold: magneticThresholdSeconds,
      isValid,
    });
  };

  const startInteraction = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectClip?.({ trackId, clipId: clip.id });
    if (mode === 'move') onSeekFromPointer?.(event);
    onSnapGuideChange?.(null);
    if (locked || event.button !== 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteraction({
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      initialTimelineStart: Number(clip.timelineStart) || 0,
      initialSourceStart: Number(clip.sourceStart) || 0,
      initialDuration: Math.max(minDuration, Number(clip.duration) || minDuration),
      timelineStart: Number(clip.timelineStart) || 0,
      sourceStart: Number(clip.sourceStart) || 0,
      duration: Math.max(minDuration, Number(clip.duration) || minDuration),
    });
  };

  const handlePointerMove = (event) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const deltaSeconds = (event.clientX - interaction.startClientX) / pixelsPerSecond;

    if (interaction.mode === 'move') {
      const desiredStart = interaction.initialTimelineStart + deltaSeconds;
      const maximumStart = timelineDuration - interaction.initialDuration;
      const magneticSnap = resolveMagneticSnap(
        [
          { edge: 'start', time: desiredStart },
          { edge: 'end', time: desiredStart + interaction.initialDuration },
        ],
        ({ delta }) => {
          const snappedStart = desiredStart + delta;
          return snappedStart >= -1e-9 && snappedStart <= maximumStart + 1e-9;
        },
      );
      const nextStart = magneticSnap
        ? clamp(desiredStart + magneticSnap.delta, 0, maximumStart)
        : clamp(snapTime(desiredStart, snapInterval), 0, maximumStart);
      onSnapGuideChange?.(magneticSnap?.targetTime ?? null);
      setInteraction((current) => ({ ...current, timelineStart: roundTime(nextStart) }));
      return;
    }

    if (interaction.mode === 'trim-start') {
      const earliestFromSource = interaction.initialTimelineStart - (interaction.initialSourceStart / playbackRate);
      const latestStart = interaction.initialTimelineStart + interaction.initialDuration - minDuration;
      const earliestStart = Math.max(0, earliestFromSource);
      const desiredStart = interaction.initialTimelineStart + deltaSeconds;
      const magneticSnap = resolveMagneticSnap(
        [{ edge: 'start', time: desiredStart }],
        ({ targetTime }) => (
          targetTime >= earliestStart - 1e-9 && targetTime <= latestStart + 1e-9
        ),
      );
      const nextStart = magneticSnap
        ? clamp(magneticSnap.targetTime, earliestStart, latestStart)
        : clamp(snapTime(desiredStart, snapInterval), earliestStart, latestStart);
      onSnapGuideChange?.(magneticSnap?.targetTime ?? null);
      const appliedDelta = nextStart - interaction.initialTimelineStart;
      setInteraction((current) => ({
        ...current,
        timelineStart: roundTime(nextStart),
        sourceStart: roundTime(interaction.initialSourceStart + (appliedDelta * playbackRate)),
        duration: roundTime(interaction.initialDuration - appliedDelta),
      }));
      return;
    }

    const maxTimelineDuration = timelineDuration - interaction.initialTimelineStart;
    const availableSourceDuration = hasSourceDurationLimit
      ? Math.max(minDuration, (sourceDuration - interaction.initialSourceStart) / playbackRate)
      : maxTimelineDuration;
    const maximumDuration = Math.min(maxTimelineDuration, availableSourceDuration);
    const minimumEnd = interaction.initialTimelineStart + minDuration;
    const maximumEnd = interaction.initialTimelineStart + maximumDuration;
    const desiredEnd = interaction.initialTimelineStart + interaction.initialDuration + deltaSeconds;
    const magneticSnap = resolveMagneticSnap(
      [{ edge: 'end', time: desiredEnd }],
      ({ targetTime }) => (
        targetTime >= minimumEnd - 1e-9 && targetTime <= maximumEnd + 1e-9
      ),
    );
    const nextEnd = magneticSnap
      ? clamp(magneticSnap.targetTime, minimumEnd, maximumEnd)
      : snapTime(desiredEnd, snapInterval);
    const nextDuration = clamp(
      nextEnd - interaction.initialTimelineStart,
      minDuration,
      maximumDuration,
    );
    onSnapGuideChange?.(magneticSnap?.targetTime ?? null);
    setInteraction((current) => ({ ...current, duration: roundTime(nextDuration) }));
  };

  const finishInteraction = (event, cancelled = false) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const finished = interaction;
    setInteraction(null);
    onSnapGuideChange?.(null);
    if (cancelled) return;

    if (finished.mode === 'move') {
      if (Math.abs(finished.timelineStart - finished.initialTimelineStart) > 0.0001) {
        onMoveClip?.({
          trackId,
          clipId: clip.id,
          timelineStart: finished.timelineStart,
        });
      }
      return;
    }

    const edge = finished.mode === 'trim-start' ? 'start' : 'end';
    const changed = Math.abs(finished.timelineStart - finished.initialTimelineStart) > 0.0001
      || Math.abs(finished.duration - finished.initialDuration) > 0.0001;
    if (changed) {
      const timelineEnd = roundTime(finished.timelineStart + finished.duration);
      onTrimClip?.({
        trackId,
        clipId: clip.id,
        edge,
        time: edge === 'start' ? finished.timelineStart : timelineEnd,
        timelineStart: finished.timelineStart,
        timelineEnd,
        sourceStart: finished.sourceStart,
        duration: finished.duration,
      });
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectClip?.({ trackId, clipId: clip.id });
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !locked) {
      event.preventDefault();
      onDeleteClip?.({ trackId, clipId: clip.id });
    }
  };

  return (
    <div
      className={`group absolute inset-y-0 overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-8px_14px_rgba(0,0,0,0.20),0_2px_7px_rgba(0,0,0,0.35)] outline-none transition-[box-shadow,filter] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9b6cff] ${visual.className} ${
        selected
          ? 'z-20'
          : `z-10 ${showFrameStrip ? 'hover:border-[#656870]' : 'hover:brightness-110'}`
      } ${locked ? 'cursor-not-allowed opacity-75' : interaction ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: values.timelineStart * pixelsPerSecond,
        width: clipWidth,
        touchAction: 'none',
        borderRadius: clipBorderRadius,
        border: selected ? '3px solid #9b6cff' : undefined,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${getClipLabel(clip)}, starts at ${values.timelineStart.toFixed(1)} seconds, duration ${values.duration.toFixed(1)} seconds`}
      aria-pressed={selected}
      onPointerDown={(event) => startInteraction(event, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishInteraction(event)}
      onPointerCancel={(event) => finishInteraction(event, true)}
      onKeyDown={handleKeyDown}
    >
      {clip.thumbnailUrl && clipType === 'video' && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${clip.thumbnailUrl})` }}
          aria-hidden="true"
        />
      )}

      {showFrameStrip && (
        <VideoFrameStrip
          clip={clip}
          width={committedClipWidth}
          height={height}
          fps={fps}
          pixelsPerSecond={pixelsPerSecond}
        />
      )}

      {clipType === 'audio' && (
        <AudioWaveform clip={{ ...clip, ...values }} selected={selected} />
      )}

      <div className="relative flex h-full min-w-0 items-center gap-1.5 px-2.5">
        {clipType !== 'video' && <Icon className="h-3.5 w-3.5 shrink-0" />}
      </div>

      {selected && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            borderRadius: 'inherit',
            boxShadow: 'inset 0 0 0 1px #121318',
          }}
          aria-hidden="true"
        />
      )}

      {selected && !locked && (
        <>
          <button
            type="button"
            className="absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize bg-transparent"
            style={{ touchAction: 'none' }}
            onPointerDown={(event) => startInteraction(event, 'trim-start')}
            aria-label={`Trim start of ${getClipLabel(clip)}`}
            title="Trim start"
          >
          </button>
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize bg-transparent"
            style={{ touchAction: 'none' }}
            onPointerDown={(event) => startInteraction(event, 'trim-end')}
            aria-label={`Trim end of ${getClipLabel(clip)}`}
            title="Trim end"
          >
          </button>
        </>
      )}
    </div>
  );
};
