import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Minus, Plus, Play, RotateCcw, Trash2, Folder, Sliders, Layout, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEXT_SETTINGS, useBulkRows } from './bulkBuilder/useBulkRows';
import { BulkVideoRow } from './bulkBuilder/BulkVideoRow';
import { CaptionDrawer } from './bulkBuilder/CaptionDrawer';
import { MediaLibraryPanel } from './videoEditorV2/components/MediaLibraryPanel';
import { AudioDialog } from './videoEditor/AudioDialog';
import { usePreviewAudio } from './videoEditor/usePreviewAudio';
import { getOverlayTextHeight, getOverlayTextWidth } from './videoEditor/videoEditorUtils';
import { PREVIEW_FRAME_HEIGHT, PREVIEW_FRAME_WIDTH } from './videoEditor/videoEditorConstants';

const SOURCE_PREVIEW_WIDTH = PREVIEW_FRAME_WIDTH;
const SOURCE_PREVIEW_HEIGHT = PREVIEW_FRAME_HEIGHT;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

  // Canvas Pan & Zoom states
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [pageZoom, setPageZoom] = useState(0.8);
  const canvasViewportRef = useRef(null);
  const didInitialFitRef = useRef(false);

  // Sidebar visibility state (collapsible)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('tw_bulk_builder_sidebar_open');
      return saved !== 'false'; // Default to true
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('tw_bulk_builder_sidebar_open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  const [sidebarTab, setSidebarTab] = useState('frames'); // 'frames' | 'media'

  // Keyboard navigation & drag statuses
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Selected row/node state for Right Inspector
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [activeCaptionRowId, setActiveCaptionRowId] = useState(null);

  // Dialog & pickers state
  const [activePickerRowId, setActivePickerRowId] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null); // 'video1' | 'video2'
  const [showAudioPickerRowId, setShowAudioPickerRowId] = useState(null);
  const [captionDrawerRowId, setCaptionDrawerRowId] = useState(null);

  // AI captions suggestion state
  const [generatedSuggestions, setGeneratedSuggestions] = useState([]);
  const [suggestionsVibe, setSuggestionsVibe] = useState('');

  // Handle clicking outside caption text and controls to close controls
  useEffect(() => {
    if (activeCaptionRowId === null) return;

    const handleDocumentClick = (event) => {
      const target = event.target;
      const isCaptionClick = target.closest('[data-caption-overlay="true"]');
      const isControlsClick = target.closest('[data-text-controls="true"]');

      if (!isCaptionClick && !isControlsClick) {
        setActiveCaptionRowId(null);
      }
    };

    document.addEventListener('pointerdown', handleDocumentClick);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick);
    };
  }, [activeCaptionRowId]);

  // Track Spacebar press for canvas pan
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && document.activeElement === document.body) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle pointer panning on canvas background
  const handleCanvasPointerDown = (event) => {
    // Only drag on canvas background, middle mouse, or space drag
    const onBg = event.target === canvasViewportRef.current || event.target.id === 'canvas-grid';
    if (onBg || isSpacePressed || event.button === 1) {
      event.preventDefault();
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      panStartRef.current = { ...pan };
      canvasViewportRef.current.setPointerCapture(event.pointerId);
    }
  };

  const handleCanvasPointerMove = (event) => {
    if (!isDraggingCanvas) return;
    event.preventDefault();
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleCanvasPointerUp = (event) => {
    if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
      try {
        canvasViewportRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // Safe releases
      }
    }
  };

  // Track pageZoom and pan in ref to keep global non-passive event handler fast and up to date
  const zoomStateRef = useRef({ pageZoom, pan });
  useEffect(() => {
    zoomStateRef.current = { pageZoom, pan };
  }, [pageZoom, pan]);

  // Zoom centered on mouse viewport coordinates using global non-passive wheel events
  useEffect(() => {
    const handleGlobalWheel = (event) => {
      const { pageZoom: currentZoom, pan: currentPan } = zoomStateRef.current;
      const target = event.target;
      const scrollable = target.closest('.overflow-y-auto') || target.closest('.overflow-x-auto');
      const isInsideScrollable = scrollable && !scrollable.contains(canvasViewportRef.current);

      if (event.ctrlKey || event.metaKey) {
        // Prevent default native page zoom scaling
        event.preventDefault();

        const rect = canvasViewportRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const canvasX = (mouseX - currentPan.x) / currentZoom;
        const canvasY = (mouseY - currentPan.y) / currentZoom;

        const zoomFactor = 1.08;
        const nextZoom = event.deltaY < 0
          ? Math.min(currentZoom * zoomFactor, 3.0)
          : Math.max(currentZoom / zoomFactor, 0.15);

        const nextPan = {
          x: mouseX - canvasX * nextZoom,
          y: mouseY - canvasY * nextZoom,
        };

        setPageZoom(nextZoom);
        setPan(nextPan);
      } else {
        // Let scrollable panels (like Layers Sidebar list) scroll normally
        if (isInsideScrollable) {
          return;
        }

        // Otherwise, pan the canvas viewport
        event.preventDefault();
        setPan((prev) => ({
          x: prev.x - event.deltaX,
          y: prev.y - event.deltaY,
        }));
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // Center canvas view on specific node
  const centerOnRow = useCallback((row) => {
    setSelectedRowId(row.id);
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Node is w-[340px] h-[340px] approximately. Center coordinates are offset.
    const targetPanX = rect.width / 2 - (row.canvasPos.x + 170) * pageZoom;
    const targetPanY = rect.height / 2 - (row.canvasPos.y + 170) * pageZoom;
    setPan({ x: targetPanX, y: targetPanY });
  }, [pageZoom]);

  // Center and zoom in to 150% on double clicking card header
  const focusAndZoomOnRow = useCallback((row) => {
    setSelectedRowId(row.id);
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Card dimensions: width = 340, height = 400 (adjusted for video grid + padding)
    const cardWidth = 340;
    const cardHeight = 400;

    // Fixed zoom level of 150%
    const nextZoom = 1.5;

    // Pan coordinates to center the card on screen at this calculated zoom level
    const targetPanX = rect.width / 2 - (row.canvasPos.x + cardWidth / 2) * nextZoom;
    const targetPanY = rect.height / 2 - (row.canvasPos.y + cardHeight / 2) * nextZoom;

    setPageZoom(nextZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, []);

  // Fit all nodes inside viewport bounds
  const fitView = useCallback(() => {
    if (bulk.rows.length === 0) return;

    // Calculate bounding rect of all nodes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    bulk.rows.forEach(r => {
      const pos = r.canvasPos || { x: 100, y: 100 };
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + 340 > maxX) maxX = pos.x + 340;
      if (pos.y + 340 > maxY) maxY = pos.y + 340;
    });

    const rect = canvasViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;

    const zoomX = rect.width / contentW;
    const zoomY = rect.height / contentH;
    const nextZoom = clamp(Math.min(zoomX, zoomY), 0.2, 1.2);

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    setPageZoom(nextZoom);
    setPan({
      x: rect.width / 2 - centerX * nextZoom,
      y: rect.height / 2 - centerY * nextZoom,
    });
  }, [bulk.rows]);

  // Align all frames in a grid with up to 6 columns
  const alignAllCards = useCallback(() => {
    bulk.rows.forEach((row, index) => {
      const r = Math.floor(index / 6);
      const c = index % 6;
      bulk.updateRow(row.id, {
        canvasPos: {
          x: 50 + c * 370,
          y: 80 + r * 450
        }
      });
    });
    setTimeout(fitView, 100);
  }, [bulk, fitView]);

  // Video picker callbacks (Directly opens MediaLibraryPanel in sidebar)
  const handlePickVideo1 = useCallback((rowId) => {
    setActivePickerRowId(rowId);
    setPickerSlot('video1');
    setIsSidebarOpen(true);
    setSidebarTab('media');
  }, []);

  const handlePickVideo2 = useCallback((rowId) => {
    setActivePickerRowId(rowId);
    setPickerSlot('video2');
    setIsSidebarOpen(true);
    setSidebarTab('media');
  }, []);

  const handleSelectLibraryVideo = useCallback((selectedVideo) => {
    const targetRowId = activePickerRowId || selectedRowId;
    const targetSlot = pickerSlot || 'video1';
    if (!targetRowId) {
      if (bulk.rows.length > 0) {
        bulk.updateRow(bulk.rows[0].id, {
          video1: selectedVideo,
          video1Url: selectedVideo.url || selectedVideo.originalUrl,
        });
      }
      return;
    }
    const field = targetSlot === 'video1'
      ? { video1: selectedVideo, video1Url: selectedVideo.url || selectedVideo.originalUrl }
      : { video2: selectedVideo, video2Url: selectedVideo.url || selectedVideo.originalUrl };
    bulk.updateRow(targetRowId, field);
    setActivePickerRowId(null);
    setPickerSlot(null);
  }, [activePickerRowId, pickerSlot, selectedRowId, bulk]);

  // Drop handlers for Drag & Drop onto canvas card slots
  const handleDropVideo1 = useCallback((rowId, asset) => {
    bulk.updateRow(rowId, {
      video1: asset,
      video1Url: asset.url || asset.originalUrl,
    });
  }, [bulk]);

  const handleDropVideo2 = useCallback((rowId, asset) => {
    bulk.updateRow(rowId, {
      video2: asset,
      video2Url: asset.url || asset.originalUrl,
    });
  }, [bulk]);

  const handleDropAudio = useCallback((rowId, asset) => {
    bulk.updateRow(rowId, {
      audio: asset,
    });
  }, [bulk]);

  // Audio picker callbacks
  const handleOpenAudioPicker = useCallback((rowId) => {
    setShowAudioPickerRowId(rowId);
    audio.setAudioDialogTab('platform');
    if (audio.audioDialogTab === 'platform') {
      void audio.refreshPlatformAudioTracks();
    }
  }, [audio]);

  const handlePickAudio = useCallback((rowId) => {
    handleOpenAudioPicker(rowId);
  }, [handleOpenAudioPicker]);

  const handleSelectAudioTrack = useCallback((track) => {
    const rowId = showAudioPickerRowId || selectedRowId;
    if (!rowId) return;
    bulk.updateRow(rowId, { audio: track });
    setShowAudioPickerRowId(null);
  }, [showAudioPickerRowId, selectedRowId, bulk]);

  const handleClearAudio = useCallback(() => {
    const rowId = showAudioPickerRowId || selectedRowId;
    if (!rowId) return;
    bulk.updateRow(rowId, { audio: null });
    audio.clearSelectedAudio();
    setShowAudioPickerRowId(null);
  }, [showAudioPickerRowId, selectedRowId, bulk, audio]);

  const handleAudioUpload = useCallback((e) => {
    if (e.target) e.target.value = '';
    alert('Uploaded audio is only supported in the single video editor. For bulk exports, choose platform audio or upload the track to the media library first.');
  }, []);

  const handleClearAll = useCallback(() => {
    const populatedRows = bulk.rows.filter((row) => row.video1 || row.video2 || row.audio || row.caption).length;
    if (populatedRows > 0 && !window.confirm(`Clear all ${populatedRows} planned frame${populatedRows === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }
    bulk.clearAllRows();
    setSelectedRowId(null);
  }, [bulk]);

  // Caption apply callback
  const handleApplyCaption = useCallback((text) => {
    const rowId = captionDrawerRowId || selectedRowId;
    if (!rowId) return;
    const row = bulk.rows.find((item) => item.id === rowId);
    bulk.updateRow(rowId, {
      caption: text,
      dragPos: getCenteredDragPos(text, row?.textSettings),
    });
  }, [captionDrawerRowId, selectedRowId, bulk]);

  const handleExportAll = useCallback(() => {
    const readyRows = bulk.getReadyRows();
    if (readyRows.length === 0) return;
    navigate(`/media/editor?mode=bulk&rowId=${encodeURIComponent(readyRows[0].id)}&panel=bulk`);
  }, [bulk, navigate]);

  // Auto center view on mount if nodes exist
  useEffect(() => {
    if (didInitialFitRef.current || bulk.rows.length === 0) return undefined;
    const timeoutId = window.setTimeout(() => {
      didInitialFitRef.current = true;
      fitView();
    }, 150);
    return () => window.clearTimeout(timeoutId);
  }, [bulk.rows.length, fitView]);

  // Compute references for right inspector panel values
  const selectedRow = bulk.rows.find(r => r.id === selectedRowId);
  const readyCount = bulk.getReadyRows().length;

  return (
    <div className="h-full w-full relative bg-[#0e0e10] text-[#e0e0e5] overflow-hidden select-none font-sans">
      {bulk.persistenceError && (
        <div className="absolute left-1/2 top-20 z-50 w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-xl border border-red-800/60 bg-red-950/95 px-4 py-3 text-xs font-semibold text-red-200 shadow-2xl">
          {bulk.persistenceError}
        </div>
      )}

      {/* Figma 2D Infinite Canvas Viewport */}
      <div
        ref={canvasViewportRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onClick={() => setSelectedRowId(null)}
        className={`absolute inset-0 z-0 overflow-hidden bg-[#0d0d0e] outline-none select-none transition-colors duration-150 ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          }`}
        style={{
          backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        id="canvas-grid"
      >
        {/* Movable 2D Stage */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${pageZoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="relative pointer-events-auto">
            {bulk.rows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-xl"
                style={{
                  position: 'absolute',
                  left: `${row.canvasPos?.x || 100}px`,
                  top: `${row.canvasPos?.y || 80}px`,
                  zIndex: selectedRowId === row.id || activeCaptionRowId === row.id ? 20 : 10,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRowId(row.id);
                  if (captionDrawerRowId !== null) {
                    setCaptionDrawerRowId(row.id);
                  }
                }}
              >
                <BulkVideoRow
                  row={row}
                  rowIndex={idx}
                  isDualVideo={bulk.isDualVideo}
                  inverseZoomScale={1 / pageZoom}
                  isActiveCaption={activeCaptionRowId === row.id}
                  isCaptionTarget={captionDrawerRowId === row.id}
                  onPickVideo1={() => handlePickVideo1(row.id)}
                  onPickVideo2={() => handlePickVideo2(row.id)}
                  onPickAudio={() => handlePickAudio(row.id)}
                  onDropVideo1={(asset) => handleDropVideo1(row.id, asset)}
                  onDropVideo2={(asset) => handleDropVideo2(row.id, asset)}
                  onDropAudio={(asset) => handleDropAudio(row.id, asset)}
                  onOpenCaptionDrawer={() => setCaptionDrawerRowId(row.id)}
                  onCaptionOverlayClick={() => setActiveCaptionRowId(prev => prev === row.id ? null : row.id)}
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
                  onUpdateDragPos={(dragPos) => bulk.updateRowDragPos(row.id, dragPos)}
                  onUpdateTextClip={(clipId, changes) => (
                    bulk.updateRowEditorClip(row.id, clipId, changes)
                  )}
                  onCloseCaptionControls={() => setActiveCaptionRowId(null)}
                  onRemove={() => {
                    bulk.removeRow(row.id);
                    if (selectedRowId === row.id) setSelectedRowId(null);
                  }}
                  zoomScale={pageZoom}
                  onUpdateCanvasPos={(canvasPos) => bulk.updateRow(row.id, { canvasPos })}
                  onHeaderDoubleClick={() => focusAndZoomOnRow(row)}
                  onEditTimeline={() => navigate(`/media/editor?mode=bulk&rowId=${encodeURIComponent(row.id)}`)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Floating zoom & status HUD (bottom right) */}
        <div
          className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border border-[#27272a] bg-[#18181b]/95 p-1.5 shadow-lg backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[9px] font-mono text-gray-400 border-r border-[#27272a]">
            Pan: X={Math.round(pan.x)}, Y={Math.round(pan.y)}
          </div>
          <button
            type="button"
            onClick={() => setPageZoom((zoom) => clamp(zoom - 0.1, 0.15, 3.0))}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-all hover:bg-[#27272a] hover:text-white active:scale-95"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-10 text-center text-[10px] font-bold text-gray-300">
            {Math.round(pageZoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setPageZoom((zoom) => clamp(zoom + 0.1, 0.15, 3.0))}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-all hover:bg-[#27272a] hover:text-white active:scale-95"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPageZoom(0.8);
              setPan({ x: 80, y: 60 });
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-all hover:bg-[#27272a] hover:text-white active:scale-95"
            title="Reset Zoom Layout"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Top Toolbar */}
      <header className="absolute top-4 left-4 right-4 h-14 flex items-center justify-end px-5 z-30 pointer-events-none">
        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <label className="flex items-center gap-1.5 cursor-pointer bg-[#27272a] border border-[#3f3f46] hover:bg-[#3f3f46] px-2.5 py-1.5 rounded-lg text-white select-none transition-all">
            <input
              type="checkbox"
              checked={bulk.isDualVideo}
              onChange={(e) => bulk.toggleDualVideo(e.target.checked)}
              className="hidden"
            />
            <div className={`relative w-7 h-4 rounded-full transition-colors ${bulk.isDualVideo ? 'bg-[#ff5500]' : 'bg-zinc-700'}`}>
              <div className={`absolute top-[2px] left-[2px] w-3 h-3 rounded-full bg-white transition-transform duration-200 ${bulk.isDualVideo ? 'translate-x-3' : 'translate-x-0'}`} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-300">Dual Mode</span>
          </label>

          <button
            type="button"
            onClick={bulk.addRow}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] active:scale-95 text-white transition-all duration-200 shadow-sm"
            title="Add blank frame"
          >
            <Plus className="h-3.5 w-3.5 text-white shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Add Frame
            </span>
          </button>

          <button
            type="button"
            onClick={alignAllCards}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] active:scale-95 border border-[#3f3f46] text-white transition-all duration-200"
            title="Align & Fit Frames"
          >
            <Layout className="h-3.5 w-3.5 text-[#c4b5fd] shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Align
            </span>
          </button>

          <div className="w-px h-5 bg-[#27272a] mx-1" />

          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-400 transition-all hover:bg-red-900/40 active:scale-95 duration-200"
            title="Clear all frames"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Clear
            </span>
          </button>

          <button
            type="button"
            disabled={readyCount === 0}
            onClick={handleExportAll}
            className="flex items-center gap-2 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] px-4 py-1.5 text-xs font-extrabold tracking-wide text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            <Play className="h-4 w-4 fill-white text-white" />
            EXPORT ({readyCount})
          </button>


        </div>
      </header>

      {/* Docked Left Layers & Media Library Panel Sidebar */}
      {isSidebarOpen && (
        <aside className="absolute inset-y-0 left-0 w-80 bg-[#0d0d0f] border-r border-white/10 flex flex-col z-20 shadow-2xl text-white">
          {/* Header Tab Switcher */}
          <div className="p-2.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-white/5 rounded-lg w-full">
              <button
                type="button"
                onClick={() => setSidebarTab('frames')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all ${sidebarTab === 'frames'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                  }`}
              >
                <Sliders className="w-3 h-3" />
                Frames ({bulk.rows.length})
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('media')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all ${sidebarTab === 'media'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                  }`}
              >
                <Folder className="w-3 h-3" />
                Media Library
              </button>
            </div>
          </div>

          {/* Active Target Banner (When picking a specific slot) */}
          {activePickerRowId && pickerSlot && (
            <div className="px-3 py-2 bg-blue-950/50 border-b border-blue-800/40 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-blue-300 block truncate">
                  Picking {pickerSlot === 'video1' ? 'First Video' : 'Second Video'} for Frame #{bulk.rows.findIndex((r) => r.id === activePickerRowId) + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePickerRowId(null);
                  setPickerSlot(null);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-blue-400 hover:bg-blue-900/50 hover:text-white transition-all shrink-0"
                title="Cancel selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {sidebarTab === 'media' ? (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#0f0f11]">
              <MediaLibraryPanel
                token={token}
                initialMediaType="video"
                onSelect={handleSelectLibraryVideo}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {bulk.rows.map((row, idx) => {
                const isSelected = selectedRowId === row.id;
                const hasVideo = bulk.isDualVideo ? (row.video1 && row.video2) : row.video1;
                return (
                  <div
                    key={row.id}
                    onClick={() => centerOnRow(row)}
                    className={`group w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-xs font-semibold cursor-pointer border transition-all duration-150 ${isSelected
                        ? 'bg-[#27272a] text-white border-[#ff5500]/60 shadow-md'
                        : 'bg-transparent text-gray-400 border-transparent hover:bg-[#1e1e24] hover:text-gray-200'
                      }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.status === 'done' ? 'bg-green-500' :
                          row.status === 'error' ? 'bg-red-500' :
                            hasVideo ? 'bg-blue-500' : 'bg-gray-600'
                        }`} />
                      <span className="text-[10px] font-mono text-gray-500">#{idx + 1}</span>
                      <span className="truncate" title={row.caption}>
                        {row.caption || '(Blank Caption)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          bulk.removeRow(row.id);
                          if (selectedRowId === row.id) setSelectedRowId(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md hover:bg-red-950/40 text-gray-400 hover:text-red-400 transition-all"
                        title="Remove frame"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Quick add card trigger */}
              <button
                type="button"
                onClick={bulk.addRow}
                className="w-full mt-2 rounded-lg border border-dashed border-[#27272a] bg-transparent py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider transition-all hover:border-[#ff5500]/30 hover:bg-[#ff5500]/5 hover:text-[#ff5500]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Frame
              </button>
            </div>
          )}

          <div className="p-2.5 bg-[#1e1e24]/40 border-t border-[#27272a] shrink-0 text-[10px] text-gray-500 leading-normal font-medium">
            💡 <strong className="text-gray-400">Space + Drag</strong> to pan canvas. <strong className="text-gray-400">Pinch trackpad</strong> to zoom.
          </div>
        </aside>
      )}

      {/* Sidebar toggle button (docked on sidebar right edge or top left) */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-3.5 z-30 p-2 bg-[#18181b] hover:bg-[#27272a] text-gray-400 hover:text-white border border-white/10 shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center ${isSidebarOpen ? 'left-[320px] rounded-r-lg border-l-0' : 'left-3 rounded-lg'
          }`}
        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-[#c4b5fd]" />}
      </button>

      {/* Audio Picker Dialog */}
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

      {/* Caption AI generator Drawer */}
      {captionDrawerRowId && (
        <CaptionDrawer
          targetRowId={captionDrawerRowId}
          token={token}
          currentCaption={bulk.rows.find((r) => r.id === captionDrawerRowId)?.caption || ''}
          suggestions={generatedSuggestions}
          onSuggestionsChange={onSuggestions => {
            setGeneratedSuggestions(onSuggestions);
            // Center caption after AI updates
            if (onSuggestions && onSuggestions.length > 0 && selectedRowId) {
              const text = onSuggestions[0];
              bulk.updateRow(selectedRowId, {
                caption: text,
                dragPos: getCenteredDragPos(text, selectedRow?.textSettings)
              });
            }
          }}
          vibe={suggestionsVibe}
          onVibeChange={setSuggestionsVibe}
          onApply={handleApplyCaption}
          onClose={() => setCaptionDrawerRowId(null)}
        />
      )}

    </div>
  );
};

export default BulkVideoBuilder;
