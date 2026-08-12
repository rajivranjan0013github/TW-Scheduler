import { VideoExportError, throwIfAborted } from './errors.js';

const FONT_WEIGHT_NAMES = {
  thin: 100,
  extralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

const getFontWeight = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.min(900, Math.max(100, numeric));
  return FONT_WEIGHT_NAMES[String(value || '').toLowerCase()] || 700;
};

const safeCanvasColor = (value, fallback) => {
  const color = String(value || '').trim();
  if (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\([\d\s,.%]+\)$/i.test(color) ||
    color === 'transparent'
  ) {
    return color;
  }
  return fallback;
};

const createCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new VideoExportError('Text rendering requires a browser canvas.', {
    code: 'CANVAS_UNAVAILABLE',
  });
};

const canvasToBytes = async (canvas) => {
  let blob;
  if (typeof canvas.convertToBlob === 'function') {
    blob = await canvas.convertToBlob({ type: 'image/png' });
  } else {
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('Canvas PNG encoding failed.'));
      }, 'image/png');
    });
  }
  return new Uint8Array(await blob.arrayBuffer());
};

const getGraphemes = (value) => {
  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(value)].map((part) => part.segment);
  }
  return Array.from(value);
};

const breakWordToWidth = (context, word, maxWidth) => {
  const chunks = [];
  let chunk = '';

  getGraphemes(word).forEach((grapheme) => {
    const candidate = `${chunk}${grapheme}`;
    if (chunk && context.measureText(candidate).width > maxWidth) {
      chunks.push(chunk);
      chunk = grapheme;
    } else {
      chunk = candidate;
    }
  });
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [' '];
};

const wrapText = (context, text, maxWidth, { breakLongWords = false } = {}) => {
  const visualLines = [];
  const paragraphs = String(text || '').split('\n');

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      visualLines.push(' ');
      return;
    }

    const words = paragraph.split(/\s+/);
    let line = '';
    words.forEach((word) => {
      if (breakLongWords && context.measureText(word).width > maxWidth) {
        if (line) {
          visualLines.push(line);
          line = '';
        }
        const chunks = breakWordToWidth(context, word, maxWidth);
        visualLines.push(...chunks.slice(0, -1));
        line = chunks.at(-1) || '';
        return;
      }

      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        visualLines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) visualLines.push(line);
  });

  return visualLines.length ? visualLines : [' '];
};

const roundedRectangle = (context, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
};

/**
 * Renders one normalized text clip into a full-output transparent PNG.
 * Rendering the browser text into pixels keeps FFmpeg independent of host fonts.
 */
export const renderTextClipToPng = async (
  clip,
  { width, height, signal } = {},
) => {
  throwIfAborted(signal);

  if (typeof document !== 'undefined' && document.fonts) {
    const fontWeight = getFontWeight(clip.style.fontWeight);
    const fontFamily = clip.style.fontFamily;
    try {
      await document.fonts.load(
        `${fontWeight} ${clip.style.fontSize}px "${fontFamily}"`,
      );
      await document.fonts.ready;
    } catch {
      // Canvas will use the browser fallback font if the requested font is absent.
    }
  }

  throwIfAborted(signal);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new VideoExportError('Could not prepare the text overlay canvas.', {
      code: 'CANVAS_CONTEXT_UNAVAILABLE',
    });
  }

  const { style, transform } = clip;
  const fontSize = style.fontSize;
  const fontWeight = getFontWeight(style.fontWeight);
  const fontFamily = String(style.fontFamily || 'Arial').replace(/["\\]/g, '');
  const maxWidth = style.maxWidth <= 1 ? width * style.maxWidth : style.maxWidth;
  const lineHeight = fontSize * style.lineHeight;
  const automaticPadding = style.padding || fontSize * 0.25;
  const paddingX = style.paddingX === null || style.paddingX === undefined
    ? automaticPadding
    : style.paddingX;
  const paddingY = style.paddingY === null || style.paddingY === undefined
    ? automaticPadding
    : style.paddingY;
  const fixedBoxWidth = style.boxWidth > 0 ? width * style.boxWidth : 0;
  const fixedBoxHeight = style.boxHeight > 0 ? height * style.boxHeight : 0;
  const wrappingWidth = fixedBoxWidth > 0
    ? Math.max(1, fixedBoxWidth - paddingX * 2)
    : Math.max(1, maxWidth);

  context.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
  context.textBaseline = 'top';
  context.textAlign = style.textAlign;
  context.lineJoin = 'round';
  context.miterLimit = 2;
  if ('letterSpacing' in context) {
    context.letterSpacing = `${style.letterSpacing}px`;
  }

  const lines = wrapText(context, clip.text, wrappingWidth, {
    breakLongWords: fixedBoxWidth > 0,
  });
  const naturalTextWidth = Math.max(
    ...lines.map((line) => context.measureText(line).width),
    1,
  );
  const measuredWidth = fixedBoxWidth > 0
    ? naturalTextWidth
    : Math.min(maxWidth, naturalTextWidth);
  const textHeight = lines.length * lineHeight;
  const naturalBlockHeight = textHeight + paddingY * 2;
  const blockWidth = fixedBoxWidth > 0
    ? fixedBoxWidth
    : measuredWidth + paddingX * 2;
  const blockHeight = fixedBoxHeight > 0
    ? Math.max(fixedBoxHeight, naturalBlockHeight)
    : naturalBlockHeight;

  context.save();
  context.translate(width * transform.x, height * transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scale, transform.scale);
  context.globalAlpha = transform.opacity;

  const blockX = -blockWidth / 2;
  const blockY = -blockHeight / 2;
  const hasBackground =
    style.backgroundType.toLowerCase() !== 'none' &&
    style.backgroundColor !== 'transparent';
  if (hasBackground) {
    context.fillStyle = safeCanvasColor(style.backgroundColor, '#000000');
    roundedRectangle(
      context,
      blockX,
      blockY,
      blockWidth,
      blockHeight,
      style.borderRadius,
    );
    context.fill();
  }

  context.shadowColor = safeCanvasColor(style.shadowColor, 'transparent');
  context.shadowBlur = style.shadowBlur;
  context.shadowOffsetX = style.shadowOffsetX;
  context.shadowOffsetY = style.shadowOffsetY;

  let textX = 0;
  if (style.textAlign === 'left') textX = blockX + paddingX;
  if (style.textAlign === 'right') textX = blockX + blockWidth - paddingX;
  const textY = blockY + (blockHeight - textHeight) / 2;
  const shouldConstrainDrawWidth = fixedBoxWidth <= 0;

  lines.forEach((line, index) => {
    const y = textY + index * lineHeight;
    // Paint the outline first, then restore the full glyph fill. This matches
    // PreviewStage's `paint-order: stroke fill` and keeps thick strokes from
    // eating into narrow letters and counters.
    if (style.strokeWidth > 0) {
      context.lineWidth = style.strokeWidth;
      context.strokeStyle = safeCanvasColor(style.strokeColor, '#000000');
      if (shouldConstrainDrawWidth) context.strokeText(line, textX, y, measuredWidth);
      else context.strokeText(line, textX, y);
    }
    context.fillStyle = safeCanvasColor(style.color, '#FFFFFF');
    if (shouldConstrainDrawWidth) context.fillText(line, textX, y, measuredWidth);
    else context.fillText(line, textX, y);
  });

  context.restore();
  throwIfAborted(signal);
  return canvasToBytes(canvas);
};
