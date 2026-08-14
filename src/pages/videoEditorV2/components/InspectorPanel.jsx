import { useRef } from 'react';
import {
  FileMusic,
  LoaderCircle,
  MoveHorizontal,
  MoveVertical,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_TEXT_STYLE,
  MAX_PLAYBACK_RATE,
  MIN_CLIP_DURATION,
  MIN_CROP_SIZE,
  MIN_PLAYBACK_RATE,
  normalizeCrop,
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
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#ff5500]"
    />
  </label>
);

const NumberControl = ({ label, value, min, max, step = 1, suffix = '', onChange }) => (
  <label className="block min-w-0 space-y-1">
    <span className="text-[9px] font-bold uppercase tracking-wide !text-[#aeb4bd]">{label}</span>
    <div className="flex h-9 items-center rounded-xl border border-white/10 bg-[#171a20] px-2.5 focus-within:border-[#ff5500]/60 focus-within:bg-[#1b1f27]">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        className="min-w-0 flex-1 bg-transparent text-[11px] font-bold !text-[#f5f7fa] outline-none [color-scheme:dark]"
      />
      {suffix && <span className="text-[9px] font-bold !text-[#aeb4bd]">{suffix}</span>}
    </div>
  </label>
);

const VideoInspector = ({
  clip,
  maxDuration,
  onUpdate,
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
  const updateTransform = (changes) => onUpdate({ transform: { ...clip.transform, ...changes } });
  const updateCrop = (changes) => onUpdate({ crop: normalizeCrop({ ...crop, ...changes }) });
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

  return (
    <>
      {clip.type === 'video' && (
        <Section title="Playback">
          <RangeControl
            label="Playback speed"
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
              Range limited to keep the complete clip inside the project timeline.
            </p>
          )}
        </Section>
      )}

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberControl
            label="Position X"
            value={Math.round((transform.x - 0.5) * 200)}
            min={-100}
            max={100}
            suffix="%"
            onChange={(value) => updateTransform({ x: value / 200 + 0.5 })}
          />
          <NumberControl
            label="Position Y"
            value={Math.round((transform.y - 0.5) * 200)}
            min={-100}
            max={100}
            suffix="%"
            onChange={(value) => updateTransform({ y: value / 200 + 0.5 })}
          />
        </div>
        <div className="mt-3 space-y-3">
          <RangeControl label="Scale" value={Math.round(transform.scale * 100)} min={10} max={300} suffix="%" onChange={(value) => updateTransform({ scale: value / 100 })} />
          <RangeControl label="Rotation" value={Math.round(transform.rotation)} min={-180} max={180} suffix="°" onChange={(rotation) => updateTransform({ rotation })} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => updateTransform({ flipX: !transform.flipX })} className={`rounded-xl border px-3 py-2 text-[10px] font-bold transition ${transform.flipX ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]' : 'border-white/10 text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}>
            Flip horizontal
          </button>
          <button type="button" onClick={() => updateTransform({ flipY: !transform.flipY })} className={`rounded-xl border px-3 py-2 text-[10px] font-bold transition ${transform.flipY ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]' : 'border-white/10 text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}>
            Flip vertical
          </button>
        </div>
      </Section>

      <Section title="Crop">
        <div className="grid grid-cols-2 gap-2">
          <NumberControl label="Left" value={Math.round(crop.x * 100)} min={0} max={Math.round((1 - crop.width) * 100)} suffix="%" onChange={(value) => updateCrop({ x: value / 100 })} />
          <NumberControl label="Top" value={Math.round(crop.y * 100)} min={0} max={Math.round((1 - crop.height) * 100)} suffix="%" onChange={(value) => updateCrop({ y: value / 100 })} />
          <NumberControl label="Width" value={Math.round(crop.width * 100)} min={MIN_CROP_SIZE * 100} max={Math.round((1 - crop.x) * 100)} suffix="%" onChange={(value) => updateCrop({ width: value / 100 })} />
          <NumberControl label="Height" value={Math.round(crop.height * 100)} min={MIN_CROP_SIZE * 100} max={Math.round((1 - crop.y) * 100)} suffix="%" onChange={(value) => updateCrop({ height: value / 100 })} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onUpdate({ fit: 'fit' })} className={`rounded-xl border py-2 text-[10px] font-bold transition ${clip.fit === 'fit' ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]' : 'border-white/10 text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}>Fit</button>
          <button type="button" onClick={() => onUpdate({ fit: 'fill' })} className={`rounded-xl border py-2 text-[10px] font-bold transition ${clip.fit === 'fill' ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]' : 'border-white/10 text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}>Fill</button>
        </div>
        <button
          type="button"
          onClick={() => onUpdate({ crop: { x: 0, y: 0, width: 1, height: 1 } })}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[10px] font-bold text-[#aeb3bc] transition hover:bg-white/5 hover:text-white"
        >
          <RotateCcw className="h-3 w-3" />
          Reset crop
        </button>
        <p className="mt-2 text-[9px] font-medium leading-relaxed !text-[#9da4ae]">
          Crop keeps an area from the original media. Fill can trim that area further to cover the canvas.
        </p>
      </Section>

      <Section title="Appearance & sound">
        <div className="space-y-3">
          <RangeControl label="Opacity" value={Math.round(transform.opacity * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ opacity: value / 100 })} />
          {clip.type === 'video' && (
            <>
              <RangeControl label="Clip volume" value={Math.round(Number(clip.volume ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(value) => onUpdate({ volume: value / 100 })} />
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={extractAudio}
                  disabled={extractionUnavailable}
                  aria-busy={extractingAudio}
                  aria-label={extractingAudio
                    ? 'Extracting MP3 from selected video'
                    : 'Extract MP3 from selected video'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff5500]/35 bg-[#ff5500]/10 px-3 py-2.5 text-[10px] font-extrabold text-[#ff7a33] transition hover:border-[#ff5500]/55 hover:bg-[#ff5500]/15 hover:text-[#ff8a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.025] disabled:text-[#727985] disabled:opacity-70"
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
                <p className="text-[9px] font-medium leading-relaxed !text-[#9da4ae]">
                  Creates an editable MP3 clip and mutes the original audio.
                </p>
              </div>
            </>
          )}
        </div>
      </Section>
    </>
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
  const strokeSliderMax = Math.min(
    MAX_TEXT_STROKE_WIDTH,
    Math.max(
      24,
      Math.ceil((fontSize * 0.2) / 4) * 4,
      Math.ceil(strokeWidth / 4) * 4,
    ),
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
    <>
      <Section
        title="Text"
        action={(
          <button
            type="button"
            onClick={onGenerateText}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-[#ff5500]/35 bg-[#ff5500]/10 px-2.5 text-[9px] font-extrabold !text-[#ff8a4d] transition hover:border-[#ff5500]/60 hover:bg-[#ff5500]/20 hover:!text-[#ffa074] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
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
          rows={4}
          className="w-full resize-none rounded-xl border border-white/10 bg-[#171a20] p-3 text-xs font-semibold leading-relaxed !text-[#f5f7fa] outline-none placeholder:!text-[#8b929d] focus:border-[#ff5500]/60 focus:bg-[#1b1f27] [color-scheme:dark]"
          placeholder="Enter text"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateTransform({ x: 0.5 })}
            aria-label="Center text horizontally on canvas"
            aria-pressed={Math.abs(positionX - 0.5) < 0.0001}
            title="Center text horizontally"
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${Math.abs(positionX - 0.5) < 0.0001
              ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
              : 'border-white/10 bg-[#171a20] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
          >
            <MoveHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => updateTransform({ y: 0.5 })}
            aria-label="Center text vertically on canvas"
            aria-pressed={Math.abs(positionY - 0.5) < 0.0001}
            title="Center text vertically"
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70 ${Math.abs(positionY - 0.5) < 0.0001
              ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
              : 'border-white/10 bg-[#171a20] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
          >
            <MoveVertical className="h-4 w-4" />
          </button>
        </div>
      </Section>
      <Section title="Typography">
        <label className="block space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-wide !text-[#aeb4bd]">Font</span>
          <select value={style.fontFamily || 'Outfit'} onChange={(event) => updateStyle({ fontFamily: event.target.value })} className="h-9 w-full rounded-xl border border-white/10 bg-[#171a20] px-2.5 text-[11px] font-bold !text-[#f5f7fa] outline-none [color-scheme:dark]">
            <option value="Outfit">TikTok Sans</option>
            <option value="Roboto">Roboto</option>
            <option value="Anton">Impact</option>
            <option value="Arimo">Arial</option>
          </select>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberControl label="Size" value={fontSize} min={12} max={240} suffix="px" onChange={(nextFontSize) => updateStyle({ fontSize: nextFontSize })} />
          <label className="block space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-wide !text-[#aeb4bd]">Weight</span>
            <select value={fontWeightValue} onChange={(event) => updateStyle({ fontWeight: event.target.value })} className="h-9 w-full rounded-xl border border-white/10 bg-[#171a20] px-2.5 text-[11px] font-bold !text-[#f5f7fa] outline-none [color-scheme:dark]">
              <option value="400">Regular</option><option value="500">Medium</option><option value="600">SemiBold</option><option value="700">Bold</option><option value="900">Black</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['Text', style.color || '#ffffff', 'color'],
            ['Stroke color', style.strokeColor || '#000000', 'strokeColor'],
            ['Background', style.backgroundColor === 'transparent' ? '#000000' : (style.backgroundColor || '#000000'), 'backgroundColor'],
          ].map(([label, value, key]) => (
            <label key={key} className="space-y-1 text-center">
              <span className="block text-[8px] font-bold uppercase !text-[#aeb4bd]">{label}</span>
              <input
                type="color"
                value={value}
                onChange={(event) => updateStyle(key === 'backgroundColor'
                  ? { backgroundColor: event.target.value, backgroundType: 'Solid' }
                  : { [key]: event.target.value })}
                className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-[#171a20] p-1"
              />
            </label>
          ))}
        </div>
        {String(style.backgroundType || 'None').toLowerCase() !== 'none' && (
          <button type="button" onClick={() => updateStyle({ backgroundType: 'None', backgroundColor: 'transparent' })} className="mt-2 text-[9px] font-bold text-[#8b929d] underline hover:text-white">
            Remove text background
          </button>
        )}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <RangeControl
            label="Stroke width"
            value={strokeWidth}
            min={0}
            max={strokeSliderMax}
            step={TEXT_STROKE_STEP}
            suffix=" px"
            formatValue={formatCompactNumber}
            onChange={updateStrokeWidth}
          />
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_88px] items-end gap-2">
            <div className="min-w-0 space-y-1">
              <span className="block text-[9px] font-bold uppercase tracking-wide !text-[#aeb4bd]">Quick widths</span>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_STROKE_PRESETS.map((preset) => {
                  const active = Math.abs(strokeWidth - preset.value) < 0.001;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={active}
                      title={preset.value === 0 ? 'Remove stroke' : `Set stroke to ${preset.value} output pixels`}
                      onClick={() => updateStrokeWidth(preset.value)}
                      className={`h-9 rounded-lg border text-[9px] font-extrabold tabular-nums transition ${active
                        ? 'border-[#ff5500]/70 bg-[#ff5500]/10 text-[#ff7a33]'
                        : 'border-white/10 bg-[#171a20] text-[#aeb3bc] hover:border-white/20 hover:text-white'}`}
                    >
                      {preset.label}
                      {preset.value > 0 && <span className="font-medium !text-[#9da4ae]"> px</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <NumberControl
              label="Exact"
              value={strokeWidth}
              min={0}
              max={MAX_TEXT_STROKE_WIDTH}
              step={TEXT_STROKE_STEP}
              suffix="px"
              onChange={updateStrokeWidth}
            />
          </div>
          <p className="mt-2 text-[9px] font-medium leading-relaxed !text-[#9da4ae]">
            Width uses output pixels; the editor preview scales it to the canvas.
          </p>
        </div>
      </Section>
      <Section title="Position">
        <div className="grid grid-cols-2 gap-2">
          <NumberControl label="X" value={Math.round(positionX * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ x: value / 100 })} />
          <NumberControl label="Y" value={Math.round(positionY * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ y: value / 100 })} />
        </div>
        <div className="mt-3 space-y-3">
          <RangeControl label="Scale" value={Math.round(Number(transform.scale || 1) * 100)} min={25} max={300} suffix="%" onChange={(value) => updateTransform({ scale: value / 100 })} />
          <RangeControl label="Rotation" value={Math.round(Number(transform.rotation || 0))} min={-180} max={180} suffix="°" onChange={(rotation) => updateTransform({ rotation })} />
          <RangeControl label="Opacity" value={Math.round(Number(transform.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(value) => updateTransform({ opacity: value / 100 })} />
        </div>
      </Section>
    </>
  );
};

const AudioInspector = ({ clip, onUpdate }) => (
  <>
    <Section title="Audio">
      <p className="truncate text-xs font-bold text-[#e6e8ec]">{clip.name || 'Audio clip'}</p>
      <div className="mt-4 space-y-3">
        <RangeControl label="Volume" value={Math.round(Number(clip.volume ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(value) => onUpdate({ volume: value / 100 })} />
        <RangeControl label="Fade in" value={Number(clip.fadeIn || 0)} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} suffix="s" onChange={(fadeIn) => onUpdate({ fadeIn })} />
        <RangeControl label="Fade out" value={Number(clip.fadeOut || 0)} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} suffix="s" onChange={(fadeOut) => onUpdate({ fadeOut })} />
      </div>
      <button type="button" onClick={() => onUpdate({ muted: !clip.muted })} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${clip.muted ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/10 text-[#aeb3bc] hover:bg-white/5 hover:text-white'}`}>
        {clip.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        {clip.muted ? 'Muted' : 'Audio enabled'}
      </button>
    </Section>
  </>
);

export const InspectorPanel = ({
  selectedClip,
  maxDuration,
  onUpdateClip,
  onSetPlaybackRate,
  onExtractAudio,
  onGenerateText,
  extractingAudio = false,
  extractAudioDisabled = false,
}) => {
  if (!selectedClip) {
    return (
      <aside className="flex min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#111318]">
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

  return (
    <aside className="min-h-0 overflow-y-auto border-l border-white/10 bg-[#111318] text-[#e6e8ec] [color-scheme:dark]">
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-white/10 bg-[#111318] px-4">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider !text-[#aeb4bd]">{selectedClip.type} properties</p>
          <h2 className="truncate text-xs font-bold !text-[#f5f7fa]">{selectedClip.name || selectedClip.text || 'Selected clip'}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateClip({ transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, flipX: false, flipY: false }, crop: { x: 0, y: 0, width: 1, height: 1 } })}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#727985] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500]/70"
            title="Reset properties"
            aria-label="Reset properties"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
        <VideoInspector
          clip={selectedClip}
          maxDuration={maxDuration}
          onUpdate={onUpdateClip}
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
