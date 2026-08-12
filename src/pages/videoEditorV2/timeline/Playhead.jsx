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
    className="pointer-events-none absolute bottom-0 z-30 w-px bg-orange-500 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
    style={{ left, top }}
  >
    <button
      type="button"
      className="pointer-events-auto absolute -left-2.5 -top-5 flex h-5 w-5 cursor-ew-resize items-start justify-center rounded-b-md bg-orange-500 text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] outline-none ring-orange-300 transition-shadow focus-visible:ring-2"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      title={`Playhead ${formatTimelineTime(currentTime, true)}`}
      aria-label={`Move playhead. Current time ${formatTimelineTime(currentTime, true)}`}
    >
      <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-white" />
    </button>
  </div>
);
