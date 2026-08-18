import { hasPatchRemovalMask, normalizePatchRemoval } from '../project/patchRemoval.js';

const createCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
};

const sizeCanvas = (canvas, width, height) => {
  if (!canvas) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
};

const tracePath = (context, points, width, height) => {
  if (points.length < 3) return false;
  context.beginPath();
  context.moveTo(points[0].x * width, points[0].y * height);
  points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
  context.closePath();
  return true;
};

export const createPatchRemovalBuffers = () => ({
  patch: null,
  mask: null,
});

/**
 * Draws a cropped media frame and applies a clone/patch mask on top of it.
 * Target-path coordinates and source offsets are normalized to the cropped frame.
 */
export const drawPatchedMediaFrame = ({
  destination,
  source,
  crop = { x: 0, y: 0, width: 1, height: 1 },
  patchRemoval,
  width = destination?.width,
  height = destination?.height,
  buffers = createPatchRemovalBuffers(),
}) => {
  const outputWidth = Math.max(1, Math.round(Number(width) || 1));
  const outputHeight = Math.max(1, Math.round(Number(height) || 1));
  if (!destination || !source) return false;
  sizeCanvas(destination, outputWidth, outputHeight);
  const context = destination.getContext('2d');
  if (!context) return false;

  const sourceWidth = Math.max(1, Number(source.videoWidth || source.width) || outputWidth);
  const sourceHeight = Math.max(1, Number(source.videoHeight || source.height) || outputHeight);
  const sourceX = Math.max(0, Number(crop.x || 0)) * sourceWidth;
  const sourceY = Math.max(0, Number(crop.y || 0)) * sourceHeight;
  const sourceCropWidth = Math.max(1, Number(crop.width ?? 1) * sourceWidth);
  const sourceCropHeight = Math.max(1, Number(crop.height ?? 1) * sourceHeight);

  try {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, outputWidth, outputHeight);
    context.drawImage(
      source,
      sourceX,
      sourceY,
      sourceCropWidth,
      sourceCropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );
    context.restore();

    if (!hasPatchRemovalMask(patchRemoval)) return true;
    const patch = normalizePatchRemoval(patchRemoval);
    buffers.patch ||= createCanvas(outputWidth, outputHeight);
    buffers.mask ||= createCanvas(outputWidth, outputHeight);
    if (!buffers.patch || !buffers.mask) return true;
    sizeCanvas(buffers.patch, outputWidth, outputHeight);
    sizeCanvas(buffers.mask, outputWidth, outputHeight);
    const patchContext = buffers.patch.getContext('2d');
    const maskContext = buffers.mask.getContext('2d');
    if (!patchContext || !maskContext) return true;

    patchContext.save();
    patchContext.setTransform(1, 0, 0, 1, 0, 0);
    patchContext.globalAlpha = 1;
    patchContext.globalCompositeOperation = 'source-over';
    patchContext.clearRect(0, 0, outputWidth, outputHeight);
    patchContext.drawImage(
      source,
      sourceX,
      sourceY,
      sourceCropWidth,
      sourceCropHeight,
      -patch.sourceOffset.x * outputWidth,
      -patch.sourceOffset.y * outputHeight,
      outputWidth,
      outputHeight,
    );
    patchContext.restore();

    maskContext.save();
    maskContext.setTransform(1, 0, 0, 1, 0, 0);
    maskContext.clearRect(0, 0, outputWidth, outputHeight);
    maskContext.fillStyle = '#ffffff';
    const blur = patch.feather * Math.min(outputWidth, outputHeight);
    maskContext.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
    if (tracePath(maskContext, patch.targetPath, outputWidth, outputHeight)) {
      maskContext.fill();
    }
    maskContext.restore();

    patchContext.save();
    patchContext.globalCompositeOperation = 'destination-in';
    patchContext.drawImage(buffers.mask, 0, 0);
    patchContext.restore();

    context.save();
    context.globalAlpha = patch.opacity;
    context.globalCompositeOperation = 'source-over';
    context.drawImage(buffers.patch, 0, 0);
    context.restore();
    return true;
  } catch {
    return false;
  }
};

