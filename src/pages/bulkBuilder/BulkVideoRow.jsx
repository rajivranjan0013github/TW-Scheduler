import { useEffect, useRef, useState } from 'react';
import { Video, Music, Type, X, Move } from 'lucide-react';
import {
  FONT_FAMILY_CSS,
  PREVIEW_FRAME_HEIGHT,
  PREVIEW_FRAME_WIDTH,
  WEIGHT_MAP,
} from '../videoEditor/videoEditorConstants';
import { getOverlayTextHeight, getOverlayTextWidth, hexToRgba } from '../videoEditor/videoEditorUtils';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';
import { DEFAULT_DRAG_POS } from './useBulkRows';
import { FloatingTextControls } from './FloatingTextControls';

const SOURCE_PREVIEW_WIDTH = PREVIEW_FRAME_WIDTH;
const SOURCE_PREVIEW_HEIGHT = PREVIEW_FRAME_HEIGHT;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

const proxiedMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

/**
 * Figma-style Canvas Node card — representing one bulk row.
 * Positioned absolutely on the workspace. Supports drag-positioning.
 */
export const BulkVideoRow = ({
  row,
  rowIndex,
  isActiveCaption,
  inverseZoomScale = 1,
  onPickVideo1,
  onPickVideo2,
  onPickAudio,
  onOpenCaptionDrawer,
  onCaptionOverlayClick,
  onUpdateCaption,
  onUpdateTextSettings,
  onUpdateDragPos,
  onCloseCaptionControls,
  onRemove,
  zoomScale = 1,
  onUpdateCanvasPos,
  onHeaderDoubleClick,
}) => {
  const { video1, video1Url, video2, video2Url, audio, caption, textSettings, status, resultMediaUrl } = row;
  const dragPos = { ...DEFAULT_DRAG_POS, ...(row.dragPos || {}) };
  const video1TileRef = useRef(null);
  const captionTextRef = useRef(null);
  const dragSessionRef = useRef(null);
  const didDragCaptionRef = useRef(false);
  const suppressTextSelectionRef = useRef(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const [video1TileSize, setVideo1TileSize] = useState({
    width: SOURCE_PREVIEW_WIDTH,
    height: SOURCE_PREVIEW_HEIGHT,
  });

  // Calculate layout sizes on mount/resize
  useEffect(() => {
    if (!video1TileRef.current) return undefined;

    const updateTileSize = () => {
      const tile = video1TileRef.current;
      if (!tile?.clientWidth || !tile?.clientHeight) return;
      setVideo1TileSize({ width: tile.clientWidth, height: tile.clientHeight });
    };

    updateTileSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateTileSize);
      return () => window.removeEventListener('resize', updateTileSize);
    }

    const resizeObserver = new ResizeObserver(updateTileSize);
    resizeObserver.observe(video1TileRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const previewScaleX = video1TileSize.width / SOURCE_PREVIEW_WIDTH;
  const previewScaleY = video1TileSize.height / SOURCE_PREVIEW_HEIGHT;
  const sourceMetrics = getSourceBoxMetrics(caption, textSettings);
  const sourceTextWidth = sourceMetrics.textWidth;
  const sourceTextHeight = sourceMetrics.textHeight;
  const sourceBoxWidth = sourceMetrics.boxWidth;
  const sourceBoxHeight = sourceMetrics.boxHeight;
  const maxSourceX = Math.max(0, SOURCE_PREVIEW_WIDTH - sourceBoxWidth);
  const maxSourceY = Math.max(0, SOURCE_PREVIEW_HEIGHT - sourceTextHeight);
  const clampedSourceX = clamp(dragPos.x, 0, maxSourceX);
  const clampedSourceY = clamp(dragPos.y, 0, maxSourceY);
  const captionLeft = clampedSourceX * previewScaleX;
  const captionTop = clampedSourceY * previewScaleY;
  
  const minCenterX = -Math.round((SOURCE_PREVIEW_WIDTH - sourceBoxWidth) / 2);
  const maxCenterX = Math.round((SOURCE_PREVIEW_WIDTH - sourceBoxWidth) / 2);
  const minCenterY = -Math.round((SOURCE_PREVIEW_HEIGHT - sourceBoxHeight) / 2);
  const maxCenterY = Math.round((SOURCE_PREVIEW_HEIGHT - sourceBoxHeight) / 2);
  const centerPlacement = {
    x: Math.round(clampedSourceX + sourceBoxWidth / 2 - SOURCE_PREVIEW_WIDTH / 2),
    y: Math.round(clampedSourceY + sourceBoxHeight / 2 - SOURCE_PREVIEW_HEIGHT / 2),
    minX: minCenterX,
    maxX: maxCenterX,
    minY: minCenterY,
    maxY: maxCenterY,
  };
  
  const previewTextWidth = Math.max(20, sourceTextWidth * previewScaleX);
  const previewTextHeight = Math.max(
    14,
    (sourceTextHeight - (textSettings.bgType !== 'None' ? 8 : 0)) * previewScaleY + 2
  );
  const previewFontSize = Math.max(7, textSettings.fontSize * previewScaleX);
  const previewStrokeWidth = textSettings.strokeWidth > 0
    ? Math.max(0.5, textSettings.strokeWidth * previewScaleX)
    : 0;

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

  const resolvedVideo1Url = video1?.sourceType === 'library' ? proxiedMediaUrl(video1.originalUrl || video1.url) : (video1Url || '');
  const resolvedVideo2Url = video2?.sourceType === 'library' ? proxiedMediaUrl(video2.originalUrl || video2.url) : (video2Url || '');

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

  const handleUpdateCenterPlacement = ({ x = centerPlacement.x, y = centerPlacement.y }) => {
    onUpdateDragPos?.({
      x: clamp(SOURCE_PREVIEW_WIDTH / 2 + x - sourceBoxWidth / 2, 0, maxSourceX),
      y: clamp(SOURCE_PREVIEW_HEIGHT / 2 + y - sourceBoxHeight / 2, 0, maxSourceY),
    });
  };

  const handleUpdateTextSettings = (partialSettings) => {
    const nextSettings = { ...textSettings, ...partialSettings };
    onUpdateTextSettings?.(
      partialSettings,
      getCenteredDragPosForBox(getSourceBoxMetrics(caption, nextSettings))
    );
  };

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
    event.preventDefault();
    event.stopPropagation();
    didDragCaptionRef.current = false;
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Math.max(0, Math.min(maxSourceX, dragPos.x)),
      startY: Math.max(0, Math.min(maxSourceY, dragPos.y)),
    };
    setIsDraggingCaption(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCaptionPointerMove = (event) => {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const deltaX = (event.clientX - dragSession.startClientX) / Math.max(previewScaleX, 0.01);
    const deltaY = (event.clientY - dragSession.startClientY) / Math.max(previewScaleY, 0.01);
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      didDragCaptionRef.current = true;
    }

    onUpdateDragPos?.({
      x: Math.max(0, Math.min(maxSourceX, dragSession.startX + deltaX)),
      y: Math.max(0, Math.min(maxSourceY, dragSession.startY + deltaY)),
    });
  };

  const handleCaptionPointerUp = (event) => {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    dragSessionRef.current = null;
    setIsDraggingCaption(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (err) {
      // Safe releases
    }
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

  return (
    <div className="w-[340px] bg-[#1c1c1e] border border-[#2d2d30] rounded-2xl p-4 shadow-xl select-none hover:border-[#3a3a3c] transition-all flex flex-col gap-3 relative z-10 pointer-events-auto">
      
      {/* Node Header (Acts as Canvas Drag Handle) */}
      <div
        onPointerDown={handleNodePointerDown}
        onDoubleClick={onHeaderDoubleClick}
        className="flex items-center justify-between pb-2 border-b border-[#2d2d30] cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 truncate mr-2">
          <Move className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">
            #{rowIndex + 1}
          </span>
          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative group/tooltip">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCaptionDrawer();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 bg-[#121214] border hover:bg-[#1a1a1e] px-2 py-0.5 rounded-md text-[8px] font-bold uppercase truncate max-w-[80px] transition-all ${
                caption
                  ? 'border-[#ff5500]/30 text-[#ff5500]'
                  : 'border-[#2d2d30] text-gray-500'
              }`}
            >
              <Type className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                Text
              </span>
            </button>
            {caption && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-[#18181b] border border-[#2d2d30] text-white text-[9px] px-2.5 py-1.5 rounded-lg shadow-2xl z-30 max-w-[180px] break-words text-center leading-normal">
                {caption}
              </div>
            )}
          </div>

          <div className="relative group/tooltip">
            <button
              type="button"
              onClick={onPickAudio}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 bg-[#121214] border hover:bg-[#1a1a1e] px-2 py-0.5 rounded-md text-[8px] font-bold uppercase truncate max-w-[100px] transition-all ${
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

      {/* Video Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        
        {/* Video 1 Preview Card */}
        <div className="relative">
          <button
            type="button"
            onClick={onPickVideo1}
            ref={video1TileRef}
            className="relative w-full aspect-[9/16] rounded-xl border border-[#2d2d30] bg-[#121214] flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-all hover:bg-[#1a1a1e] group"
          >
            {resolvedVideo1Url ? (
              <video
                src={resolvedVideo1Url}
                className="absolute inset-0 w-full h-full object-cover rounded-xl"
                muted
                preload="metadata"
                crossOrigin="anonymous"
              />
            ) : (
              <>
                <Video className="h-5 w-5 text-gray-600 group-hover:text-[#ff5500]" />
                <span className="text-[9px] font-bold text-gray-500 uppercase">Video 1</span>
              </>
            )}
          </button>

          {/* Styled Captions overlay */}
          {caption && resolvedVideo1Url && (
            <div
              data-caption-overlay="true"
              className="absolute z-10"
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
                left: `${captionLeft}px`,
                top: `${captionTop}px`,
                cursor: isEditingCaption ? 'text' : 'move',
                touchAction: isEditingCaption ? 'auto' : 'none',
                padding: textSettings.bgType !== 'None' ? `${Math.max(1, 3 * previewScaleY)}px ${Math.max(2, 6 * previewScaleX)}px` : '0px',
                borderRadius: textSettings.bgType === 'Snapchat' ? '4px' : textSettings.bgType === 'White' ? '3px' : '0',
                backgroundColor:
                  textSettings.bgType === 'White'
                    ? textSettings.bgColor
                    : textSettings.bgType === 'Snapchat'
                      ? hexToRgba(textSettings.bgColor, 0.6)
                      : 'transparent',
                outline: isEditingCaption
                  ? '1px dashed rgba(255,255,255,0.8)'
                  : isDraggingCaption
                    ? '1px dashed rgba(255,255,255,0.5)'
                    : isActiveCaption
                      ? '1px dashed rgba(255,255,255,0.6)'
                      : 'none',
                outlineOffset: '2px',
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
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  captionTextRef.current?.setSelectionRange(caption.length, caption.length);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsEditingCaption(false);
                    captionTextRef.current?.blur();
                  }
                }}
                readOnly={!isEditingCaption}
                rows={Math.max(caption.split('\n').length, 1)}
                className="block select-none bg-transparent p-0 m-0 resize-none overflow-hidden border-0 outline-none text-center leading-[1.3] break-words transition-all text-white"
                style={{
                  display: 'block',
                  fontFamily: FONT_FAMILY_CSS[textSettings.fontFamily] || FONT_FAMILY_CSS.Roboto,
                  fontWeight: WEIGHT_MAP[textSettings.fontWeight] || '400',
                  fontSize: `${previewFontSize}px`,
                  width: `${previewTextWidth}px`,
                  minWidth: '20px',
                  height: `${previewTextHeight}px`,
                  boxSizing: 'border-box',
                  color: textSettings.fontColor,
                  WebkitTextStrokeWidth: previewStrokeWidth > 0 ? `${previewStrokeWidth}px` : '0px',
                  WebkitTextStrokeColor: textSettings.strokeColor,
                  paintOrder: 'stroke fill',
                  whiteSpace: 'pre-wrap',
                  pointerEvents: isEditingCaption ? 'auto' : 'none',
                  userSelect: isEditingCaption ? 'auto' : 'none',
                  caretColor: isEditingCaption ? '#ffffff' : 'transparent',
                }}
              />
            </div>
          )}

          {/* Floating controls */}
          {isActiveCaption && caption && resolvedVideo1Url && (
            <FloatingTextControls
              inverseZoomScale={inverseZoomScale}
              textSettings={textSettings}
              dragPos={dragPos}
              placement={centerPlacement}
              onUpdatePlacement={handleUpdateCenterPlacement}
              onUpdate={handleUpdateTextSettings}
              onUpdateDragPos={onUpdateDragPos}
              onClose={onCloseCaptionControls}
            />
          )}

          {/* Bottom Title Label */}
          {video1 && (
            <p className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-[2px] rounded text-[8px] font-semibold text-gray-300 truncate px-1 py-0.5 text-center" title={video1.name}>
              {video1.name}
            </p>
          )}
        </div>

        {/* Video 2 Preview Card */}
        <div className="relative">
          <button
            type="button"
            onClick={onPickVideo2}
            className="w-full aspect-[9/16] rounded-xl border border-[#2d2d30] bg-[#121214] flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-all hover:bg-[#1a1a1e] group"
          >
            {resolvedVideo2Url ? (
              <video
                src={resolvedVideo2Url}
                className="absolute inset-0 w-full h-full object-cover rounded-xl"
                muted
                preload="metadata"
                crossOrigin="anonymous"
              />
            ) : (
              <>
                <Video className="h-5 w-5 text-gray-600 group-hover:text-[#ff5500]" />
                <span className="text-[9px] font-bold text-gray-500 uppercase">Video 2</span>
              </>
            )}
          </button>
          {video2 && (
            <p className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-[2px] rounded text-[8px] font-semibold text-gray-300 truncate px-1 py-0.5 text-center" title={video2.name}>
              {video2.name}
            </p>
          )}
        </div>

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
