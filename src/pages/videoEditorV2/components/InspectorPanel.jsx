import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Eraser,
  FileMusic,
  LoaderCircle,
  MoveHorizontal,
  MoveVertical,
  PenTool,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_PATCH_REMOVAL,
  DEFAULT_TEXT_STYLE,
  findPatchKeyframeIndex,
  getClipSourceTime,
  MAX_PLAYBACK_RATE,
  MIN_CLIP_DURATION,
  MIN_CROP_SIZE,
  MIN_PLAYBACK_RATE,
  normalizeCrop,
  normalizePatchRemoval,
  removePatchRemovalKeyframe,
  resolvePatchRemovalAtSourceTime,
  upsertPatchRemovalKeyframe,
} from '../project';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const MAX_TEXT_STROKE_WIDTH = 100;
const TEXT_STROKE_STEP = 0.25;
const TEXT_STROKE_PRESETS = [
  { label: 'None', value: 0 },
  { label: '2', value: 2 },
  { label: '4', value: 4 },
  { label: '8', value: 8 },
];

const PATCH_MASK_TOOLS = [
  { id: 'points', label: 'Points', Icon: PenTool },
  { id: 'rectangle', label: 'Rectangle', Icon: Square },
];

const formatCompactNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  if (Number.isInteger(numericValue)) return String(numericValue);
  return numericValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const Section = ({ title, action = null, children }) => (
  <section className="border-b border-white/10 px-4 py-4 last:border-b-0">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] !text-[#c5c9d0]">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const RangeControl = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  resetValue,
  formatValue,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}) => (
  <label className="block space-y-1.5">
    <span className="flex items-center justify-between text-[10px] font-bold !text-[#e1e4e8]">
      {label}
      <span className="rounded-md bg-white/5 px-1.5 py-0.5 tabular-nums !text-[#c5c9d0]">
        {formatValue ? formatValue(value) : value}{suffix}
      </span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerDown={onInteractionStart}
      onPointerUp={onInteractionEnd}
      onPointerCancel={onInteractionEnd}
      onKeyDown={onInteractionStart}
      onKeyUp={onInteractionEnd}
      onBlur={onInteractionEnd}
      onDoubleClick={(event) => {
        if (!Number.isFinite(resetValue)) return;
        event.preventDefault();
        onChange(clamp(resetValue, min, max));
        onInteractionEnd?.();
      }}
      title={Number.isFinite(resetValue) ? `Double-click to reset ${label}` : undefined}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#ff5500]"
    />
  </label>
);

const PropertyCard = ({ title, description, action = null, children }) => (
  <section className="rounded-2xl border border-white/10 bg-[#171a20] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
    {(title || description || action) && (
      <div className="-mx-3 -mt-3 mb-3 flex items-start justify-between gap-2 rounded-t-2xl border-b border-white/10 bg-[#11151b] px-3 py-2.5">
        <div className="min-w-0">
          {title && <h3 className="text-xs font-extrabold !text-[#f3f5f7]">{title}</h3>}
          {description && (
            <p className="mt-1 text-[9px] font-medium leading-relaxed !text-[#8f96a1]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

const CollapsiblePropertyCard = ({ title, summary, action = null, children }) => (
  <details className="group rounded-2xl border border-white/10 bg-[#171a20] shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl bg-[#11151b] px-3 py-3 transition hover:bg-[#141820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff5500]/70 group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">
        <span className="block text-xs font-extrabold !text-[#f3f5f7]">{title}</span>
        {summary && (
          <span className="mt-0.5 block truncate text-[9px] font-medium !text-[#8f96a1]">{summary}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {action}
        <ChevronDown className="h-4 w-4 text-[#8f96a1] transition-transform group-open:rotate-180" />
      </span>
    </summary>
    <div className="border-t border-white/10 px-3 pb-3 pt-2">
      {children}
    </div>
  </details>
);

const getStepPrecision = (step) => {
  const stepText = String(step);
  return stepText.includes('.') ? stepText.split('.')[1].length : 0;
};

const ScrubbableNumberControl = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  formatValue,
  onChange,
  onInteractionStart,
  onInteractionEnd,
  compact = false,
  className = '',
}) => {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const inputRef = useRef(null);
  const dragRef = useRef(null);
  const editInteractionRef = useRef(false);
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const displayValue = formatValue ? formatValue(numericValue) : formatCompactNumber(numericValue);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const emitValue = (nextValue) => {
    const precision = getStepPrecision(step);
    const roundedValue = Number(clamp(nextValue, min, max).toFixed(precision));
    onChange(roundedValue);
  };

  const beginEditing = () => {
    if (editing) return;
    editInteractionRef.current = true;
    onInteractionStart?.();
    setDraftValue(String(numericValue));
    setEditing(true);
  };

  const finishEditing = () => {
    const parsedDraft = Number(draftValue);
    if (draftValue.trim() !== '' && Number.isFinite(parsedDraft)) emitValue(parsedDraft);
    setEditing(false);
    if (editInteractionRef.current) {
      editInteractionRef.current = false;
      onInteractionEnd?.();
    }
  };

  const endScrub = (event, { editOnClick = false } = {}) => {
    const interaction = dragRef.current;
    if (!interaction) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onInteractionEnd?.();
    if (editOnClick && !interaction.dragged) beginEditing();
  };

  if (editing) {
    return (
      <div className={`flex h-9 min-w-0 items-center gap-2 px-2 ${compact ? 'justify-start' : 'justify-between'} ${className}`}>
        <span className="truncate text-[10px] font-bold !text-[#aeb3bc]">{label}</span>
        <label className="flex h-8 w-[72px] shrink-0 items-center rounded-md border border-[#ff5500]/60 bg-[#111318] px-1.5 shadow-[0_0_0_1px_rgba(255,85,0,0.08)]">
          <input
            ref={inputRef}
            type="number"
            value={draftValue}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const nextDraft = event.target.value;
              setDraftValue(nextDraft);
              if (nextDraft.trim() === '') return;
              const nextValue = Number(nextDraft);
              if (Number.isFinite(nextValue)) emitValue(nextValue);
            }}
            onBlur={finishEditing}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
            }}
            className="min-w-0 flex-1 appearance-none bg-transparent text-right text-[11px] font-extrabold tabular-nums !text-[#4ea1ff] outline-none [color-scheme:dark] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={label}
          />
          {suffix && <span className="ml-0.5 shrink-0 text-[9px] font-bold !text-[#8f96a1]">{suffix}</span>}
        </label>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`group/scrub flex h-9 min-w-0 cursor-ew-resize select-none items-center gap-2 rounded-lg px-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${compact ? 'justify-start' : 'justify-between'} ${className}`}
      title="Drag left or right to adjust; click to type"
      aria-label={`${label}: ${displayValue}${suffix}. Drag left or right to adjust, or click to type.`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startValue: numericValue,
          dragged: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        onInteractionStart?.();
      }}
      onPointerMove={(event) => {
        const interaction = dragRef.current;
        if (!interaction || interaction.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - interaction.startX;
        if (Math.abs(deltaX) >= 3) interaction.dragged = true;
        if (!interaction.dragged) return;
        emitValue(interaction.startValue + ((deltaX / 4) * step));
      }}
      onPointerUp={(event) => endScrub(event, { editOnClick: true })}
      onPointerCancel={(event) => endScrub(event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          beginEditing();
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault();
          onInteractionStart?.();
          emitValue(numericValue + step);
          onInteractionEnd?.();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault();
          onInteractionStart?.();
          emitValue(numericValue - step);
          onInteractionEnd?.();
        }
      }}
    >
      <span className="truncate text-[10px] font-bold !text-[#aeb3bc]">{label}</span>
      <span className="flex shrink-0 items-baseline gap-1">
        <span className="text-xs font-extrabold tabular-nums !text-[#4ea1ff] transition group-hover/scrub:!text-[#7bb8ff]">{displayValue}</span>
        {suffix && <span className="text-[10px] font-bold !text-[#8f96a1]">{suffix}</span>}
      </span>
    </button>
  );
};

const InspectorRangeControl = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  resetValue,
  formatValue,
  onChange,
  onInteractionStart,
  onInteractionEnd,
  compact = false,
}) => {
  const reset = () => {
    if (!Number.isFinite(resetValue)) return;
    onChange(clamp(resetValue, min, max));
    onInteractionEnd?.();
  };

  return (
    <div className="flex items-center gap-1.5">
      <ScrubbableNumberControl
        className="flex-1"
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        formatValue={formatValue}
        onChange={onChange}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
        compact={compact}
      />
      {Number.isFinite(resetValue) && (
        <button
          type="button"
          onClick={reset}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#737b87] transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
          title={`Reset ${label}`}
          aria-label={`Reset ${label}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

const CardResetButton = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[9px] font-bold !text-[#858d99] transition hover:bg-white/5 hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
    title={label}
  >
    <RotateCcw className="h-3 w-3" />
    Reset
  </button>
);

const VideoInspector = ({
  clip,
  currentTime,
  fps,
  maxDuration,
  onUpdate,
  onSeek,
  onPlaybackRateChange,
  onExtractAudio,
  extractingAudio = false,
  extractAudioDisabled = false,
}) => {
  const playbackSourceSpanRef = useRef(null);
  const transform = {
    x: Number(clip.transform?.x ?? 0.5),
    y: Number(clip.transform?.y ?? 0.5),
    scale: Number(clip.transform?.scale ?? 1),
    rotation: Number(clip.transform?.rotation || 0),
    opacity: Number(clip.transform?.opacity ?? 1),
    flipX: Boolean(clip.transform?.flipX),
    flipY: Boolean(clip.transform?.flipY),
  };
  const crop = normalizeCrop(clip.crop);
  const patchRemoval = normalizePatchRemoval(clip.patchRemoval);
  const patchSourceTime = getClipSourceTime(clip, currentTime);
  const resolvedPatchRemoval = resolvePatchRemovalAtSourceTime(
    patchRemoval,
    patchSourceTime,
  );
  const currentPatchKeyframeIndex = findPatchKeyframeIndex(
    patchRemoval,
    patchSourceTime,
    0.5 / Math.max(1, Number(fps) || 30),
  );
  const previousPatchKeyframe = [...patchRemoval.keyframes]
    .reverse()
    .find((keyframe) => keyframe.sourceTime < patchSourceTime - 0.0005);
  const nextPatchKeyframe = patchRemoval.keyframes
    .find((keyframe) => keyframe.sourceTime > patchSourceTime + 0.0005);
  const updateTransform = (changes) => onUpdate({ transform: { ...clip.transform, ...changes } });
  const updateCrop = (changes) => onUpdate({ crop: normalizeCrop({ ...crop, ...changes }) });
  const updatePatchRemoval = (changes) => onUpdate({
    patchRemoval: normalizePatchRemoval({ ...patchRemoval, ...changes }),
  });
  const updateAnimatedPatchValues = (changes) => {
    if (patchRemoval.autoKeyframe || patchRemoval.keyframes.length > 0) {
      const keyedPatch = upsertPatchRemovalKeyframe(
        patchRemoval,
        patchSourceTime,
        { ...resolvedPatchRemoval, ...changes },
      );
      onUpdate({
        patchRemoval: normalizePatchRemoval({
          ...keyedPatch,
          ...(changes.editing === undefined ? {} : { editing: changes.editing }),
        }),
      });
      return;
    }
    updatePatchRemoval(changes);
  };
  const seekToPatchSourceTime = (sourceTime) => {
    if (typeof onSeek !== 'function') return;
    const timelineTime = Number(clip.timelineStart || 0)
      + (sourceTime - Number(clip.sourceStart || 0))
        / Math.max(0.01, Number(clip.playbackRate) || 1);
    onSeek(timelineTime);
  };
  const togglePatchKeyframe = () => {
    if (currentPatchKeyframeIndex >= 0) {
      onUpdate({
        patchRemoval: removePatchRemovalKeyframe(patchRemoval, patchSourceTime),
      });
      return;
    }
    if (resolvedPatchRemoval.targetPath.length < 3) return;
    onUpdate({
      patchRemoval: upsertPatchRemovalKeyframe(
        patchRemoval,
        patchSourceTime,
        resolvedPatchRemoval,
      ),
    });
  };
  const playbackRate = clamp(
    Number(clip.playbackRate) || 1,
    MIN_PLAYBACK_RATE,
    MAX_PLAYBACK_RATE,
  );
  const clipDuration = Math.max(MIN_CLIP_DURATION, Number(clip.duration) || 0);
  const sourceSpan = clipDuration * playbackRate;
  const availableTimelineDuration = Math.max(
    MIN_CLIP_DURATION,
    Number(maxDuration || 30) - Number(clip.timelineStart || 0),
  );
  const minimumPlaybackRate = clamp(
    sourceSpan / availableTimelineDuration,
    MIN_PLAYBACK_RATE,
    MAX_PLAYBACK_RATE,
  );
  const maximumPlaybackRate = Math.max(
    minimumPlaybackRate,
    clamp(
      sourceSpan / Math.min(MIN_CLIP_DURATION, clipDuration),
      MIN_PLAYBACK_RATE,
      MAX_PLAYBACK_RATE,
    ),
  );
  const playbackRangeLimited = minimumPlaybackRate > MIN_PLAYBACK_RATE
    || maximumPlaybackRate < MAX_PLAYBACK_RATE;
  const startPlaybackRateInteraction = () => {
    if (playbackSourceSpanRef.current === null) {
      playbackSourceSpanRef.current = sourceSpan;
    }
  };
  const endPlaybackRateInteraction = () => {
    playbackSourceSpanRef.current = null;
  };
  const changePlaybackRate = (nextPlaybackRate) => {
    onPlaybackRateChange(nextPlaybackRate, {
      sourceSpan: playbackSourceSpanRef.current ?? sourceSpan,
    });
  };
  const extractionUnavailable = extractingAudio
    || extractAudioDisabled
    || typeof onExtractAudio !== 'function';
  const extractAudio = () => {
    if (extractionUnavailable) return;
    onExtractAudio(clip.id);
  };
  const resetLayout = () => {
    if (clip.type === 'video') changePlaybackRate(clamp(1, minimumPlaybackRate, maximumPlaybackRate));
    onUpdate({
      fit: 'fit',
      transform: {
        ...clip.transform,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
      },
    });
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 p-2">
      <div className="col-start-2 row-start-1 min-w-0 space-y-2">
        <PropertyCard
          title="Layout"
          action={<CardResetButton label="Reset layout" onClick={resetLayout} />}
        >
        {clip.type === 'video' && (
          <div className="mb-3 border-b border-white/10 pb-3">
            <InspectorRangeControl
              label="Speed"
              value={playbackRate}
              min={minimumPlaybackRate}
              max={maximumPlaybackRate}
              step={0.01}
              suffix="×"
              formatValue={(value) => Number(value).toFixed(2)}
              onChange={changePlaybackRate}
              onInteractionStart={startPlaybackRateInteraction}
              onInteractionEnd={endPlaybackRateInteraction}
            />
            {playbackRangeLimited && (
              <p className="mt-2 text-[9px] font-medium leading-relaxed !text-[#9da4ae]">
                Range limited by the project timeline.
              </p>
            )}
          </div>
        )}

        <div>
          <InspectorRangeControl
            label="Scale"
            value={Math.round(transform.scale * 100)}
            min={10}
            max={300}
            suffix="%"
            onChange={(value) => updateTransform({ scale: value / 100 })}
          />
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-2">
          <p className="shrink-0 text-[11px] font-bold !text-[#dfe2e6]">Position</p>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ScrubbableNumberControl
              label="X"
              compact
              value={Math.round((transform.x - 0.5) * 200)}
              min={-100}
              max={100}
              suffix="%"
              onChange={(value) => updateTransform({ x: value / 200 + 0.5 })}
            />
            <ScrubbableNumberControl
              label="Y"
              compact
              value={Math.round((transform.y - 0.5) * 200)}
              min={-100}
              max={100}
              suffix="%"
              onChange={(value) => updateTransform({ y: value / 200 + 0.5 })}
            />
          </div>
        </div>

        <div className="mt-2 grid min-w-0 grid-cols-[minmax(72px,0.8fr)_minmax(0,1.2fr)] items-center gap-1.5">
          <InspectorRangeControl compact label="Rotation" value={Math.round(transform.rotation)} min={-180} max={180} suffix="°" onChange={(rotation) => updateTransform({ rotation })} />
          <div className="grid min-w-0 grid-cols-2 gap-1" role="group" aria-label="Flip video">
            <button
              type="button"
              aria-pressed={transform.flipX}
              aria-label="Flip horizontally"
              title="Flip horizontally"
              onClick={() => updateTransform({ flipX: !transform.flipX })}
              className={`flex h-9 min-w-0 items-center justify-center gap-0.5 rounded-lg border px-1 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${transform.flipX
                ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
                : 'border-white/10 bg-[#111318] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
            >
              <span aria-hidden="true">↔</span>
              <span>Horizontal</span>
            </button>
            <button
              type="button"
              aria-pressed={transform.flipY}
              aria-label="Flip vertically"
              title="Flip vertically"
              onClick={() => updateTransform({ flipY: !transform.flipY })}
              className={`flex h-9 min-w-0 items-center justify-center gap-0.5 rounded-lg border px-1 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${transform.flipY
                ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
                : 'border-white/10 bg-[#111318] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
            >
              <span aria-hidden="true">↕</span>
              <span>Vertical</span>
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2" role="group" aria-label="Video sizing mode">
          <button
            type="button"
            onClick={() => onUpdate({ fit: 'fill' })}
            aria-pressed={clip.fit === 'fill'}
            aria-label="Fill canvas with video"
            title="Fill canvas with video"
            className={`flex h-9 items-center gap-2 rounded-lg px-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${clip.fit === 'fill'
              ? 'bg-white/5 text-[#ff7a33]'
              : 'text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}
          >
            <span className="relative h-5 w-6 shrink-0" aria-hidden="true">
              <span className="absolute inset-x-1 top-1 h-3 border-2 border-current" />
              <span className="absolute inset-x-0 top-0 h-0.5 bg-current" />
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-current" />
            </span>
            Fill
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ fit: 'fit' })}
            aria-pressed={clip.fit === 'fit'}
            aria-label="Fit video inside canvas"
            title="Fit video inside canvas"
            className={`flex h-9 items-center gap-2 rounded-lg px-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${clip.fit === 'fit'
              ? 'bg-white/5 text-[#ff7a33]'
              : 'text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}
          >
            <span className="relative flex h-5 w-6 shrink-0 items-center justify-center border-2 border-current" aria-hidden="true">
              <span className="h-3 w-2 border border-current bg-current/20" />
            </span>
            Fit
          </button>
        </div>
        </PropertyCard>
      </div>

      <div className="col-start-1 row-start-1 min-w-0 space-y-2">
        <CollapsiblePropertyCard
          title="Crop"
          action={(
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onUpdate({ crop: { x: 0, y: 0, width: 1, height: 1 } });
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#737b87] transition hover:bg-white/5 hover:text-[#ff7a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
              title="Reset crop"
              aria-label="Reset crop"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        >
          <div className="grid grid-cols-2 gap-2">
            <ScrubbableNumberControl label="Left" value={Math.round(crop.x * 100)} min={0} max={Math.round((1 - crop.width) * 100)} suffix="%" onChange={(value) => updateCrop({ x: value / 100 })} />
            <ScrubbableNumberControl label="Top" value={Math.round(crop.y * 100)} min={0} max={Math.round((1 - crop.height) * 100)} suffix="%" onChange={(value) => updateCrop({ y: value / 100 })} />
            <ScrubbableNumberControl label="Width" value={Math.round(crop.width * 100)} min={MIN_CROP_SIZE * 100} max={Math.round((1 - crop.x) * 100)} suffix="%" onChange={(value) => updateCrop({ width: value / 100 })} />
            <ScrubbableNumberControl label="Height" value={Math.round(crop.height * 100)} min={MIN_CROP_SIZE * 100} max={Math.round((1 - crop.y) * 100)} suffix="%" onChange={(value) => updateCrop({ height: value / 100 })} />
          </div>
        </CollapsiblePropertyCard>

        {clip.type === 'video' && (
          <PropertyCard
            title="Patch removal"
            action={patchRemoval.enabled ? (
              <button
                type="button"
                onClick={() => onUpdate({ patchRemoval: DEFAULT_PATCH_REMOVAL })}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#737b87] transition hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                title="Remove patch effect"
                aria-label="Remove patch effect"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          >
            {!patchRemoval.enabled ? (
              <button
                type="button"
                onClick={() => updatePatchRemoval({
                  enabled: true,
                  editing: true,
                  targetPath: [],
                  sourceOffset: DEFAULT_PATCH_REMOVAL.sourceOffset,
                  autoKeyframe: false,
                  keyframes: [],
                })}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111318] px-3 text-[10px] font-extrabold text-[#dfe2e6] transition hover:border-violet-400/50 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                <Eraser className="h-4 w-4" />
                Create source patch
              </button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updatePatchRemoval({
                      editing: !patchRemoval.editing,
                      pathClosed: patchRemoval.maskTool === 'points'
                        && patchRemoval.targetPath.length >= 3
                        ? true
                        : patchRemoval.pathClosed,
                    })}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ${patchRemoval.editing
                      ? 'border-violet-400/70 bg-violet-400/15 text-violet-200'
                      : 'border-white/10 bg-[#111318] text-[#b8bec8] hover:border-white/20 hover:text-white'}`}
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    {patchRemoval.editing ? 'Done editing' : 'Edit patch'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePatchRemoval({
                      editing: true,
                      targetPath: [],
                      pathClosed: patchRemoval.maskTool !== 'points',
                      sourceOffset: DEFAULT_PATCH_REMOVAL.sourceOffset,
                      keyframes: [],
                    })}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#111318] px-2 text-[9px] font-bold text-[#b8bec8] transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Redraw
                  </button>
                </div>

                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] !text-[#858d99]">
                    Mask shape
                  </p>
                  <div className="grid grid-cols-2 gap-1" role="group" aria-label="Mask drawing tool">
                    {PATCH_MASK_TOOLS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => updatePatchRemoval({
                          maskTool: id,
                          pathClosed: id !== 'points',
                          editing: true,
                          targetPath: [],
                          sourceOffset: DEFAULT_PATCH_REMOVAL.sourceOffset,
                          keyframes: [],
                        })}
                        aria-pressed={patchRemoval.maskTool === id}
                        title={`Draw ${label.toLowerCase()} mask`}
                        className={`flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border text-[8px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ${patchRemoval.maskTool === id
                          ? 'border-violet-400/70 bg-violet-400/15 text-violet-200'
                          : 'border-white/10 bg-[#111318] text-[#9299a4] hover:border-white/20 hover:text-white'}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#111318] p-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!previousPatchKeyframe}
                      onClick={() => seekToPatchSourceTime(previousPatchKeyframe.sourceTime)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#aab0ba] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      title="Previous patch keyframe"
                      aria-label="Previous patch keyframe"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={togglePatchKeyframe}
                      disabled={resolvedPatchRemoval.targetPath.length < 3}
                      aria-pressed={currentPatchKeyframeIndex >= 0}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${currentPatchKeyframeIndex >= 0
                        ? 'border-violet-400/70 bg-violet-400/15 text-violet-300'
                        : 'border-white/10 text-[#aab0ba] hover:border-violet-400/50 hover:text-violet-200'}`}
                      title={currentPatchKeyframeIndex >= 0
                        ? 'Remove keyframe at current frame'
                        : 'Add keyframe at current frame'}
                      aria-label={currentPatchKeyframeIndex >= 0
                        ? 'Remove patch keyframe at current frame'
                        : 'Add patch keyframe at current frame'}
                    >
                      <Diamond className={`h-3.5 w-3.5 ${currentPatchKeyframeIndex >= 0 ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      disabled={!nextPatchKeyframe}
                      onClick={() => seekToPatchSourceTime(nextPatchKeyframe.sourceTime)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#aab0ba] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      title="Next patch keyframe"
                      aria-label="Next patch keyframe"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePatchRemoval({
                        autoKeyframe: !patchRemoval.autoKeyframe,
                      })}
                      aria-pressed={patchRemoval.autoKeyframe}
                      className={`ml-auto flex h-8 items-center gap-1 rounded-lg border px-2 text-[8px] font-extrabold transition ${patchRemoval.autoKeyframe
                        ? 'border-violet-400/70 bg-violet-400/15 text-violet-200'
                        : 'border-white/10 text-[#9299a4] hover:border-white/20 hover:text-white'}`}
                      title="Automatically create a keyframe when the patch changes"
                    >
                      <Diamond className="h-2.5 w-2.5" />
                      Auto
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between px-1 text-[8px] font-bold tabular-nums !text-[#7f8792]">
                    <span>{patchRemoval.keyframes.length} keyframe{patchRemoval.keyframes.length === 1 ? '' : 's'}</span>
                    <span>{patchSourceTime.toFixed(2)}s source</span>
                  </div>
                </div>

                <InspectorRangeControl
                  label="Edge softness"
                  value={Math.round(resolvedPatchRemoval.feather * 1000) / 10}
                  min={0}
                  max={15}
                  step={0.1}
                  suffix="%"
                  onChange={(value) => updateAnimatedPatchValues({ feather: value / 100 })}
                />
                <InspectorRangeControl
                  label="Patch opacity"
                  value={Math.round(resolvedPatchRemoval.opacity * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => updateAnimatedPatchValues({ opacity: value / 100 })}
                />
                <button
                  type="button"
                  onClick={() => updateAnimatedPatchValues({
                    sourceOffset: DEFAULT_PATCH_REMOVAL.sourceOffset,
                    editing: true,
                  })}
                  className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[9px] font-bold text-[#9097a2] transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset source position
                </button>
                <p className="text-[9px] font-medium leading-relaxed !text-[#858d99]">
                  Purple is the covered area. Drag the green source to clean nearby pixels.
                </p>
              </div>
            )}
          </PropertyCard>
        )}

        {clip.type === 'video' && (
          <PropertyCard title="Audio">
            <InspectorRangeControl label="Volume" value={Math.round(Number(clip.volume ?? 1) * 100)} min={0} max={100} resetValue={100} suffix="%" onChange={(value) => onUpdate({ volume: value / 100 })} />
            <div className="mt-2">
              <InspectorRangeControl label="Opacity" value={Math.round(transform.opacity * 100)} min={0} max={100} resetValue={100} suffix="%" onChange={(value) => updateTransform({ opacity: value / 100 })} />
            </div>
            <div className="mt-3 grid grid-cols-[42px_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ muted: !clip.muted })}
              aria-pressed={Boolean(clip.muted)}
              aria-label={clip.muted ? 'Unmute video clip' : 'Mute video clip'}
              title={clip.muted ? 'Unmute video clip' : 'Mute video clip'}
              className={`flex h-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${clip.muted
                ? 'border-[#ff5500]/60 bg-[#ff5500]/10 text-[#ff7a33]'
                : 'border-white/10 text-[#9da4ae] hover:bg-white/5 hover:text-white'}`}
            >
              {clip.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={extractAudio}
                disabled={extractionUnavailable}
                aria-busy={extractingAudio}
                aria-label={extractingAudio
                  ? 'Extracting MP3 from selected video'
                  : 'Extract MP3 from selected video'}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111318] px-3 text-[10px] font-extrabold text-[#dfe2e6] transition hover:border-[#ff5500]/45 hover:text-[#ff8a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 disabled:cursor-not-allowed disabled:text-[#727985] disabled:opacity-70"
              >
                {extractingAudio ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileMusic className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span aria-live="polite">
                  {extractingAudio ? 'Extracting MP3…' : 'Extract MP3'}
                </span>
              </button>
            </div>
            </div>
          </PropertyCard>
        )}

        {clip.type !== 'video' && (
          <CollapsiblePropertyCard title="Advanced">
            <InspectorRangeControl label="Opacity" value={Math.round(transform.opacity * 100)} min={0} max={100} resetValue={100} suffix="%" onChange={(value) => updateTransform({ opacity: value / 100 })} />
          </CollapsiblePropertyCard>
        )}
      </div>

    </div>
  );
};

const TextInspector = ({ clip, onUpdate, onGenerateText }) => {
  const style = clip.style || {};
  const transform = clip.transform || {};
  const positionX = Number(transform.x ?? 0.5);
  const positionY = Number(transform.y ?? 0.25);
  const fontSize = clamp(Number(style.fontSize) || DEFAULT_TEXT_STYLE.fontSize, 12, 240);
  const rawStrokeWidth = Number(style.strokeWidth);
  const strokeWidth = clamp(
    Number.isFinite(rawStrokeWidth) ? rawStrokeWidth : DEFAULT_TEXT_STYLE.strokeWidth,
    0,
    MAX_TEXT_STROKE_WIDTH,
  );
  const fontWeightValue = ({
    Thin: '100',
    Light: '300',
    Regular: '400',
    Medium: '500',
    SemiBold: '600',
    Bold: '700',
  })[style.fontWeight] || String(style.fontWeight || DEFAULT_TEXT_STYLE.fontWeight);
  const updateStyle = (changes) => onUpdate({ style: { ...style, ...changes } });
  const updateTransform = (changes) => onUpdate({ transform: { ...transform, ...changes } });
  const updateStrokeWidth = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    updateStyle({
      strokeWidth: Math.round(
        clamp(numericValue, 0, MAX_TEXT_STROKE_WIDTH) / TEXT_STROKE_STEP,
      ) * TEXT_STROKE_STEP,
    });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 p-2">
      <div className="min-w-0 space-y-2">
        <PropertyCard
          title="Text"
          action={(
            <button
              type="button"
              onClick={onGenerateText}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-[#ff5500]/35 bg-[#ff5500]/10 px-2 text-[9px] font-extrabold !text-[#ff8a4d] transition hover:border-[#ff5500]/60 hover:bg-[#ff5500]/20 hover:!text-[#ffa074] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
              title="Generate text with AI"
            >
              <Sparkles className="h-3 w-3" />
              Generate with AI
            </button>
          )}
        >
          <textarea
            value={clip.text || ''}
            onChange={(event) => onUpdate({ text: event.target.value })}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-[#111318] p-3 text-sm font-semibold leading-relaxed !text-[#f5f7fa] outline-none placeholder:!text-[#8b929d] focus:border-[#ff5500]/60 [color-scheme:dark]"
            placeholder="Enter text"
          />
        </PropertyCard>

        <PropertyCard title="Typography">
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 space-y-1">
              <span className="text-[9px] font-bold !text-[#aeb4bd]">Font</span>
              <select value={style.fontFamily || 'Outfit'} onChange={(event) => updateStyle({ fontFamily: event.target.value })} className="h-9 w-full rounded-lg border border-white/10 bg-[#111318] px-2 text-[10px] font-bold !text-[#f5f7fa] outline-none focus:border-[#ff5500]/60 [color-scheme:dark]">
                <option value="Outfit">TikTok Sans</option>
                <option value="Roboto">Roboto</option>
                <option value="Anton">Impact</option>
                <option value="Arimo">Arial</option>
              </select>
            </label>
            <label className="min-w-0 space-y-1">
              <span className="text-[9px] font-bold !text-[#aeb4bd]">Weight</span>
              <select value={fontWeightValue} onChange={(event) => updateStyle({ fontWeight: event.target.value })} className="h-9 w-full rounded-lg border border-white/10 bg-[#111318] px-2 text-[10px] font-bold !text-[#f5f7fa] outline-none focus:border-[#ff5500]/60 [color-scheme:dark]">
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">SemiBold</option>
                <option value="700">Bold</option>
                <option value="900">Black</option>
              </select>
            </label>
          </div>

          <div className="mt-2">
            <ScrubbableNumberControl label="Font size" value={fontSize} min={12} max={240} suffix="px" onChange={(nextFontSize) => updateStyle({ fontSize: nextFontSize })} />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              ['Text', style.color || '#ffffff', 'color'],
              ['Stroke', style.strokeColor || '#000000', 'strokeColor'],
              ['Background', style.backgroundColor === 'transparent' ? '#000000' : (style.backgroundColor || '#000000'), 'backgroundColor'],
            ].map(([label, value, key]) => (
              <label key={key} className="min-w-0 space-y-1 text-center">
                <span className="block truncate text-[8px] font-bold !text-[#aeb4bd]">{label}</span>
                <input
                  type="color"
                  value={value}
                  onChange={(event) => updateStyle(key === 'backgroundColor'
                    ? { backgroundColor: event.target.value, backgroundType: 'Solid' }
                    : { [key]: event.target.value })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#111318] p-1"
                />
              </label>
            ))}
          </div>
          {String(style.backgroundType || 'None').toLowerCase() !== 'none' && (
            <button type="button" onClick={() => updateStyle({ backgroundType: 'None', backgroundColor: 'transparent' })} className="mt-2 text-[9px] font-bold text-[#8b929d] hover:text-white">
              Remove background
            </button>
          )}
        </PropertyCard>

      </div>

      <div className="min-w-0 space-y-2">
        <PropertyCard title="Transform">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold !text-[#dfe2e6]">Center</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateTransform({ x: 0.5 })}
                aria-label="Center text horizontally on canvas"
                aria-pressed={Math.abs(positionX - 0.5) < 0.0001}
                title="Center horizontally"
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${Math.abs(positionX - 0.5) < 0.0001
                  ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
                  : 'border-white/10 bg-[#111318] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
              >
                <MoveHorizontal className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateTransform({ y: 0.5 })}
                aria-label="Center text vertically on canvas"
                aria-pressed={Math.abs(positionY - 0.5) < 0.0001}
                title="Center vertically"
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${Math.abs(positionY - 0.5) < 0.0001
                  ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
                  : 'border-white/10 bg-[#111318] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
              >
                <MoveVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold !text-[#dfe2e6]">Position</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <ScrubbableNumberControl compact label="X" value={Math.round(positionX * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ x: value / 100 })} />
              <ScrubbableNumberControl compact label="Y" value={Math.round(positionY * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ y: value / 100 })} />
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <ScrubbableNumberControl label="Scale" value={Math.round(Number(transform.scale || 1) * 100)} min={25} max={300} suffix="%" onChange={(value) => updateTransform({ scale: value / 100 })} />
            <ScrubbableNumberControl label="Rotation" value={Math.round(Number(transform.rotation || 0))} min={-180} max={180} suffix="°" onChange={(rotation) => updateTransform({ rotation })} />
            <ScrubbableNumberControl label="Opacity" value={Math.round(Number(transform.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ opacity: value / 100 })} />
          </div>
        </PropertyCard>

        <PropertyCard title="Stroke">
          <ScrubbableNumberControl
            label="Width"
            value={strokeWidth}
            min={0}
            max={MAX_TEXT_STROKE_WIDTH}
            step={TEXT_STROKE_STEP}
            suffix="px"
            formatValue={formatCompactNumber}
            onChange={updateStrokeWidth}
          />
          <div className="mt-2 grid grid-cols-4 gap-1">
            {TEXT_STROKE_PRESETS.map((preset) => {
              const active = Math.abs(strokeWidth - preset.value) < 0.001;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  title={preset.value === 0 ? 'Remove stroke' : `Set stroke to ${preset.value} output pixels`}
                  onClick={() => updateStrokeWidth(preset.value)}
                  className={`h-8 rounded-lg border text-[9px] font-extrabold tabular-nums transition ${active
                    ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
                    : 'border-white/10 bg-[#111318] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </PropertyCard>
      </div>
    </div>
  );
};

const AudioInspector = ({ clip, onUpdate }) => (
  <>
    <Section title="Audio">
      <p className="truncate text-xs font-bold text-[#e6e8ec]">{clip.name || 'Audio clip'}</p>
      <div className="mt-4 space-y-3">
        <RangeControl label="Volume" value={Math.round(Number(clip.volume ?? 1) * 100)} min={0} max={100} resetValue={100} suffix="%" onChange={(value) => onUpdate({ volume: value / 100 })} />
        <RangeControl label="Fade in" value={Number(clip.fadeIn || 0)} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} resetValue={0} suffix="s" onChange={(fadeIn) => onUpdate({ fadeIn })} />
        <RangeControl label="Fade out" value={Number(clip.fadeOut || 0)} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} resetValue={0} suffix="s" onChange={(fadeOut) => onUpdate({ fadeOut })} />
      </div>
      <button type="button" onClick={() => onUpdate({ muted: !clip.muted })} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${clip.muted ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/10 text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}>
        {clip.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        {clip.muted ? 'Muted' : 'Audio enabled'}
      </button>
    </Section>
  </>
);

export const InspectorPanel = ({
  className = '',
  selectedClip,
  currentTime = 0,
  fps = 30,
  maxDuration,
  onUpdateClip,
  onSeek,
  onSetPlaybackRate,
  onExtractAudio,
  onGenerateText,
  extractingAudio = false,
  extractAudioDisabled = false,
}) => {
  if (!selectedClip) {
    return (
      <aside className={`flex min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#111318] ${className}`}>
        <div className="flex h-12 items-center gap-2 border-b border-white/10 px-4">
          <SlidersHorizontal className="h-4 w-4 text-[#ff5500]" />
          <h2 className="text-xs font-bold text-[#f5f7fa]">Clip properties</h2>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-xs">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff5500]/10 text-[#ff6a1a]">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <p className="mt-3 text-xs font-bold text-[#e6e8ec]">Select a timeline clip</p>
            <p className="mt-1 text-[10px] font-medium leading-relaxed text-[#8b929d]">
              Crop, transform, typography, and audio controls will appear here.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const resetSelectedClipProperties = () => {
    if (selectedClip.type === 'video' && typeof onSetPlaybackRate === 'function') {
      onSetPlaybackRate(1);
    }
    onUpdateClip({
      ...(selectedClip.type === 'video' || selectedClip.type === 'image'
        ? { fit: 'fit' }
        : {}),
      ...(selectedClip.type === 'video'
        ? { volume: 1, muted: false }
        : {}),
      transform: {
        x: 0.5,
        y: selectedClip.type === 'text' ? 0.25 : 0.5,
        scale: 1,
        rotation: 0,
        opacity: 1,
        flipX: false,
        flipY: false,
      },
      crop: { x: 0, y: 0, width: 1, height: 1 },
      ...(selectedClip.type === 'video'
        ? { patchRemoval: DEFAULT_PATCH_REMOVAL }
        : {}),
    });
  };

  return (
    <aside className={`min-h-0 overflow-y-auto border-l border-white/10 bg-[#111318] text-[#e6e8ec] [color-scheme:dark] ${className}`}>
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-white/10 bg-[#111318] px-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider !text-[#aeb4bd]">{selectedClip.type} properties</p>
          <h2 className="truncate text-xs font-bold !text-[#f5f7fa]">{selectedClip.name || selectedClip.text || 'Selected clip'}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetSelectedClipProperties}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#727985] transition hover:bg-white/10 hover:text-[#ff7a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
            title="Reset all properties"
            aria-label="Reset all properties"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
        <VideoInspector
          clip={selectedClip}
          currentTime={currentTime}
          fps={fps}
          maxDuration={maxDuration}
          onUpdate={onUpdateClip}
          onSeek={onSeek}
          onPlaybackRateChange={onSetPlaybackRate}
          onExtractAudio={onExtractAudio}
          extractingAudio={extractingAudio}
          extractAudioDisabled={extractAudioDisabled}
        />
      )}
      {selectedClip.type === 'text' && (
        <TextInspector
          clip={selectedClip}
          onUpdate={onUpdateClip}
          onGenerateText={onGenerateText}
        />
      )}
      {selectedClip.type === 'audio' && <AudioInspector clip={selectedClip} onUpdate={onUpdateClip} />}
    </aside>
  );
};
