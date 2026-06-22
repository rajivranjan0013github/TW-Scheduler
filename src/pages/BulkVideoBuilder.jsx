import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Minus, Plus, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEXT_SETTINGS, useBulkRows } from './bulkBuilder/useBulkRows';
import { BulkVideoRow } from './bulkBuilder/BulkVideoRow';
import { CaptionDrawer } from './bulkBuilder/CaptionDrawer';
import { VideoLibraryPickerDialog } from './videoEditor/VideoLibraryPickerDialog';
import { AudioDialog } from './videoEditor/AudioDialog';
import { usePreviewAudio } from './videoEditor/usePreviewAudio';
import { BulkAssetPickerDialog } from './bulkBuilder/BulkAssetPickerDialog';
import { TempAssetQuickPickerDialog } from './bulkBuilder/TempAssetQuickPickerDialog';
import { getOverlayTextHeight, getOverlayTextWidth } from './videoEditor/videoEditorUtils';

const SOURCE_PREVIEW_WIDTH = 292;
const SOURCE_PREVIEW_HEIGHT = 520;
const PAGE_ZOOM_BASE_SCALE = 0.7;
const MIN_PAGE_ZOOM = 0.7;
const MAX_PAGE_ZOOM = 1.5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampPageZoom = (value) => clamp(Number(value.toFixed(2)), MIN_PAGE_ZOOM, MAX_PAGE_ZOOM);

const getCenteredDragPos = (text, settings = DEFAULT_TEXT_SETTINGS) => {
  const mergedSettings = { ...DEFAULT_TEXT_SETTINGS, ...settings };
  const textWidth = getOverlayTextWidth(
    text || ' ',
    mergedSettings.fontSize,
    mergedSettings.fontFamily,
    SOURCE_PREVIEW_WIDTH,
    mergedSettings.fontWeight
  );
  const textHeight = getOverlayTextHeight(
    text || ' ',
    mergedSettings.fontSize,
    mergedSettings.bgType,
    mergedSettings.fontFamily,
    SOURCE_PREVIEW_WIDTH,
    mergedSettings.fontWeight
  );
  const horizontalPadding = mergedSettings.bgType !== 'None' ? 20 : 0;
  const boxWidth = textWidth + horizontalPadding;
  const boxHeight = textHeight;

  return {
    x: clamp((SOURCE_PREVIEW_WIDTH - boxWidth) / 2, 0, Math.max(0, SOURCE_PREVIEW_WIDTH - boxWidth)),
    y: clamp((SOURCE_PREVIEW_HEIGHT - boxHeight) / 2, 0, Math.max(0, SOURCE_PREVIEW_HEIGHT - boxHeight)),
  };
};

export const BulkVideoBuilder = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const bulk = useBulkRows();
  const audio = usePreviewAudio();

  // Which row is being edited
  const [activePickerRowId, setActivePickerRowId] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null); // 'video1' | 'video2'
  const [showAudioPickerRowId, setShowAudioPickerRowId] = useState(null);
  const [captionDrawerRowId, setCaptionDrawerRowId] = useState(null);
  const [activeCaptionRowId, setActiveCaptionRowId] = useState(null);
  const [pageZoom, setPageZoom] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 0 });
  const zoomContentRef = useRef(null);

  // Lifted state for caption suggestions to share across rows
  const [generatedSuggestions, setGeneratedSuggestions] = useState([]);
  const [suggestionsVibe, setSuggestionsVibe] = useState('');

  // Bulk / Temporary Library States
  const [showBulkAssetPicker, setShowBulkAssetPicker] = useState(false);
  const [tempLibrary, setTempLibrary] = useState(() => {
    try {
      const saved = localStorage.getItem('tw_bulk_builder_temp_library');
      return saved ? JSON.parse(saved) : { video2: [], audio: [] };
    } catch {
      return { video2: [], audio: [] };
    }
  });
  const [quickPickerType, setQuickPickerType] = useState(null); // 'video' | 'audio'
  const [quickPickerRowId, setQuickPickerRowId] = useState(null);

  // Auto-save tempLibrary to localStorage
  useEffect(() => {
    localStorage.setItem('tw_bulk_builder_temp_library', JSON.stringify(tempLibrary));
  }, [tempLibrary]);

  // --- Video picker handlers ---
  const handlePickVideo1 = useCallback((rowId) => {
    setActivePickerRowId(rowId);
    setPickerSlot('video1');
  }, []);

  const handlePickVideo2 = useCallback((rowId) => {
    if (tempLibrary.video2 && tempLibrary.video2.length > 0) {
      setQuickPickerRowId(rowId);
      setQuickPickerType('video');
    } else {
      setActivePickerRowId(rowId);
      setPickerSlot('video2');
    }
  }, [tempLibrary.video2]);

  const handleSelectLibraryVideo = useCallback((selectedVideo) => {
    if (!activePickerRowId || !pickerSlot) return;
    const field = pickerSlot === 'video1'
      ? { video1: selectedVideo, video1Url: selectedVideo.url }
      : { video2: selectedVideo, video2Url: selectedVideo.url };
    bulk.updateRow(activePickerRowId, field);
    setActivePickerRowId(null);
    setPickerSlot(null);
  }, [activePickerRowId, pickerSlot, bulk]);

  // --- Audio picker handlers ---
  const handleOpenAudioPicker = useCallback((rowId) => {
    setShowAudioPickerRowId(rowId);
    audio.setAudioDialogTab('platform');
    if (audio.audioDialogTab === 'platform') {
      void audio.refreshPlatformAudioTracks();
    }
  }, [audio]);

  const handlePickAudio = useCallback((rowId) => {
    if (tempLibrary.audio && tempLibrary.audio.length > 0) {
      setQuickPickerRowId(rowId);
      setQuickPickerType('audio');
    } else {
      handleOpenAudioPicker(rowId);
    }
  }, [tempLibrary.audio, handleOpenAudioPicker]);

  const handleSelectAudioTrack = useCallback((track) => {
    if (!showAudioPickerRowId) return;
    bulk.updateRow(showAudioPickerRowId, { audio: track });
    setShowAudioPickerRowId(null);
  }, [showAudioPickerRowId, bulk]);

  const handleClearAudio = useCallback(() => {
    if (!showAudioPickerRowId) return;
    bulk.updateRow(showAudioPickerRowId, { audio: null });
    audio.clearSelectedAudio();
    setShowAudioPickerRowId(null);
  }, [showAudioPickerRowId, bulk, audio]);

  const handleAudioUpload = useCallback((e) => {
    if (e.target) e.target.value = '';
    alert('Uploaded audio is only supported in the single video editor. For bulk exports, choose platform audio or upload the track to the media library first.');
  }, []);

  // --- Quick Select Handlers ---
  const handleSelectQuickVideo = useCallback((selectedVideo) => {
    bulk.updateRow(quickPickerRowId, { video2: selectedVideo, video2Url: selectedVideo.url });
    setQuickPickerRowId(null);
    setQuickPickerType(null);
  }, [quickPickerRowId, bulk]);

  const handleSelectQuickAudio = useCallback((selectedAudio) => {
    bulk.updateRow(quickPickerRowId, { audio: selectedAudio });
    setQuickPickerRowId(null);
    setQuickPickerType(null);
  }, [quickPickerRowId, bulk]);

  const handleBrowseGlobalVideo = useCallback(() => {
    const rowId = quickPickerRowId;
    setQuickPickerRowId(null);
    setQuickPickerType(null);
    setActivePickerRowId(rowId);
    setPickerSlot('video2');
  }, [quickPickerRowId]);

  const handleBrowseGlobalAudio = useCallback(() => {
    const rowId = quickPickerRowId;
    setQuickPickerRowId(null);
    setQuickPickerType(null);
    handleOpenAudioPicker(rowId);
  }, [quickPickerRowId, handleOpenAudioPicker]);

  // --- Bulk Asset Picker Confirm Handler ---
  const handleConfirmBulkAssets = useCallback(({ video1List, video2List, musicList }) => {
    if (video1List.length > 0) {
      bulk.addRowsWithFirstVideos(video1List);
    }

    setTempLibrary((prev) => {
      const mergedVideo2 = [...prev.video2];
      video2List.forEach((item) => {
        if (!mergedVideo2.some((v) => v.id === item.id)) {
          mergedVideo2.push(item);
        }
      });

      const mergedAudio = [...prev.audio];
      musicList.forEach((item) => {
        if (!mergedAudio.some((a) => a.id === item.id)) {
          mergedAudio.push(item);
        }
      });

      return {
        video2: mergedVideo2,
        audio: mergedAudio,
      };
    });

    setShowBulkAssetPicker(false);
  }, [bulk]);

  const handleClearAll = useCallback(() => {
    bulk.clearAllRows();
    setTempLibrary({ video2: [], audio: [] });
  }, [bulk]);

  // --- Caption drawer handlers ---
  const handleApplyCaption = useCallback((text) => {
    if (!captionDrawerRowId) return;
    const row = bulk.rows.find((item) => item.id === captionDrawerRowId);
    bulk.updateRow(captionDrawerRowId, {
      caption: text,
      dragPos: getCenteredDragPos(text, row?.textSettings),
    });
    setCaptionDrawerRowId(null);
  }, [captionDrawerRowId, bulk]);

  // --- Export all ---
  const handleExportAll = useCallback(() => {
    const readyRows = bulk.getReadyRows();
    if (readyRows.length === 0) return;
    navigate('/media/editor?mode=bulk');
  }, [bulk, navigate]);

  const handleContentWheel = useCallback((event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = zoomContentRef.current?.getBoundingClientRect();
    const delta = event.deltaY < 0 ? 0.05 : -0.05;
    const oldScale = pageZoom * PAGE_ZOOM_BASE_SCALE;
    const nextZoom = clampPageZoom(pageZoom + delta);
    if (nextZoom === pageZoom) return;

    const nextScale = nextZoom * PAGE_ZOOM_BASE_SCALE;

    if (rect?.width && rect?.height) {
      const originX = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
      const originY = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
      const localX = (event.clientX - rect.left) / Math.max(oldScale, 0.01);
      const localY = (event.clientY - rect.top) / Math.max(oldScale, 0.01);
      const scaleDelta = nextScale - oldScale;
      setZoomOrigin({ x: originX, y: originY });

      window.requestAnimationFrame(() => {
        window.scrollBy({
          top: localY * scaleDelta,
          behavior: 'auto',
        });
      });
    }

    setPageZoom(nextZoom);
  }, [pageZoom]);

  const readyCount = bulk.getReadyRows().length;
  const totalRows = bulk.rows.length;
  const visualPageScale = pageZoom * PAGE_ZOOM_BASE_SCALE;

  return (
    <div
      className="min-h-screen bg-[#f8f9fa] p-4 flex flex-col items-center"
      onClick={() => setActiveCaptionRowId(null)}
    >
      {/* Header */}
      <div className="max-w-4xl w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-[#ff5500]" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Bulk Video Builder</h2>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {readyCount}/{totalRows} ready
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulkAssetPicker(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider transition-all hover:bg-gray-50 active:scale-95 shadow-sm"
          >
            <Plus className="h-3 w-3 text-[#ff5500]" />
            Add Videos
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
            Clear All
          </button>
          <button
            type="button"
            disabled={readyCount === 0}
            onClick={handleExportAll}
            className="flex items-center gap-1.5 rounded-lg bg-[#ff5500] px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-orange-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="h-3.5 w-3.5" />
            Export All ({readyCount})
          </button>
        </div>
      </div>

      {/* Rows */}
      <div
        className="w-full overflow-x-auto pb-24"
        onWheel={handleContentWheel}
      >
        <div
          ref={zoomContentRef}
          className="mx-auto max-w-4xl w-full origin-top space-y-3"
          style={{
            transform: `scale(${visualPageScale})`,
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          }}
        >
          {bulk.rows.map((row, idx) => (
            <BulkVideoRow
              key={row.id}
              row={row}
              rowIndex={idx}
              inverseZoomScale={1 / visualPageScale}
              isActiveCaption={activeCaptionRowId === row.id}
              onPickVideo1={() => handlePickVideo1(row.id)}
              onPickVideo2={() => handlePickVideo2(row.id)}
              onPickAudio={() => handlePickAudio(row.id)}
              onOpenCaptionDrawer={() => setCaptionDrawerRowId(row.id)}
              onCaptionOverlayClick={() =>
                setActiveCaptionRowId((prev) => (prev === row.id ? null : row.id))
              }
              onUpdateCaption={(caption, dragPos) => {
                const nextDragPos = dragPos || (!row.caption ? getCenteredDragPos(caption, row.textSettings) : null);
                bulk.updateRow(row.id, nextDragPos ? { caption, dragPos: nextDragPos } : { caption });
              }}
              onUpdateTextSettings={(partialSettings, dragPos) => {
                if (dragPos) {
                  bulk.updateRow(row.id, {
                    textSettings: { ...row.textSettings, ...partialSettings },
                    dragPos,
                  });
                  return;
                }
                bulk.updateRowTextSettings(row.id, partialSettings);
              }}
              onUpdateDragPos={(dragPos) =>
                bulk.updateRowDragPos(row.id, dragPos)
              }
              onCloseCaptionControls={() => setActiveCaptionRowId(null)}
              onRemove={() => bulk.removeRow(row.id)}
            />
          ))}

          {/* Add row button */}
          <button
            type="button"
            onClick={bulk.addRow}
            className="w-full rounded-xl border border-dashed border-gray-300 bg-white/60 py-3 flex items-center justify-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider transition-all hover:border-[#ff5500]/40 hover:bg-orange-50/30 hover:text-[#ff5500] active:scale-[0.99]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add New Row
          </button>
        </div>
      </div>

      <div
        className="fixed bottom-5 right-5 z-50 flex items-center rounded-xl border border-gray-200 bg-white/95 p-1 shadow-xl backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            setZoomOrigin({ x: 50, y: 0 });
            setPageZoom((zoom) => clampPageZoom(zoom - 0.1));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95"
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-12 text-center text-[11px] font-bold text-gray-600">
          {Math.round(pageZoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => {
            setZoomOrigin({ x: 50, y: 0 });
            setPageZoom((zoom) => clampPageZoom(zoom + 0.1));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95"
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoomOrigin({ x: 50, y: 0 });
            setPageZoom(1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95"
          title="Reset zoom"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Video Library Picker */}
      {activePickerRowId && pickerSlot && (
        <VideoLibraryPickerDialog
          slotLabel={pickerSlot === 'video1' ? 'First Video (Clip Starts)' : 'Second Video (Appended)'}
          token={token}
          onClose={() => {
            setActivePickerRowId(null);
            setPickerSlot(null);
          }}
          onSelectVideo={handleSelectLibraryVideo}
        />
      )}

      {/* Audio Picker */}
      {showAudioPickerRowId && (
        <AudioDialog
          audioDialogTab={audio.audioDialogTab}
          onTabChange={audio.setAudioDialogTab}
          selectedAudio={bulk.rows.find((r) => r.id === showAudioPickerRowId)?.audio || null}
          platformAudioTracks={audio.platformAudioTracks}
          platformAudioLoading={audio.platformAudioLoading}
          platformAudioError={audio.platformAudioError}
          myAudioTracks={audio.myAudioTracks}
          onSelectTrack={handleSelectAudioTrack}
          onUploadAudio={handleAudioUpload}
          onClearAudio={handleClearAudio}
          onClose={() => setShowAudioPickerRowId(null)}
        />
      )}

      {/* Caption Drawer */}
      {captionDrawerRowId && (
        <CaptionDrawer
          token={token}
          currentCaption={bulk.rows.find((r) => r.id === captionDrawerRowId)?.caption || ''}
          suggestions={generatedSuggestions}
          onSuggestionsChange={setGeneratedSuggestions}
          vibe={suggestionsVibe}
          onVibeChange={setSuggestionsVibe}
          onApply={handleApplyCaption}
          onClose={() => setCaptionDrawerRowId(null)}
        />
      )}

      {/* Bulk Asset Picker Dialog */}
      {showBulkAssetPicker && (
        <BulkAssetPickerDialog
          token={token}
          onClose={() => setShowBulkAssetPicker(false)}
          onConfirm={handleConfirmBulkAssets}
        />
      )}

      {/* Quick Asset Picker Dialog */}
      {quickPickerRowId && quickPickerType && (
        <TempAssetQuickPickerDialog
          type={quickPickerType}
          items={quickPickerType === 'video' ? tempLibrary.video2 : tempLibrary.audio}
          onSelect={quickPickerType === 'video' ? handleSelectQuickVideo : handleSelectQuickAudio}
          onBrowseGlobal={quickPickerType === 'video' ? handleBrowseGlobalVideo : handleBrowseGlobalAudio}
          onClose={() => {
            setQuickPickerRowId(null);
            setQuickPickerType(null);
          }}
        />
      )}
    </div>
  );
};

export default BulkVideoBuilder;
