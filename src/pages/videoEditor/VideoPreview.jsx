import { useState } from 'react';
import { Video, Play, Pause } from 'lucide-react';
import { WEIGHT_MAP } from './videoEditorConstants';
import { hexToRgba, formatTime } from './videoEditorUtils';

const IgIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Instagram Reels UI overlay — purely cosmetic, non-interactive.
 * Rendered on top of the preview to visualise text placement in context.
 */
const InstagramReelsOverlay = () => (
  <div
    className="absolute inset-0 z-30 flex flex-col justify-between"
    style={{ pointerEvents: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
  >
    {/* ── Spacer (pushes bottom content down) ── */}
    <div className="flex-1" />

    {/* ── Right Side Actions ── */}
    <div className="absolute right-2 flex flex-col items-center gap-3" style={{ bottom: '62px' }}>
      {/* Like */}
      <div className="flex flex-col items-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className="text-[7px] font-bold text-white mt-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>2.8M</span>
      </div>
      {/* Comment */}
      <div className="flex flex-col items-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-[7px] font-bold text-white mt-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>2.8M</span>
      </div>
      {/* Share */}
      <div className="flex flex-col items-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <span className="text-[7px] font-bold text-white mt-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>2.8M</span>
      </div>
      {/* More */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    </div>

    {/* ── Bottom Section ── */}
    <div className="px-2.5 pb-2">
      {/* Username */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <span className="text-[9px] font-bold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>@Your name</span>
      </div>
      {/* Description */}
      <p className="text-[8px] text-white/90 leading-relaxed mb-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        Here are some descriptions about videos
      </p>
      {/* Music */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-white/25 flex items-center justify-center">
            <svg width="6" height="6" viewBox="0 0 24 24" fill="white">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="text-[7px] text-white/80" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Music name</span>
        </div>
        {/* Instagram logo */}
        <div className="w-4 h-4 rounded bg-white/20 flex items-center justify-center">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none" />
          </svg>
        </div>
      </div>
    </div>
  </div>
);

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
  const [showIgOverlay, setShowIgOverlay] = useState(false);

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
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Placement Preview</h4>
        {/* Instagram Overlay Toggle */}
        <button
          type="button"
          onClick={() => setShowIgOverlay((prev) => !prev)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
            showIgOverlay
              ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white shadow-sm'
              : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
          title={showIgOverlay ? 'Hide Instagram overlay' : 'Show Instagram overlay'}
        >
          <IgIcon className="h-3 w-3" />
          {showIgOverlay ? 'IG On' : 'IG Off'}
        </button>
      </div>

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
            preload="auto"
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
            preload="auto"
            onEnded={onVideo2Ended}
            onLoadedMetadata={(e) => onLoadedMetadata('input2', e)}
            onDurationChange={(e) => onDurationChange('input2', e)}
            onTimeUpdate={() => onTimeUpdate('input2')}
            muted={Boolean(selectedAudio)}
            className={`absolute inset-0 w-full h-full object-contain ${activeVideo === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Instagram Reels UI Overlay */}
          {showIgOverlay && <InstagramReelsOverlay />}

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
              zIndex: 31,
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
