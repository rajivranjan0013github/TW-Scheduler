import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, MonitorSmartphone, SlidersHorizontal, X } from 'lucide-react';

const RESOLUTION_PRESETS = [
  { label: 'Standard', detail: '9:16', width: 720, height: 1280 },
  { label: 'Full HD', detail: '9:16', width: 1080, height: 1920 },
  { label: 'Maximum', detail: '2:3', width: 1280, height: 1920 },
];

const FPS_OPTIONS = [24, 30, 60];
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const createDraft = (output = {}) => ({
  width: Math.round(clampNumber(output.width, 360, 1280, 1080)),
  height: Math.round(clampNumber(output.height, 640, 1920, 1920)),
  fps: FPS_OPTIONS.includes(Number(output.fps)) ? Number(output.fps) : 30,
  backgroundColor: HEX_COLOR_PATTERN.test(output.backgroundColor || '')
    ? output.backgroundColor
    : '#000000',
  maxDuration: Math.round(clampNumber(output.maxDuration, 1, 30, 30)),
});

const FieldLabel = ({ htmlFor, children }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8b929d]"
  >
    {children}
  </label>
);

export const ProjectSettingsDialog = ({ output, onApply, onClose }) => {
  const [draft, setDraft] = useState(() => createDraft(output));
  const titleId = useId();
  const descriptionId = useId();
  const widthId = useId();
  const heightId = useId();
  const colorId = useId();
  const durationId = useId();
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateNumber = (field, value, min, max) => {
    setDraft((current) => ({
      ...current,
      [field]: Math.round(clampNumber(value, min, max, current[field])),
    }));
  };

  const setNumberInput = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value === '' ? '' : Number(value),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const settings = createDraft(draft);
    onApply?.(settings);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#111318] text-[#e6e8ec] shadow-2xl shadow-black/50 ring-1 ring-white/10"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff5500]/10 text-[#ff6a1a]">
              <SlidersHorizontal className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-[#f5f7fa]">Project settings</h2>
              <p id={descriptionId} className="mt-0.5 text-[10px] font-semibold text-[#8b929d]">
                Configure the canvas and playback settings used by preview and export.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#727985] outline-none transition hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-[#ff5500]/40"
            aria-label="Close project settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <section aria-labelledby={`${titleId}-resolution`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 id={`${titleId}-resolution`} className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#d7dbe2]">
                    Canvas resolution
                  </h3>
                  <p className="mt-0.5 text-[9px] font-medium text-[#727985]">Choose a vertical preset or enter a custom size.</p>
                </div>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[9px] font-bold tabular-nums text-[#a1a7b1]">
                  {draft.width || '—'} × {draft.height || '—'}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {RESOLUTION_PRESETS.map((preset) => {
                  const selected = draft.width === preset.width && draft.height === preset.height;
                  return (
                    <button
                      key={`${preset.width}x${preset.height}`}
                      type="button"
                      onClick={() => setDraft((current) => ({
                        ...current,
                        width: preset.width,
                        height: preset.height,
                      }))}
                      className={`relative flex items-center gap-3 rounded-xl border p-3 text-left outline-none transition focus:ring-2 focus:ring-[#ff5500]/20 ${
                        selected
                          ? 'border-[#ff5500] bg-[#ff5500]/10 text-[#ff7a33]'
                          : 'border-white/10 bg-[#171a20] text-[#aeb3bc] hover:border-white/20 hover:bg-[#1b1f27]'
                      }`}
                      aria-pressed={selected}
                    >
                      <span className={`flex h-10 w-7 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-[#ff5500]/60 bg-[#211810]' : 'border-white/15 bg-[#1d2027]'}`}>
                        <MonitorSmartphone className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-extrabold">{preset.label}</span>
                        <span className="mt-0.5 block text-[9px] font-semibold tabular-nums text-[#727985]">
                          {preset.width} × {preset.height} · {preset.detail}
                        </span>
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5500] text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor={widthId}>Custom width</FieldLabel>
                  <div className="flex h-10 items-center rounded-xl border border-white/10 bg-[#171a20] px-3 focus-within:border-[#ff5500]/60 focus-within:bg-[#1b1f27]">
                    <input
                      id={widthId}
                      type="number"
                      min="360"
                      max="1280"
                      step="1"
                      value={draft.width}
                      onChange={(event) => setNumberInput('width', event.target.value)}
                      onBlur={(event) => updateNumber('width', event.target.value, 360, 1280)}
                      className="min-w-0 flex-1 bg-transparent text-xs font-bold tabular-nums text-[#e6e8ec] outline-none"
                    />
                    <span className="text-[9px] font-bold text-[#727985]">px</span>
                  </div>
                  <p className="mt-1 text-[8px] font-medium text-[#666d78]">360–1280 px</p>
                </div>
                <div>
                  <FieldLabel htmlFor={heightId}>Custom height</FieldLabel>
                  <div className="flex h-10 items-center rounded-xl border border-white/10 bg-[#171a20] px-3 focus-within:border-[#ff5500]/60 focus-within:bg-[#1b1f27]">
                    <input
                      id={heightId}
                      type="number"
                      min="640"
                      max="1920"
                      step="1"
                      value={draft.height}
                      onChange={(event) => setNumberInput('height', event.target.value)}
                      onBlur={(event) => updateNumber('height', event.target.value, 640, 1920)}
                      className="min-w-0 flex-1 bg-transparent text-xs font-bold tabular-nums text-[#e6e8ec] outline-none"
                    />
                    <span className="text-[9px] font-bold text-[#727985]">px</span>
                  </div>
                  <p className="mt-1 text-[8px] font-medium text-[#666d78]">640–1920 px</p>
                </div>
              </div>
            </section>

            <div className="h-px bg-white/10" />

            <div className="grid gap-5 sm:grid-cols-2">
              <section aria-labelledby={`${titleId}-fps`}>
                <h3 id={`${titleId}-fps`} className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#d7dbe2]">
                  Frame rate
                </h3>
                <p className="mt-0.5 text-[9px] font-medium text-[#727985]">Higher FPS creates smoother motion and larger exports.</p>
                <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#0c0e12] p-1">
                  {FPS_OPTIONS.map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, fps }))}
                      className={`h-9 rounded-lg text-[10px] font-extrabold outline-none transition focus:ring-2 focus:ring-[#ff5500]/20 ${
                        draft.fps === fps
                          ? 'bg-[#242832] text-[#ff6a1a] shadow-sm shadow-black/20'
                          : 'text-[#8b929d] hover:text-white'
                      }`}
                      aria-pressed={draft.fps === fps}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </section>

              <section aria-labelledby={`${titleId}-background`}>
                <h3 id={`${titleId}-background`} className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#d7dbe2]">
                  Canvas background
                </h3>
                <p className="mt-0.5 text-[9px] font-medium text-[#727985]">Visible wherever a video or image does not cover the canvas.</p>
                <label
                  htmlFor={colorId}
                  className="mt-3 flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#171a20] px-2.5 transition hover:bg-[#1b1f27]"
                >
                  <input
                    id={colorId}
                    type="color"
                    value={draft.backgroundColor}
                    onChange={(event) => setDraft((current) => ({ ...current, backgroundColor: event.target.value }))}
                    className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-bold uppercase tabular-nums text-[#c5c9d0]">{draft.backgroundColor}</span>
                </label>
              </section>
            </div>

            <div className="h-px bg-white/10" />

            <section aria-labelledby={`${titleId}-duration`}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 id={`${titleId}-duration`} className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#d7dbe2]">
                    Maximum duration
                  </h3>
                  <p className="mt-0.5 text-[9px] font-medium text-[#727985]">Set the editable timeline length from 1 to 30 seconds.</p>
                </div>
                <label htmlFor={durationId} className="flex h-9 w-24 items-center rounded-xl border border-white/10 bg-[#171a20] px-2.5 focus-within:border-[#ff5500]/60">
                  <input
                    id={durationId}
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={draft.maxDuration}
                    onChange={(event) => setNumberInput('maxDuration', event.target.value)}
                    onBlur={(event) => updateNumber('maxDuration', event.target.value, 1, 30)}
                    className="min-w-0 flex-1 bg-transparent text-right text-xs font-bold tabular-nums text-[#e6e8ec] outline-none"
                  />
                  <span className="ml-1 text-[9px] font-bold text-[#727985]">sec</span>
                </label>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={draft.maxDuration}
                onChange={(event) => updateNumber('maxDuration', event.target.value, 1, 30)}
                className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#ff5500]"
                aria-label="Maximum project duration"
              />
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-[9px] font-semibold leading-relaxed">
                  Shortening the maximum duration can move or trim clips that extend beyond the new endpoint.
                </p>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-[#0d0f13] px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-white/10 bg-[#171a20] px-4 text-[10px] font-bold text-[#b6bbc4] outline-none transition hover:bg-[#20242c] hover:text-white focus:ring-2 focus:ring-white/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded-xl bg-[#0071e3] px-5 text-[10px] font-bold text-white shadow-sm outline-none transition hover:bg-[#147ce5] active:scale-[0.98] focus:ring-2 focus:ring-blue-200"
            >
              Apply settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
