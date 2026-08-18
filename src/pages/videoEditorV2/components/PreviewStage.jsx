import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Grid3X3,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  DEFAULT_TEXT_STYLE,
  getPatchSourcePath,
  hasPatchRemovalMask,
  MAX_PLAYBACK_RATE,
  MIN_CROP_SIZE,
  MIN_PLAYBACK_RATE,
  normalizePatchRemoval,
} from '../project';
import {
  createPatchRemovalBuffers,
  drawPatchedMediaFrame,
} from '../export/patchRemovalRenderer.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const compareVisualLayers = (left, right) => (
  Number(left.trackIndex || 0) - Number(right.trackIndex || 0)
  || Number(left.clipIndex || 0) - Number(right.clipIndex || 0)
);
const NOOP = () => {};
const formatPreviewTime = (seconds, showTenths = false) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const base = `${minutes}:${String(wholeSeconds).padStart(2, '0')}`;
  return showTenths ? `${base}.${Math.floor((safeSeconds % 1) * 10)}` : base;
};
const MIN_TEXT_BOX_WIDTH = 0.08;
const MAX_TEXT_BOX_WIDTH = 0.92;
const MIN_TEXT_SCALE = 0.25;
const MAX_TEXT_SCALE = 3;
const COMPACT_TEXT_BOX_WIDTH = 96;
const COMPACT_TEXT_BOX_HEIGHT = 44;
const COMPACT_TEXT_HANDLE_MODES = new Set(['nw', 'right']);
const MIN_MEDIA_SCALE = 0.05;
const MAX_MEDIA_SCALE = 10;
const MIN_PREVIEW_ZOOM = 0.5;
const MAX_PREVIEW_ZOOM = 3;
const MEDIA_RESIZE_HANDLES = [
  { mode: 'nw', label: 'Resize media from top left', className: '-left-3 -top-3 cursor-nwse-resize', markerClassName: 'h-3.5 w-3.5 rounded-full' },
  { mode: 'n', label: 'Resize media from top', className: 'left-1/2 -top-2.5 -translate-x-1/2 cursor-ns-resize', markerClassName: 'h-2 w-8 rounded-full' },
  { mode: 'ne', label: 'Resize media from top right', className: '-right-3 -top-3 cursor-nesw-resize', markerClassName: 'h-3.5 w-3.5 rounded-full' },
  { mode: 'e', label: 'Resize media from right', className: '-right-2.5 top-1/2 -translate-y-1/2 cursor-ew-resize', markerClassName: 'h-8 w-2 rounded-full' },
  { mode: 'se', label: 'Resize media from bottom right', className: '-bottom-3 -right-3 cursor-nwse-resize', markerClassName: 'h-3.5 w-3.5 rounded-full' },
  { mode: 's', label: 'Resize media from bottom', className: '-bottom-2.5 left-1/2 -translate-x-1/2 cursor-ns-resize', markerClassName: 'h-2 w-8 rounded-full' },
  { mode: 'sw', label: 'Resize media from bottom left', className: '-bottom-3 -left-3 cursor-nesw-resize', markerClassName: 'h-3.5 w-3.5 rounded-full' },
  { mode: 'w', label: 'Resize media from left', className: '-left-2.5 top-1/2 -translate-y-1/2 cursor-ew-resize', markerClassName: 'h-8 w-2 rounded-full' },
];
const TEXT_RESIZE_HANDLES = [
  { mode: 'left', label: 'Resize text box from left', className: '-left-2 top-1/2 h-7 w-4 -translate-y-1/2 cursor-ew-resize', indicatorClassName: 'h-4 w-1 rounded-full' },
  { mode: 'right', label: 'Resize text box from right', className: '-right-2 top-1/2 h-7 w-4 -translate-y-1/2 cursor-ew-resize', indicatorClassName: 'h-4 w-1 rounded-full' },
  { mode: 'nw', label: 'Scale text from top left', className: '-left-2.5 -top-2.5 h-5 w-5 cursor-nwse-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
  { mode: 'ne', label: 'Scale text from top right', className: '-right-2.5 -top-2.5 h-5 w-5 cursor-nesw-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
  { mode: 'sw', label: 'Scale text from bottom left', className: '-bottom-2.5 -left-2.5 h-5 w-5 cursor-nesw-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
  { mode: 'se', label: 'Scale text from bottom right', className: '-bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
];

const isClipActive = (clip, currentTime) => (
  currentTime >= Number(clip.timelineStart || 0) &&
  currentTime < Number(clip.timelineStart || 0) + Number(clip.duration || 0)
);

const getNormalizedCrop = (crop = {}) => {
  const rawX = Number(crop.x);
  const rawY = Number(crop.y);
  const rawWidth = Number(crop.width);
  const rawHeight = Number(crop.height);
  const x = clamp(Number.isFinite(rawX) ? rawX : 0, 0, 1 - MIN_CROP_SIZE);
  const y = clamp(Number.isFinite(rawY) ? rawY : 0, 0, 1 - MIN_CROP_SIZE);
  return {
    x,
    y,
    width: clamp(Number.isFinite(rawWidth) ? rawWidth : 1, MIN_CROP_SIZE, 1 - x),
    height: clamp(Number.isFinite(rawHeight) ? rawHeight : 1, MIN_CROP_SIZE, 1 - y),
  };
};

const getClipCrop = (clip) => getNormalizedCrop(clip.crop);

const getClipTransform = (clip) => ({
  x: Number(clip.transform?.x ?? 0.5),
  y: Number(clip.transform?.y ?? 0.5),
  scale: Math.max(0.01, Number(clip.transform?.scale ?? 1)),
  rotation: Number(clip.transform?.rotation || 0),
  opacity: clamp(Number(clip.transform?.opacity ?? 1), 0, 1),
  flipX: Boolean(clip.transform?.flipX),
  flipY: Boolean(clip.transform?.flipY),
});

const getVisualGeometry = ({ clip, crop, transform, mediaSize, stageSize }) => {
  const stageWidth = Math.max(1, stageSize.width);
  const stageHeight = Math.max(1, stageSize.height);
  const sourceWidth = Math.max(
    1,
    mediaSize.width || Number(clip.metadata?.width || clip.width) || stageWidth,
  );
  const sourceHeight = Math.max(
    1,
    mediaSize.height || Number(clip.metadata?.height || clip.height) || stageHeight,
  );
  const sourceAspect = Math.max(0.001, sourceWidth / sourceHeight);
  const croppedAspect = Math.max(
    0.001,
    (sourceWidth * crop.width) / (sourceHeight * crop.height),
  );
  const targetWidth = stageWidth * transform.scale;
  const targetHeight = stageHeight * transform.scale;
  const targetAspect = targetWidth / targetHeight;
  const fit = clip.fit === 'stretch'
    ? 'stretch'
    : clip.fit === 'fill' || clip.fit === 'cover'
      ? 'cover'
      : 'contain';

  if (fit === 'contain') {
    const fittedWidth = sourceAspect >= targetAspect
      ? targetWidth
      : targetHeight * sourceAspect;
    const fittedHeight = sourceAspect >= targetAspect
      ? targetWidth / sourceAspect
      : targetHeight;
    const width = fittedWidth * crop.width;
    const height = fittedHeight * crop.height;
    return {
      layerWidth: width,
      layerHeight: height,
      contentWidth: width,
      contentHeight: height,
      contentLeft: 0,
      contentTop: 0,
    };
  }

  if (fit === 'cover') {
    const contentWidth = croppedAspect >= targetAspect
      ? targetHeight * croppedAspect
      : targetWidth;
    const contentHeight = croppedAspect >= targetAspect
      ? targetHeight
      : targetWidth / croppedAspect;
    return {
      layerWidth: targetWidth,
      layerHeight: targetHeight,
      contentWidth,
      contentHeight,
      contentLeft: (targetWidth - contentWidth) / 2,
      contentTop: (targetHeight - contentHeight) / 2,
    };
  }

  return {
    layerWidth: targetWidth,
    layerHeight: targetHeight,
    contentWidth: targetWidth,
    contentHeight: targetHeight,
    contentLeft: 0,
    contentTop: 0,
  };
};

const getMediaLayerStyle = (geometry, transform) => ({
  left: `${transform.x * 100}%`,
  top: `${transform.y * 100}%`,
  width: geometry.layerWidth,
  height: geometry.layerHeight,
  opacity: transform.opacity,
  transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.flipX ? -1 : 1}, ${transform.flipY ? -1 : 1})`,
  transformOrigin: 'center',
});

const getCroppedMediaStyle = (geometry, crop) => ({
  left: geometry.contentLeft - (crop.x / crop.width) * geometry.contentWidth,
  top: geometry.contentTop - (crop.y / crop.height) * geometry.contentHeight,
  width: geometry.contentWidth / crop.width,
  height: geometry.contentHeight / crop.height,
});

const getAudioFadeVolume = (clip, currentTime) => {
  const baseVolume = clamp(Number(clip.volume ?? 1), 0, 1);
  const localTime = Math.max(0, currentTime - Number(clip.timelineStart || 0));
  const remaining = Math.max(0, Number(clip.duration || 0) - localTime);
  const fadeIn = Math.max(0, Number(clip.fadeIn || 0));
  const fadeOut = Math.max(0, Number(clip.fadeOut || 0));
  const fadeInFactor = fadeIn > 0 ? clamp(localTime / fadeIn, 0, 1) : 1;
  const fadeOutFactor = fadeOut > 0 ? clamp(remaining / fadeOut, 0, 1) : 1;
  return baseVolume * Math.min(fadeInFactor, fadeOutFactor);
};

const getLoopedSourceTime = (clip, currentTime, mediaDuration) => {
  const sourceStart = Math.max(0, Number(clip.sourceStart || 0));
  const elapsed = Math.max(0, currentTime - Number(clip.timelineStart || 0)) *
    Math.max(0.01, Number(clip.playbackRate || 1));
  const absoluteTime = sourceStart + elapsed;
  const duration = Number(clip.sourceDuration || mediaDuration || 0);
  if (!clip.loop || duration <= 0 || absoluteTime < duration) return absoluteTime;
  return (absoluteTime - duration) % duration;
};

const useMediaResize = ({ clip, mediaSize, stageSize, onSelect, onUpdate }) => {
  const [draftTransform, setDraftTransform] = useState(null);
  const [draftCrop, setDraftCrop] = useState(null);
  const draftTransformRef = useRef(null);
  const draftCropRef = useRef(null);
  const cleanupRef = useRef(null);
  const crop = draftCrop || getClipCrop(clip);
  const transform = draftTransform || getClipTransform(clip);
  const geometry = getVisualGeometry({ clip, crop, transform, mediaSize, stageSize });

  useEffect(() => () => cleanupRef.current?.(), []);

  const startMove = (event) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(clip.id);
    cleanupRef.current?.();

    const startPoint = { x: event.clientX, y: event.clientY };
    const startTransform = getClipTransform(clip);
    let dragging = false;

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', cancel);
      cleanupRef.current = null;
    };
    const finish = (commit) => {
      const finalTransform = draftTransformRef.current;
      cleanup();
      if (commit && dragging && finalTransform) {
        onUpdate(clip.id, { transform: finalTransform });
      }
      draftTransformRef.current = null;
      setDraftTransform(null);
    };
    const move = (moveEvent) => {
      const deltaX = moveEvent.clientX - startPoint.x;
      const deltaY = moveEvent.clientY - startPoint.y;
      if (!dragging && Math.hypot(deltaX, deltaY) < 3) return;
      dragging = true;
      moveEvent.preventDefault();
      const nextTransform = {
        ...clip.transform,
        x: clamp(
          startTransform.x + deltaX / Math.max(1, stageSize.width),
          0,
          1,
        ),
        y: clamp(
          startTransform.y + deltaY / Math.max(1, stageSize.height),
          0,
          1,
        ),
      };
      draftTransformRef.current = nextTransform;
      setDraftTransform(nextTransform);
    };
    const end = () => finish(true);
    const cancel = () => finish(false);

    cleanupRef.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancel);
  };

  const startCrop = (event, mode) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(clip.id);
    cleanupRef.current?.();

    const startPoint = { x: event.clientX, y: event.clientY };
    const startCropValue = getClipCrop(clip);
    const startTransform = getClipTransform(clip);
    const startGeometry = getVisualGeometry({
      clip,
      crop: startCropValue,
      transform: startTransform,
      mediaSize,
      stageSize,
    });
    const rotation = (startTransform.rotation * Math.PI) / 180;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const horizontalDirection = mode === 'e' ? 1 : mode === 'w' ? -1 : 0;
    const verticalDirection = mode === 's' ? 1 : mode === 'n' ? -1 : 0;

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', cancel);
      cleanupRef.current = null;
    };
    const finish = (commit) => {
      const finalCrop = draftCropRef.current;
      const finalTransform = draftTransformRef.current;
      cleanup();
      if (commit && finalCrop && finalTransform) {
        onUpdate(clip.id, { crop: finalCrop, transform: finalTransform });
      }
      draftCropRef.current = null;
      draftTransformRef.current = null;
      setDraftCrop(null);
      setDraftTransform(null);
    };
    const move = (moveEvent) => {
      moveEvent.preventDefault();
      const worldDeltaX = moveEvent.clientX - startPoint.x;
      const worldDeltaY = moveEvent.clientY - startPoint.y;
      const localDeltaX = worldDeltaX * cosine + worldDeltaY * sine;
      const localDeltaY = -worldDeltaX * sine + worldDeltaY * cosine;
      const nextCrop = updateCropFromDelta(
        startCropValue,
        mode,
        (localDeltaX / Math.max(1, startGeometry.layerWidth)) * startCropValue.width,
        (localDeltaY / Math.max(1, startGeometry.layerHeight)) * startCropValue.height,
      );
      const nextGeometry = getVisualGeometry({
        clip,
        crop: nextCrop,
        transform: startTransform,
        mediaSize,
        stageSize,
      });
      const localCenterShiftX = horizontalDirection
        * (nextGeometry.layerWidth - startGeometry.layerWidth) / 2;
      const localCenterShiftY = verticalDirection
        * (nextGeometry.layerHeight - startGeometry.layerHeight) / 2;
      const worldCenterShiftX = localCenterShiftX * cosine - localCenterShiftY * sine;
      const worldCenterShiftY = localCenterShiftX * sine + localCenterShiftY * cosine;
      const nextTransform = {
        ...clip.transform,
        x: clamp(
          startTransform.x + worldCenterShiftX / Math.max(1, stageSize.width),
          0,
          1,
        ),
        y: clamp(
          startTransform.y + worldCenterShiftY / Math.max(1, stageSize.height),
          0,
          1,
        ),
      };
      draftCropRef.current = nextCrop;
      draftTransformRef.current = nextTransform;
      setDraftCrop(nextCrop);
      setDraftTransform(nextTransform);
    };
    const end = () => finish(true);
    const cancel = () => finish(false);

    cleanupRef.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancel);
  };

  const startResize = (event, mode) => {
    if (mode.length === 1) {
      startCrop(event, mode);
      return;
    }
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(clip.id);
    cleanupRef.current?.();

    const startPoint = { x: event.clientX, y: event.clientY };
    const startTransform = getClipTransform(clip);
    const startGeometry = getVisualGeometry({
      clip,
      crop,
      transform: startTransform,
      mediaSize,
      stageSize,
    });
    const startScale = Math.max(MIN_MEDIA_SCALE, startTransform.scale);
    const baseWidth = startGeometry.layerWidth / startScale;
    const baseHeight = startGeometry.layerHeight / startScale;
    const horizontalDirection = mode.includes('e') ? 1 : mode.includes('w') ? -1 : 0;
    const verticalDirection = mode.includes('s') ? 1 : mode.includes('n') ? -1 : 0;
    const rotation = (startTransform.rotation * Math.PI) / 180;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const localDiagonalX = horizontalDirection * startGeometry.layerWidth;
    const localDiagonalY = verticalDirection * startGeometry.layerHeight;
    const worldDiagonalX = localDiagonalX * cosine - localDiagonalY * sine;
    const worldDiagonalY = localDiagonalX * sine + localDiagonalY * cosine;
    const diagonalLengthSquared = Math.max(
      1,
      worldDiagonalX ** 2 + worldDiagonalY ** 2,
    );

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', cancel);
      cleanupRef.current = null;
    };
    const finish = (commit) => {
      const finalTransform = draftTransformRef.current;
      cleanup();
      if (commit && finalTransform) onUpdate(clip.id, { transform: finalTransform });
      draftTransformRef.current = null;
      setDraftTransform(null);
    };
    const move = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startPoint.x;
      const deltaY = moveEvent.clientY - startPoint.y;
      const scaleFactor = horizontalDirection === 0
        ? 1 + (verticalDirection * deltaY) / Math.max(1, startGeometry.layerHeight)
        : verticalDirection === 0
          ? 1 + (horizontalDirection * deltaX) / Math.max(1, startGeometry.layerWidth)
          : 1 + (
              deltaX * worldDiagonalX + deltaY * worldDiagonalY
            ) / diagonalLengthSquared;
      const nextScale = clamp(
        startScale * scaleFactor,
        MIN_MEDIA_SCALE,
        MAX_MEDIA_SCALE,
      );
      const scaleDelta = nextScale - startScale;
      const localCenterShiftX = horizontalDirection * baseWidth * scaleDelta / 2;
      const localCenterShiftY = verticalDirection * baseHeight * scaleDelta / 2;
      const worldCenterShiftX = localCenterShiftX * cosine - localCenterShiftY * sine;
      const worldCenterShiftY = localCenterShiftX * sine + localCenterShiftY * cosine;
      const nextTransform = {
        ...clip.transform,
        x: clamp(
          startTransform.x + worldCenterShiftX / Math.max(1, stageSize.width),
          0,
          1,
        ),
        y: clamp(
          startTransform.y + worldCenterShiftY / Math.max(1, stageSize.height),
          0,
          1,
        ),
        scale: nextScale,
      };
      draftTransformRef.current = nextTransform;
      setDraftTransform(nextTransform);
    };
    const end = () => finish(true);
    const cancel = () => finish(false);

    cleanupRef.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancel);
  };

  return { crop, geometry, transform, startMove, startResize };
};

const getPathBounds = (points) => points.reduce((bounds, point) => ({
  minX: Math.min(bounds.minX, point.x),
  maxX: Math.max(bounds.maxX, point.x),
  minY: Math.min(bounds.minY, point.y),
  maxY: Math.max(bounds.maxY, point.y),
}), { minX: 1, maxX: 0, minY: 1, maxY: 0 });

const getPathCenter = (points) => {
  if (!points.length) return { x: 0.5, y: 0.5 };
  const bounds = getPathBounds(points);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

const pathToSvgPoints = (points) => points
  .map((point) => `${point.x * 1000},${point.y * 1000}`)
  .join(' ');

const createRectangleMaskPath = (start, end) => [
  { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
  { x: Math.max(start.x, end.x), y: Math.min(start.y, end.y) },
  { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) },
  { x: Math.min(start.x, end.x), y: Math.max(start.y, end.y) },
];

const createGeometricMaskPath = (_tool, start, end) => createRectangleMaskPath(start, end);

const PatchMaskEditor = ({ patchRemoval, geometry, onPreviewChange, onChange }) => {
  const normalizedPatch = normalizePatchRemoval(patchRemoval);
  const [draftPatch, setDraftPatch] = useState(normalizedPatch);
  const svgRef = useRef(null);
  const interactionRef = useRef(null);

  useEffect(() => {
    if (!interactionRef.current) setDraftPatch(normalizedPatch);
  }, [patchRemoval]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointFromEvent = (event) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0.5, y: 0.5 };
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
  };

  const startDrawing = (event) => {
    if (event.button !== 0) return;
    if (draftPatch.maskTool === 'points' && !draftPatch.pathClosed) {
      event.preventDefault();
      event.stopPropagation();
      const point = pointFromEvent(event);
      const nextPatch = normalizePatchRemoval({
        ...draftPatch,
        pathClosed: false,
        targetPath: [...draftPatch.targetPath, point].slice(0, 512),
      });
      setDraftPatch(nextPatch);
      onPreviewChange(nextPatch);
      onChange(nextPatch);
      return;
    }
    if (draftPatch.targetPath.length >= 3) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const points = draftPatch.maskTool === 'brush' ? [point] : [];
    interactionRef.current = {
      type: 'draw',
      tool: draftPatch.maskTool,
      pointerId: event.pointerId,
      start: point,
      points,
    };
    const nextPatch = { ...draftPatch, targetPath: points };
    setDraftPatch(nextPatch);
    onPreviewChange(nextPatch);
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const startDraggingPath = (event, type) => {
    if (event.button !== 0 || !hasPatchRemovalMask(draftPatch)) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type,
      pointerId: event.pointerId,
      start: pointFromEvent(event),
      patch: draftPatch,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const moveInteraction = (event) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);

    if (interaction.type === 'draw') {
      if (interaction.tool !== 'brush') {
        interaction.points = createGeometricMaskPath(interaction.tool, interaction.start, point);
        const nextPatch = { ...draftPatch, targetPath: interaction.points };
        interaction.latest = nextPatch;
        setDraftPatch(nextPatch);
        onPreviewChange(nextPatch);
        return;
      }
      const lastPoint = interaction.points[interaction.points.length - 1];
      if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.006) return;
      interaction.points = [...interaction.points, point].slice(0, 512);
      const nextPatch = { ...draftPatch, targetPath: interaction.points };
      interaction.latest = nextPatch;
      setDraftPatch(nextPatch);
      onPreviewChange(nextPatch);
      return;
    }

    const deltaX = point.x - interaction.start.x;
    const deltaY = point.y - interaction.start.y;
    const bounds = getPathBounds(interaction.patch.targetPath);
    if (interaction.type === 'source') {
      const nextOffsetX = clamp(
        interaction.patch.sourceOffset.x + deltaX,
        -bounds.minX,
        1 - bounds.maxX,
      );
      const nextOffsetY = clamp(
        interaction.patch.sourceOffset.y + deltaY,
        -bounds.minY,
        1 - bounds.maxY,
      );
      const nextPatch = {
        ...interaction.patch,
        sourceOffset: { x: nextOffsetX, y: nextOffsetY },
      };
      interaction.latest = nextPatch;
      setDraftPatch(nextPatch);
      onPreviewChange(nextPatch);
      return;
    }

    const adjustedX = clamp(deltaX, -bounds.minX, 1 - bounds.maxX);
    const adjustedY = clamp(deltaY, -bounds.minY, 1 - bounds.maxY);
    const nextPatch = {
      ...interaction.patch,
      targetPath: interaction.patch.targetPath.map((pathPoint) => ({
        x: pathPoint.x + adjustedX,
        y: pathPoint.y + adjustedY,
      })),
      sourceOffset: {
        x: interaction.patch.sourceOffset.x - adjustedX,
        y: interaction.patch.sourceOffset.y - adjustedY,
      },
    };
    interaction.latest = nextPatch;
    setDraftPatch(nextPatch);
    onPreviewChange(nextPatch);
  };

  const finishInteraction = (event) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (interaction.type === 'draw' && interaction.tool !== 'brush') {
      interaction.points = createGeometricMaskPath(
        interaction.tool,
        interaction.start,
        pointFromEvent(event),
      );
    }
    const interactionPatch = interaction.type === 'draw'
      ? { ...draftPatch, targetPath: interaction.points }
      : interaction.latest || draftPatch;
    interactionRef.current = null;
    if (svgRef.current?.hasPointerCapture?.(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    const pathBounds = getPathBounds(interactionPatch.targetPath);
    const validPath = interactionPatch.targetPath.length >= 3
      && pathBounds.maxX - pathBounds.minX >= 0.005
      && pathBounds.maxY - pathBounds.minY >= 0.005;
    const nextPatch = normalizePatchRemoval({
      ...interactionPatch,
      targetPath: validPath ? interactionPatch.targetPath : [],
    });
    setDraftPatch(nextPatch);
    onPreviewChange(nextPatch);
    onChange(nextPatch);
  };

  const targetPath = draftPatch.targetPath;
  const sourcePath = getPatchSourcePath(draftPatch);
  const targetCenter = getPathCenter(targetPath);
  const sourceCenter = getPathCenter(sourcePath);
  const pointPathOpen = draftPatch.maskTool === 'points' && !draftPatch.pathClosed;
  const maskComplete = hasPatchRemovalMask(draftPatch);
  const dotScaleX = 1000 / Math.max(1, geometry.contentWidth);
  const dotScaleY = 1000 / Math.max(1, geometry.contentHeight);

  const closePointPath = (event) => {
    if (!pointPathOpen || targetPath.length < 3) return;
    event.preventDefault();
    event.stopPropagation();
    const nextPatch = normalizePatchRemoval({ ...draftPatch, pathClosed: true });
    setDraftPatch(nextPatch);
    onPreviewChange(nextPatch);
    onChange(nextPatch);
  };

  return (
    <span
      className="absolute z-[65] overflow-hidden"
      style={{
        left: geometry.contentLeft,
        top: geometry.contentTop,
        width: geometry.contentWidth,
        height: geometry.contentHeight,
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className={`absolute inset-0 h-full w-full touch-none ${maskComplete ? 'cursor-default' : 'cursor-crosshair'}`}
        onPointerDown={startDrawing}
        onPointerMove={moveInteraction}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        aria-label="Patch removal mask editor"
      >
        {pointPathOpen && targetPath.length > 0 && (
          <>
            <polyline
              points={pathToSvgPoints(targetPath)}
              fill="none"
              stroke="rgba(15,23,42,0.5)"
              strokeWidth="4.5"
              strokeDasharray="8 7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <polyline
              points={pathToSvgPoints(targetPath)}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="8 7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {targetPath.map((point, index) => (
              <ellipse
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x * 1000}
                cy={point.y * 1000}
                rx={(index === 0 ? 4 : 3) * dotScaleX}
                ry={(index === 0 ? 4 : 3) * dotScaleY}
                fill={index === targetPath.length - 1 ? '#0ea5e9' : '#ffffff'}
                stroke="#0ea5e9"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
                className={index === 0 && targetPath.length >= 3 ? 'cursor-pointer' : ''}
                onPointerDown={index === 0 ? closePointPath : undefined}
              />
            ))}
          </>
        )}
        {maskComplete && (
          <>
            <line
              x1={targetCenter.x * 1000}
              y1={targetCenter.y * 1000}
              x2={sourceCenter.x * 1000}
              y2={sourceCenter.y * 1000}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="3"
              strokeDasharray="10 10"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <polygon
              points={pathToSvgPoints(targetPath)}
              fill="transparent"
              stroke="#a78bfa"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="all"
              className="cursor-move"
              onPointerDown={(event) => startDraggingPath(event, 'target')}
            />
            <polygon
              points={pathToSvgPoints(sourcePath)}
              fill="transparent"
              stroke="#4ade80"
              strokeWidth="4"
              strokeDasharray="10 7"
              vectorEffect="non-scaling-stroke"
              pointerEvents="all"
              className="cursor-move"
              onPointerDown={(event) => startDraggingPath(event, 'source')}
            />
            <ellipse
              cx={targetCenter.x * 1000}
              cy={targetCenter.y * 1000}
              rx={4 * dotScaleX}
              ry={4 * dotScaleY}
              fill="#8b5cf6"
              stroke="white"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <ellipse
              cx={sourceCenter.x * 1000}
              cy={sourceCenter.y * 1000}
              rx={4 * dotScaleX}
              ry={4 * dotScaleY}
              fill="#22c55e"
              stroke="white"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          </>
        )}
      </svg>
      {!maskComplete && (
        <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-black/75 px-3 py-2 text-[10px] font-bold text-white shadow-xl backdrop-blur">
          {draftPatch.maskTool === 'points'
            ? targetPath.length >= 3
              ? 'Click the first green dot to close the mask'
              : 'Click around the object to place mask dots'
            : 'Drag to draw a rectangle mask'}
        </span>
      )}
    </span>
  );
};

const PatchedVideoCanvas = ({
  videoRef,
  clip,
  crop,
  geometry,
  currentTime,
  isPlaying,
}) => {
  const canvasRef = useRef(null);
  const buffersRef = useRef(createPatchRemovalBuffers());

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth <= 0) return;
    const croppedWidth = Math.max(1, video.videoWidth * crop.width);
    const croppedHeight = Math.max(1, video.videoHeight * crop.height);
    const previewScale = Math.min(1, 1280 / Math.max(croppedWidth, croppedHeight));
    drawPatchedMediaFrame({
      destination: canvas,
      source: video,
      crop,
      patchRemoval: clip.patchRemoval,
      width: croppedWidth * previewScale,
      height: croppedHeight * previewScale,
      buffers: buffersRef.current,
    });
  }, [clip.patchRemoval, crop, videoRef]);

  useEffect(() => {
    renderFrame();
  }, [currentTime, renderFrame]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.addEventListener('loadeddata', renderFrame);
    video.addEventListener('seeked', renderFrame);
    return () => {
      video.removeEventListener('loadeddata', renderFrame);
      video.removeEventListener('seeked', renderFrame);
    };
  }, [renderFrame, videoRef]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let frame = 0;
    const update = () => {
      renderFrame();
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, renderFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute max-w-none"
      style={{
        left: geometry.contentLeft,
        top: geometry.contentTop,
        width: geometry.contentWidth,
        height: geometry.contentHeight,
      }}
      aria-hidden="true"
    />
  );
};

const PreviewVideoLayer = ({
  clip,
  currentTime,
  isPlaying,
  selected,
  stageSize,
  onSelect,
  onUpdate,
}) => {
  const videoRef = useRef(null);
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const [patchPreview, setPatchPreview] = useState(null);
  const { crop, geometry, transform, startMove, startResize } = useMediaResize({
    clip,
    mediaSize,
    stageSize,
    onSelect,
    onUpdate,
  });
  const patchRemoval = normalizePatchRemoval(clip.patchRemoval);
  const patchEditing = selected && patchRemoval.enabled && patchRemoval.editing;
  const renderedPatchRemoval = patchPreview || patchRemoval;
  const patchActive = hasPatchRemovalMask(renderedPatchRemoval);

  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const nextSourceTime = Number(clip.sourceStart || 0) +
      Math.max(0, currentTime - Number(clip.timelineStart || 0)) * Number(clip.playbackRate || 1);
    const seekTolerance = isPlaying ? 0.16 : 0.001;
    if (
      Number.isFinite(nextSourceTime)
      && Math.abs(video.currentTime - nextSourceTime) > seekTolerance
    ) {
      try {
        video.currentTime = nextSourceTime;
      } catch {
        // Metadata may still be loading; the next clock tick will retry.
      }
    }
    video.playbackRate = clamp(
      Number(clip.playbackRate || 1),
      MIN_PLAYBACK_RATE,
      MAX_PLAYBACK_RATE,
    );
    video.volume = clamp(Number(clip.volume ?? 1), 0, 1);
    video.muted = Boolean(clip.muted || clip.trackMuted);
    if (isPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [clip.muted, clip.playbackRate, clip.sourceStart, clip.timelineStart, clip.trackMuted, clip.volume, currentTime, isPlaying]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(clip.id);
      }}
      onPointerDown={patchEditing ? undefined : startMove}
      className={`absolute cursor-move overflow-visible ${selected ? 'outline outline-2 outline-[#8b5cf6]' : ''}`}
      style={getMediaLayerStyle(geometry, transform)}
      aria-label={`Select ${clip.name || 'video clip'}`}
    >
      <span className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          src={clip.sourceUrl || clip.url}
          onLoadedMetadata={(event) => setMediaSize({
            width: event.currentTarget.videoWidth,
            height: event.currentTarget.videoHeight,
          })}
          crossOrigin="anonymous"
          playsInline
          preload="auto"
          muted={Boolean(clip.muted || clip.trackMuted)}
          className="pointer-events-none absolute max-w-none"
          style={getCroppedMediaStyle(geometry, crop)}
        />
        {patchActive && (
          <PatchedVideoCanvas
            videoRef={videoRef}
            clip={{ ...clip, patchRemoval: renderedPatchRemoval }}
            crop={crop}
            geometry={geometry}
            currentTime={currentTime}
            isPlaying={isPlaying}
          />
        )}
        {patchEditing && (
          <PatchMaskEditor
            patchRemoval={patchRemoval}
            geometry={geometry}
            onPreviewChange={setPatchPreview}
            onChange={(nextPatch) => {
              setPatchPreview(null);
              onUpdate(clip.id, { patchRemoval: nextPatch });
            }}
          />
        )}
      </span>
      {selected && !patchEditing && MEDIA_RESIZE_HANDLES.map((handle) => (
        <span
          key={handle.mode}
          className={`absolute z-[70] grid h-5 w-5 touch-none place-items-center ${handle.className}`}
          onPointerDown={(event) => startResize(event, handle.mode)}
          title={handle.label}
        >
          <span className={`pointer-events-none border border-zinc-400 bg-white shadow-[0_1px_5px_rgba(0,0,0,0.55)] ${handle.markerClassName}`} />
        </span>
      ))}
    </button>
  );
};

const PreviewImageLayer = ({ clip, selected, stageSize, onSelect, onUpdate }) => {
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const { crop, geometry, transform, startMove, startResize } = useMediaResize({
    clip,
    mediaSize,
    stageSize,
    onSelect,
    onUpdate,
  });

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(clip.id);
      }}
      onPointerDown={startMove}
      className={`absolute cursor-move overflow-visible ${selected ? 'outline outline-2 outline-[#8b5cf6]' : ''}`}
      style={getMediaLayerStyle(geometry, transform)}
      aria-label={`Select ${clip.name || 'image clip'}`}
    >
      <span className="absolute inset-0 overflow-hidden">
        <img
          src={clip.sourceUrl || clip.url}
          onLoad={(event) => setMediaSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
          alt=""
          className="pointer-events-none absolute max-w-none"
          style={getCroppedMediaStyle(geometry, crop)}
        />
      </span>
      {selected && MEDIA_RESIZE_HANDLES.map((handle) => (
        <span
          key={handle.mode}
          className={`absolute z-[70] grid h-5 w-5 touch-none place-items-center ${handle.className}`}
          onPointerDown={(event) => startResize(event, handle.mode)}
          title={handle.label}
        >
          <span className={`pointer-events-none border border-zinc-400 bg-white shadow-[0_1px_5px_rgba(0,0,0,0.55)] ${handle.markerClassName}`} />
        </span>
      ))}
    </button>
  );
};

const PreviewAudioLayer = ({ clip, currentTime, isPlaying }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const nextSourceTime = getLoopedSourceTime(clip, currentTime, audio.duration);
    if (Number.isFinite(nextSourceTime) && Math.abs(audio.currentTime - nextSourceTime) > 0.18) {
      try {
        audio.currentTime = nextSourceTime;
      } catch {
        // Retry once metadata is ready.
      }
    }
    audio.playbackRate = clamp(
      Number(clip.playbackRate || 1),
      MIN_PLAYBACK_RATE,
      MAX_PLAYBACK_RATE,
    );
    audio.loop = Boolean(clip.loop);
    audio.volume = getAudioFadeVolume(clip, currentTime);
    audio.muted = Boolean(clip.muted || clip.trackMuted);
    if (isPlaying && !audio.muted) void audio.play().catch(() => {});
    else audio.pause();
  }, [clip, currentTime, isPlaying]);

  return <audio ref={audioRef} src={clip.sourceUrl || clip.url} crossOrigin="anonymous" preload="auto" />;
};

const PreviewTextLayer = ({
  clip,
  output,
  stageSize,
  currentTime,
  isPlaying,
  selected,
  onSelect,
  onUpdate,
  onTogglePlay,
}) => {
  const [draftTransform, setDraftTransform] = useState(null);
  const [draftText, setDraftText] = useState(clip.text || '');
  const [isEditing, setIsEditing] = useState(false);
  const [resizeDraft, setResizeDraft] = useState(null);
  const [compactHandles, setCompactHandles] = useState(false);
  const draftTransformRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const resizeDraftRef = useRef(null);
  const resizeCleanupRef = useRef(null);
  const originalTextRef = useRef(clip.text || '');
  const textEditActiveRef = useRef(false);
  const internalTextInteractionRef = useRef(false);
  const caretSelectionRef = useRef({ start: 0, end: 0 });
  const textLayerRef = useRef(null);
  const textInputRef = useRef(null);
  const transform = {
    x: Number(clip.transform?.x ?? 0.5),
    y: Number(clip.transform?.y ?? 0.25),
    scale: Number(clip.transform?.scale ?? 1),
    rotation: Number(clip.transform?.rotation || 0),
    opacity: Number(clip.transform?.opacity ?? 1),
  };
  const style = clip.style || {};
  const persistedBoxWidth = clamp(Number(style.boxWidth || 0), 0, 1);
  const persistedBoxHeight = clamp(Number(style.boxHeight || 0), 0, 1);
  const visibleTransform = resizeDraft?.transform || draftTransform || transform;
  const visibleBoxWidth = resizeDraft?.boxWidth ?? persistedBoxWidth;
  const visibleBoxHeight = resizeDraft?.boxHeight ?? persistedBoxHeight;
  const previewScale = stageSize.height > 0 ? stageSize.height / output.height : 0.25;
  const outputFontSize = Number(style.fontSize || DEFAULT_TEXT_STYLE.fontSize);
  const fontSize = clamp(outputFontSize * previewScale, 8, 96);
  const hasTextBackground = String(style.backgroundType || 'none').toLowerCase() !== 'none';
  const automaticPreviewPadding = Math.max(
    0,
    Number(style.padding || (hasTextBackground ? outputFontSize * 0.25 : 0)) * previewScale,
  );
  const previewPaddingX = style.paddingX === null || style.paddingX === undefined
    ? automaticPreviewPadding
    : Math.max(0, Number(style.paddingX) * previewScale);
  const previewPaddingY = style.paddingY === null || style.paddingY === undefined
    ? automaticPreviewPadding
    : Math.max(0, Number(style.paddingY) * previewScale);
  const strokeWidth = Math.max(
    0,
    Number(style.strokeWidth ?? DEFAULT_TEXT_STYLE.strokeWidth) * previewScale,
  );
  const localTime = Math.max(0, currentTime - Number(clip.timelineStart || 0));
  const remaining = Math.max(0, Number(clip.duration || 0) - localTime);
  const fadeIn = clip.animation?.in === 'fade'
    ? Math.max(0, Number(clip.animation.inDuration || 0))
    : 0;
  const fadeOut = clip.animation?.out === 'fade'
    ? Math.max(0, Number(clip.animation.outDuration || 0))
    : 0;
  const animationOpacity = Math.min(
    fadeIn > 0 ? clamp(localTime / fadeIn, 0, 1) : 1,
    fadeOut > 0 ? clamp(remaining / fadeOut, 0, 1) : 1,
  );

  useEffect(() => {
    if (!isEditing) return undefined;
    const frame = requestAnimationFrame(() => {
      const input = textInputRef.current;
      if (!input) return;
      input.focus();
      const caretPosition = input.value.length;
      input.setSelectionRange(caretPosition, caretPosition);
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !textInputRef.current) return;
    const input = textInputRef.current;
    const maximumHeight = Math.max(48, stageSize.height * 0.8);
    input.style.height = '0px';
    const nextHeight = Math.min(input.scrollHeight, maximumHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maximumHeight ? 'auto' : 'hidden';
  }, [draftText, isEditing, stageSize.height, stageSize.width]);

  useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer) return undefined;
    let frame = null;
    const update = () => {
      const visualScale = Math.max(0.01, Number(visibleTransform.scale) || 1);
      const compact = (
        layer.offsetWidth * visualScale < COMPACT_TEXT_BOX_WIDTH
        || layer.offsetHeight * visualScale < COMPACT_TEXT_BOX_HEIGHT
      );
      setCompactHandles((current) => (current === compact ? current : compact));
    };
    const scheduleUpdate = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    scheduleUpdate();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(scheduleUpdate);
      observer.observe(layer);
      return () => {
        observer.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
      };
    }

    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [visibleTransform.scale]);

  useEffect(() => () => {
    dragCleanupRef.current?.();
    resizeCleanupRef.current?.();
  }, []);

  const beginInternalTextInteraction = () => {
    if (!isEditing || !textInputRef.current) return;
    const input = textInputRef.current;
    internalTextInteractionRef.current = true;
    caretSelectionRef.current = {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
  };

  const restoreTextInputFocus = (completeInteraction = false) => {
    if (!internalTextInteractionRef.current) return;
    requestAnimationFrame(() => {
      const input = textInputRef.current;
      if (textEditActiveRef.current && input) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(
          caretSelectionRef.current.start,
          caretSelectionRef.current.end,
        );
      }
      if (completeInteraction) internalTextInteractionRef.current = false;
    });
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (isEditing) {
      event.preventDefault();
      beginInternalTextInteraction();
    }
    event.stopPropagation();
    onSelect(clip.id);
    resizeCleanupRef.current?.();
    resizeDraftRef.current = null;
    setResizeDraft(null);
    const start = { x: event.clientX, y: event.clientY };
    const startTransform = { ...transform };
    let dragging = false;

    dragCleanupRef.current?.();

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', cancelDrag);
      dragCleanupRef.current = null;
    };

    const move = (moveEvent) => {
      const deltaX = moveEvent.clientX - start.x;
      const deltaY = moveEvent.clientY - start.y;
      if (!dragging && Math.hypot(deltaX, deltaY) < 4) return;
      dragging = true;
      moveEvent.preventDefault();
      const nextX = clamp(startTransform.x + (moveEvent.clientX - start.x) / Math.max(stageSize.width, 1), 0, 1);
      const nextY = clamp(startTransform.y + (moveEvent.clientY - start.y) / Math.max(stageSize.height, 1), 0, 1);
      const nextTransform = { ...clip.transform, x: nextX, y: nextY };
      draftTransformRef.current = nextTransform;
      setDraftTransform(nextTransform);
    };
    const end = () => {
      cleanup();
      if (dragging && draftTransformRef.current) {
        onUpdate(clip.id, { transform: draftTransformRef.current });
      }
      draftTransformRef.current = null;
      setDraftTransform(null);
      restoreTextInputFocus(true);
    };
    const cancelDrag = () => {
      cleanup();
      draftTransformRef.current = null;
      setDraftTransform(null);
      restoreTextInputFocus(true);
    };

    dragCleanupRef.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancelDrag);
  };

  const startResize = (event, mode) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    beginInternalTextInteraction();
    onSelect(clip.id);
    dragCleanupRef.current?.();
    draftTransformRef.current = null;
    setDraftTransform(null);
    resizeCleanupRef.current?.();
    resizeDraftRef.current = null;
    setResizeDraft(null);

    const layer = textLayerRef.current;
    if (!layer) return;

    const stageWidth = Math.max(1, stageSize.width);
    const stageHeight = Math.max(1, stageSize.height);
    const startPoint = { x: event.clientX, y: event.clientY };
    const startWidth = Math.max(1, layer.offsetWidth);
    const startHeight = Math.max(1, layer.offsetHeight);
    const startScale = clamp(Number(transform.scale || 1), 0.01, MAX_TEXT_SCALE);
    const rotation = (Number(transform.rotation || 0) * Math.PI) / 180;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const minimumWidth = Math.max(stageWidth * MIN_TEXT_BOX_WIDTH, fontSize * 2);
    const maximumWidth = stageWidth * MAX_TEXT_BOX_WIDTH;
    const sideMode = mode === 'left' || mode === 'right';

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', cancelResize);
      resizeCleanupRef.current = null;
    };

    const finish = (shouldCommit) => {
      const finalDraft = resizeDraftRef.current;
      cleanup();
      if (shouldCommit && finalDraft) {
        onUpdate(clip.id, {
          style: {
            ...clip.style,
            boxWidth: finalDraft.boxWidth,
            boxHeight: finalDraft.boxHeight,
          },
          transform: finalDraft.transform,
        });
      }
      resizeDraftRef.current = null;
      setResizeDraft(null);
      restoreTextInputFocus(true);
    };

    const move = (moveEvent) => {
      moveEvent.preventDefault();
      const worldDeltaX = moveEvent.clientX - startPoint.x;
      const worldDeltaY = moveEvent.clientY - startPoint.y;
      let nextBoxWidth = persistedBoxWidth;
      const nextBoxHeight = persistedBoxHeight;
      let nextTransform;

      if (sideMode) {
        const localDeltaX = (worldDeltaX * cosine + worldDeltaY * sine) / startScale;
        const direction = mode === 'right' ? 1 : -1;
        const nextWidth = clamp(
          startWidth + direction * localDeltaX,
          minimumWidth,
          maximumWidth,
        );
        const appliedDelta = nextWidth - startWidth;
        const centerShiftX = (appliedDelta * direction) / 2;
        nextBoxWidth = nextWidth / stageWidth;

        const worldCenterShiftX = centerShiftX * cosine * startScale;
        const worldCenterShiftY = centerShiftX * sine * startScale;
        nextTransform = {
          ...clip.transform,
          x: clamp(transform.x + worldCenterShiftX / stageWidth, 0, 1),
          y: clamp(transform.y + worldCenterShiftY / stageHeight, 0, 1),
          scale: startScale,
        };
      } else {
        const horizontalDirection = mode.includes('e') ? 1 : -1;
        const verticalDirection = mode.includes('s') ? 1 : -1;
        const localDiagonalX = horizontalDirection * startWidth * startScale;
        const localDiagonalY = verticalDirection * startHeight * startScale;
        const worldDiagonalX = localDiagonalX * cosine - localDiagonalY * sine;
        const worldDiagonalY = localDiagonalX * sine + localDiagonalY * cosine;
        const diagonalLengthSquared = Math.max(
          1,
          worldDiagonalX ** 2 + worldDiagonalY ** 2,
        );
        const scaleFactor = 1 + (
          worldDeltaX * worldDiagonalX + worldDeltaY * worldDiagonalY
        ) / diagonalLengthSquared;
        const nextScale = clamp(
          startScale * scaleFactor,
          MIN_TEXT_SCALE,
          MAX_TEXT_SCALE,
        );
        const scaleDelta = nextScale - startScale;
        const localCenterShiftX = horizontalDirection * startWidth * scaleDelta / 2;
        const localCenterShiftY = verticalDirection * startHeight * scaleDelta / 2;
        const worldCenterShiftX = localCenterShiftX * cosine - localCenterShiftY * sine;
        const worldCenterShiftY = localCenterShiftX * sine + localCenterShiftY * cosine;
        nextTransform = {
          ...clip.transform,
          x: clamp(transform.x + worldCenterShiftX / stageWidth, 0, 1),
          y: clamp(transform.y + worldCenterShiftY / stageHeight, 0, 1),
          scale: nextScale,
        };
      }

      const nextDraft = {
        boxWidth: nextBoxWidth,
        boxHeight: nextBoxHeight,
        transform: nextTransform,
      };
      resizeDraftRef.current = nextDraft;
      setResizeDraft(nextDraft);
    };

    const end = () => finish(true);
    const cancelResize = () => finish(false);

    resizeCleanupRef.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', cancelResize);
  };

  const startEditing = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isEditing) return;
    onSelect(clip.id);
    if (isPlaying) onTogglePlay?.();
    originalTextRef.current = clip.text || '';
    textEditActiveRef.current = true;
    setDraftText(originalTextRef.current);
    setIsEditing(true);
  };

  const focusTextLayer = () => {
    requestAnimationFrame(() => textLayerRef.current?.focus());
  };

  const commitText = (restoreFocus = false) => {
    if (!textEditActiveRef.current) return;
    textEditActiveRef.current = false;
    internalTextInteractionRef.current = false;
    setIsEditing(false);
    if (draftText !== originalTextRef.current) onUpdate(clip.id, { text: draftText });
    if (restoreFocus) focusTextLayer();
  };

  const cancelTextEdit = () => {
    if (!textEditActiveRef.current) return;
    textEditActiveRef.current = false;
    internalTextInteractionRef.current = false;
    setDraftText(originalTextRef.current);
    setIsEditing(false);
    focusTextLayer();
  };

  const textLines = draftText.split('\n');
  const editorColumns = clamp(
    Math.max(...textLines.map((line) => line.length), 1) + 1,
    4,
    64,
  );

  return (
    <div
      ref={textLayerRef}
      role={isEditing ? undefined : 'group'}
      tabIndex={isEditing ? -1 : (selected ? 0 : -1)}
      aria-label={isEditing ? undefined : `Select and edit text: ${clip.text || 'Text'}`}
      onPointerDown={handlePointerDown}
      onDoubleClick={startEditing}
      onKeyDown={isEditing ? undefined : (event) => {
        if (
          event.target === event.currentTarget
          && (event.key === 'Enter' || event.key === 'F2')
        ) {
          startEditing(event);
        }
      }}
      title={isEditing ? 'Editing text — drag the top or bottom edge to move' : 'Double-click to edit text'}
      className={`absolute flex max-w-[92%] items-center justify-center whitespace-pre-wrap text-center [overflow-wrap:anywhere] ${selected || isEditing ? 'z-[60]' : 'z-50'} ${isEditing ? 'cursor-move outline outline-2 outline-[#ff5500]' : `cursor-move ${selected ? 'outline outline-1 outline-dashed outline-white/80' : ''}`}`}
      style={{
        left: `${visibleTransform.x * 100}%`,
        top: `${visibleTransform.y * 100}%`,
        width: visibleBoxWidth > 0 ? visibleBoxWidth * stageSize.width : undefined,
        minHeight: visibleBoxHeight > 0 ? visibleBoxHeight * stageSize.height : undefined,
        boxSizing: 'border-box',
        padding: `${previewPaddingY}px ${previewPaddingX}px`,
        maxWidth: visibleBoxWidth > 0 ? stageSize.width : undefined,
        transform: `translate(-50%, -50%) rotate(${visibleTransform.rotation}deg) scale(${visibleTransform.scale})`,
        transformOrigin: 'center',
        opacity: visibleTransform.opacity * animationOpacity,
        fontFamily: style.fontFamily || 'Outfit, sans-serif',
        fontSize,
        fontWeight: style.fontWeight || DEFAULT_TEXT_STYLE.fontWeight,
        lineHeight: Number(style.lineHeight || 1.2),
        letterSpacing: Number(style.letterSpacing || 0) * previewScale,
        color: style.color || '#ffffff',
        textAlign: style.textAlign || 'center',
        WebkitTextStrokeWidth: `${strokeWidth}px`,
        WebkitTextStrokeColor: style.strokeColor || '#000000',
        WebkitTextFillColor: style.color || '#ffffff',
        paintOrder: 'stroke fill',
        textRendering: 'geometricPrecision',
        backgroundColor: !hasTextBackground
          ? 'transparent'
          : (style.backgroundColor || 'transparent'),
        borderRadius: Number(style.borderRadius ?? style.backgroundRadius ?? 12) * previewScale,
        textShadow: style.shadow ? '0 2px 8px rgba(0,0,0,.55)' : 'none',
        userSelect: isEditing ? 'text' : 'none',
      }}
    >
      {isEditing ? (
        <textarea
          ref={textInputRef}
          value={draftText}
          rows={Math.max(1, textLines.length)}
          cols={editorColumns}
          aria-label="Edit text on preview"
          onChange={(event) => setDraftText(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={() => {
            if (internalTextInteractionRef.current) {
              restoreTextInputFocus(false);
              return;
            }
            commitText(false);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelTextEdit();
            } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              commitText(true);
            }
          }}
          className="block min-h-[1.2em] min-w-[4ch] max-w-full cursor-text resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
          style={{
            fieldSizing: 'content',
            width: visibleBoxWidth > 0 ? '100%' : undefined,
            maxWidth: visibleBoxWidth > 0
              ? '100%'
              : Math.max(1, stageSize.width * 0.92),
            font: 'inherit',
            lineHeight: 'inherit',
            color: 'inherit',
            textAlign: 'inherit',
            WebkitTextStrokeWidth: `${strokeWidth}px`,
            WebkitTextStrokeColor: style.strokeColor || '#000000',
            WebkitTextFillColor: style.color || '#ffffff',
            paintOrder: 'stroke fill',
            caretColor: style.color || '#ffffff',
          }}
        />
      ) : (
        <span
          className="block whitespace-pre-wrap [overflow-wrap:anywhere]"
          style={{ width: visibleBoxWidth > 0 ? '100%' : undefined }}
        >
          {clip.text || 'Text'}
        </span>
      )}

      {selected && isEditing && ['top', 'bottom'].map((edge) => (
        <button
          key={edge}
          type="button"
          tabIndex={-1}
          aria-label={`Move text box from ${edge} edge`}
          title="Drag to move text box"
          onPointerDown={(event) => {
            event.preventDefault();
            handlePointerDown(event);
          }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          className={`absolute left-4 right-4 z-[65] h-3 touch-none cursor-move rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#ff5500] ${edge === 'top' ? '-top-2.5' : '-bottom-2.5'}`}
        />
      ))}

      {selected && TEXT_RESIZE_HANDLES
        .filter((handle) => !compactHandles || COMPACT_TEXT_HANDLE_MODES.has(handle.mode))
        .map((handle) => (
          <button
            key={handle.mode}
            type="button"
            tabIndex={isEditing ? -1 : 0}
            aria-label={handle.label}
            title={handle.label}
            onPointerDown={(event) => startResize(event, handle.mode)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            className={`absolute z-[70] grid touch-none place-items-center bg-transparent outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white ${handle.className}`}
          >
            <span className={`pointer-events-none border border-white bg-[#ff5500] shadow-[0_1px_5px_rgba(0,0,0,0.65)] ${handle.indicatorClassName}`} />
          </button>
        ))}
    </div>
  );
};

const CROP_HANDLES = [
  { mode: 'nw', label: 'Resize crop from top left', className: '-left-2 -top-2 cursor-nwse-resize', markerClassName: 'h-2.5 w-2.5 rounded-[2px]' },
  { mode: 'n', label: 'Resize crop from top', className: 'left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize', markerClassName: 'h-1.5 w-4 rounded-full' },
  { mode: 'ne', label: 'Resize crop from top right', className: '-right-2 -top-2 cursor-nesw-resize', markerClassName: 'h-2.5 w-2.5 rounded-[2px]' },
  { mode: 'e', label: 'Resize crop from right', className: '-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize', markerClassName: 'h-4 w-1.5 rounded-full' },
  { mode: 'se', label: 'Resize crop from bottom right', className: '-bottom-2 -right-2 cursor-nwse-resize', markerClassName: 'h-2.5 w-2.5 rounded-[2px]' },
  { mode: 's', label: 'Resize crop from bottom', className: '-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize', markerClassName: 'h-1.5 w-4 rounded-full' },
  { mode: 'sw', label: 'Resize crop from bottom left', className: '-bottom-2 -left-2 cursor-nesw-resize', markerClassName: 'h-2.5 w-2.5 rounded-[2px]' },
  { mode: 'w', label: 'Resize crop from left', className: '-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize', markerClassName: 'h-4 w-1.5 rounded-full' },
];

const updateCropFromDelta = (initialCrop, mode, deltaX, deltaY) => {
  const initial = getNormalizedCrop(initialCrop);
  const next = { ...initial };

  if (mode === 'move') {
    next.x = clamp(initial.x + deltaX, 0, 1 - initial.width);
    next.y = clamp(initial.y + deltaY, 0, 1 - initial.height);
    return next;
  }

  if (mode.includes('w')) {
    const right = initial.x + initial.width;
    next.x = clamp(initial.x + deltaX, 0, right - MIN_CROP_SIZE);
    next.width = right - next.x;
  }
  if (mode.includes('e')) {
    next.width = clamp(initial.width + deltaX, MIN_CROP_SIZE, 1 - initial.x);
  }
  if (mode.includes('n')) {
    const bottom = initial.y + initial.height;
    next.y = clamp(initial.y + deltaY, 0, bottom - MIN_CROP_SIZE);
    next.height = bottom - next.y;
  }
  if (mode.includes('s')) {
    next.height = clamp(initial.height + deltaY, MIN_CROP_SIZE, 1 - initial.y);
  }

  return getNormalizedCrop(next);
};

const getDeclaredMediaSize = (clip) => {
  const width = Number(clip.metadata?.width || clip.width || 0);
  const height = Number(clip.metadata?.height || clip.height || 0);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 0,
    height: Number.isFinite(height) && height > 0 ? height : 0,
  };
};

const CropWorkspace = ({
  clip,
  crop,
  currentTime,
  stageSize,
  onCancel,
  onChange,
}) => {
  const mediaRef = useRef(null);
  const sourceViewportRef = useRef(null);
  const interactionCleanupRef = useRef(null);
  const [mediaSize, setMediaSize] = useState(() => getDeclaredMediaSize(clip));

  useEffect(() => () => interactionCleanupRef.current?.(), []);

  useEffect(() => {
    const media = mediaRef.current;
    if (clip.type !== 'video' || !media) return;
    const sourceTime = Number(clip.sourceStart || 0) +
      Math.max(0, currentTime - Number(clip.timelineStart || 0)) *
      Math.max(MIN_PLAYBACK_RATE, Number(clip.playbackRate || 1));
    if (Number.isFinite(sourceTime) && Math.abs(media.currentTime - sourceTime) > 0.04) {
      try {
        media.currentTime = sourceTime;
      } catch {
        // The metadata event will make the next synchronization attempt valid.
      }
    }
    media.pause();
  }, [clip.playbackRate, clip.sourceStart, clip.timelineStart, clip.type, currentTime, mediaSize]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [onCancel]);

  const sourceReady = mediaSize.width > 0 && mediaSize.height > 0;
  const workspacePadding = Math.min(12, stageSize.width * 0.035, stageSize.height * 0.035);
  const availableWidth = Math.max(1, stageSize.width - workspacePadding * 2);
  const availableHeight = Math.max(1, stageSize.height - workspacePadding * 2);
  const sourceScale = sourceReady
    ? Math.min(availableWidth / mediaSize.width, availableHeight / mediaSize.height)
    : 1;
  const sourceWidth = sourceReady ? mediaSize.width * sourceScale : 0;
  const sourceHeight = sourceReady ? mediaSize.height * sourceScale : 0;
  const sourceViewport = {
    left: (stageSize.width - sourceWidth) / 2,
    top: (stageSize.height - sourceHeight) / 2,
    width: sourceWidth,
    height: sourceHeight,
  };

  const startInteraction = (event, mode) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const viewport = sourceViewportRef.current?.getBoundingClientRect();
    if (!viewport?.width || !viewport?.height) return;

    event.preventDefault();
    event.stopPropagation();
    interactionCleanupRef.current?.();
    const pointerId = event.pointerId;
    const startPoint = { x: event.clientX, y: event.clientY };
    const initialCrop = { ...crop };

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', cancel);
      interactionCleanupRef.current = null;
    };
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      onChange(updateCropFromDelta(
        initialCrop,
        mode,
        (moveEvent.clientX - startPoint.x) / viewport.width,
        (moveEvent.clientY - startPoint.y) / viewport.height,
      ));
    };
    const finish = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      cleanup();
    };
    const cancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanup();
      onChange(initialCrop);
    };

    interactionCleanupRef.current = cleanup;
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', cancel);
  };

  const handleKeyboardMove = (event, mode) => {
    const keyDelta = event.shiftKey ? 0.02 : 0.005;
    const deltas = {
      ArrowLeft: [-keyDelta, 0],
      ArrowRight: [keyDelta, 0],
      ArrowUp: [0, -keyDelta],
      ArrowDown: [0, keyDelta],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(updateCropFromDelta(crop, mode, delta[0], delta[1]));
  };

  const updateIntrinsicSize = (width, height) => {
    if (width > 0 && height > 0) setMediaSize({ width, height });
  };
  const sourceUrl = clip.sourceUrl || clip.url;

  return (
    <div
      className="absolute inset-0 z-[90] overflow-hidden bg-[#050506]"
      role="region"
      aria-label={`Crop ${clip.name || clip.type}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {sourceReady ? (
        <div
          ref={sourceViewportRef}
          className="absolute overflow-hidden bg-black shadow-[0_12px_45px_rgba(0,0,0,0.65)] ring-1 ring-white/25"
          style={sourceViewport}
        >
          {clip.type === 'video' ? (
            <video
              ref={mediaRef}
              src={sourceUrl}
              crossOrigin="anonymous"
              playsInline
              muted
              preload="auto"
              onLoadedMetadata={(event) => updateIntrinsicSize(
                event.currentTarget.videoWidth,
                event.currentTarget.videoHeight,
              )}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
            />
          ) : (
            <img
              ref={mediaRef}
              src={sourceUrl}
              alt=""
              draggable="false"
              onLoad={(event) => updateIntrinsicSize(
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              )}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
            />
          )}

          <div
            role="group"
            tabIndex={0}
            aria-label="Crop selection. Drag to move; use arrow keys for precise movement."
            onKeyDown={(event) => handleKeyboardMove(event, 'move')}
            onPointerDown={(event) => startInteraction(event, 'move')}
            className="absolute z-10 cursor-move touch-none border-2 border-[#ff5a1f] shadow-[0_0_0_999px_rgba(0,0,0,0.58)] outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
          >
            <div className="pointer-events-none absolute inset-x-1/3 top-0 h-full border-x border-dashed border-white/60" />
            <div className="pointer-events-none absolute inset-y-1/3 left-0 w-full border-y border-dashed border-white/60" />
            {CROP_HANDLES.map((handle) => (
              <button
                key={handle.mode}
                type="button"
                aria-label={handle.label}
                title={`${handle.label}. Arrow keys adjust precisely.`}
                onKeyDown={(event) => handleKeyboardMove(event, handle.mode)}
                onPointerDown={(event) => startInteraction(event, handle.mode)}
                onClick={(event) => event.stopPropagation()}
                className={`absolute z-20 grid h-5 w-5 touch-none place-items-center bg-transparent outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white ${handle.className}`}
              >
                <span className={`pointer-events-none border border-white bg-[#ff5a1f] shadow-[0_1px_5px_rgba(0,0,0,0.7)] ${handle.markerClassName}`} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] font-semibold text-white/60">
          Loading the original media dimensions…
          {clip.type === 'video' ? (
            <video
              ref={mediaRef}
              src={sourceUrl}
              crossOrigin="anonymous"
              playsInline
              muted
              preload="metadata"
              onLoadedMetadata={(event) => updateIntrinsicSize(
                event.currentTarget.videoWidth,
                event.currentTarget.videoHeight,
              )}
              className="hidden"
            />
          ) : (
            <img
              ref={mediaRef}
              src={sourceUrl}
              alt=""
              onLoad={(event) => updateIntrinsicSize(
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              )}
              className="hidden"
            />
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Read-only version of the timeline compositor for legacy/editor summaries.
 * It deliberately has no selection or editing chrome, but uses the exact same
 * media, crop, transform, text and playback layers as PreviewStage.
 */
export const ProjectPreviewCanvas = ({
  project,
  currentTime = 0,
  isPlaying = false,
  includeAudio = false,
  hiddenClipIds = [],
  className = '',
}) => {
  const previewAreaRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 270, height: 480 });

  useEffect(() => {
    const previewArea = previewAreaRef.current;
    if (!previewArea) return undefined;
    const update = () => {
      const availableWidth = Math.max(1, previewArea.clientWidth);
      const availableHeight = Math.max(1, previewArea.clientHeight);
      const outputWidth = Math.max(1, Number(project?.output?.width) || 1080);
      const outputHeight = Math.max(1, Number(project?.output?.height) || 1920);
      const outputRatio = outputWidth / outputHeight;
      const availableRatio = availableWidth / availableHeight;
      const width = availableRatio > outputRatio
        ? availableHeight * outputRatio
        : availableWidth;
      const height = availableRatio > outputRatio
        ? availableHeight
        : availableWidth / outputRatio;
      setStageSize({ width: Math.floor(width), height: Math.floor(height) });
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(previewArea);
    return () => observer.disconnect();
  }, [project?.output?.height, project?.output?.width]);

  const hiddenIds = useMemo(() => new Set(hiddenClipIds), [hiddenClipIds]);
  const allClips = useMemo(() => (project?.tracks || []).flatMap((track, trackIndex) => (
    track.hidden
      ? []
      : (track.clips || []).map((clip, clipIndex) => ({
        ...clip,
        trackType: track.type,
        trackMuted: track.muted,
        trackIndex,
        clipIndex,
      }))
  )), [project?.tracks]);
  const activeVisualClips = allClips.filter((clip) => (
    clip.enabled !== false
    && !hiddenIds.has(clip.id)
    && ['video', 'image', 'text'].includes(clip.type)
    && isClipActive(clip, currentTime)
  )).sort(compareVisualLayers);
  const activeAudio = includeAudio ? allClips.filter((clip) => (
    clip.enabled !== false
    && !clip.trackMuted
    && clip.type === 'audio'
    && isClipActive(clip, currentTime)
  )) : [];
  const output = project?.output || { width: 1080, height: 1920, backgroundColor: '#000000' };

  return (
    <div ref={previewAreaRef} className={`flex h-full w-full items-center justify-center ${className}`}>
      <div
        className="pointer-events-none relative shrink-0 overflow-hidden"
        style={{
          width: stageSize.width,
          height: stageSize.height,
          aspectRatio: `${output.width} / ${output.height}`,
          backgroundColor: output.backgroundColor || '#000000',
        }}
      >
        {activeVisualClips.map((clip) => {
          if (clip.type === 'video') {
            return (
              <PreviewVideoLayer
                key={clip.id}
                clip={clip}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selected={false}
                stageSize={stageSize}
                onSelect={NOOP}
              />
            );
          }
          if (clip.type === 'image') {
            return (
              <PreviewImageLayer
                key={clip.id}
                clip={clip}
                selected={false}
                stageSize={stageSize}
                onSelect={NOOP}
              />
            );
          }
          return (
            <PreviewTextLayer
              key={clip.id}
              clip={clip}
              output={output}
              stageSize={stageSize}
              currentTime={currentTime}
              isPlaying={isPlaying}
              selected={false}
              onSelect={NOOP}
              onUpdate={NOOP}
              onTogglePlay={NOOP}
            />
          );
        })}
        {activeAudio.map((clip) => (
          <PreviewAudioLayer
            key={clip.id}
            clip={clip}
            currentTime={currentTime}
            isPlaying={isPlaying}
          />
        ))}
      </div>
    </div>
  );
};

export const PreviewStage = ({
  project,
  currentTime,
  duration = 0,
  isPlaying,
  selectedClipId,
  onSelectClip,
  onUpdateClip,
  onTogglePlay,
}) => {
  const fullscreenContainerRef = useRef(null);
  const stageRef = useRef(null);
  const previewAreaRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 270, height: 480 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [cropSession, setCropSession] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => {
    const previewArea = previewAreaRef.current;
    if (!previewArea) return undefined;

    const handleWheelZoom = (event) => {
      if ((!event.ctrlKey && !event.metaKey) || event.deltaY === 0) return;
      event.preventDefault();
      const normalizedDelta = clamp(event.deltaY, -80, 80);
      setPreviewZoom((current) => clamp(
        current * Math.exp(-normalizedDelta * 0.006),
        MIN_PREVIEW_ZOOM,
        MAX_PREVIEW_ZOOM,
      ));
    };

    previewArea.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => previewArea.removeEventListener('wheel', handleWheelZoom);
  }, []);

  useEffect(() => {
    const handleResetZoomShortcut = (event) => {
      if (
        event.code !== 'KeyZ'
        || event.repeat
        || event.metaKey
        || event.ctrlKey
        || event.altKey
      ) return;
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      );
      if (isTyping) return;
      event.preventDefault();
      setPreviewZoom(1);
    };

    window.addEventListener('keydown', handleResetZoomShortcut);
    return () => window.removeEventListener('keydown', handleResetZoomShortcut);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenContainerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const previewArea = previewAreaRef.current;
    if (!previewArea) return undefined;
    const update = () => {
      const availableWidth = Math.max(1, previewArea.clientWidth);
      const availableHeight = Math.max(1, previewArea.clientHeight);
      const outputWidth = Math.max(1, Number(project.output.width) || 1);
      const outputHeight = Math.max(1, Number(project.output.height) || 1);
      const outputRatio = outputWidth / outputHeight;
      const availableRatio = availableWidth / availableHeight;
      const width = availableRatio > outputRatio
        ? availableHeight * outputRatio
        : availableWidth;
      const height = availableRatio > outputRatio
        ? availableHeight
        : availableWidth / outputRatio;
      setStageSize({
        width: Math.floor(width * previewZoom),
        height: Math.floor(height * previewZoom),
      });
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(previewArea);
    return () => observer.disconnect();
  }, [previewZoom, project.output.height, project.output.width]);

  useEffect(() => {
    const previewArea = previewAreaRef.current;
    if (!previewArea) return undefined;
    const frame = requestAnimationFrame(() => {
      previewArea.scrollLeft = Math.max(0, (previewArea.scrollWidth - previewArea.clientWidth) / 2);
      previewArea.scrollTop = Math.max(0, (previewArea.scrollHeight - previewArea.clientHeight) / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [stageSize.height, stageSize.width]);

  const allClips = useMemo(() => project.tracks.flatMap((track, trackIndex) => (
    track.hidden ? [] : track.clips.map((clip, clipIndex) => ({
      ...clip,
      trackType: track.type,
      trackMuted: track.muted,
      trackIndex,
      clipIndex,
    }))
  )), [project.tracks]);
  const activeVisualClips = allClips.filter((clip) => (
    clip.enabled !== false &&
    ['video', 'image', 'text'].includes(clip.type) &&
    isClipActive(clip, currentTime)
  )).sort(compareVisualLayers);
  const activeAudio = allClips.filter((clip) => (
    clip.enabled !== false
    && !clip.trackHidden
    && !clip.trackMuted
    && clip.type === 'audio'
    && isClipActive(clip, currentTime)
  ));
  const hasProjectVisual = allClips.some((clip) => (
    clip.enabled !== false && ['video', 'image', 'text'].includes(clip.type)
  ));
  const selectedVisualClip = allClips.find((clip) => (
    clip.enabled !== false &&
    clip.id === selectedClipId &&
    (clip.type === 'video' || clip.type === 'image')
  ));
  const isCropping = Boolean(
    cropSession &&
    selectedVisualClip &&
    cropSession.clipId === selectedVisualClip.id,
  );
  const cropDraft = isCropping ? cropSession.crop : null;
  const selectedPatchRemoval = selectedVisualClip?.type === 'video'
    ? normalizePatchRemoval(selectedVisualClip.patchRemoval)
    : null;
  const isPatchEditing = Boolean(
    selectedVisualClip
    && selectedPatchRemoval?.enabled
    && selectedPatchRemoval.editing,
  );

  useEffect(() => {
    if (!cropSession || cropSession.clipId === selectedClipId) return undefined;
    const frame = requestAnimationFrame(() => {
      setCropSession((current) => (
        current?.clipId === selectedClipId ? current : null
      ));
    });
    return () => cancelAnimationFrame(frame);
  }, [cropSession, selectedClipId]);

  const cancelCropping = () => {
    setCropSession(null);
  };
  const applyCropping = () => {
    if (selectedVisualClip && cropDraft) {
      onUpdateClip(selectedVisualClip.id, { crop: getNormalizedCrop(cropDraft) });
    }
    setCropSession(null);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === fullscreenContainerRef.current) {
        await document.exitFullscreen?.();
      } else {
        await fullscreenContainerRef.current?.requestFullscreen?.();
      }
    } catch {
      // The browser can reject fullscreen when permissions or user settings disallow it.
    }
  };

  return (
    <section
      ref={fullscreenContainerRef}
      className={`relative flex min-h-0 flex-col bg-[#101114] text-zinc-100 ${isFullscreen
        ? 'h-screen w-screen border-0 bg-black'
        : 'h-full border-l border-white/10'}`}
      onKeyDown={(event) => {
        const isFrameStepKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        if ((isCropping || isPatchEditing) && !isFrameStepKey) event.stopPropagation();
      }}
    >
      <div className={`relative flex min-h-0 flex-1 overflow-hidden ${isFullscreen ? 'p-0' : 'p-3'}`}>
        <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 0.7px, transparent 0.7px)', backgroundSize: '18px 18px' }} />

        <div
          ref={previewAreaRef}
          className="relative z-10 flex h-full w-full overflow-auto [scrollbar-color:#45454b_#18181b]"
        >
          <div
            ref={stageRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) onSelectClip(null);
            }}
            className={`relative m-auto shrink-0 overflow-hidden bg-black ${isFullscreen
              ? ''
              : 'shadow-[0_24px_70px_rgba(0,0,0,0.58)] ring-1 ring-white/15'}`}
            style={{
              width: stageSize.width,
              height: stageSize.height,
              aspectRatio: `${project.output.width} / ${project.output.height}`,
              backgroundColor: project.output.backgroundColor || '#000000',
            }}
          >
          {!hasProjectVisual && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black p-7 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/80">
                <Play className="h-5 w-5" />
              </span>
              <p className="mt-3 text-xs font-bold text-white">Add media to start</p>
              <p className="mt-1 text-[9px] font-medium leading-relaxed text-white/45">Upload a video or choose one from your Media Library.</p>
            </div>
          )}

          {activeVisualClips.map((clip) => {
            if (clip.type === 'video') {
              return (
                <PreviewVideoLayer
                  key={clip.id}
                  clip={clip}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  selected={selectedClipId === clip.id}
                  stageSize={stageSize}
                  onSelect={onSelectClip}
                  onUpdate={onUpdateClip}
                />
              );
            }
            if (clip.type === 'image') {
              return (
                <PreviewImageLayer
                  key={clip.id}
                  clip={clip}
                  selected={selectedClipId === clip.id}
                  stageSize={stageSize}
                  onSelect={onSelectClip}
                  onUpdate={onUpdateClip}
                />
              );
            }
            return (
              <PreviewTextLayer
                key={clip.id}
                clip={clip}
                output={project.output}
                stageSize={stageSize}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selected={selectedClipId === clip.id}
                onSelect={onSelectClip}
                onUpdate={onUpdateClip}
                onTogglePlay={onTogglePlay}
              />
            );
          })}

          {activeAudio.map((clip) => (
            <PreviewAudioLayer key={clip.id} clip={clip} currentTime={currentTime} isPlaying={isPlaying} />
          ))}

          {showGuides && (
            <>
              <div className="pointer-events-none absolute inset-x-[7%] bottom-[16%] top-[8%] z-30 border border-dashed border-white/45" />
              <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px bg-white/25" />
              <div className="pointer-events-none absolute left-0 top-1/2 z-30 h-px w-full bg-white/25" />
            </>
          )}

          {isCropping && selectedVisualClip && cropDraft && (
            <CropWorkspace
              key={selectedVisualClip.id}
              clip={selectedVisualClip}
              crop={cropDraft}
              currentTime={currentTime}
              stageSize={stageSize}
              onCancel={cancelCropping}
              onChange={(crop) => setCropSession((current) => (
                current ? { ...current, crop: getNormalizedCrop(crop) } : current
              ))}
            />
          )}
          </div>
        </div>
      </div>

      <div className={`${isFullscreen
        ? 'absolute bottom-4 left-1/2 z-[80] -translate-x-1/2'
        : 'mx-auto mb-3 shrink-0'} flex h-11 w-fit items-center gap-2 rounded-xl border border-white/10 bg-[#1a1b20]/95 px-2 shadow-[0_12px_30px_rgba(0,0,0,0.32)] backdrop-blur-md`}>
        {isPatchEditing ? (
          <>
            <span className="px-1 text-[10px] font-bold text-zinc-300">
              {hasPatchRemovalMask(selectedPatchRemoval)
                ? 'Drag purple target or green source'
                : selectedPatchRemoval.maskTool === 'points'
                  ? 'Place dots, then click the first dot'
                  : 'Draw the target mask'}
            </span>
            <button
              type="button"
              onClick={() => onUpdateClip(selectedVisualClip.id, {
                patchRemoval: {
                  ...selectedPatchRemoval,
                  targetPath: [],
                  pathClosed: selectedPatchRemoval.maskTool !== 'points',
                },
              })}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Redraw
            </button>
            <button
              type="button"
              onClick={() => onUpdateClip(selectedVisualClip.id, {
                patchRemoval: {
                  ...selectedPatchRemoval,
                  editing: false,
                  pathClosed: selectedPatchRemoval.maskTool === 'points'
                    && selectedPatchRemoval.targetPath.length >= 3
                    ? true
                    : selectedPatchRemoval.pathClosed,
                },
              })}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-[10px] font-extrabold text-white shadow-[0_5px_14px_rgba(139,92,246,0.3)] transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1b20]"
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </button>
          </>
        ) : isCropping ? (
          <>
            <button
              type="button"
              onClick={cancelCropping}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setCropSession((current) => (
                current
                  ? { ...current, crop: { x: 0, y: 0, width: 1, height: 1 } }
                  : current
              ))}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={applyCropping}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ff5a1f] px-3 text-[10px] font-extrabold text-white shadow-[0_5px_14px_rgba(255,90,31,0.28)] transition hover:bg-[#ff6a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a61] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1b20]"
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </button>
          </>
        ) : (
          <>
            <span className="px-1.5 text-[10px] font-bold tabular-nums text-zinc-200">
              {formatPreviewTime(currentTime, true)}
              <span className="mx-1 text-zinc-500">/</span>
              {formatPreviewTime(duration)}
            </span>
            <span className="h-5 w-px bg-white/10" aria-hidden="true" />
            <button
              type="button"
              onClick={onTogglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff5a1f] text-white shadow-[0_5px_14px_rgba(255,90,31,0.28)] transition hover:bg-[#ff6a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a61] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1b20]"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => setShowGuides((visible) => !visible)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${showGuides
                ? 'bg-[#ff5a1f]/15 text-[#ff7043] ring-1 ring-[#ff7043]/40'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70`}
              aria-label={showGuides ? 'Hide preview guides' : 'Show preview guides'}
              aria-pressed={showGuides}
              title={showGuides ? 'Hide guides' : 'Show guides'}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(1)}
              disabled={Math.abs(previewZoom - 1) < 0.001}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
              aria-label="Reset preview zoom to 100 percent"
              title="Reset preview zoom (Z)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/70"
              aria-label={isFullscreen ? 'Exit full-screen preview' : 'Full-screen preview'}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen
                ? <Minimize2 className="h-3.5 w-3.5" />
                : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>
    </section>
  );
};
