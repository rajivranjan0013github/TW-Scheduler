export const DEFAULT_TIMELINE_DURATION = 30;
export const DEFAULT_PIXELS_PER_SECOND = 64;
export const DEFAULT_LABEL_WIDTH = 168;
export const DEFAULT_RULER_HEIGHT = 36;
export const DEFAULT_TRACK_HEIGHT = 62;
export const DEFAULT_MIN_CLIP_DURATION = 0.1;
export const DEFAULT_SNAP_INTERVAL = 0.1;
export const DEFAULT_MAGNETIC_SNAP_THRESHOLD_PX = 8;

export const clamp = (value, min, max) => {
  const safeMax = Math.max(min, max);
  return Math.min(safeMax, Math.max(min, value));
};

export const snapTime = (value, interval = DEFAULT_SNAP_INTERVAL) => {
  if (!Number.isFinite(interval) || interval <= 0) return value;
  return Math.round(value / interval) * interval;
};

export const roundTime = (value) => Math.round(value * 1000) / 1000;

/**
 * Finds the closest target to any moving edge within a time-based threshold.
 * Targets may be numbers or objects with a numeric `time`; edge entries may be
 * numbers or `{ edge, time }` objects. `isValid` can reject snaps that would
 * violate the caller's move/trim bounds.
 */
export const findNearestMagneticSnap = ({
  edges = [],
  targets = [],
  threshold = 0,
  isValid,
} = {}) => {
  const maximumDistance = Number(threshold);
  if (!Number.isFinite(maximumDistance) || maximumDistance < 0) return null;

  let nearest = null;

  edges.forEach((edgeEntry) => {
    const edgeTime = Number(
      typeof edgeEntry === 'number' ? edgeEntry : edgeEntry?.time,
    );
    if (!Number.isFinite(edgeTime)) return;

    targets.forEach((targetEntry) => {
      const targetTime = Number(
        typeof targetEntry === 'number' ? targetEntry : targetEntry?.time,
      );
      if (!Number.isFinite(targetTime)) return;

      const delta = targetTime - edgeTime;
      const distance = Math.abs(delta);
      if (distance > maximumDistance + 1e-9) return;

      const candidate = {
        edge: typeof edgeEntry === 'number' ? undefined : edgeEntry?.edge,
        edgeTime,
        target: targetEntry,
        targetTime,
        delta,
        distance,
      };
      if (isValid && !isValid(candidate)) return;
      if (!nearest || distance < nearest.distance - 1e-9) nearest = candidate;
    });
  });

  return nearest;
};

export const formatTimelineTime = (seconds, showTenths = false) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const base = `${minutes}:${String(wholeSeconds).padStart(2, '0')}`;

  if (!showTenths) return base;
  return `${base}.${Math.floor((safeSeconds % 1) * 10)}`;
};

export const getTrackType = (track) => String(track?.type || 'video').toLowerCase();

export const getClipLabel = (clip) => (
  clip?.name
  || clip?.label
  || clip?.text
  || `${String(clip?.type || 'clip').replace(/^./, (letter) => letter.toUpperCase())}`
);
