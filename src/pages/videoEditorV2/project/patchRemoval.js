const clamp = (value, minimum, maximum, fallback = minimum) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(maximum, Math.max(minimum, numericValue));
};

const roundSourceTime = (value) => Math.round(Math.max(0, Number(value) || 0) * 1_000_000) / 1_000_000;

const normalizePoint = (point) => ({
  x: clamp(point?.x, 0, 1, 0.5),
  y: clamp(point?.y, 0, 1, 0.5),
});

const normalizePoints = (points) => (
  Array.isArray(points) ? points.slice(0, 512).map(normalizePoint) : []
);

const getPathBounds = (points) => points.reduce((current, point) => ({
  minX: Math.min(current.minX, point.x),
  maxX: Math.max(current.maxX, point.x),
  minY: Math.min(current.minY, point.y),
  maxY: Math.max(current.maxY, point.y),
}), { minX: 1, maxX: 0, minY: 1, maxY: 0 });

export const DEFAULT_PATCH_REMOVAL = Object.freeze({
  enabled: false,
  editing: false,
  maskTool: 'points',
  pathClosed: false,
  targetPath: Object.freeze([]),
  sourceOffset: Object.freeze({ x: 0.18, y: 0 }),
  feather: 0.018,
  opacity: 1,
  autoKeyframe: false,
  keyframes: Object.freeze([]),
});

const normalizePatchSnapshot = (value = {}, fallback = {}) => {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const points = normalizePoints(input.targetPath ?? fallback.targetPath);
  const bounds = getPathBounds(points);
  const fallbackOffset = fallback.sourceOffset || DEFAULT_PATCH_REMOVAL.sourceOffset;
  const requestedOffsetX = clamp(input.sourceOffset?.x, -1, 1, fallbackOffset.x);
  const requestedOffsetY = clamp(input.sourceOffset?.y, -1, 1, fallbackOffset.y);

  return {
    targetPath: points,
    sourceOffset: {
      x: points.length
        ? clamp(requestedOffsetX, -bounds.minX, 1 - bounds.maxX, 0)
        : requestedOffsetX,
      y: points.length
        ? clamp(requestedOffsetY, -bounds.minY, 1 - bounds.maxY, 0)
        : requestedOffsetY,
    },
    feather: clamp(
      input.feather,
      0,
      0.15,
      fallback.feather ?? DEFAULT_PATCH_REMOVAL.feather,
    ),
    opacity: clamp(
      input.opacity,
      0,
      1,
      fallback.opacity ?? DEFAULT_PATCH_REMOVAL.opacity,
    ),
  };
};

const interpolate = (start, end, progress) => start + (end - start) * progress;

export const normalizePatchRemoval = (value = {}) => {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const snapshot = normalizePatchSnapshot(input, DEFAULT_PATCH_REMOVAL);
  const maskTool = ['points', 'rectangle'].includes(input.maskTool)
    ? input.maskTool
    : DEFAULT_PATCH_REMOVAL.maskTool;
  const pathClosed = input.pathClosed === undefined
    ? snapshot.targetPath.length >= 3
    : input.pathClosed !== false;
  const normalizedKeyframes = Array.isArray(input.keyframes)
    ? input.keyframes
      .filter((keyframe) => keyframe && typeof keyframe === 'object')
      .slice(0, 1000)
      .map((keyframe, index) => {
        const sourceTime = roundSourceTime(keyframe.sourceTime);
        return {
          id: String(keyframe.id || `patch-keyframe-${sourceTime}-${index}`),
          sourceTime,
          ...normalizePatchSnapshot(keyframe, snapshot),
          easing: keyframe.easing === 'hold' ? 'hold' : 'linear',
        };
      })
      .sort((left, right) => left.sourceTime - right.sourceTime)
    : [];
  const keyframes = normalizedKeyframes.filter((keyframe, index) => (
    index === normalizedKeyframes.length - 1
    || Math.abs(keyframe.sourceTime - normalizedKeyframes[index + 1].sourceTime) > 0.000001
  ));

  return {
    enabled: Boolean(input.enabled),
    editing: Boolean(input.editing),
    maskTool,
    pathClosed,
    ...snapshot,
    autoKeyframe: Boolean(input.autoKeyframe),
    keyframes,
  };
};

export const getClipSourceTime = (clip, timelineTime) => roundSourceTime(
  Math.max(0, Number(clip?.sourceStart) || 0)
  + Math.max(0, Number(timelineTime) - Number(clip?.timelineStart || 0))
    * Math.max(0.01, Number(clip?.playbackRate) || 1),
);

export const findPatchKeyframeIndex = (value, sourceTime, tolerance = 0.0005) => {
  const patch = normalizePatchRemoval(value);
  const time = roundSourceTime(sourceTime);
  return patch.keyframes.findIndex((keyframe) => (
    Math.abs(keyframe.sourceTime - time) <= tolerance
  ));
};

export const resolvePatchRemovalAtSourceTime = (value, sourceTime) => {
  const patch = normalizePatchRemoval(value);
  const time = roundSourceTime(sourceTime);
  if (!patch.keyframes.length) return patch;

  const exactIndex = findPatchKeyframeIndex(patch, time);
  if (exactIndex >= 0) return { ...patch, ...patch.keyframes[exactIndex] };

  const nextIndex = patch.keyframes.findIndex((keyframe) => keyframe.sourceTime > time);
  if (nextIndex === 0) return { ...patch, ...patch.keyframes[0] };
  if (nextIndex < 0) return { ...patch, ...patch.keyframes[patch.keyframes.length - 1] };

  const previous = patch.keyframes[nextIndex - 1];
  const next = patch.keyframes[nextIndex];
  if (previous.easing === 'hold') return { ...patch, ...previous };
  const progress = clamp(
    (time - previous.sourceTime) / Math.max(0.000001, next.sourceTime - previous.sourceTime),
    0,
    1,
    0,
  );
  const compatiblePaths = previous.targetPath.length === next.targetPath.length;
  const targetPath = compatiblePaths
    ? previous.targetPath.map((point, index) => ({
        x: interpolate(point.x, next.targetPath[index].x, progress),
        y: interpolate(point.y, next.targetPath[index].y, progress),
      }))
    : progress < 0.5 ? previous.targetPath : next.targetPath;

  return {
    ...patch,
    targetPath,
    sourceOffset: {
      x: interpolate(previous.sourceOffset.x, next.sourceOffset.x, progress),
      y: interpolate(previous.sourceOffset.y, next.sourceOffset.y, progress),
    },
    feather: interpolate(previous.feather, next.feather, progress),
    opacity: interpolate(previous.opacity, next.opacity, progress),
  };
};

export const upsertPatchRemovalKeyframe = (value, sourceTime, snapshot = {}) => {
  const patch = normalizePatchRemoval(value);
  const time = roundSourceTime(sourceTime);
  const resolved = resolvePatchRemovalAtSourceTime(patch, time);
  const normalizedSnapshot = normalizePatchSnapshot(snapshot, resolved);
  const existingIndex = findPatchKeyframeIndex(patch, time);
  const keyframe = {
    id: existingIndex >= 0
      ? patch.keyframes[existingIndex].id
      : `patch-keyframe-${Math.round(time * 1_000_000)}`,
    sourceTime: time,
    ...normalizedSnapshot,
    easing: existingIndex >= 0 ? patch.keyframes[existingIndex].easing : 'linear',
  };
  const keyframes = existingIndex >= 0
    ? patch.keyframes.map((current, index) => (index === existingIndex ? keyframe : current))
    : [...patch.keyframes, keyframe].sort((left, right) => left.sourceTime - right.sourceTime);
  return normalizePatchRemoval({ ...patch, keyframes });
};

export const removePatchRemovalKeyframe = (value, sourceTime) => {
  const patch = normalizePatchRemoval(value);
  const index = findPatchKeyframeIndex(patch, sourceTime);
  if (index < 0) return patch;
  return normalizePatchRemoval({
    ...patch,
    keyframes: patch.keyframes.filter((_, keyframeIndex) => keyframeIndex !== index),
  });
};

export const hasPatchRemovalMask = (value) => {
  const patch = normalizePatchRemoval(value);
  const pathIsClosed = patch.maskTool !== 'points' || patch.pathClosed;
  return patch.enabled
    && pathIsClosed
    && (
      patch.targetPath.length >= 3
      || patch.keyframes.some((keyframe) => keyframe.targetPath.length >= 3)
    );
};

export const getPatchSourcePath = (value) => {
  const patch = normalizePatchRemoval(value);
  return patch.targetPath.map((point) => ({
    x: point.x + patch.sourceOffset.x,
    y: point.y + patch.sourceOffset.y,
  }));
};
