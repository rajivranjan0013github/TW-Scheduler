import { Video, Play, Pause } from 'lucide-react';
import { WEIGHT_MAP } from './videoEditorConstants';
import { hexToRgba, formatTime } from './videoEditorUtils';

/**
 * Center column — 9:16 preview container with dual videos,
 * play/pause control, time HUD, and draggable/editable text overlay.
 */
export const VideoPreview = ({
  video1Url,
  video2Url,
  // Refs
  containerRef,
  video1Ref,
  video2Ref,
  dragRef,
  overlayTextRef,
  // Video playback
  activeVideo,
  isPlaying,
  previewCurrentTime,
  previewTotalTime,
  selectedAudio,
  onTogglePlay,
  onVideo1Ended,
  onVideo2Ended,
  onLoadedMetadata,
  onDurationChange,
  onTimeUpdate,
  // Text overlay
  text,
  onTextChange,
  fontColor,
  fontWeight,
  fontSize,
  strokeWidth,
  strokeColor,
  bgType,
  bgColor,
  isEditingOverlay,
  isDragging,
  onSetEditingOverlay,
  clampedDragPos,
  overlayTextWidth,
  overlayTextHeight,
  previewFontFamily,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  if (!video1Url || !video2Url) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Placement Preview</h4>
        <div className="aspect-[9/16] h-[480px] max-w-[270px] mx-auto rounded-xl bg-gray-150 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Video className="w-7 h-7" />
          <span className="text-[11px]">Import Video 1 &amp; Video 2</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Placement Preview</h4>

      <div className="space-y-3">
        <div
          ref={containerRef}
          className="aspect-[9/16] h-[480px] max-w-[270px] mx-auto rounded-xl bg-black overflow-hidden relative select-none"
          style={{ overflow: 'hidden' }}
        >
          {/* Video 1 */}
          <video
            key={video1Url}
            ref={video1Ref}
            src={video1Url}
            onEnded={onVideo1Ended}
            onLoadedMetadata={(e) => onLoadedMetadata('input1', e)}
            onDurationChange={(e) => onDurationChange('input1', e)}
            onTimeUpdate={() => onTimeUpdate('input1')}
            muted={Boolean(selectedAudio)}
            className={`absolute inset-0 w-full h-full object-contain ${activeVideo === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />
          {/* Video 2 */}
          <video
            key={video2Url}
            ref={video2Ref}
            src={video2Url}
            onEnded={onVideo2Ended}
            onLoadedMetadata={(e) => onLoadedMetadata('input2', e)}
            onDurationChange={(e) => onDurationChange('input2', e)}
            onTimeUpdate={() => onTimeUpdate('input2')}
            muted={Boolean(selectedAudio)}
            className={`absolute inset-0 w-full h-full object-contain ${activeVideo === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Time HUD */}
          <div className="absolute left-3 top-3 z-20 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-sm">
            {formatTime(previewCurrentTime)} / {formatTime(previewTotalTime)}
          </div>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/75 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 translate-x-[1px]" />
            )}
          </button>

          {/* Draggable + Inline-Editable Text Overlay */}
          <div
            ref={dragRef}
            onPointerDown={(e) => { if (!isEditingOverlay) onPointerDown(e); }}
            onPointerMove={(e) => { if (!isEditingOverlay) onPointerMove(e); }}
            onPointerUp={(e) => { if (!isEditingOverlay) onPointerUp(e); }}
            onDoubleClick={() => {
              if (!isEditingOverlay) {
                onSetEditingOverlay(true);
                setTimeout(() => {
                  const ta = overlayTextRef.current;
                  if (ta) { ta.focus(); ta.selectionStart = ta.value.length; }
                }, 10);
              }
            }}
            style={{
              position: 'absolute',
              left: `${clampedDragPos.x}px`,
              top: `${clampedDragPos.y}px`,
              cursor: isEditingOverlay ? 'text' : 'move',
              touchAction: isEditingOverlay ? 'auto' : 'none',
              padding: bgType !== 'None' ? '4px 10px' : '0px',
              borderRadius: bgType === 'Snapchat' ? '6px' : bgType === 'White' ? '4px' : '0px',
              backgroundColor: bgType === 'White' ? bgColor : bgType === 'Snapchat' ? hexToRgba(bgColor, 0.6) : 'transparent',
              outline: isEditingOverlay
                ? '1.5px dashed rgba(255,255,255,0.55)'
                : isDragging
                  ? '1.5px dashed rgba(255,255,255,0.45)'
                  : 'none',
              opacity: activeVideo === 1 ? 1 : 0,
              pointerEvents: activeVideo === 1 ? 'auto' : 'none',
            }}
          >
            <textarea
              ref={overlayTextRef}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onBlur={() => onSetEditingOverlay(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') { onSetEditingOverlay(false); overlayTextRef.current?.blur(); } }}
              readOnly={!isEditingOverlay}
              rows={Math.max(text.split('\n').length, 1)}
               style={{
                display: 'block',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                overflow: 'hidden',
                color: fontColor,
                fontFamily: previewFontFamily,
                fontWeight: WEIGHT_MAP[fontWeight],
                fontSize: `${fontSize}px`,
                lineHeight: 1.3,
                textAlign: 'center',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: 0,
                margin: 0,
                width: `${overlayTextWidth}px`,
                height: `${overlayTextHeight - (bgType !== 'None' ? 8 : 0) + 2}px`,
                minWidth: '50px',
                boxSizing: 'border-box',
                WebkitTextStrokeWidth: strokeWidth > 0 ? `${strokeWidth}px` : '0px',
                WebkitTextStrokeColor: strokeColor,
                paintOrder: 'stroke fill',
                pointerEvents: isEditingOverlay ? 'auto' : 'none',
                userSelect: isEditingOverlay ? 'auto' : 'none',
                caretColor: isEditingOverlay ? '#ffffff' : 'transparent',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
