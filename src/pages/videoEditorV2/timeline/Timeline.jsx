import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ListCollapse,
  Magnet,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Scissors,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { Playhead } from './Playhead';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import {
  clamp,
  DEFAULT_MAGNETIC_SNAP_THRESHOLD_PX,
  DEFAULT_MIN_CLIP_DURATION,
  DEFAULT_PIXELS_PER_SECOND,
  DEFAULT_RULER_HEIGHT,
  DEFAULT_SNAP_INTERVAL,
  DEFAULT_TIMELINE_DURATION,
  DEFAULT_TRACK_HEIGHT,
  roundTime,
  snapTime,
} from './timelineUtils';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const TIMELINE_LANE_INSET = 8;

const ToolButton = ({ disabled = false, label, danger = false, iconOnly = false, pressed, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex h-6 items-center rounded-md border text-[9px] font-bold outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[#7831d6] disabled:cursor-not-allowed disabled:opacity-40 ${iconOnly ? 'w-6 justify-center px-0' : 'gap-1 px-2'} ${
      danger
        ? 'border-red-900/60 bg-red-950/25 text-red-400 hover:border-red-800 hover:bg-red-950/45 hover:text-red-300'
        : pressed
          ? 'border-[#7831d6]/70 bg-[#7831d6]/20 text-[#c4b5fd] hover:border-[#7831d6] hover:bg-[#7831d6]/30'
        : 'border-[#35353a] bg-[#232326] text-zinc-300 hover:border-[#4a4a50] hover:bg-[#2a2a2e] hover:text-white'
    }`}
    title={label}
    aria-label={label}
    aria-pressed={pressed}
  >
    {children}
  </button>
);

/**
 * Reusable, controlled-friendly multi-track timeline.
 *
 * Callback payloads:
 * - onSelectClip({ trackId, clipId })
 * - onMoveClip({ trackId, clipId, timelineStart })
 * - onTrimClip({ trackId, clipId, edge, time, timelineStart, timelineEnd, sourceStart, duration })
 * - onSplitClip({ trackId, clipId, time })
 * - onDeleteClip({ trackId, clipId })
 * - onRippleDeleteClip({ trackId, clipId })
 * - onDropItem({ item, trackId, trackType, timelineStart })
 * - onRippleDeleteEnabledChange(enabled)
 */
export const Timeline = ({
  tracks = [],
  duration = DEFAULT_TIMELINE_DURATION,
  currentTime = 0,
  fps = 30,
  selectedClipId = null,
  zoom,
  defaultZoom = 1,
  magneticSnapping,
  defaultMagneticSnapping = true,
  rippleDeleteEnabled = false,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
  rulerHeight = DEFAULT_RULER_HEIGHT,
  trackHeight = DEFAULT_TRACK_HEIGHT,
  minClipDuration = DEFAULT_MIN_CLIP_DURATION,
  snapInterval = DEFAULT_SNAP_INTERVAL,
  magneticSnapThresholdPx = DEFAULT_MAGNETIC_SNAP_THRESHOLD_PX,
  className = '',
  onSeek,
  onZoomChange,
  onMagneticSnappingChange,
  onSelectClip,
  onMoveClip,
  onTrimClip,
  onSplitClip,
  onDeleteClip,
  onRippleDeleteClip,
  onRippleDeleteEnabledChange,
  expandedToLeft = false,
  onExpandedToLeftChange,
  onRequestAudio,
  onDropItem,
}) => {
  const [internalZoom, setInternalZoom] = useState(() => clamp(
    Number.isFinite(defaultZoom) ? defaultZoom : 1,
    minZoom,
    maxZoom,
  ));
  const [internalMagneticSnapping, setInternalMagneticSnapping] = useState(
    defaultMagneticSnapping !== false,
  );
  const [activeSnapTime, setActiveSnapTime] = useState(null);
  const rulerRef = useRef(null);
  const scrollViewportRef = useRef(null);
  const scrubPointerIdRef = useRef(null);
  const pendingZoomAnchorRef = useRef(null);
  const zoomValueRef = useRef(1);
  const requestedDuration = Number(duration);
  const effectiveDuration = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? Math.max(minClipDuration, requestedDuration)
    : DEFAULT_TIMELINE_DURATION;
  const requestedCurrentTime = Number(currentTime);
  const effectiveCurrentTime = Number.isFinite(requestedCurrentTime)
    ? clamp(requestedCurrentTime, 0, effectiveDuration)
    : 0;
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  const displayTracks = safeTracks
    .map((track, index) => ({
      track,
      index,
      priority: track.type === 'overlay' ? 0 : track.type === 'video' ? 1 : 2,
    }))
    .sort((left, right) => (
      left.priority - right.priority
      || left.index - right.index
    ))
    .map(({ track }) => track);
  const effectiveZoom = clamp(Number.isFinite(zoom) ? zoom : internalZoom, minZoom, maxZoom);
  const effectiveMagneticSnapping = typeof magneticSnapping === 'boolean'
    ? magneticSnapping
    : internalMagneticSnapping;
  const pixelsPerSecond = DEFAULT_PIXELS_PER_SECOND * effectiveZoom;
  const contentWidth = effectiveDuration * pixelsPerSecond;
  const magneticSnapTargets = [
    { time: 0, kind: 'timeline-start' },
    { time: effectiveDuration, kind: 'timeline-end' },
    { time: effectiveCurrentTime, kind: 'playhead' },
    ...safeTracks.flatMap((track) => {
      if (track.hidden) return [];
      return (Array.isArray(track.clips) ? track.clips : []).flatMap((clip) => {
        if (clip.enabled === false) return [];
        const start = Number(clip.timelineStart);
        const clipDuration = Number(clip.duration);
        if (!Number.isFinite(start) || !Number.isFinite(clipDuration) || clipDuration <= 0) {
          return [];
        }
        const end = start + clipDuration;
        return [
          { time: start, kind: 'clip-start', clipId: clip.id, trackId: track.id },
          { time: end, kind: 'clip-end', clipId: clip.id, trackId: track.id },
        ].filter((target) => target.time >= 0 && target.time <= effectiveDuration);
      });
    }),
  ];

  const selectedEntry = (() => {
    for (const track of safeTracks) {
      const clip = (track.clips || []).find((item) => item.id === selectedClipId);
      if (clip) return { track, clip };
    }
    return null;
  })();

  const canSplit = Boolean(selectedEntry)
    && !selectedEntry.track.locked
    && effectiveCurrentTime > (Number(selectedEntry.clip.timelineStart) || 0) + minClipDuration
    && effectiveCurrentTime < (Number(selectedEntry.clip.timelineStart) || 0)
      + (Number(selectedEntry.clip.duration) || 0)
      - minClipDuration;
  const canDelete = Boolean(selectedEntry) && !selectedEntry.track.locked;

  const setZoom = useCallback((nextZoom) => {
    const next = clamp(nextZoom, minZoom, maxZoom);
    if (!Number.isFinite(zoom)) setInternalZoom(next);
    onZoomChange?.(next);
  }, [maxZoom, minZoom, onZoomChange, zoom]);

  useEffect(() => {
    zoomValueRef.current = effectiveZoom;
  }, [effectiveZoom]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return undefined;

    const handleWheelZoom = (event) => {
      if ((!event.metaKey && !event.ctrlKey) || event.deltaY === 0) return;
      event.preventDefault();

      const currentZoom = zoomValueRef.current;
      const normalizedDelta = clamp(event.deltaY, -80, 80);
      const nextZoom = clamp(
        currentZoom * Math.exp(-normalizedDelta * 0.006),
        minZoom,
        maxZoom,
      );
      if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

      const rect = viewport.getBoundingClientRect();
      const cursorOffset = clamp(event.clientX - rect.left, 0, viewport.clientWidth);
      const anchorTime = clamp(
        (viewport.scrollLeft + cursorOffset - TIMELINE_LANE_INSET) / pixelsPerSecond,
        0,
        effectiveDuration,
      );
      pendingZoomAnchorRef.current = { anchorTime, cursorOffset };
      zoomValueRef.current = nextZoom;
      setZoom(nextZoom);
    };

    viewport.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheelZoom);
  }, [effectiveDuration, maxZoom, minZoom, pixelsPerSecond, setZoom]);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    const anchor = pendingZoomAnchorRef.current;
    if (!viewport || !anchor) return;
    viewport.scrollLeft = TIMELINE_LANE_INSET
      + (anchor.anchorTime * pixelsPerSecond)
      - anchor.cursorOffset;
    pendingZoomAnchorRef.current = null;
  }, [pixelsPerSecond]);

  const seekFromPointer = (event) => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const time = roundTime(clamp(
      snapTime((event.clientX - rect.left) / pixelsPerSecond, snapInterval),
      0,
      effectiveDuration,
    ));
    onSeek?.(time);
  };

  const handleScrubStart = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scrubPointerIdRef.current = event.pointerId;
    seekFromPointer(event);
  };

  const handleScrubMove = (event) => {
    if (scrubPointerIdRef.current !== event.pointerId) return;
    seekFromPointer(event);
  };

  const handleScrubEnd = (event) => {
    if (scrubPointerIdRef.current !== event.pointerId) return;
    seekFromPointer(event);
    scrubPointerIdRef.current = null;
  };

  const handleScrubCancel = (event) => {
    if (scrubPointerIdRef.current === event.pointerId) scrubPointerIdRef.current = null;
  };

  const handleLaneSeek = (event) => {
    if (event.button === 0) seekFromPointer(event);
  };

  const handleRulerKeyDown = (event) => {
    let nextTime = effectiveCurrentTime;
    const keyboardStep = event.shiftKey ? 1 : Math.max(snapInterval, 0.1);

    if (event.key === 'ArrowLeft') nextTime -= keyboardStep;
    else if (event.key === 'ArrowRight') nextTime += keyboardStep;
    else if (event.key === 'Home') nextTime = 0;
    else if (event.key === 'End') nextTime = effectiveDuration;
    else return;

    event.preventDefault();
    onSeek?.(roundTime(clamp(nextTime, 0, effectiveDuration)));
  };

  const splitSelectedClip = () => {
    if (!selectedEntry || !canSplit) return;
    onSplitClip?.({
      trackId: selectedEntry.track.id,
      clipId: selectedEntry.clip.id,
      time: roundTime(effectiveCurrentTime),
    });
  };

  const deleteSelectedClip = () => {
    if (!selectedEntry || !canDelete) return;
    const payload = {
      trackId: selectedEntry.track.id,
      clipId: selectedEntry.clip.id,
    };
    if (rippleDeleteEnabled) onRippleDeleteClip?.(payload);
    else onDeleteClip?.(payload);
  };

  const toggleMagneticSnapping = () => {
    const nextEnabled = !effectiveMagneticSnapping;
    if (typeof magneticSnapping !== 'boolean') setInternalMagneticSnapping(nextEnabled);
    onMagneticSnappingChange?.(nextEnabled);
    if (!nextEnabled) setActiveSnapTime(null);
  };

  return (
    <section className={`flex min-h-[220px] flex-col overflow-hidden border-t border-[#303034] bg-[#151517] text-zinc-200 [color-scheme:dark] ${className}`} aria-label="Video timeline">
      <div
        ref={scrollViewportRef}
        className="relative flex-1 overflow-auto bg-[#141416] [scrollbar-color:#45454b_#18181b]"
      >
        <div
          className="relative flex min-h-full flex-col"
          style={{
            minWidth: contentWidth + (TIMELINE_LANE_INSET * 2),
            width: contentWidth + (TIMELINE_LANE_INSET * 2),
          }}
        >
          <div
            className="sticky top-0 z-20 flex shrink-0 bg-[#1a1a1d] px-2"
            style={{ height: rulerHeight }}
          >
            <TimelineRuler
              rulerRef={rulerRef}
              duration={effectiveDuration}
              currentTime={effectiveCurrentTime}
              pixelsPerSecond={pixelsPerSecond}
              height={rulerHeight}
              onPointerDown={handleScrubStart}
              onPointerMove={handleScrubMove}
              onPointerUp={handleScrubEnd}
              onPointerCancel={handleScrubCancel}
              onKeyDown={handleRulerKeyDown}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center">
            {displayTracks.length ? displayTracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                height={track.type === 'video'
                  ? trackHeight + 24
                  : track.type === 'overlay'
                    ? Math.max(34, trackHeight - 10)
                    : trackHeight}
                duration={effectiveDuration}
                pixelsPerSecond={pixelsPerSecond}
                fps={fps}
                selectedClipId={selectedClipId}
                minClipDuration={minClipDuration}
                snapInterval={snapInterval}
                magneticSnapEnabled={effectiveMagneticSnapping}
                magneticSnapTargets={magneticSnapTargets}
                magneticSnapThresholdPx={magneticSnapThresholdPx}
                onLanePointerDown={handleLaneSeek}
                onSelectClip={onSelectClip}
                onMoveClip={onMoveClip}
                onTrimClip={onTrimClip}
                onDeleteClip={onDeleteClip}
                onRequestAudio={onRequestAudio}
                onDropItem={onDropItem}
                onSnapGuideChange={setActiveSnapTime}
              />
            )) : (
              <div className="flex h-24 items-center justify-center text-xs font-medium text-zinc-600">
                Add a track to begin editing
              </div>
            )}
          </div>

          {Number.isFinite(activeSnapTime) && (
            <div
              className="pointer-events-none absolute inset-y-0 z-[35] w-px bg-[#c4b5fd] shadow-[0_0_8px_rgba(120,49,214,0.9)]"
              style={{ left: TIMELINE_LANE_INSET + (activeSnapTime * pixelsPerSecond) }}
              aria-hidden="true"
            />
          )}

          <Playhead
            currentTime={effectiveCurrentTime}
            left={TIMELINE_LANE_INSET + (effectiveCurrentTime * pixelsPerSecond)}
            top={rulerHeight}
            onPointerDown={handleScrubStart}
            onPointerMove={handleScrubMove}
            onPointerUp={handleScrubEnd}
            onPointerCancel={handleScrubCancel}
          />
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-[#303034] bg-[#1c1c1f] px-3">
        <div className="flex shrink-0 items-center gap-1.5">
          <ToolButton
            iconOnly
            label={expandedToLeft ? 'Restore timeline width' : 'Extend timeline into left panel'}
            pressed={expandedToLeft}
            onClick={() => onExpandedToLeftChange?.(!expandedToLeft)}
          >
            {expandedToLeft
              ? <PanelLeftOpen className="h-3 w-3" />
              : <PanelLeftClose className="h-3 w-3" />}
          </ToolButton>
          <span className="mx-0.5 h-4 w-px bg-white/10" aria-hidden="true" />
          <ToolButton iconOnly label="Split selected clip at playhead (S)" disabled={!canSplit} onClick={splitSelectedClip}>
            <Scissors className="h-3 w-3" />
          </ToolButton>
          <ToolButton
            iconOnly
            label={rippleDeleteEnabled
              ? 'Ripple delete selected clip and close gap'
              : 'Delete selected clip'}
            danger
            disabled={!canDelete}
            onClick={deleteSelectedClip}
          >
            <Trash2 className="h-3 w-3" />
          </ToolButton>
          <ToolButton
            iconOnly
            label={rippleDeleteEnabled
              ? 'Disable ripple delete mode'
              : 'Enable ripple delete mode'}
            pressed={rippleDeleteEnabled}
            onClick={() => onRippleDeleteEnabledChange?.(!rippleDeleteEnabled)}
          >
            <ListCollapse className="h-3 w-3" />
          </ToolButton>
          <ToolButton
            iconOnly
            label={effectiveMagneticSnapping ? 'Disable magnetic snapping' : 'Enable magnetic snapping'}
            pressed={effectiveMagneticSnapping}
            onClick={toggleMagneticSnapping}
          >
            <Magnet className="h-3 w-3" />
          </ToolButton>
        </div>

        <div className="flex items-center gap-2" aria-label="Timeline zoom controls">
          <ZoomIn className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 outline-none transition hover:bg-white/[0.06] hover:text-white focus-visible:ring-1 focus-visible:ring-[#7831d6] disabled:opacity-35"
            onClick={() => setZoom(effectiveZoom - ZOOM_STEP)}
            disabled={effectiveZoom <= minZoom}
            aria-label="Zoom timeline out"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            step="0.05"
            value={effectiveZoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 w-36 cursor-pointer accent-[#7831d6]"
            aria-label="Timeline zoom"
            aria-valuetext={`${Math.round(effectiveZoom * 100)} percent`}
          />
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 outline-none transition hover:bg-white/[0.06] hover:text-white focus-visible:ring-1 focus-visible:ring-[#7831d6] disabled:opacity-35"
            onClick={() => setZoom(effectiveZoom + ZOOM_STEP)}
            disabled={effectiveZoom >= maxZoom}
            aria-label="Zoom timeline in"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-right text-[9px] font-bold tabular-nums text-zinc-400">
            {Math.round(effectiveZoom * 100)}%
          </span>
        </div>
      </div>
    </section>
  );
};
