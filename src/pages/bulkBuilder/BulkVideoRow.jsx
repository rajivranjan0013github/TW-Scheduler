import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Video, Music, Type, X, Move, Pencil } from 'lucide-react';
import {
  PREVIEW_FRAME_HEIGHT,
  PREVIEW_FRAME_WIDTH,
} from '../videoEditor/videoEditorConstants';
import { getOverlayTextHeight, getOverlayTextWidth } from '../videoEditor/videoEditorUtils';
import { bulkRowToProject, getAllClips, TRACK_TYPES } from '../videoEditorV2/project';
import { getActiveEditorDragItem, readEditorDragData } from '../videoEditorV2/media/editorDragData';
import { DEFAULT_DRAG_POS } from './useBulkRows';
import { FloatingTextControls } from './FloatingTextControls';
import LoadingVideoPreview from '../../components/LoadingVideoPreview';
import { getMediaUrl } from '../../utils/mediaUrls';

const SOURCE_PREVIEW_WIDTH = PREVIEW_FRAME_WIDTH;
const SOURCE_PREVIEW_HEIGHT = PREVIEW_FRAME_HEIGHT;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MIN_TEXT_BOX_WIDTH = 0.08;
const MAX_TEXT_BOX_WIDTH = 1.0;
const MIN_TEXT_SCALE = 0.25;
const MAX_TEXT_SCALE = 3;
const CENTER_GUIDE_THRESHOLD_PX = 6;
const TEXT_RESIZE_HANDLES = [
  { mode: 'left', label: 'Resize text box from left', className: '-left-2 top-1/2 h-7 w-4 -translate-y-1/2 cursor-ew-resize', indicatorClassName: 'h-4 w-1 rounded-full' },
  { mode: 'right', label: 'Resize text box from right', className: '-right-2 top-1/2 h-7 w-4 -translate-y-1/2 cursor-ew-resize', indicatorClassName: 'h-4 w-1 rounded-full' },
  { mode: 'nw', label: 'Scale text from top left', className: '-left-2.5 -top-2.5 h-5 w-5 cursor-nwse-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
  { mode: 'ne', label: 'Scale text from top right', className: '-right-2.5 -top-2.5 h-5 w-5 cursor-nesw-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
  { mode: 'sw', label: 'Scale text from bottom left', className: '-bottom-2.5 -left-2.5 h-5 w-5 cursor-nesw-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
  { mode: 'se', label: 'Scale text from bottom right', className: '-bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize', indicatorClassName: 'h-2 w-2 rounded-[2px]' },
];

const getSourceBoxMetrics = (text, settings) => {
  const textWidth = getOverlayTextWidth(
    text || ' ',
    settings.fontSize,
    settings.fontFamily,
    SOURCE_PREVIEW_WIDTH,
    settings.fontWeight
  );
  const textHeight = getOverlayTextHeight(
    text || ' ',
    settings.fontSize,
    settings.bgType,
    settings.fontFamily,
    SOURCE_PREVIEW_WIDTH,
    settings.fontWeight
  );
  const horizontalPadding = settings.bgType !== 'None' ? 20 : 0;

  return {
    textWidth,
    textHeight,
    boxWidth: textWidth + horizontalPadding,
    boxHeight: textHeight,
  };
};

/**
 * Figma-style Canvas Node card — representing one bulk row.
 * Positioned absolutely on the workspace. Supports drag-positioning.
 */
export const BulkVideoRow = ({
  row,
  rowIndex,
  isSelected = false,
  isActiveCaption,
  isCaptionTarget = false,
  inverseZoomScale = 1,
  onPickVideo1,
  onPickVideo2,
  onPickAudio,
  onDropVideo1,
  onDropVideo2,
  onDropAudio,
  onOpenCaptionDrawer,
  onCaptionOverlayClick,
  onUpdateCaption,
  onUpdateTextSettings,
  onUpdateTextClip,
  onCloseCaptionControls,
  onRemove,
  zoomScale = 1,
  onUpdateCanvasPos,
  onHeaderDoubleClick,
  onEditTimeline,
  isDualVideo = true,
}) => {
  const { video1, video1Url, video2, video2Url, audio, caption, textSettings, status, resultMediaUrl } = row;
  const dragPos = { ...DEFAULT_DRAG_POS, ...(row.dragPos || {}) };
  const video1TileRef = useRef(null);
  const video1PreviewRef = useRef(null);
  const video2PreviewRef = useRef(null);
  const captionTextRef = useRef(null);
  const captionLayerRef = useRef(null);
  const dragSessionRef = useRef(null);
  const resizeDraftRef = useRef(null);
  const resizeCleanupRef = useRef(null);
  const didDragCaptionRef = useRef(false);
  const suppressTextSelectionRef = useRef(false);
  const [video1TileSize, setVideo1TileSize] = useState({
    width: SOURCE_PREVIEW_WIDTH,
    height: SOURCE_PREVIEW_HEIGHT,
  });
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState({ horizontal: false, vertical: false });
  const [dragOverSlot, setDragOverSlot] = useState(null); // 'video1' | 'video2' | 'audio' | null
  const [resizeDraft, setResizeDraft] = useState(null);
  const [dragDraft, setDragDraft] = useState(null);
  const dragDraftRef = useRef(null);

  // Keep live rendered pixel dimensions of Video 1 slot to map relative % positions
  useEffect(() => {
    if (!video1TileRef.current) return undefined;
    const updateSize = () => {
      if (video1TileRef.current) {
        setVideo1TileSize({
          width: video1TileRef.current.offsetWidth || SOURCE_PREVIEW_WIDTH,
          height: video1TileRef.current.offsetHeight || SOURCE_PREVIEW_HEIGHT,
        });
      }
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(video1TileRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const previewProject = useMemo(() => bulkRowToProject(row), [row]);
  const previewTextClip = useMemo(() => {
    const textClips = getAllClips(previewProject).filter((clip) => (
      clip.type === TRACK_TYPES.TEXT && clip.enabled !== false
    ));
    return textClips.find((clip) => clip.metadata?.bulkCaption === true) || textClips[0] || null;
  }, [previewProject]);
  const sourceMetrics = getSourceBoxMetrics(caption, textSettings);
  const sourceTextHeight = sourceMetrics.textHeight;
  const sourceBoxWidth = sourceMetrics.boxWidth;
  const sourceBoxHeight = sourceMetrics.boxHeight;
  const maxSourceX = Math.max(0, SOURCE_PREVIEW_WIDTH - sourceBoxWidth);
  const maxSourceY = Math.max(0, SOURCE_PREVIEW_HEIGHT - sourceTextHeight);
  const clampedSourceX = clamp(dragPos.x, 0, maxSourceX);
  const clampedSourceY = clamp(dragPos.y, 0, maxSourceY);
  const editorTextStyle = previewTextClip?.style || {};
  const editorTextTransform = previewTextClip?.transform || {};
  const outputHeight = Math.max(1, Number(previewProject?.output?.height) || 1280);
  const editorPreviewScale = video1TileSize.height / outputHeight;
  const outputFontSize = Number(editorTextStyle.fontSize || 40);
  const previewFontSize = clamp(outputFontSize * editorPreviewScale, 8, 96);
  const hasTextBackground = String(editorTextStyle.backgroundType || 'none').toLowerCase() !== 'none';
  const automaticPreviewPadding = Math.max(
    0,
    Number(editorTextStyle.padding || (hasTextBackground ? outputFontSize * 0.25 : 0))
      * editorPreviewScale,
  );
  const previewPaddingX = editorTextStyle.paddingX === null || editorTextStyle.paddingX === undefined
    ? automaticPreviewPadding
    : Math.max(0, Number(editorTextStyle.paddingX) * editorPreviewScale);
  const previewPaddingY = editorTextStyle.paddingY === null || editorTextStyle.paddingY === undefined
    ? automaticPreviewPadding
    : Math.max(0, Number(editorTextStyle.paddingY) * editorPreviewScale);
  const previewStrokeWidth = Math.max(
    0,
    Number(editorTextStyle.strokeWidth ?? 3) * editorPreviewScale,
  );
  const previewBoxWidth = clamp(Number(editorTextStyle.boxWidth || 0), 0, 1);
  const previewBoxHeight = clamp(Number(editorTextStyle.boxHeight || 0), 0, 1);
  const previewTransform = {
    x: Number(editorTextTransform.x ?? 0.5),
    y: Number(editorTextTransform.y ?? 0.25),
    scale: Number(editorTextTransform.scale ?? 1),
    rotation: Number(editorTextTransform.rotation || 0),
    opacity: Number(editorTextTransform.opacity ?? 1),
  };
  const visibleBoxWidth = resizeDraft?.boxWidth ?? previewBoxWidth;
  const visibleBoxHeight = resizeDraft?.boxHeight ?? previewBoxHeight;
  const visibleTransform = resizeDraft?.transform || dragDraft?.transform || previewTransform;
  const resizeControlScale = Math.max(0.01, Number(inverseZoomScale) || 1)
    / Math.max(0.01, Math.abs(Number(visibleTransform.scale) || 1));
  const captionLines = caption.split('\n');
  const captionEditorColumns = clamp(
    Math.max(...captionLines.map((line) => line.length), 1) + 1,
    4,
    64,
  );

  const statusColors = {
    draft: 'bg-zinc-800 text-zinc-400 border border-zinc-700/60',
    ready: 'bg-blue-950/40 text-blue-400 border border-blue-900/40',
    processing: 'bg-amber-950/40 text-amber-400 border border-amber-900/40 animate-pulse',
    saving: 'bg-purple-950/40 text-purple-400 border border-purple-900/40 animate-pulse',
    done: 'bg-green-950/40 text-green-400 border border-green-900/40',
    error: 'bg-red-950/40 text-red-400 border border-red-900/40',
  };

  const statusLabels = {
    draft: 'Draft',
    ready: 'Ready',
    processing: 'Processing',
    saving: 'Saving',
    done: 'Done ✓',
    error: 'Error',
  };

  const resolveBulkPreviewUrl = (video, selectedUrl) => {
    if (selectedUrl) return selectedUrl;
    if (!video) return '';
    if (video.sourceType === 'library') return getMediaUrl(video.originalUrl || video.url);
    return video.url || '';
  };

  const resolvedVideo1Url = resolveBulkPreviewUrl(video1, video1Url);
  const resolvedVideo2Url = resolveBulkPreviewUrl(video2, video2Url);

  const getCenteredDragPosForBox = (nextMetrics) => {
    const currentCenterX = clampedSourceX + sourceBoxWidth / 2;
    const currentCenterY = clampedSourceY + sourceBoxHeight / 2;
    const nextMaxSourceX = Math.max(0, SOURCE_PREVIEW_WIDTH - nextMetrics.boxWidth);
    const nextMaxSourceY = Math.max(0, SOURCE_PREVIEW_HEIGHT - nextMetrics.boxHeight);

    return {
      x: clamp(currentCenterX - nextMetrics.boxWidth / 2, 0, nextMaxSourceX),
      y: clamp(currentCenterY - nextMetrics.boxHeight / 2, 0, nextMaxSourceY),
    };
  };

  const handleCaptionChange = (nextCaption) => {
    onUpdateCaption?.(
      nextCaption,
      getCenteredDragPosForBox(getSourceBoxMetrics(nextCaption, textSettings))
    );
  };

  const handleUpdateTextSettings = (partialSettings) => {
    const nextSettings = { ...textSettings, ...partialSettings };
    onUpdateTextSettings?.(
      partialSettings,
      getCenteredDragPosForBox(getSourceBoxMetrics(caption, nextSettings))
    );
  };

  const handleTogglePreviewPlayback = (event, slot) => {
    event.preventDefault();
    event.stopPropagation();

    const videoRef = slot === 'video1' ? video1PreviewRef : video2PreviewRef;
    const otherRef = slot === 'video1' ? video2PreviewRef : video1PreviewRef;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (videoEl.paused) {
      if (otherRef.current && !otherRef.current.paused) {
        otherRef.current.pause();
      }
      void videoEl.play().catch(() => {});
      return;
    }

    videoEl.pause();
  };

  const handlePreviewStopped = () => {};

  // Node Drag Handler (Header bar drag movement)
  const handleNodePointerDown = (event) => {
    // Avoid drag trigger on input selectors or buttons
    if (event.target.closest('button') || event.target.closest('a')) return;
    
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const initialPos = { ...(row.canvasPos || { x: 100, y: 80 }) };

    const handlePointerMove = (moveEvent) => {
      // Scale translation by the page's current zoom factor
      const dx = (moveEvent.clientX - startX) / zoomScale;
      const dy = (moveEvent.clientY - startY) / zoomScale;

      onUpdateCanvasPos?.({
        x: Math.round(initialPos.x + dx),
        y: Math.round(initialPos.y + dy)
      });
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Caption inline overlay dragging
  const handleCaptionPointerDown = (event) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    didDragCaptionRef.current = false;
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTransformX: Number(previewTransform.x ?? 0.5),
      startTransformY: Number(previewTransform.y ?? 0.25),
    };
    setAlignmentGuides({ vertical: false, horizontal: false });
    setIsDraggingCaption(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCaptionPointerMove = (event) => {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const localZoom = Math.max(0.01, Number(zoomScale) || 1);
    const stageWidth = Math.max(1, video1TileSize.width);
    const stageHeight = Math.max(1, video1TileSize.height);

    const deltaX = (event.clientX - dragSession.startClientX) / (stageWidth * localZoom);
    const deltaY = (event.clientY - dragSession.startClientY) / (stageHeight * localZoom);

    if (Math.abs(event.clientX - dragSession.startClientX) > 2 || Math.abs(event.clientY - dragSession.startClientY) > 2) {
      didDragCaptionRef.current = true;
    }

    // Keep the entire text box strictly bounded within the video frame edges
    const layer = captionLayerRef.current;
    const currentScale = Number(visibleTransform.scale || 1);
    const layerWidth = (layer?.offsetWidth || sourceBoxWidth) * currentScale;
    const layerHeight = (layer?.offsetHeight || sourceBoxHeight) * currentScale;
    const halfWidthRatio = Math.min(0.48, (layerWidth / 2) / stageWidth);
    const halfHeightRatio = Math.min(0.48, (layerHeight / 2) / stageHeight);

    const minX = halfWidthRatio;
    const maxX = Math.max(halfWidthRatio, 1 - halfWidthRatio);
    const minY = halfHeightRatio;
    const maxY = Math.max(halfHeightRatio, 1 - halfHeightRatio);

    let nextTransformX = clamp(dragSession.startTransformX + deltaX, minX, maxX);
    let nextTransformY = clamp(dragSession.startTransformY + deltaY, minY, maxY);

    const xThreshold = CENTER_GUIDE_THRESHOLD_PX / (stageWidth * localZoom);
    const yThreshold = CENTER_GUIDE_THRESHOLD_PX / (stageHeight * localZoom);
    const shouldSnapVertical = Math.abs(nextTransformX - 0.5) <= xThreshold;
    const shouldSnapHorizontal = Math.abs(nextTransformY - 0.5) <= yThreshold;

    if (shouldSnapVertical) {
      nextTransformX = 0.5;
    }
    if (shouldSnapHorizontal) {
      nextTransformY = 0.5;
    }

    setAlignmentGuides({
      vertical: shouldSnapVertical,
      horizontal: shouldSnapHorizontal,
    });

    const nextTransform = {
      ...previewTextClip?.transform,
      x: nextTransformX,
      y: nextTransformY,
      scale: previewTransform.scale,
      rotation: previewTransform.rotation,
      opacity: previewTransform.opacity,
    };

    dragDraftRef.current = nextTransform;
    setDragDraft({ transform: nextTransform });
  };

  const handleCaptionPointerUp = (event) => {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const finalTransform = dragDraftRef.current;
    dragSessionRef.current = null;
    dragDraftRef.current = null;
    setDragDraft(null);
    setIsDraggingCaption(false);
    setAlignmentGuides({ vertical: false, horizontal: false });
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Safe releases
    }

    if (didDragCaptionRef.current && finalTransform && previewTextClip) {
      onUpdateTextClip?.(previewTextClip.id, {
        transform: finalTransform,
      });
    }
  };

  const startCaptionResize = (event, mode) => {
    if (event.button !== 0 || event.isPrimary === false || !previewTextClip) return;
    event.preventDefault();
    event.stopPropagation();
    dragSessionRef.current = null;
    setIsDraggingCaption(false);
    resizeCleanupRef.current?.();
    resizeDraftRef.current = null;
    setResizeDraft(null);

    const layer = captionLayerRef.current;
    if (!layer) return;

    const stageWidth = Math.max(1, video1TileSize.width);
    const stageHeight = Math.max(1, video1TileSize.height);
    const localZoom = Math.max(0.01, Number(zoomScale) || 1);
    const startPoint = { x: event.clientX, y: event.clientY };
    const startWidth = Math.max(1, layer.offsetWidth);
    const startHeight = Math.max(1, layer.offsetHeight);
    const startScale = clamp(Number(previewTransform.scale || 1), 0.01, MAX_TEXT_SCALE);
    const rotation = (Number(previewTransform.rotation || 0) * Math.PI) / 180;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const minimumWidth = Math.max(stageWidth * MIN_TEXT_BOX_WIDTH, previewFontSize * 2);
    const maximumWidth = stageWidth * MAX_TEXT_BOX_WIDTH;
    const isSideHandle = mode === 'left' || mode === 'right';

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finishResize);
      document.removeEventListener('pointercancel', cancelResize);
      resizeCleanupRef.current = null;
    };

    const completeResize = (shouldCommit) => {
      const finalDraft = resizeDraftRef.current;
      cleanup();
      if (shouldCommit && finalDraft) {
        onUpdateTextClip?.(previewTextClip.id, {
          style: {
            ...previewTextClip.style,
            boxWidth: finalDraft.boxWidth,
            boxHeight: finalDraft.boxHeight,
          },
          transform: finalDraft.transform,
        });
      }
      resizeDraftRef.current = null;
      setResizeDraft(null);
    };

    function move(moveEvent) {
      moveEvent.preventDefault();
      const worldDeltaX = (moveEvent.clientX - startPoint.x) / localZoom;
      const worldDeltaY = (moveEvent.clientY - startPoint.y) / localZoom;
      let nextBoxWidth = previewBoxWidth;
      const nextBoxHeight = previewBoxHeight;
      let nextTransform;

      if (isSideHandle) {
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
        const halfWidthRatio = Math.min(0.48, (nextWidth / 2) / stageWidth);
        const minX = halfWidthRatio;
        const maxX = Math.max(halfWidthRatio, 1 - halfWidthRatio);

        nextTransform = {
          ...previewTextClip.transform,
          x: clamp(previewTransform.x + worldCenterShiftX / stageWidth, minX, maxX),
          y: clamp(previewTransform.y + worldCenterShiftY / stageHeight, 0.05, 0.95),
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
          ...previewTextClip.transform,
          x: clamp(previewTransform.x + worldCenterShiftX / stageWidth, 0, 1),
          y: clamp(previewTransform.y + worldCenterShiftY / stageHeight, 0, 1),
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
    }

    function finishResize() {
      completeResize(true);
    }

    function cancelResize() {
      completeResize(false);
    }

    resizeCleanupRef.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finishResize);
    document.addEventListener('pointercancel', cancelResize);
  };

  const handleCaptionDoubleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCaptionOverlayClick();
    suppressTextSelectionRef.current = true;
    setIsEditingCaption(true);
    window.setTimeout(() => {
      const textarea = captionTextRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      window.setTimeout(() => {
        suppressTextSelectionRef.current = false;
      }, 80);
    }, 10);
  };

  const isDragItemAudio = () => {
    const dragItem = getActiveEditorDragItem();
    if (!dragItem?.asset) return false;
    const { mediaType, type, category, kind } = dragItem.asset;
    return mediaType === 'audio' || type === 'audio' || category === 'audio' || kind === 'audio';
  };

  const handleCardDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (isDragItemAudio()) {
      if (dragOverSlot !== 'card-audio') {
        setDragOverSlot('card-audio');
      }
    }
  };

  const handleCardDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (dragOverSlot === 'card-audio') {
      setDragOverSlot(null);
    }
  };

  const handleCardDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverSlot(null);

    const dragItem = getActiveEditorDragItem() || readEditorDragData(event.dataTransfer);
    if (dragItem?.asset) {
      const asset = dragItem.asset;
      const isAudio = asset.mediaType === 'audio' || asset.type === 'audio' || asset.category === 'audio';
      if (isAudio) {
        onDropAudio?.(asset);
        return;
      }
      if (!row.video1) {
        onDropVideo1?.(asset);
      } else if (isDualVideo && !row.video2) {
        onDropVideo2?.(asset);
      } else {
        onDropVideo1?.(asset);
      }
      return;
    }

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      const file = files[0];
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name);
      const url = URL.createObjectURL(file);
      const asset = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        url,
        originalUrl: url,
        sourceType: 'local',
        type: isVideo ? 'video' : isAudio ? 'audio' : 'file',
        mediaType: isVideo ? 'video' : isAudio ? 'audio' : 'file',
        file,
      };

      if (isAudio) {
        onDropAudio?.(asset);
      } else if (isVideo) {
        if (!row.video1) onDropVideo1?.(asset);
        else if (isDualVideo && !row.video2) onDropVideo2?.(asset);
        else onDropVideo1?.(asset);
      }
    }
  };

  const handleSlotDragOver = (event, slot) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (isDragItemAudio()) {
      if (dragOverSlot !== 'card-audio') {
        setDragOverSlot('card-audio');
      }
      return;
    }
    if (dragOverSlot !== slot) {
      setDragOverSlot(slot);
    }
  };

  const handleSlotDragLeave = (event, slot) => {
    event.preventDefault();
    event.stopPropagation();
    if (dragOverSlot === slot) {
      setDragOverSlot(null);
    }
  };

  const handleSlotDrop = (event, slot) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverSlot(null);

    const dragItem = getActiveEditorDragItem() || readEditorDragData(event.dataTransfer);
    if (dragItem?.asset) {
      const asset = dragItem.asset;
      const isAudio = asset.mediaType === 'audio' || asset.type === 'audio' || asset.category === 'audio';
      if (isAudio || slot === 'audio') {
        onDropAudio?.(asset);
        return;
      }
      if (slot === 'video1') {
        onDropVideo1?.(asset);
      } else if (slot === 'video2') {
        onDropVideo2?.(asset);
      }
      return;
    }

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      const file = files[0];
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name);
      const url = URL.createObjectURL(file);
      const asset = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        url,
        originalUrl: url,
        sourceType: 'local',
        type: isVideo ? 'video' : isAudio ? 'audio' : 'file',
        mediaType: isVideo ? 'video' : isAudio ? 'audio' : 'file',
        file,
      };

      if (isAudio || slot === 'audio') {
        onDropAudio?.(asset);
      } else if (isVideo && slot === 'video1') {
        onDropVideo1?.(asset);
      } else if (isVideo && slot === 'video2') {
        onDropVideo2?.(asset);
      }
    }
  };

  return (
    <div
      onDragOver={handleCardDragOver}
      onDragLeave={handleCardDragLeave}
      onDrop={handleCardDrop}
      className={`${isDualVideo ? "w-[300px]" : "w-[175px]"} bg-[#181924] border rounded-2xl p-2.5 select-none transition-all flex flex-col gap-2 relative z-10 pointer-events-auto ${
        isSelected || isCaptionTarget
          ? 'border-[#7831d6] ring-1 ring-[#7831d6]/60 shadow-[0_0_14px_rgba(120,49,214,0.4)]'
          : 'border-white/15 hover:border-white/30 shadow-[0_16px_48px_rgba(0,0,0,0.65)]'
      }`}
    >
      {/* Full-Card Audio Drop Overlay */}
      {dragOverSlot === 'card-audio' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#7831d6]/25 backdrop-blur-[2px] rounded-2xl border-2 border-dashed border-[#7831d6] pointer-events-none animate-pulse">
          <div className="flex items-center gap-2 bg-black/90 px-3 py-1.5 rounded-xl shadow-2xl border border-[#7831d6]/60">
            <Music className="h-3.5 w-3.5 text-purple-300 animate-bounce" />
            <span className="text-[9px] font-extrabold uppercase text-white tracking-wider">
              Drop Audio #{rowIndex + 1}
            </span>
          </div>
        </div>
      )}
      
      {/* Node Header (Acts as Canvas Drag Handle) */}
      <div
        onPointerDown={handleNodePointerDown}
        onDoubleClick={onHeaderDoubleClick}
        className="flex items-center justify-between pb-2 border-b border-white/10 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 truncate mr-1.5 min-w-0">
          <Move className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">
            #{rowIndex + 1}
          </span>
          <span className={`text-[7.5px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEditTimeline?.();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-5 items-center gap-1 rounded-md border border-blue-500/25 bg-blue-500/10 px-1.5 text-[8px] font-bold uppercase text-blue-300 transition hover:bg-blue-500/20 hover:text-blue-200"
            title="Open this row in Timeline Editor"
          >
            <Pencil className="h-2.5 w-2.5" />
            Edit
          </button>


          <div
            onDragOver={(e) => handleSlotDragOver(e, 'audio')}
            onDragLeave={(e) => handleSlotDragLeave(e, 'audio')}
            onDrop={(e) => handleSlotDrop(e, 'audio')}
            className={`relative group/tooltip rounded-md transition-all ${
              dragOverSlot === 'audio' ? 'ring-2 ring-[#ff5500] scale-105' : ''
            }`}
          >
            <button
              type="button"
              onClick={onPickAudio}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 bg-[#121214] border hover:bg-[#1a1a1e] px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase truncate max-w-[80px] transition-all ${
                audio
                  ? 'border-[#ff5500]/30 text-[#ff5500]'
                  : 'border-[#2d2d30] text-gray-500'
              }`}
            >
              <Music className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {audio ? audio.name : 'Music'}
              </span>
            </button>
            {audio && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-[#18181b] border border-[#2d2d30] text-white text-[9px] px-2.5 py-1.5 rounded-lg shadow-2xl z-30 max-w-[180px] break-words text-center leading-normal">
                {audio.name}
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={onRemove}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-5 w-5 items-center justify-center rounded-md text-gray-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
            title="Remove frame"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {row.editorProjectStale && (
        <div
          className="-mt-1 flex items-center justify-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider text-amber-300"
          role="status"
          title="This row changed after its timeline project was saved. Open the Timeline Editor to review and sync it."
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Timeline out of sync
        </div>
      )}

      {/* Video Cards Grid */}
      <div className={isDualVideo ? "grid grid-cols-2 gap-2" : "flex flex-col"}>
        
        {/* Video 1 Preview Card */}
        <div
          onDragOver={(e) => handleSlotDragOver(e, 'video1')}
          onDragLeave={(e) => handleSlotDragLeave(e, 'video1')}
          onDrop={(e) => handleSlotDrop(e, 'video1')}
          className={`relative transition-all w-full ${
            dragOverSlot === 'video1'
              ? 'ring-2 ring-[#ff5500] ring-offset-2 ring-offset-[#1c1c1e] scale-[1.02] rounded-xl z-20 shadow-[0_0_15px_rgba(255,85,0,0.5)]'
              : ''
          }`}
        >
          {dragOverSlot === 'video1' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#ff5500]/20 backdrop-blur-[2px] rounded-xl border-2 border-dashed border-[#ff5500] pointer-events-none animate-pulse">
              <span className="text-[10px] font-extrabold uppercase text-white bg-black/80 px-2 py-1 rounded-md shadow-lg border border-[#ff5500]/50">
                Drop Video 1
              </span>
            </div>
          )}
          {resolvedVideo1Url ? (
            <>
              <div
                ref={video1TileRef}
                role="button"
                tabIndex={0}
                onClick={(event) => handleTogglePreviewPlayback(event, 'video1')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    handleTogglePreviewPlayback(event, 'video1');
                  }
                }}
                className="group relative flex w-full aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#0f1016] transition-all hover:bg-[#14161f]"
              >
                <LoadingVideoPreview
                  ref={video1PreviewRef}
                  src={resolvedVideo1Url}
                  className="absolute inset-0"
                  videoClassName="h-full w-full object-cover rounded-xl"
                  muted
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  onPause={() => handlePreviewStopped('video1')}
                  onEnded={() => handlePreviewStopped('video1')}
                />
              </div>
              {/* Change Video Button Overlay */}
              <div className="absolute top-2 left-2 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickVideo1();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 border border-white/15 text-gray-300 hover:text-white hover:bg-black/90 transition-all shadow-md"
                  title="Change Video 1"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Text Overlay Button on Top Right */}
              <div className="absolute top-2 right-2 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCaptionDrawer();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex h-6 w-6 items-center justify-center rounded-full bg-black/70 border transition-all shadow-md ${
                    caption
                      ? 'border-[#ff5500]/70 text-[#ff5500] bg-black/90'
                      : 'border-white/15 text-gray-300 hover:text-white hover:bg-black/90'
                  }`}
                  title={caption ? 'Edit Text Overlay' : 'Add Text Overlay'}
                >
                  <Type className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onPickVideo1}
              ref={video1TileRef}
              className="relative w-full aspect-[9/16] rounded-xl border border-white/10 bg-[#0f1016] flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-all hover:bg-[#14161f] hover:border-white/20 group"
            >
              <>
                <Video className="h-5 w-5 text-gray-500 group-hover:text-[#ff5500]" />
                <span className="text-[9px] font-bold text-gray-400 uppercase">Video 1</span>
              </>
            </button>
          )}

          {isDraggingCaption && alignmentGuides.vertical && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-1/2 z-[5] -translate-x-1/2 bg-[#ff5500] shadow-[0_0_4px_rgba(255,85,0,0.7)]"
              style={{ width: `${Math.max(0.01, Number(inverseZoomScale) || 1)}px` }}
            />
          )}
          {isDraggingCaption && alignmentGuides.horizontal && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[5] -translate-y-1/2 bg-[#ff5500] shadow-[0_0_4px_rgba(255,85,0,0.7)]"
              style={{ height: `${Math.max(0.01, Number(inverseZoomScale) || 1)}px` }}
            />
          )}

          {/* Styled Captions overlay */}
          {caption && resolvedVideo1Url && (
            <div
              ref={captionLayerRef}
              data-caption-overlay="true"
              className={`absolute z-10 flex max-w-full items-center justify-center whitespace-pre-wrap text-center [overflow-wrap:anywhere] ${
                isEditingCaption
                  ? 'outline outline-2 outline-[#ff5500]'
                  : isActiveCaption || isDraggingCaption
                    ? 'outline outline-1 outline-dashed outline-white/80'
                    : ''
              }`}
              onMouseDown={(e) => {
                if (!isEditingCaption && e.detail > 1) {
                  e.preventDefault();
                }
              }}
              onPointerDown={(e) => {
                if (!isEditingCaption) handleCaptionPointerDown(e);
              }}
              onPointerMove={(e) => {
                if (!isEditingCaption) handleCaptionPointerMove(e);
              }}
              onPointerUp={(e) => {
                if (!isEditingCaption) handleCaptionPointerUp(e);
              }}
              onPointerCancel={(e) => {
                if (!isEditingCaption) handleCaptionPointerUp(e);
              }}
              onDoubleClick={handleCaptionDoubleClick}
              style={{
                left: `${visibleTransform.x * video1TileSize.width}px`,
                top: `${visibleTransform.y * video1TileSize.height}px`,
                width: visibleBoxWidth > 0 ? visibleBoxWidth * video1TileSize.width : undefined,
                minHeight: visibleBoxHeight > 0
                  ? visibleBoxHeight * video1TileSize.height
                  : undefined,
                boxSizing: 'border-box',
                padding: `${previewPaddingY}px ${previewPaddingX}px`,
                maxWidth: visibleBoxWidth > 0 ? video1TileSize.width : undefined,
                transform: `translate(-50%, -50%) rotate(${visibleTransform.rotation}deg) scale(${visibleTransform.scale})`,
                transformOrigin: 'center',
                opacity: visibleTransform.opacity,
                fontFamily: editorTextStyle.fontFamily || 'Outfit, sans-serif',
                fontSize: `${previewFontSize}px`,
                fontWeight: editorTextStyle.fontWeight || 600,
                lineHeight: Number(editorTextStyle.lineHeight || 1.2),
                letterSpacing: Number(editorTextStyle.letterSpacing || 0) * editorPreviewScale,
                color: editorTextStyle.color || '#ffffff',
                textAlign: editorTextStyle.textAlign || 'center',
                WebkitTextStrokeWidth: `${previewStrokeWidth}px`,
                WebkitTextStrokeColor: editorTextStyle.strokeColor || '#000000',
                WebkitTextFillColor: editorTextStyle.color || '#ffffff',
                paintOrder: 'stroke fill',
                textRendering: 'geometricPrecision',
                backgroundColor: hasTextBackground
                  ? (editorTextStyle.backgroundColor || 'transparent')
                  : 'transparent',
                borderRadius: Number(
                  editorTextStyle.borderRadius ?? editorTextStyle.backgroundRadius ?? 12,
                ) * editorPreviewScale,
                textShadow: editorTextStyle.shadow ? '0 2px 8px rgba(0,0,0,.55)' : 'none',
                userSelect: isEditingCaption ? 'text' : 'none',
                outlineWidth: isEditingCaption
                  ? `${2 * resizeControlScale}px`
                  : isActiveCaption || isDraggingCaption
                    ? `${resizeControlScale}px`
                    : undefined,
                cursor: isEditingCaption ? 'text' : 'move',
                touchAction: isEditingCaption ? 'auto' : 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (didDragCaptionRef.current) {
                  didDragCaptionRef.current = false;
                  return;
                }
                onCaptionOverlayClick();
              }}
            >
              {isEditingCaption ? (
                <textarea
                  ref={captionTextRef}
                  value={caption}
                  onChange={(e) => handleCaptionChange(e.target.value)}
                  onBlur={() => setIsEditingCaption(false)}
                  onSelect={(e) => {
                    if (!suppressTextSelectionRef.current) return;
                    const textarea = e.currentTarget;
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    captionTextRef.current?.setSelectionRange(caption.length, caption.length);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setIsEditingCaption(false);
                      captionTextRef.current?.blur();
                    }
                  }}
                  rows={Math.max(captionLines.length, 1)}
                  cols={captionEditorColumns}
                  aria-label="Edit text on preview"
                  className="block min-h-[1.2em] min-w-[4ch] max-w-full cursor-text resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
                  style={{
                    fieldSizing: 'content',
                    width: visibleBoxWidth > 0 ? '100%' : undefined,
                    maxWidth: visibleBoxWidth > 0
                      ? '100%'
                      : video1TileSize.width,
                    font: 'inherit',
                    lineHeight: 'inherit',
                    color: 'inherit',
                    textAlign: 'inherit',
                    WebkitTextStrokeWidth: `${previewStrokeWidth}px`,
                    WebkitTextStrokeColor: editorTextStyle.strokeColor || '#000000',
                    WebkitTextFillColor: editorTextStyle.color || '#ffffff',
                    paintOrder: 'stroke fill',
                    caretColor: editorTextStyle.color || '#ffffff',
                  }}
                />
              ) : (
                <span
                  className="block whitespace-pre-wrap [overflow-wrap:anywhere]"
                  style={{ width: visibleBoxWidth > 0 ? '100%' : undefined }}
                >
                  {caption}
                </span>
              )}

              {isActiveCaption && TEXT_RESIZE_HANDLES.map((handle) => (
                <button
                  key={handle.mode}
                  type="button"
                  tabIndex={isEditingCaption ? -1 : 0}
                  aria-label={handle.label}
                  title={handle.label}
                  onPointerDown={(event) => startCaptionResize(event, handle.mode)}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  className={`absolute z-[70] grid touch-none place-items-center bg-transparent outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-white ${handle.className}`}
                >
                  <span
                    className={`pointer-events-none border border-white bg-[#ff5500] shadow-[0_1px_5px_rgba(0,0,0,0.65)] ${handle.indicatorClassName}`}
                    style={{ transform: `scale(${resizeControlScale})` }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Floating controls */}
          {isActiveCaption && caption && resolvedVideo1Url && (
            <FloatingTextControls
              inverseZoomScale={inverseZoomScale}
              textSettings={textSettings}
              onUpdate={handleUpdateTextSettings}
              onClose={onCloseCaptionControls}
            />
          )}


        </div>

        {/* Video 2 Preview Card */}
        {isDualVideo && (
          <div
            onDragOver={(e) => handleSlotDragOver(e, 'video2')}
            onDragLeave={(e) => handleSlotDragLeave(e, 'video2')}
            onDrop={(e) => handleSlotDrop(e, 'video2')}
            className={`relative transition-all ${
              dragOverSlot === 'video2'
                ? 'ring-2 ring-[#0071e3] ring-offset-2 ring-offset-[#1c1c1e] scale-[1.02] rounded-xl z-20 shadow-[0_0_15px_rgba(0,113,227,0.5)]'
                : ''
            }`}
          >
            {dragOverSlot === 'video2' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0071e3]/20 backdrop-blur-[2px] rounded-xl border-2 border-dashed border-[#0071e3] pointer-events-none animate-pulse">
                <span className="text-[10px] font-extrabold uppercase text-white bg-black/80 px-2 py-1 rounded-md shadow-lg border border-[#0071e3]/50">
                  Drop Video 2
                </span>
              </div>
            )}
            {resolvedVideo2Url ? (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(event) => handleTogglePreviewPlayback(event, 'video2')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      handleTogglePreviewPlayback(event, 'video2');
                    }
                  }}
                  className="group relative flex w-full aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#0f1016] transition-all hover:bg-[#14161f]"
                >
                  <LoadingVideoPreview
                    ref={video2PreviewRef}
                    src={resolvedVideo2Url}
                    className="absolute inset-0"
                    videoClassName="h-full w-full object-cover rounded-xl"
                    muted
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    onPause={() => handlePreviewStopped('video2')}
                    onEnded={() => handlePreviewStopped('video2')}
                  />
                </div>
                {/* Change Video Button Overlay */}
                <div className="absolute top-2 left-2 z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickVideo2();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 border border-white/15 text-gray-300 hover:text-white hover:bg-black/90 transition-all shadow-md"
                    title="Change Video 2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onPickVideo2}
                className="w-full aspect-[9/16] rounded-xl border border-white/10 bg-[#0f1016] flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-all hover:bg-[#14161f] hover:border-white/20 group"
              >
                <>
                  <Video className="h-5 w-5 text-gray-500 group-hover:text-[#ff5500]" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Video 2</span>
                </>
              </button>
            )}

          </div>
        )}

      </div>

      {/* Done / Library Tag */}
      {resultMediaUrl && (
        <div className="flex items-center justify-center pt-2 border-t border-[#2d2d30]">
          <div className="flex items-center gap-1 bg-green-950/30 text-green-400 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-green-800/40">
            Saved to Media Library
          </div>
        </div>
      )}

    </div>
  );
};
