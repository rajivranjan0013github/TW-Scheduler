import { useEffect, useRef, useState } from 'react';
import { Video, Music, Type, X } from 'lucide-react';
import { FONT_FAMILY_CSS, WEIGHT_MAP } from '../videoEditor/videoEditorConstants';
import { getOverlayTextHeight, getOverlayTextWidth, hexToRgba } from '../videoEditor/videoEditorUtils';
import { FloatingTextControls } from './FloatingTextControls';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';
import { DEFAULT_DRAG_POS } from './useBulkRows';

const SOURCE_PREVIEW_WIDTH = 292;
const SOURCE_PREVIEW_HEIGHT = 520;

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
  // If already proxied or local blob, return as-is
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

/**
 * Single row in the Bulk Video Builder — renders 3 cards:
 * Video 1 (with caption overlay) | Video 2 | Audio
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
    draft: 'bg-gray-100 text-gray-500',
    ready: 'bg-blue-50 text-blue-600',
    processing: 'bg-amber-50 text-amber-600',
    saving: 'bg-purple-50 text-purple-600',
    done: 'bg-green-50 text-green-600',
    error: 'bg-red-50 text-red-600',
  };

  const statusLabels = {
    draft: 'Draft',
    ready: 'Ready',
    processing: 'Processing...',
    saving: 'Saving...',
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

  const handleUpdateTextSettings = (partialSettings) => {
    const nextSettings = { ...textSettings, ...partialSettings };
    onUpdateTextSettings?.(
      partialSettings,
      getCenteredDragPosForBox(getSourceBoxMetrics(caption, nextSettings))
    );
  };

  const handleUpdateCenterPlacement = ({ x = centerPlacement.x, y = centerPlacement.y }) => {
    onUpdateDragPos?.({
      x: clamp(SOURCE_PREVIEW_WIDTH / 2 + x - sourceBoxWidth / 2, 0, maxSourceX),
      y: clamp(SOURCE_PREVIEW_HEIGHT / 2 + y - sourceBoxHeight / 2, 0, maxSourceY),
    });
  };

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
    event.currentTarget.releasePointerCapture(event.pointerId);
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
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm transition-all hover:shadow-md">
      {/* Row header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Row {rowIndex + 1}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Remove row"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Video cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Video 1 Card */}
        <div className="relative">
          <button
            type="button"
            onClick={onPickVideo1}
            ref={video1TileRef}
            className="relative w-full aspect-[9/16] rounded-lg border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-all hover:border-gray-300 hover:bg-gray-100 group"
          >
            {resolvedVideo1Url ? (
              <video
                src={resolvedVideo1Url}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
                muted
                preload="metadata"
                crossOrigin="anonymous"
              />
            ) : (
              <>
                <Video className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                <span className="text-[9px] font-semibold text-gray-400 group-hover:text-gray-600">Video 1</span>
              </>
            )}
          </button>

          {/* Caption overlay on Video 1 */}
          {caption && resolvedVideo1Url && (
            <div
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
                  ? '1.5px dashed rgba(255,255,255,0.55)'
                  : isDraggingCaption
                    ? '1.5px dashed rgba(255,255,255,0.45)'
                    : isActiveCaption
                      ? '1.5px dashed rgba(255,255,255,0.45)'
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
                className="block select-none bg-transparent p-0 m-0 resize-none overflow-hidden border-0 outline-none text-center leading-[1.3] break-words transition-all"
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

          {/* Label */}
          {video1 && (
            <p className="mt-1 text-[8px] font-semibold text-gray-500 truncate px-1" title={video1.name}>
              {video1.name}
            </p>
          )}
        </div>

        {/* Video 2 Card */}
        <div>
          <button
            type="button"
            onClick={onPickVideo2}
            className="w-full aspect-[9/16] rounded-lg border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-all hover:border-gray-300 hover:bg-gray-100 relative group"
          >
            {resolvedVideo2Url ? (
              <video
                src={resolvedVideo2Url}
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
                muted
                preload="metadata"
                crossOrigin="anonymous"
              />
            ) : (
              <>
                <Video className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                <span className="text-[9px] font-semibold text-gray-400 group-hover:text-gray-600">Video 2</span>
              </>
            )}
          </button>
          {video2 && (
            <p className="mt-1 text-[8px] font-semibold text-gray-500 truncate px-1" title={video2.name}>
              {video2.name}
            </p>
          )}
        </div>

      </div>

      {/* Caption assign button */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCaptionDrawer}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-wider transition-all hover:bg-white hover:border-gray-300 hover:text-gray-900"
        >
          <Type className="h-2.5 w-2.5" />
          {caption ? 'Change Caption' : 'Assign Caption'}
        </button>
        {caption && (
          <span className="text-[9px] text-gray-500 truncate flex-1" title={caption}>
            "{caption}"
          </span>
        )}
        {resultMediaUrl && (
          <span className="ml-auto text-[9px] font-bold text-green-600 uppercase">
            Saved
          </span>
        )}
        <button
          type="button"
          onClick={onPickAudio}
          className={`ml-auto flex max-w-[180px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all ${
            audio
              ? 'border-orange-200 bg-orange-50 text-[#ff5500] hover:bg-orange-100'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-800'
          }`}
          title={audio ? audio.name : 'Select audio'}
        >
          <Music className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {audio ? audio.name : 'Audio'}
          </span>
        </button>
      </div>
    </div>
  );
};
