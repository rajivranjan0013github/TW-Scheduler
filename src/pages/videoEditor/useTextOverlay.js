import { useState, useRef, useCallback, useEffect } from 'react';
import {
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  FONT_FAMILY_CSS,
  CANVAS_FONT_FAMILY,
  WEIGHT_MAP,
} from './videoEditorConstants';
import {
  hexToRgba,
  drawRoundRect,
  canvasToUint8Array,
  getOverlayTextWidth,
  getOverlayTextHeight,
  getClampedDragPos,
} from './videoEditorUtils';

/**
 * Manages text overlay state, drag interaction, and the canvas-based
 * PNG renderer used for FFmpeg compositing.
 */
export const useTextOverlay = () => {
  const [text, setText] = useState("clinical students... we can officially\nbreathe on TW");
  const [fontFamily, setFontFamily] = useState('TikTok Sans');
  const [fontWeight, setFontWeight] = useState('Regular');
  const [fontSize, setFontSize] = useState(15);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [bgType, setBgType] = useState('None');
  const [bgColor, setBgColor] = useState('#000000');
  const [dragPos, setDragPos] = useState({ x: 20, y: 220 });
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(292);
  const [previewHeight, setPreviewHeight] = useState(520);

  const dragRef = useRef(null);
  const overlayTextRef = useRef(null);
  const containerRef = useRef(null);

  // Drag state (use refs to avoid re-renders during drag)
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elemStart = useRef({ x: 0, y: 0 });

  // Track preview container size
  useEffect(() => {
    if (!containerRef.current) return undefined;

    const updatePreviewSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPreviewWidth(rect.width);
        setPreviewHeight(rect.height);
      }
    };

    updatePreviewSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updatePreviewSize);
      return () => window.removeEventListener('resize', updatePreviewSize);
    }

    const resizeObserver = new ResizeObserver(updatePreviewSize);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const computeClampedDragPos = useCallback(() => {
    return getClampedDragPos(dragPos, text, fontSize, fontFamily, bgType, previewWidth, previewHeight, fontWeight);
  }, [dragPos, text, fontSize, fontFamily, bgType, previewWidth, previewHeight, fontWeight]);

  const computeOverlayTextWidth = useCallback(() => {
    return getOverlayTextWidth(text, fontSize, fontFamily, previewWidth, fontWeight);
  }, [text, fontSize, fontFamily, previewWidth, fontWeight]);

  const computeOverlayTextHeight = useCallback(() => {
    return getOverlayTextHeight(text, fontSize, bgType, fontFamily, previewWidth, fontWeight);
  }, [text, fontSize, bgType, fontFamily, previewWidth, fontWeight]);

  const getPreviewFontFamily = useCallback(() => {
    return FONT_FAMILY_CSS[fontFamily] || FONT_FAMILY_CSS.Roboto;
  }, [fontFamily]);

  // --- Drag handlers ---
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    if (!containerRef.current || !dragRef.current) return;

    isDragging.current = true;
    setIsDraggingOverlay(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    elemStart.current = getClampedDragPos(dragPos, text, fontSize, fontFamily, bgType, previewWidth, previewHeight, fontWeight);

    dragRef.current.setPointerCapture(e.pointerId);
  }, [dragPos, text, fontSize, fontFamily, bgType, previewWidth, previewHeight, fontWeight]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current || !dragRef.current) return;
    e.preventDefault();

    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;

    const containerRect = containerRef.current.getBoundingClientRect();
    const dragRect = dragRef.current.getBoundingClientRect();

    let newX = elemStart.current.x + deltaX;
    let newY = elemStart.current.y + deltaY;

    const maxX = Math.max(0, containerRect.width - dragRect.width);
    const maxY = Math.max(0, containerRect.height - dragRect.height);

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setDragPos({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (isDragging.current && dragRef.current) {
      isDragging.current = false;
      setIsDraggingOverlay(false);
      dragRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  // --- Word-wrap helper for canvas rendering ---
  const wrapLineForCanvas = useCallback((ctx, line, maxWidth) => {
    if (!line || line.trim().length === 0) return [' '];
    
    const words = line.split(' ');
    const wrappedLines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
    return wrappedLines.length > 0 ? wrappedLines : [' '];
  }, []);

  // --- Canvas overlay PNG generation for FFmpeg ---
  const createTextOverlayPng = useCallback(async (containerRect) => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const scale = OUTPUT_WIDTH / containerRect.width;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare text overlay.');

    const clampedPos = computeClampedDragPos();
    const finalX = Math.round(clampedPos.x * scale);
    const finalY = Math.round(clampedPos.y * scale);
    const finalFontSize = Math.max(1, Math.round(fontSize * scale));
    const finalStrokeWidth = strokeWidth > 0 ? Math.max(1, strokeWidth * scale) : 0;
    const lineHeight = finalFontSize * 1.3;
    const textWidth = Math.round(computeOverlayTextWidth() * scale);
    const horizontalPadding = bgType !== 'None' ? Math.round(10 * scale) : 0;
    const verticalPadding = bgType !== 'None' ? Math.round(4 * scale) : 0;

    // Set font before measuring text for word wrapping
    ctx.font = `${WEIGHT_MAP[fontWeight]} ${finalFontSize}px ${CANVAS_FONT_FAMILY[fontFamily] || 'Roboto'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Word-wrap each explicit line using actual canvas measurements
    const explicitLines = (text || ' ').split('\n');
    const visualLines = [];
    for (const line of explicitLines) {
      const wrapped = wrapLineForCanvas(ctx, line, textWidth);
      visualLines.push(...wrapped);
    }

    const textBlockHeight = lineHeight * visualLines.length;
    const backgroundWidth = textWidth + horizontalPadding * 2;
    const backgroundHeight = textBlockHeight + verticalPadding * 2;

    if (bgType !== 'None') {
      ctx.fillStyle = bgType === 'Snapchat' ? hexToRgba(bgColor, 0.6) : bgColor;
      drawRoundRect(
        ctx,
        finalX,
        finalY,
        backgroundWidth,
        backgroundHeight,
        bgType === 'Snapchat' ? Math.round(6 * scale) : Math.round(4 * scale)
      );
      ctx.fill();
    }

    const textX = finalX + horizontalPadding + textWidth / 2;
    const textY = finalY + verticalPadding;

    visualLines.forEach((line, index) => {
      const y = textY + index * lineHeight;
      if (finalStrokeWidth > 0) {
        ctx.lineWidth = finalStrokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(line, textX, y);
      }
      ctx.fillStyle = fontColor;
      ctx.fillText(line, textX, y);
    });

    return canvasToUint8Array(canvas);
  }, [text, fontFamily, fontWeight, fontSize, fontColor, strokeWidth, strokeColor, bgType, bgColor, computeClampedDragPos, computeOverlayTextWidth, wrapLineForCanvas]);

  return {
    // State
    text, setText,
    fontFamily, setFontFamily,
    fontWeight, setFontWeight,
    fontSize, setFontSize,
    fontColor, setFontColor,
    strokeWidth, setStrokeWidth,
    strokeColor, setStrokeColor,
    bgType, setBgType,
    bgColor, setBgColor,
    dragPos, setDragPos,
    isEditingOverlay, setIsEditingOverlay,
    isDraggingOverlay,
    previewWidth, previewHeight,
    // Refs
    dragRef, overlayTextRef, containerRef,
    // Computed
    computeClampedDragPos,
    computeOverlayTextWidth,
    computeOverlayTextHeight,
    getPreviewFontFamily,
    // Handlers
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    createTextOverlayPng,
  };
};
