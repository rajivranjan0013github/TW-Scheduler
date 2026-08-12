import { useCallback, useEffect, useRef } from 'react';

export const usePlaybackClock = ({
  isPlaying,
  currentTime,
  duration,
  onTimeChange,
  onPlayingChange,
}) => {
  const animationFrameRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const startTimeRef = useRef(currentTime);
  const startedAtRef = useRef(0);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      return undefined;
    }

    startTimeRef.current = currentTimeRef.current;
    startedAtRef.current = performance.now();

    const tick = (now) => {
      const nextTime = startTimeRef.current + (now - startedAtRef.current) / 1000;
      if (nextTime >= duration) {
        currentTimeRef.current = 0;
        onTimeChange(0);
        onPlayingChange(false);
        animationFrameRef.current = null;
        return;
      }
      currentTimeRef.current = nextTime;
      onTimeChange(nextTime);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [duration, isPlaying, onPlayingChange, onTimeChange]);

  const seek = useCallback((time) => {
    const next = Math.max(0, Math.min(duration, Number(time) || 0));
    currentTimeRef.current = next;
    startTimeRef.current = next;
    startedAtRef.current = performance.now();
    onTimeChange(next);
  }, [duration, onTimeChange]);

  return { seek };
};

