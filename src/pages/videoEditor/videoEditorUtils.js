import { FONT_WIDTH_FACTORS, CANVAS_FONT_FAMILY, WEIGHT_MAP } from './videoEditorConstants';

/**
 * Format seconds into a m:ss display string.
 */
export const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

/**
 * Convert a hex color string to an rgba() CSS value.
 * Replaces the previously duplicated hexToRgba / hexToCanvasRgba.
 */
export const hexToRgba = (hex, alpha = 1) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Draw a rectangle with rounded corners on a canvas 2D context.
 */
export const drawRoundRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

/**
 * Convert a canvas element to a Uint8Array (PNG).
 */
export const canvasToUint8Array = async (canvas) => {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render text overlay.');
  return new Uint8Array(await blob.arrayBuffer());
};

// Memoized offscreen canvas for measurements in the browser
let memoCanvas = null;
let memoCtx = null;

const getCanvasContext = () => {
  if (typeof document === 'undefined') return null;
  if (!memoCtx) {
    try {
      memoCanvas = document.createElement('canvas');
      memoCtx = memoCanvas.getContext('2d');
    } catch (e) {
      console.warn('Canvas measurements context initialization failed:', e);
      return null;
    }
  }
  return memoCtx;
};

/**
 * Estimate the pixel width of the overlay text block.
 */
export const getOverlayTextWidth = (text, fontSize, fontFamily, previewWidth, fontWeight = 'Regular') => {
  const ctx = getCanvasContext();
  if (!ctx) {
    const longestLineLength = Math.max(...(text || ' ').split('\n').map((line) => line.length), 1);
    const widthFactor = FONT_WIDTH_FACTORS[fontFamily] || FONT_WIDTH_FACTORS.Roboto;
    const estimatedWidth = Math.max(50, Math.ceil(longestLineLength * fontSize * widthFactor) + 8);
    return Math.min(estimatedWidth, Math.max(50, previewWidth - 16));
  }

  const fontName = CANVAS_FONT_FAMILY[fontFamily] || 'Roboto';
  const weight = WEIGHT_MAP[fontWeight] || '400';
  ctx.font = `${weight} ${fontSize}px ${fontName}`;

  const lines = (text || ' ').split('\n');
  let maxWidth = 0;
  for (const line of lines) {
    const lineText = line || ' ';
    const width = ctx.measureText(lineText).width;
    if (width > maxWidth) {
      maxWidth = width;
    }
  }

  // Add a safety padding (e.g. 12px) to prevent subpixel layout differences in browser textarea
  const estimatedWidth = Math.ceil(maxWidth) + 12;
  return Math.min(Math.max(50, estimatedWidth), Math.max(50, previewWidth - 16));
};

/**
 * Estimate the pixel height of the overlay text block.
 */
export const getOverlayTextHeight = (text, fontSize, bgType, fontFamily, previewWidth, fontWeight = 'Regular') => {
  const availableWidth = getOverlayTextWidth(text, fontSize, fontFamily, previewWidth, fontWeight);
  const ctx = getCanvasContext();

  if (!ctx) {
    const lines = (text || ' ').split('\n');
    const widthFactor = FONT_WIDTH_FACTORS[fontFamily] || FONT_WIDTH_FACTORS.Roboto;
    let totalVisualLines = 0;
    for (const line of lines) {
      if (!line || line.trim().length === 0) {
        totalVisualLines += 1;
        continue;
      }
      const linePixelWidth = line.length * fontSize * widthFactor;
      const wrappedLines = Math.ceil(linePixelWidth / Math.max(availableWidth, 1));
      totalVisualLines += Math.max(wrappedLines, 1);
    }
    const textHeight = totalVisualLines * fontSize * 1.3;
    const verticalPadding = bgType !== 'None' ? 8 : 0;
    return Math.ceil(textHeight + verticalPadding);
  }

  const fontName = CANVAS_FONT_FAMILY[fontFamily] || 'Roboto';
  const weight = WEIGHT_MAP[fontWeight] || '400';
  ctx.font = `${weight} ${fontSize}px ${fontName}`;

  const lines = (text || ' ').split('\n');
  let totalVisualLines = 0;

  for (const line of lines) {
    if (!line || line.trim().length === 0) {
      totalVisualLines += 1;
      continue;
    }

    const words = line.split(' ');
    let currentLine = '';
    let lineCount = 0;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = ctx.measureText(testLine).width;
      if (width > availableWidth && currentLine) {
        lineCount++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lineCount++;
    }
    totalVisualLines += Math.max(lineCount, 1);
  }

  const textHeight = totalVisualLines * fontSize * 1.3;
  const verticalPadding = bgType !== 'None' ? 8 : 0;
  return Math.ceil(textHeight + verticalPadding);
};

/**
 * Clamp drag position so the overlay stays inside the preview container.
 */
export const getClampedDragPos = (dragPos, text, fontSize, fontFamily, bgType, previewWidth, previewHeight, fontWeight = 'Regular') => {
  const overlayWidth = getOverlayTextWidth(text, fontSize, fontFamily, previewWidth, fontWeight) + (bgType !== 'None' ? 20 : 0);
  const overlayHeight = getOverlayTextHeight(text, fontSize, bgType, fontFamily, previewWidth, fontWeight);
  const maxX = Math.max(0, previewWidth - overlayWidth);
  const maxY = Math.max(0, previewHeight - overlayHeight);

  return {
    x: Math.max(0, Math.min(dragPos.x, maxX)),
    y: Math.max(0, Math.min(dragPos.y, maxY)),
  };
};
