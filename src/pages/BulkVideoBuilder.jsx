import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Minus, Plus, Play, RotateCcw, Trash2, Eye, EyeOff, Folder, FileText, Music, Sparkles, Sliders, Layout, Crosshair, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEXT_SETTINGS, useBulkRows } from './bulkBuilder/useBulkRows';
import { BulkVideoRow } from './bulkBuilder/BulkVideoRow';
import { CaptionDrawer } from './bulkBuilder/CaptionDrawer';
import { VideoLibraryPickerDialog } from './videoEditor/VideoLibraryPickerDialog';
import { AudioDialog } from './videoEditor/AudioDialog';
import { usePreviewAudio } from './videoEditor/usePreviewAudio';
import { BulkAssetPickerDialog } from './bulkBuilder/BulkAssetPickerDialog';
import { TempAssetQuickPickerDialog, TempMediaLibraryDialog } from './bulkBuilder/TempAssetQuickPickerDialog';
import { getOverlayTextHeight, getOverlayTextWidth } from './videoEditor/videoEditorUtils';
import { FONT_WEIGHTS } from './videoEditor/videoEditorConstants';

const SOURCE_PREVIEW_WIDTH = 292;
const SOURCE_PREVIEW_HEIGHT = 520;

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
  const [showBulkAssetPicker, setShowBulkAssetPicker] = useState(false);
  const [showTempMediaLibrary, setShowTempMediaLibrary] = useState(false);

  // Temporary local library state
  const [tempLibrary, setTempLibrary] = useState(() => {
    try {
      const saved = localStorage.getItem('tw_bulk_builder_temp_library');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        video1: Array.isArray(parsed.video1) ? parsed.video1 : [],
        video2: Array.isArray(parsed.video2) ? parsed.video2 : [],
        audio: Array.isArray(parsed.audio) ? parsed.audio : [],
      };
    } catch {
      return { video1: [], video2: [], audio: [] };
    }
  });
  const [quickPickerType, setQuickPickerType] = useState(null); // 'video1' | 'video2' | 'audio'
  const [quickPickerRowId, setQuickPickerRowId] = useState(null);

  // AI captions suggestion state
  const [generatedSuggestions, setGeneratedSuggestions] = useState([]);
  const [suggestionsVibe, setSuggestionsVibe] = useState('');

  // Auto-save tempLibrary to localStorage
  useEffect(() => {
    localStorage.setItem('tw_bulk_builder_temp_library', JSON.stringify(tempLibrary));
  }, [tempLibrary]);

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
      } catch (err) {
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
        let nextZoom = currentZoom;
        if (event.deltaY < 0) {
          nextZoom = Math.min(currentZoom * zoomFactor, 3.0);
        } else {
          nextZoom = Math.max(currentZoom / zoomFactor, 0.15);
        }

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

  // Video picker callbacks
  const handlePickVideo1 = useCallback((rowId) => {
    if (tempLibrary.video1 && tempLibrary.video1.length > 0) {
      setQuickPickerRowId(rowId);
      setQuickPickerType('video1');
    } else {
      setActivePickerRowId(rowId);
      setPickerSlot('video1');
    }
  }, [tempLibrary.video1]);

  const handlePickVideo2 = useCallback((rowId) => {
    if (tempLibrary.video2 && tempLibrary.video2.length > 0) {
      setQuickPickerRowId(rowId);
      setQuickPickerType('video2');
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
    setTempLibrary((prev) => {
      const key = pickerSlot === 'video1' ? 'video1' : 'video2';
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      if (current.some((item) => item.id === selectedVideo.id)) return prev;
      return {
        ...prev,
        [key]: [...current, selectedVideo],
      };
    });
    setActivePickerRowId(null);
    setPickerSlot(null);
  }, [activePickerRowId, pickerSlot, bulk]);

  // Audio picker callbacks
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
    const rowId = showAudioPickerRowId || selectedRowId;
    if (!rowId) return;
    bulk.updateRow(rowId, { audio: track });
    setTempLibrary((prev) => {
      const current = Array.isArray(prev.audio) ? prev.audio : [];
      if (current.some((item) => item.id === track.id)) return prev;
      return {
        ...prev,
        audio: [...current, track],
      };
    });
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

  // Quick pick confirm callbacks
  const handleSelectQuickVideo = useCallback((selectedVideo) => {
    const isFirstVideo = quickPickerType === 'video1';
    bulk.updateRow(quickPickerRowId, isFirstVideo
      ? { video1: selectedVideo, video1Url: selectedVideo.url }
      : { video2: selectedVideo, video2Url: selectedVideo.url });
    setQuickPickerRowId(null);
    setQuickPickerType(null);
  }, [quickPickerRowId, quickPickerType, bulk]);

  const handleSelectQuickAudio = useCallback((selectedAudio) => {
    bulk.updateRow(quickPickerRowId, { audio: selectedAudio });
    setQuickPickerRowId(null);
    setQuickPickerType(null);
  }, [quickPickerRowId, bulk]);

  const handleBrowseGlobalVideo = useCallback(() => {
    const rowId = quickPickerRowId;
    const slot = quickPickerType === 'video1' ? 'video1' : 'video2';
    setQuickPickerRowId(null);
    setQuickPickerType(null);
    setActivePickerRowId(rowId);
    setPickerSlot(slot);
  }, [quickPickerRowId, quickPickerType]);

  const handleBrowseGlobalAudio = useCallback(() => {
    const rowId = quickPickerRowId;
    setQuickPickerRowId(null);
    setQuickPickerType(null);
    handleOpenAudioPicker(rowId);
  }, [quickPickerRowId, handleOpenAudioPicker]);

  // Bulk dialog asset confirm callback
  const handleConfirmBulkAssets = useCallback(({ video1List, video2List, musicList }) => {
    if (video1List.length > 0) {
      bulk.addRowsWithFirstVideos(video1List);
    }

    setTempLibrary((prev) => {
      const mergedVideo1 = [...(prev.video1 || [])];
      video1List.forEach((item) => {
        if (!mergedVideo1.some((v) => v.id === item.id)) {
          mergedVideo1.push(item);
        }
      });

      const mergedVideo2 = [...(prev.video2 || [])];
      video2List.forEach((item) => {
        if (!mergedVideo2.some((v) => v.id === item.id)) {
          mergedVideo2.push(item);
        }
      });

      const mergedAudio = [...(prev.audio || [])];
      musicList.forEach((item) => {
        if (!mergedAudio.some((a) => a.id === item.id)) {
          mergedAudio.push(item);
        }
      });

      return {
        video1: mergedVideo1,
        video2: mergedVideo2,
        audio: mergedAudio,
      };
    });

    setShowBulkAssetPicker(false);
  }, [bulk]);

  const handleClearAll = useCallback(() => {
    bulk.clearAllRows();
    setTempLibrary({ video1: [], video2: [], audio: [] });
    setSelectedRowId(null);
  }, [bulk]);

  const handleRemoveTempAsset = useCallback((section, item) => {
    const itemKey = item?.id || item?.url;
    setTempLibrary((prev) => ({
      ...prev,
      [section]: (Array.isArray(prev[section]) ? prev[section] : []).filter((asset) => (
        (asset.id || asset.url) !== itemKey
      )),
    }));
  }, []);

  // Caption apply callback
  const handleApplyCaption = useCallback((text) => {
    const rowId = captionDrawerRowId || selectedRowId;
    if (!rowId) return;
    const row = bulk.rows.find((item) => item.id === rowId);
    bulk.updateRow(rowId, {
      caption: text,
      dragPos: getCenteredDragPos(text, row?.textSettings),
    });
    setCaptionDrawerRowId(null);
  }, [captionDrawerRowId, selectedRowId, bulk]);

  const handleExportAll = useCallback(() => {
    const readyRows = bulk.getReadyRows();
    if (readyRows.length === 0) return;
    navigate('/media/editor?mode=bulk');
  }, [bulk, navigate]);

  // Auto center view on mount if nodes exist
  useEffect(() => {
    if (bulk.rows.length > 0) {
      setTimeout(fitView, 150);
    }
  }, []);

  // Compute references for right inspector panel values
  const selectedRow = bulk.rows.find(r => r.id === selectedRowId);
  const readyCount = bulk.getReadyRows().length;
  const totalRows = bulk.rows.length;

  return (
    <div className="h-screen w-screen relative bg-[#0e0e10] text-[#e0e0e5] overflow-hidden select-none font-sans">
      
      {/* Figma 2D Infinite Canvas Viewport */}
      <div
        ref={canvasViewportRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onClick={() => setSelectedRowId(null)}
        className={`absolute inset-0 z-0 overflow-hidden bg-[#0d0d0e] outline-none select-none transition-colors duration-150 ${
          isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
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
                style={{
                  position: 'absolute',
                  left: `${row.canvasPos?.x || 100}px`,
                  top: `${row.canvasPos?.y || 80}px`,
                  zIndex: selectedRowId === row.id || activeCaptionRowId === row.id ? 20 : 10,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRowId(row.id);
                }}
              >
                <BulkVideoRow
                  row={row}
                  rowIndex={idx}
                  inverseZoomScale={1 / pageZoom}
                  isActiveCaption={activeCaptionRowId === row.id}
                  onPickVideo1={() => handlePickVideo1(row.id)}
                  onPickVideo2={() => handlePickVideo2(row.id)}
                  onPickAudio={() => handlePickAudio(row.id)}
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
                  onCloseCaptionControls={() => setActiveCaptionRowId(null)}
                  onRemove={() => {
                    bulk.removeRow(row.id);
                    if (selectedRowId === row.id) setSelectedRowId(null);
                  }}
                  zoomScale={pageZoom}
                  onUpdateCanvasPos={(canvasPos) => bulk.updateRow(row.id, { canvasPos })}
                  onHeaderDoubleClick={() => focusAndZoomOnRow(row)}
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

      {/* Floating Top Figma Header */}
      <header className="absolute top-4 left-4 right-4 h-14 flex items-center justify-between px-5 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-[#ff5500] p-1.5 rounded-lg shadow-inner">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-widest text-white" style={{ color: '#ffffff' }}>Bulk Video Builder</h1>
            <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Canvas Workspace</p>
          </div>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={bulk.addRow}
            className="group flex items-center justify-center gap-0 hover:gap-1.5 p-1.5 hover:px-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] active:scale-95 border border-[#3f3f46] text-white transition-all duration-300"
            title="Add blank frame"
          >
            <Plus className="h-3.5 w-3.5 text-[#ff5500] shrink-0" />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Add Frame
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowTempMediaLibrary(true)}
            className="group flex items-center justify-center gap-0 hover:gap-1.5 p-1.5 hover:px-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] active:scale-95 border border-[#3f3f46] text-white transition-all duration-300"
            title="Temporary Media Library"
          >
            <Folder className="h-3.5 w-3.5 text-[#0071e3] shrink-0" />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 transition-all duration-300 ease-in-out text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Temp Library
            </span>
          </button>
          
          <button
            type="button"
            onClick={alignAllCards}
            className="group flex items-center justify-center gap-0 hover:gap-1.5 p-1.5 hover:px-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] active:scale-95 border border-[#3f3f46] text-white transition-all duration-300"
            title="Align Frames"
          >
            <Layout className="h-3.5 w-3.5 text-[#ff5500] shrink-0" />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Align
            </span>
          </button>

          <button
            type="button"
            onClick={fitView}
            className="group flex items-center justify-center gap-0 hover:gap-1.5 p-1.5 hover:px-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] active:scale-95 border border-[#3f3f46] text-white transition-all duration-300"
            title="Fit View"
          >
            <Crosshair className="h-3.5 w-3.5 text-[#0071e3] shrink-0" />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Fit
            </span>
          </button>

          <div className="w-px h-5 bg-[#27272a] mx-1" />

          <button
            type="button"
            onClick={handleClearAll}
            className="group flex items-center justify-center gap-0 hover:gap-1.5 p-1.5 hover:px-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-400 transition-all hover:bg-red-900/40 active:scale-95 duration-300"
            title="Clear all frames"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 transition-all duration-300 ease-in-out text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Clear
            </span>
          </button>

          <button
            type="button"
            disabled={readyCount === 0}
            onClick={handleExportAll}
            className="flex items-center gap-2 rounded-lg bg-[#ff5500] px-4 py-1.5 text-xs font-extrabold tracking-wide text-white transition-all hover:bg-orange-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            <Play className="h-4 w-4 fill-white text-white" />
            EXPORT ({readyCount})
          </button>
        </div>
      </header>

      {/* Floating Left Layers Panel Sidebar */}
      {isSidebarOpen && (
        <aside className="absolute top-20 left-4 bottom-4 w-64 bg-[#18181b]/95 border border-[#27272a] rounded-xl flex flex-col z-20 shadow-lg backdrop-blur-md">
          <div className="p-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#a1a1aa' }}>
              <Sliders className="w-3.5 h-3.5 text-[#ff5500]" />
              Frames Directory
            </h3>
            <span className="text-[9px] font-extrabold text-gray-400 bg-[#27272a] px-2 py-0.5 rounded-full">
              {bulk.rows.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {bulk.rows.map((row, idx) => {
              const isSelected = selectedRowId === row.id;
              const hasVideo = row.video1 && row.video2;
              return (
                <div
                  key={row.id}
                  onClick={() => centerOnRow(row)}
                  className={`group w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-xs font-semibold cursor-pointer border transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#27272a] text-white border-[#ff5500]/60 shadow-md'
                      : 'bg-transparent text-gray-400 border-transparent hover:bg-[#1e1e24] hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      row.status === 'done' ? 'bg-green-500' :
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
          
          <div className="p-3 bg-[#1e1e24]/40 border-t border-[#27272a] shrink-0 text-[10px] text-gray-500 leading-normal font-medium rounded-b-xl">
            💡 <strong className="text-gray-400">Space + Drag</strong> to pan 2D canvas workspace. <strong className="text-gray-400">Pinch trackpad</strong> to zoom.
          </div>
        </aside>
      )}

      {/* Sidebar toggle button (floating in top left) */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-20 z-30 p-2.5 bg-[#18181b]/95 hover:bg-[#27272a] text-gray-400 hover:text-white rounded-xl border border-[#27272a] shadow-lg backdrop-blur-md transition-all duration-200 active:scale-95 flex items-center justify-center ${
          isSidebarOpen ? 'left-[276px]' : 'left-4'
        }`}
        title={isSidebarOpen ? "Collapse Layers Directory" : "Expand Layers Directory"}
      >
        {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-[#ff5500]" />}
      </button>

      {/* Video Library Picker Dialog */}
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

      {/* Multi asset batch imports */}
      {showBulkAssetPicker && (
        <BulkAssetPickerDialog
          token={token}
          onClose={() => setShowBulkAssetPicker(false)}
          onConfirm={handleConfirmBulkAssets}
        />
      )}

      {showTempMediaLibrary && (
        <TempMediaLibraryDialog
          library={tempLibrary}
          onAddMore={() => {
            setShowTempMediaLibrary(false);
            setShowBulkAssetPicker(true);
          }}
          onRemove={handleRemoveTempAsset}
          onClose={() => setShowTempMediaLibrary(false)}
        />
      )}

      {/* Quick single select picking dialog */}
      {quickPickerRowId && quickPickerType && (
        <TempAssetQuickPickerDialog
          type={quickPickerType === 'audio' ? 'audio' : 'video'}
          slotLabel={
            quickPickerType === 'video1'
              ? 'First Video'
              : quickPickerType === 'video2'
                ? 'Second Video'
                : 'Audio Track'
          }
          items={
            quickPickerType === 'video1'
              ? tempLibrary.video1
              : quickPickerType === 'video2'
                ? tempLibrary.video2
                : tempLibrary.audio
          }
          onSelect={quickPickerType === 'audio' ? handleSelectQuickAudio : handleSelectQuickVideo}
          onBrowseGlobal={quickPickerType === 'audio' ? handleBrowseGlobalAudio : handleBrowseGlobalVideo}
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
