import { formatTimelineTime } from './timelineUtils';

export const Playhead = ({
  currentTime,
  left,
  top,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => (
  <div
    className="pointer-events-none absolute inset-y-0 z-30 w-[3px] -translate-x-1/2"
    style={{ left }}
  >
    <div
      className="absolute bottom-0 w-full rounded-full bg-[#e8e6e1] shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
      style={{ top }}
      aria-hidden="true"
    />
    <div className="sticky h-0 w-full" style={{ top }}>
      <button
        type="button"
        className="pointer-events-auto absolute left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center text-[#e8e6e1] outline-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] transition focus-visible:drop-shadow-[0_0_4px_rgba(255,255,255,0.85)]"
        style={{ touchAction: 'none', top: 4 - Number(top || 0) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        title={`Playhead ${formatTimelineTime(currentTime, true)}`}
        aria-label={`Move playhead. Current time ${formatTimelineTime(currentTime, true)}`}
      >
        <svg viewBox="0 0 28 22" className="h-[11px] w-[14px] fill-current" aria-hidden="true">
          <path d="M5 1h18a4 4 0 0 1 3.1 6.5l-8.7 10.8a4.4 4.4 0 0 1-6.8 0L1.9 7.5A4 4 0 0 1 5 1Z" />
        </svg>
      </button>
    </div>
  </div>
);
