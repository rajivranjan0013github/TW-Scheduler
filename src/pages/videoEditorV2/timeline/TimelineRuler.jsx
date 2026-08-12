import { useMemo } from 'react';
import { formatTimelineTime } from './timelineUtils';

const getTickIntervals = (pixelsPerSecond) => {
  if (pixelsPerSecond >= 100) return { minor: 0.5, major: 1 };
  if (pixelsPerSecond >= 52) return { minor: 1, major: 5 };
  if (pixelsPerSecond >= 28) return { minor: 2.5, major: 5 };
  return { minor: 5, major: 10 };
};

export const TimelineRuler = ({
  duration,
  currentTime,
  pixelsPerSecond,
  height,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  rulerRef,
}) => {
  const { minor, major } = getTickIntervals(pixelsPerSecond);
  const ticks = useMemo(() => {
    const tickCount = Math.floor(duration / minor);
    return Array.from({ length: tickCount + 1 }, (_, index) => {
      const time = Number((index * minor).toFixed(3));
      const isMajor = Math.abs(time / major - Math.round(time / major)) < 0.001;
      return { time, isMajor };
    });
  }, [duration, major, minor]);

  return (
    <div
      ref={rulerRef}
      className="relative cursor-col-resize select-none border-b border-[#303034] bg-[#1a1a1d] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-orange-400/80"
      style={{ width: duration * pixelsPerSecond, height, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="slider"
      aria-label="Timeline playhead"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-valuetext={formatTimelineTime(currentTime, true)}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {ticks.map(({ time, isMajor }) => (
        <div
          key={time}
          className="absolute bottom-0"
          style={{ left: time * pixelsPerSecond }}
          aria-hidden="true"
        >
          {isMajor && (
            <span className="absolute left-1 top-1 whitespace-nowrap text-[9px] font-semibold tabular-nums text-zinc-400">
              {formatTimelineTime(time)}
            </span>
          )}
          <span
            className={`absolute bottom-0 block w-px ${isMajor ? 'h-3 bg-zinc-500' : 'h-1.5 bg-zinc-700'}`}
          />
        </div>
      ))}
    </div>
  );
};
