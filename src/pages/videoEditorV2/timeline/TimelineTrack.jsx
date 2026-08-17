import { useState } from 'react';
import { Layers3, Music2, Plus } from 'lucide-react';
import {
  canDropEditorTypeOnTrack,
  clearActiveEditorDragItem,
  getActiveEditorDragItem,
  getEditorDragClipType,
  getEditorDragTransferType,
  readEditorDragData,
} from '../media/editorDragData';
import { TimelineClip } from './TimelineClip';
import {
  clamp,
  getTrackType,
  roundTime,
  snapTime,
} from './timelineUtils';

const getDragPreviewDuration = (clipType, item, availableDuration = Number.POSITIVE_INFINITY) => {
  const fallbackDuration = clipType === 'image' || clipType === 'text' ? 3 : 5;
  return Math.min(
    Math.max(0.1, Number(item?.asset?.duration) || fallbackDuration),
    Math.max(0.1, availableDuration),
  );
};

export const TimelineTrack = ({
  track,
  height,
  duration,
  pixelsPerSecond,
  fps,
  selectedClipId,
  minClipDuration,
  snapInterval,
  magneticSnapEnabled,
  magneticSnapTargets,
  magneticSnapThresholdPx,
  onLanePointerDown,
  onSelectClip,
  onMoveClip,
  onTrimClip,
  onDeleteClip,
  onRequestAudio,
  onDropItem,
  onSnapGuideChange,
}) => {
  const type = getTrackType(track);
  const hidden = Boolean(track.hidden);
  const clips = Array.isArray(track.clips) ? track.clips : [];
  const [dropPreview, setDropPreview] = useState(null);
  const trackBorderRadius = Math.min(20, Math.max(8, Number(height || 0) * 0.4));

  const getDropTime = (event, clipType, item) => {
    if (type === 'video') {
      const trackEnd = clips.reduce((latestEnd, clip) => Math.max(
        latestEnd,
        Number(clip.timelineStart || 0) + Number(clip.duration || 0),
      ), 0);
      return roundTime(clamp(trackEnd, 0, duration));
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorTime = (event.clientX - rect.left) / pixelsPerSecond;
    const previewDuration = getDragPreviewDuration(clipType, item, duration);
    const rawTime = cursorTime - (previewDuration / 2);
    return roundTime(clamp(
      snapTime(rawTime, snapInterval),
      0,
      Math.max(0, duration - previewDuration),
    ));
  };

  const handleDragOver = (event) => {
    const clipType = getEditorDragTransferType(event.dataTransfer);
    if (!canDropEditorTypeOnTrack(type, clipType) || hidden || track.locked) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const item = getActiveEditorDragItem();
    setDropPreview({
      clipType,
      item,
      timelineStart: getDropTime(event, clipType, item),
    });
  };

  const handleDragLeave = (event) => {
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
    setDropPreview(null);
  };

  const handleDrop = (event) => {
    const item = readEditorDragData(event.dataTransfer);
    const clipType = getEditorDragClipType(item);
    if (!item || !canDropEditorTypeOnTrack(type, clipType) || hidden || track.locked) {
      setDropPreview(null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const timelineStart = getDropTime(event, clipType, item);
    setDropPreview(null);
    clearActiveEditorDragItem();
    onDropItem?.({
      item,
      trackId: track.id,
      trackType: type,
      timelineStart,
    });
  };

  return (
    <div
      className="mx-2 mt-1 overflow-visible border border-white/[0.06] bg-[#1d1e22] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
      style={{
        height,
        minWidth: duration * pixelsPerSecond,
        width: duration * pixelsPerSecond,
        borderRadius: trackBorderRadius,
      }}
    >
      <div
        className={`relative h-full overflow-visible transition-shadow ${hidden ? 'bg-[#1b1b1e] opacity-45' : 'bg-[#202126]'} ${dropPreview ? 'shadow-[inset_0_0_0_2px_rgba(139,92,246,0.75)]' : ''}`}
        aria-label={track.name || `${type} track`}
        style={{
          width: duration * pixelsPerSecond,
          borderRadius: Math.max(0, trackBorderRadius - 1),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          onSelectClip?.({ trackId: track.id, clipId: null });
          onLanePointerDown?.(event);
        }}
      >
        {!clips.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center px-5 text-zinc-400">
            {type === 'overlay' && (
              <div className="flex items-center gap-3 text-[12px] font-bold">
                <Layers3 className="h-4 w-4" />
                <span>Add elements</span>
              </div>
            )}
            {type === 'video' && (
              <div className="flex items-center gap-4 text-[12px] font-semibold text-zinc-300">
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-white/[0.07] text-zinc-300">
                  <Plus className="h-6 w-6" />
                </span>
                <span>or drag and drop media</span>
              </div>
            )}
            {type === 'audio' && (
              <button
                type="button"
                className="pointer-events-auto flex items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] font-bold outline-none transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-orange-400"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestAudio?.();
                }}
              >
                <Music2 className="h-4 w-4" />
                <span>Add audio</span>
              </button>
            )}
          </div>
        )}

        {dropPreview && (() => {
          const asset = dropPreview.item?.asset || {};
          const previewDuration = getDragPreviewDuration(
            dropPreview.clipType,
            dropPreview.item,
            duration - dropPreview.timelineStart,
          );
          const thumbnailUrl = asset.thumbnailUrl
            || (dropPreview.clipType === 'image' ? asset.url : '');
          const previewColor = dropPreview.clipType === 'text'
            ? 'bg-[#0d7479]'
            : dropPreview.clipType === 'audio'
              ? 'bg-[#185f5a]'
              : dropPreview.clipType === 'image'
                ? 'bg-[#343a43]'
                : 'bg-[#0b0c0f]';
          return (
          <div
            className={`pointer-events-none absolute inset-y-0 z-30 overflow-hidden border-2 border-dashed border-[#a78bfa] opacity-85 shadow-[0_5px_16px_rgba(0,0,0,0.38)] ${previewColor}`}
            style={{
              left: dropPreview.timelineStart * pixelsPerSecond,
              width: Math.max(12, previewDuration * pixelsPerSecond),
              borderRadius: trackBorderRadius,
              ...(thumbnailUrl ? {
                backgroundImage: `url(${thumbnailUrl})`,
                backgroundPosition: 'center',
                backgroundRepeat: dropPreview.clipType === 'video' ? 'repeat-x' : 'no-repeat',
                backgroundSize: dropPreview.clipType === 'video' ? 'auto 100%' : 'cover',
              } : {}),
            }}
            aria-hidden="true"
          />
          );
        })()}

        {clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackId={track.id}
            trackType={type}
            pixelsPerSecond={pixelsPerSecond}
            height={Math.max(24, height)}
            fps={fps}
            timelineDuration={duration}
            selected={clip.id === selectedClipId}
            minDuration={minClipDuration}
            snapInterval={snapInterval}
            magneticSnapEnabled={magneticSnapEnabled}
            magneticSnapTargets={magneticSnapTargets}
            magneticSnapThresholdPx={magneticSnapThresholdPx}
            onSelectClip={onSelectClip}
            onMoveClip={onMoveClip}
            onTrimClip={onTrimClip}
            onDeleteClip={onDeleteClip}
            onSeekFromPointer={onLanePointerDown}
            onSnapGuideChange={onSnapGuideChange}
          />
        ))}
      </div>
    </div>
  );
};
