const clamp = (value, minimum, maximum, fallback = minimum) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(maximum, Math.max(minimum, numericValue));
};

const normalizePoint = (point) => ({
  x: clamp(point?.x, 0, 1, 0.5),
  y: clamp(point?.y, 0, 1, 0.5),
});

export const DEFAULT_PATCH_REMOVAL = Object.freeze({
  enabled: false,
  editing: false,
  maskTool: 'points',
  pathClosed: false,
  targetPath: Object.freeze([]),
  sourceOffset: Object.freeze({ x: 0.18, y: 0 }),
  feather: 0.018,
  opacity: 1,
});

export const normalizePatchRemoval = (value = {}) => {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const points = Array.isArray(input.targetPath)
    ? input.targetPath.slice(0, 512).map(normalizePoint)
    : [];
  const bounds = points.reduce((current, point) => ({
    minX: Math.min(current.minX, point.x),
    maxX: Math.max(current.maxX, point.x),
    minY: Math.min(current.minY, point.y),
    maxY: Math.max(current.maxY, point.y),
  }), { minX: 1, maxX: 0, minY: 1, maxY: 0 });
  const requestedOffsetX = clamp(
    input.sourceOffset?.x,
    -1,
    1,
    DEFAULT_PATCH_REMOVAL.sourceOffset.x,
  );
  const requestedOffsetY = clamp(
    input.sourceOffset?.y,
    -1,
    1,
    DEFAULT_PATCH_REMOVAL.sourceOffset.y,
  );

  return {
    enabled: Boolean(input.enabled),
    editing: Boolean(input.editing),
    maskTool: ['points', 'rectangle'].includes(input.maskTool)
      ? input.maskTool
      : DEFAULT_PATCH_REMOVAL.maskTool,
    pathClosed: input.pathClosed === undefined
      ? points.length >= 3
      : input.pathClosed !== false,
    targetPath: points,
    sourceOffset: {
      x: points.length
        ? clamp(requestedOffsetX, -bounds.minX, 1 - bounds.maxX, 0)
        : requestedOffsetX,
      y: points.length
        ? clamp(requestedOffsetY, -bounds.minY, 1 - bounds.maxY, 0)
        : requestedOffsetY,
    },
    feather: clamp(input.feather, 0, 0.15, DEFAULT_PATCH_REMOVAL.feather),
    opacity: clamp(input.opacity, 0, 1, DEFAULT_PATCH_REMOVAL.opacity),
  };
};

export const hasPatchRemovalMask = (value) => {
  const patch = normalizePatchRemoval(value);
  return patch.enabled
    && patch.targetPath.length >= 3
    && (patch.maskTool !== 'points' || patch.pathClosed);
};

export const getPatchSourcePath = (value) => {
  const patch = normalizePatchRemoval(value);
  return patch.targetPath.map((point) => ({
    x: point.x + patch.sourceOffset.x,
    y: point.y + patch.sourceOffset.y,
  }));
};
