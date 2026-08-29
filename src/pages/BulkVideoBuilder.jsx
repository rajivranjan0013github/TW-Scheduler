import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Trash2, Folder, Sliders, Layout, ChevronLeft, ChevronRight, X, Music } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEXT_SETTINGS, useBulkRows } from './bulkBuilder/useBulkRows';
import { BulkVideoRow } from './bulkBuilder/BulkVideoRow';
import { CaptionDrawer } from './bulkBuilder/CaptionDrawer';
import { BulkAgentComposer } from './bulkBuilder/BulkAgentComposer';
import { MediaLibraryPanel } from './videoEditorV2/components/MediaLibraryPanel';
import { getOverlayTextHeight, getOverlayTextWidth } from './videoEditor/videoEditorUtils';
import { PREVIEW_FRAME_HEIGHT, PREVIEW_FRAME_WIDTH } from './videoEditor/videoEditorConstants';
import { getActiveCampaignId } from '../utils/campaignScope';

const SOURCE_PREVIEW_WIDTH = PREVIEW_FRAME_WIDTH;
const SOURCE_PREVIEW_HEIGHT = PREVIEW_FRAME_HEIGHT;
const DUAL_CARD_WIDTH = 300;
const SINGLE_CARD_WIDTH = 175;
const CARD_HEIGHT = 350;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getCardWidth = (isDualVideo) => (
  isDualVideo ? DUAL_CARD_WIDTH : SINGLE_CARD_WIDTH
);
const isVideoAsset = (asset) => (
  asset?.mediaType === 'video'
  || asset?.type === 'video'
  || asset?.category === 'video'
  || asset?.kind === 'video'
);
const isAudioAsset = (asset) => (
  asset?.mediaType === 'audio'
  || asset?.type === 'audio'
  || asset?.category === 'audio'
  || asset?.kind === 'audio'
);

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

const BulkVideoNode = memo(({
  row,
  rowIndex,
  isSelected,
  isDualVideo,
  pageZoom,
  isActiveCaption,
  isCaptionTarget,
  onSelectRow,
  onPickVideo1,
  onPickVideo2,
  onPickAudio,
  onDropVideo1,
  onDropVideo2,
  onDropAudio,
  onOpenCaptionDrawer,
  onToggleCaptionControls,
  onUpdateCaption,
  onUpdateTextSettings,
  onUpdateTextClip,
  onCloseCaptionControls,
  onRemoveRow,
  onUpdateCanvasPos,
  onVideoDurationLoaded,
  onFocusRow,
  onEditTimeline,
}) => (
  <div
    className="rounded-xl"
    data-bulk-row-id={row.id}
    style={{
      position: 'absolute',
      left: `${row.canvasPos?.x ?? 100}px`,
      top: `${row.canvasPos?.y ?? 80}px`,
      zIndex: isSelected || isActiveCaption ? 20 : 10,
    }}
    onClick={(event) => {
      event.stopPropagation();
      onSelectRow(row.id);
    }}
  >
    <BulkVideoRow
      row={row}
      rowIndex={rowIndex}
      isSelected={isSelected}
      isDualVideo={isDualVideo}
      inverseZoomScale={1 / pageZoom}
      isActiveCaption={isActiveCaption}
      isCaptionTarget={isCaptionTarget}
      onPickVideo1={() => onPickVideo1(row.id)}
      onPickVideo2={() => onPickVideo2(row.id)}
      onPickAudio={() => onPickAudio(row.id)}
      onDropVideo1={(asset) => onDropVideo1(row.id, asset)}
      onDropVideo2={(asset) => onDropVideo2(row.id, asset)}
      onDropAudio={(asset) => onDropAudio(row.id, asset)}
      onOpenCaptionDrawer={() => onOpenCaptionDrawer(row.id)}
      onCaptionOverlayClick={() => onToggleCaptionControls(row.id)}
      onUpdateCaption={(caption, dragPos) => onUpdateCaption(row, caption, dragPos)}
      onUpdateTextSettings={(partialSettings, dragPos) => (
        onUpdateTextSettings(row, partialSettings, dragPos)
      )}
      onUpdateTextClip={(clipId, changes) => onUpdateTextClip(row.id, clipId, changes)}
      onCloseCaptionControls={onCloseCaptionControls}
      onRemove={() => onRemoveRow(row.id)}
      zoomScale={pageZoom}
      onUpdateCanvasPos={(canvasPos) => onUpdateCanvasPos(row.id, canvasPos)}
      onVideoDurationLoaded={(slot, duration) => (
        onVideoDurationLoaded(row.id, slot, duration)
      )}
      onHeaderDoubleClick={() => onFocusRow(row)}
      onEditTimeline={() => onEditTimeline(row.id)}
    />
  </div>
));

BulkVideoNode.displayName = 'BulkVideoNode';

export const BulkVideoBuilder = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [campaignId, setCampaignId] = useState(getActiveCampaignId);
  const {
    rows,
    addRow,
    removeRow,
    updateRow,
    updateRowCanvasPositions,
    updateRowVideoDuration,
    updateRowTextSettings,
    updateRowEditorClip,
    getReadyRows,
    clearAllRows,
    applyAgentPlan,
    undoAgentPlan,
    isDualVideo,
    toggleDualVideo,
    persistenceError,
  } = useBulkRows({ campaignId });
  const [isAgentModeLocked, setIsAgentModeLocked] = useState(false);

  useEffect(() => {
    const syncCampaign = (event) => {
      setCampaignId(String(event?.detail?.campaignId || getActiveCampaignId()));
    };
    window.addEventListener('campaign-selected', syncCampaign);
    window.addEventListener('storage', syncCampaign);
    return () => {
      window.removeEventListener('campaign-selected', syncCampaign);
      window.removeEventListener('storage', syncCampaign);
    };
  }, []);

  // Canvas Pan & Zoom states
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [pageZoom, setPageZoom] = useState(0.8);
  const canvasViewportRef = useRef(null);
  const didInitialFitRef = useRef(false);
  const shouldFitAfterAgentChangeRef = useRef(false);

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
    try {
      localStorage.setItem('tw_bulk_builder_sidebar_open', String(isSidebarOpen));
    } catch {
      // The sidebar preference is optional when browser storage is unavailable.
    }
  }, [isSidebarOpen]);

  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(() => {
    try {
      return localStorage.getItem('tw_bulk_builder_ai_drawer_open') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tw_bulk_builder_ai_drawer_open', String(isAiDrawerOpen));
    } catch {
      // The drawer preference is optional when browser storage is unavailable.
    }
  }, [isAiDrawerOpen]);

  const [sidebarTab, setSidebarTab] = useState('frames'); // 'frames' | 'media' | 'audio'

  // Keyboard navigation & drag statuses
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Selected row and active inline-caption controls.
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [activeCaptionRowId, setActiveCaptionRowId] = useState(null);

  // Dialog & pickers state
  const [activePickerRowId, setActivePickerRowId] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null); // 'video1' | 'video2'
  const [showAudioPickerRowId, setShowAudioPickerRowId] = useState(null);
  const [captionDrawerRowId, setCaptionDrawerRowId] = useState(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

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
    const handleWindowBlur = () => setIsSpacePressed(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
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

  // Track pageZoom and pan in a ref to keep the native wheel handler up to date.
  const zoomStateRef = useRef({ pageZoom, pan });
  useEffect(() => {
    zoomStateRef.current = { pageZoom, pan };
  }, [pageZoom, pan]);

  const applyZoomAtPoint = useCallback((requestedZoom, pointX, pointY) => {
    const { pageZoom: currentZoom, pan: currentPan } = zoomStateRef.current;
    const nextZoom = clamp(requestedZoom, 0.15, 3.0);
    if (Math.abs(nextZoom - currentZoom) < 0.0001) return;

    const canvasX = (pointX - currentPan.x) / currentZoom;
    const canvasY = (pointY - currentPan.y) / currentZoom;
    const nextPan = {
      x: pointX - canvasX * nextZoom,
      y: pointY - canvasY * nextZoom,
    };

    zoomStateRef.current = { pageZoom: nextZoom, pan: nextPan };
    setPageZoom(nextZoom);
    setPan(nextPan);
  }, []);

  // Zoom with Ctrl + Scrollwheel. Normal wheel input pans the canvas.
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return undefined;

    const handleCanvasWheel = (event) => {
      const { pageZoom: currentZoom, pan: currentPan } = zoomStateRef.current;
      const target = event.target instanceof Element ? event.target : null;
      const scrollable = target?.closest('.overflow-y-auto, .overflow-x-auto, .overflow-auto');
      if (scrollable && viewport.contains(scrollable)) return;

      // Zoom in and out with Ctrl / Cmd + scrollwheel (or pinch gesture)
      if (event.ctrlKey || event.metaKey) {
        if (event.deltaY === 0) return;
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const normalizedDelta = clamp(event.deltaY, -120, 120);
        const zoomFactor = Math.exp(-normalizedDelta * 0.002);
        applyZoomAtPoint(currentZoom * zoomFactor, mouseX, mouseY);
        return;
      }

      // Normal scrollwheel: pan the canvas
      event.preventDefault();
      let deltaX = event.deltaX;
      let deltaY = event.deltaY;

      if (event.shiftKey) {
        // Shift + scroll pans horizontally
        deltaX = event.deltaX || event.deltaY;
        deltaY = 0;
      }

      if (deltaX === 0 && deltaY === 0) return;

      const nextPan = {
        x: currentPan.x - deltaX,
        y: currentPan.y - deltaY,
      };

      zoomStateRef.current = { pageZoom: currentZoom, pan: nextPan };
      setPan(nextPan);
    };

    viewport.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleCanvasWheel);
    };
  }, [applyZoomAtPoint]);

  // Center canvas view on specific node safely below top floating bar
  const centerOnRow = useCallback((row) => {
    setSelectedRowId(row.id);
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const sidebarOffset = isSidebarOpen ? 320 : 0;
    const topOffset = 90;
    const bottomOffset = 50;
    const availableWidth = Math.max(200, rect.width - sidebarOffset);
    const availableHeight = Math.max(200, rect.height - topOffset - bottomOffset);

    const targetCenterX = sidebarOffset + availableWidth / 2;
    const targetCenterY = topOffset + availableHeight / 2;
    const cardWidth = getCardWidth(isDualVideo);
    const position = row.canvasPos || { x: 100, y: 80 };

    const targetPanX = targetCenterX - (position.x + cardWidth / 2) * pageZoom;
    const targetPanY = targetCenterY - (position.y + CARD_HEIGHT / 2) * pageZoom;
    setPan({ x: targetPanX, y: targetPanY });
  }, [isDualVideo, isSidebarOpen, pageZoom]);

  // Center and zoom in to 150% on double clicking card header
  const focusAndZoomOnRow = useCallback((row) => {
    setSelectedRowId(row.id);
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cardWidth = getCardWidth(isDualVideo);
    const nextZoom = 1.5;

    const sidebarOffset = isSidebarOpen ? 320 : 0;
    const topOffset = 90;
    const bottomOffset = 50;
    const availableWidth = Math.max(200, rect.width - sidebarOffset);
    const availableHeight = Math.max(200, rect.height - topOffset - bottomOffset);

    const targetCenterX = sidebarOffset + availableWidth / 2;
    const targetCenterY = topOffset + availableHeight / 2;
    const position = row.canvasPos || { x: 100, y: 80 };

    const targetPanX = targetCenterX - (position.x + cardWidth / 2) * nextZoom;
    const targetPanY = targetCenterY - (position.y + CARD_HEIGHT / 2) * nextZoom;

    setPageZoom(nextZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, [isDualVideo, isSidebarOpen]);

  // Fit all nodes inside viewport bounds taking sidebar and floating top toolbar into account
  const fitRows = useCallback((rowsToFit) => {
    if (rowsToFit.length === 0) return;

    // Calculate bounding rect of all nodes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const cardW = getCardWidth(isDualVideo);

    rowsToFit.forEach(r => {
      const pos = r.canvasPos || { x: 100, y: 100 };
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + cardW > maxX) maxX = pos.x + cardW;
      if (pos.y + CARD_HEIGHT > maxY) maxY = pos.y + CARD_HEIGHT;
    });

    const rect = canvasViewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const sidebarOffset = isSidebarOpen ? 320 : 0;
    const topOffset = 90;
    const bottomOffset = 50;
    const availableWidth = Math.max(200, rect.width - sidebarOffset);
    const availableHeight = Math.max(200, rect.height - topOffset - bottomOffset);

    const contentW = maxX - minX + 60;
    const contentH = maxY - minY + 60;

    const zoomX = availableWidth / contentW;
    const zoomY = availableHeight / contentH;
    const nextZoom = clamp(Math.min(zoomX, zoomY), 0.2, 1.2);

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    const targetCenterX = sidebarOffset + availableWidth / 2;
    const targetCenterY = topOffset + availableHeight / 2;

    setPageZoom(nextZoom);
    setPan({
      x: targetCenterX - centerX * nextZoom,
      y: targetCenterY - centerY * nextZoom,
    });
  }, [isDualVideo, isSidebarOpen]);

  const fitView = useCallback(() => fitRows(rows), [fitRows, rows]);

  useEffect(() => {
    if (!shouldFitAfterAgentChangeRef.current) return;
    shouldFitAfterAgentChangeRef.current = false;
    const timeoutId = window.setTimeout(() => fitRows(rows), 50);
    return () => window.clearTimeout(timeoutId);
  }, [fitRows, rows]);

  // Align all frames in a grid with up to 6 columns
  const alignAllCards = useCallback(() => {
    const colW = isDualVideo ? 330 : 205;
    const rowH = 380;
    const positionsByRowId = {};
    const alignedRows = rows.map((row, index) => {
      const r = Math.floor(index / 6);
      const c = index % 6;
      const canvasPos = {
        x: 50 + c * colW,
        y: 100 + r * rowH,
      };
      positionsByRowId[row.id] = canvasPos;
      return { ...row, canvasPos };
    });
    updateRowCanvasPositions(positionsByRowId);
    fitRows(alignedRows);
  }, [fitRows, isDualVideo, rows, updateRowCanvasPositions]);

  // Video picker callbacks (Directly opens MediaLibraryPanel in sidebar)
  const handlePickVideo1 = useCallback((rowId) => {
    setSelectedRowId(rowId);
    setShowAudioPickerRowId(null);
    setCaptionDrawerRowId(null);
    setActiveCaptionRowId(null);
    setActivePickerRowId(rowId);
    setPickerSlot('video1');
    setIsSidebarOpen(true);
    setSidebarTab('media');
  }, []);

  const handlePickVideo2 = useCallback((rowId) => {
    setSelectedRowId(rowId);
    setShowAudioPickerRowId(null);
    setCaptionDrawerRowId(null);
    setActiveCaptionRowId(null);
    setActivePickerRowId(rowId);
    setPickerSlot('video2');
    setIsSidebarOpen(true);
    setSidebarTab('media');
  }, []);

  const handleSelectLibraryVideo = useCallback((selectedVideo) => {
    if (!isVideoAsset(selectedVideo)) return;
    const requestedRowId = activePickerRowId || selectedRowId;
    const targetRowId = rows.some((row) => row.id === requestedRowId)
      ? requestedRowId
      : rows[0]?.id;
    const targetSlot = pickerSlot || 'video1';
    if (!targetRowId) return;
    const field = targetSlot === 'video1'
      ? { video1: selectedVideo, video1Url: selectedVideo.url || selectedVideo.originalUrl }
      : { video2: selectedVideo, video2Url: selectedVideo.url || selectedVideo.originalUrl };
    updateRow(targetRowId, field);
    setActivePickerRowId(null);
    setPickerSlot(null);
  }, [activePickerRowId, pickerSlot, rows, selectedRowId, updateRow]);

  // Drop handlers for Drag & Drop onto canvas card slots
  const handleDropVideo1 = useCallback((rowId, asset) => {
    if (!isVideoAsset(asset)) return;
    updateRow(rowId, {
      video1: asset,
      video1Url: asset.url || asset.originalUrl,
    });
  }, [updateRow]);

  const handleDropVideo2 = useCallback((rowId, asset) => {
    if (!isVideoAsset(asset)) return;
    updateRow(rowId, {
      video2: asset,
      video2Url: asset.url || asset.originalUrl,
    });
  }, [updateRow]);

  const handleDropAudio = useCallback((rowId, asset) => {
    if (!isAudioAsset(asset)) return;
    updateRow(rowId, { audio: asset });
  }, [updateRow]);

  const handleSelectLibraryAudio = useCallback((asset) => {
    if (!isAudioAsset(asset)) return;
    const requestedRowId = showAudioPickerRowId || selectedRowId;
    const targetRowId = rows.some((row) => row.id === requestedRowId)
      ? requestedRowId
      : rows[0]?.id;
    if (!targetRowId) return;
    updateRow(targetRowId, { audio: asset });
    setShowAudioPickerRowId(null);
  }, [rows, selectedRowId, showAudioPickerRowId, updateRow]);

  // Audio picker callbacks
  const handleOpenAudioPicker = useCallback((rowId) => {
    setSelectedRowId(rowId);
    setActivePickerRowId(null);
    setPickerSlot(null);
    setCaptionDrawerRowId(null);
    setActiveCaptionRowId(null);
    setShowAudioPickerRowId(rowId);
    setSidebarTab('audio');
    setIsSidebarOpen(true);
  }, []);

  const handlePickAudio = useCallback((rowId) => {
    handleOpenAudioPicker(rowId);
  }, [handleOpenAudioPicker]);

  const handleClearAudio = useCallback(() => {
    const rowId = showAudioPickerRowId || selectedRowId;
    if (!rowId) return;
    updateRow(rowId, { audio: null });
    setShowAudioPickerRowId(null);
  }, [selectedRowId, showAudioPickerRowId, updateRow]);

  const handleSidebarTabChange = useCallback((nextTab) => {
    setSidebarTab(nextTab);
    if (nextTab !== 'media') {
      setActivePickerRowId(null);
      setPickerSlot(null);
    }
    if (nextTab !== 'audio') {
      setShowAudioPickerRowId(null);
    }
  }, []);

  const handleSelectRow = useCallback((rowId) => {
    setSelectedRowId(rowId);
    if (captionDrawerRowId !== null) {
      setCaptionDrawerRowId(rowId);
      setGeneratedSuggestions([]);
    }
  }, [captionDrawerRowId]);

  const handleOpenCaptionDrawer = useCallback((rowId) => {
    setSelectedRowId(rowId);
    setActivePickerRowId(null);
    setPickerSlot(null);
    setShowAudioPickerRowId(null);
    setActiveCaptionRowId(null);
    setGeneratedSuggestions([]);
    setCaptionDrawerRowId(rowId);
  }, []);

  const handleToggleCaptionControls = useCallback((rowId) => {
    setActiveCaptionRowId((currentRowId) => currentRowId === rowId ? null : rowId);
  }, []);

  const handleCloseCaptionControls = useCallback(() => {
    setActiveCaptionRowId(null);
  }, []);

  const handleUpdateCaption = useCallback((row, caption, dragPos) => {
    const nextDragPos = dragPos
      || (!row.caption ? getCenteredDragPos(caption, row.textSettings) : null);
    updateRow(
      row.id,
      nextDragPos ? { caption, dragPos: nextDragPos } : { caption },
    );
  }, [updateRow]);

  const handleUpdateTextSettings = useCallback((row, partialSettings, dragPos) => {
    if (dragPos) {
      updateRow(row.id, {
        textSettings: { ...row.textSettings, ...partialSettings },
        dragPos,
      });
      return;
    }
    updateRowTextSettings(row.id, partialSettings);
  }, [updateRow, updateRowTextSettings]);

  const handleUpdateTextClip = useCallback((rowId, clipId, changes) => {
    updateRowEditorClip(rowId, clipId, changes);
  }, [updateRowEditorClip]);

  const handleRemoveRow = useCallback((rowId) => {
    removeRow(rowId);
    setSelectedRowId((currentRowId) => currentRowId === rowId ? null : currentRowId);
    setActivePickerRowId(null);
    setPickerSlot(null);
    setShowAudioPickerRowId(null);
    setCaptionDrawerRowId(null);
    setActiveCaptionRowId(null);
    setGeneratedSuggestions([]);
  }, [removeRow]);

  const handleUpdateCanvasPos = useCallback((rowId, canvasPos) => {
    updateRow(rowId, { canvasPos });
  }, [updateRow]);

  const handleVideoDurationLoaded = useCallback((rowId, slot, duration) => {
    updateRowVideoDuration(rowId, slot, duration);
  }, [updateRowVideoDuration]);

  const handleEditTimeline = useCallback((rowId) => {
    navigate(`/media/editor?mode=bulk&rowId=${encodeURIComponent(rowId)}`);
  }, [navigate]);

  const handleClearAll = useCallback(() => {
    if (rows.length === 0) return;
    setShowClearDialog(true);
  }, [rows.length]);

  const handleConfirmClear = useCallback(() => {
    clearAllRows();
    setSelectedRowId(null);
    setActivePickerRowId(null);
    setPickerSlot(null);
    setShowAudioPickerRowId(null);
    setCaptionDrawerRowId(null);
    setActiveCaptionRowId(null);
    setGeneratedSuggestions([]);
    setShowClearDialog(false);
    fitRows([{ canvasPos: { x: 50, y: 80 } }]);
  }, [clearAllRows, fitRows]);

  // Caption apply callback
  const handleApplyCaption = useCallback((text) => {
    const rowId = captionDrawerRowId || selectedRowId;
    if (!rowId) return;
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    updateRow(rowId, {
      caption: text,
      dragPos: getCenteredDragPos(text, row?.textSettings),
    });
  }, [captionDrawerRowId, rows, selectedRowId, updateRow]);

  const handleExportAll = useCallback(() => {
    const readyRows = getReadyRows();
    if (readyRows.length === 0) return;
    navigate(`/media/editor?mode=bulk&rowId=${encodeURIComponent(readyRows[0].id)}&panel=bulk`);
  }, [getReadyRows, navigate]);

  const handleApplyAgentPlan = useCallback((plan) => {
    shouldFitAfterAgentChangeRef.current = true;
    const changeSet = applyAgentPlan(plan);
    if (typeof plan?.isDualVideo === 'boolean' && plan.isDualVideo !== isDualVideo) {
      toggleDualVideo(plan.isDualVideo);
    }
    return changeSet;
  }, [applyAgentPlan, isDualVideo, toggleDualVideo]);

  const handleUndoAgentPlan = useCallback((changeSet) => {
    shouldFitAfterAgentChangeRef.current = true;
    return undoAgentPlan(changeSet);
  }, [undoAgentPlan]);

  // Auto center view on mount if nodes exist
  useEffect(() => {
    if (didInitialFitRef.current || rows.length === 0) return undefined;
    const timeoutId = window.setTimeout(() => {
      didInitialFitRef.current = true;
      fitView();
    }, 150);
    return () => window.clearTimeout(timeoutId);
  }, [fitView, rows.length]);

  const readyCount = getReadyRows().length;
  const captionDrawerRow = rows.find((row) => row.id === captionDrawerRowId) || null;

  return (
    <div className="h-full w-full relative bg-[#0e0e10] text-[#e0e0e5] overflow-hidden select-none font-sans">
      {persistenceError && (
        <div className="absolute left-1/2 top-20 z-50 w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-xl border border-red-800/60 bg-red-950/95 px-4 py-3 text-xs font-semibold text-red-200 shadow-2xl">
          {persistenceError}
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
        className={`absolute inset-0 z-0 overflow-hidden bg-[#141416] outline-none select-none transition-colors duration-150 ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          }`}
        style={{
          backgroundImage: 'radial-gradient(circle, #303034 1px, transparent 1px)',
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
            {rows.map((row, idx) => (
              <BulkVideoNode
                key={row.id}
                row={row}
                rowIndex={idx}
                isSelected={selectedRowId === row.id}
                isDualVideo={isDualVideo}
                pageZoom={pageZoom}
                isActiveCaption={activeCaptionRowId === row.id}
                isCaptionTarget={captionDrawerRowId === row.id}
                onSelectRow={handleSelectRow}
                onPickVideo1={handlePickVideo1}
                onPickVideo2={handlePickVideo2}
                onPickAudio={handlePickAudio}
                onDropVideo1={handleDropVideo1}
                onDropVideo2={handleDropVideo2}
                onDropAudio={handleDropAudio}
                onOpenCaptionDrawer={handleOpenCaptionDrawer}
                onToggleCaptionControls={handleToggleCaptionControls}
                onUpdateCaption={handleUpdateCaption}
                onUpdateTextSettings={handleUpdateTextSettings}
                onUpdateTextClip={handleUpdateTextClip}
                onCloseCaptionControls={handleCloseCaptionControls}
                onRemoveRow={handleRemoveRow}
                onUpdateCanvasPos={handleUpdateCanvasPos}
                onVideoDurationLoaded={handleVideoDurationLoaded}
                onFocusRow={focusAndZoomOnRow}
                onEditTimeline={handleEditTimeline}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Floating Top Toolbar */}
      <header
        className="absolute top-4 right-4 left-4 h-14 flex items-center justify-end px-5 z-30 pointer-events-none"
      >
        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <label className={`flex items-center gap-1.5 border border-[#35353a] px-2.5 py-1.5 rounded-lg text-white select-none transition-all ${isAgentModeLocked
            ? 'cursor-not-allowed bg-[#1c1c1f] opacity-55'
            : 'cursor-pointer bg-[#232326] hover:bg-[#2a2a2e]'
          }`}>
            <input
              type="checkbox"
              checked={isDualVideo}
              disabled={isAgentModeLocked}
              onChange={(e) => toggleDualVideo(e.target.checked)}
              className="hidden"
            />
            <div className={`relative w-7 h-4 rounded-full transition-colors ${isDualVideo ? 'bg-[#7831d6]' : 'bg-zinc-700'}`}>
              <div className={`absolute top-[2px] left-[2px] w-3 h-3 rounded-full bg-white transition-transform duration-200 ${isDualVideo ? 'translate-x-3' : 'translate-x-0'}`} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-300">Dual Mode</span>
          </label>

          <button
            type="button"
            onClick={addRow}
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
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#232326] hover:bg-[#2a2a2e] active:scale-95 border border-[#35353a] text-white transition-all duration-200"
            title="Align & Fit Frames"
          >
            <Layout className="h-3.5 w-3.5 text-[#c4b5fd] shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              Align
            </span>
          </button>

          <div className="w-px h-5 bg-[#303034] mx-1" />

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
        <aside className="absolute inset-y-0 left-0 w-80 bg-[#151517] border-r border-[#303034] flex flex-col z-20 shadow-2xl text-white">
          {/* Header Tab Switcher */}
          <div className="p-2.5 border-b border-[#303034] flex items-center justify-between shrink-0 bg-[#1a1a1d]">
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-white/5 rounded-lg w-full">
              <button
                type="button"
                onClick={() => handleSidebarTabChange('frames')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all ${sidebarTab === 'frames'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                  }`}
              >
                <Sliders className="w-3 h-3 shrink-0" />
                Frames
              </button>
              <button
                type="button"
                onClick={() => handleSidebarTabChange('media')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all ${sidebarTab === 'media'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                  }`}
              >
                <Folder className="w-3 h-3 shrink-0" />
                Media
              </button>
              <button
                type="button"
                onClick={() => handleSidebarTabChange('audio')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all ${sidebarTab === 'audio'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                  }`}
              >
                <Music className="w-3 h-3 shrink-0" />
                Audio
              </button>
            </div>
          </div>

          {/* Active Target Banner (When picking a specific slot) */}
          {activePickerRowId && pickerSlot && rows.some((row) => row.id === activePickerRowId) && (
            <div className="px-3 py-2 bg-blue-950/50 border-b border-blue-800/40 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-blue-300 block truncate">
                  Picking {pickerSlot === 'video1' ? 'First Video' : 'Second Video'} for Frame #{rows.findIndex((r) => r.id === activePickerRowId) + 1}
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

          {showAudioPickerRowId && sidebarTab === 'audio' && rows.some((row) => row.id === showAudioPickerRowId) && (
            <div className="px-3 py-2 bg-[#7831d6]/20 border-b border-[#7831d6]/40 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-purple-300 block truncate">
                  Selecting audio for Frame #{rows.findIndex((r) => r.id === showAudioPickerRowId) + 1}
                </span>
                {rows.find((r) => r.id === showAudioPickerRowId)?.audio && (
                  <button
                    type="button"
                    onClick={handleClearAudio}
                    className="text-[9px] text-red-400 hover:text-red-300 underline font-semibold mt-0.5"
                  >
                    Remove current audio
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowAudioPickerRowId(null)}
                className="flex h-5 w-5 items-center justify-center rounded text-purple-400 hover:bg-purple-900/50 hover:text-white transition-all shrink-0"
                title="Cancel selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {sidebarTab === 'media' ? (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#151517]">
              <MediaLibraryPanel
                key="bulk-video-library"
                token={token}
                initialMediaType="video"
                restrictToInitialMediaType
                onSelect={handleSelectLibraryVideo}
              />
            </div>
          ) : sidebarTab === 'audio' ? (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#151517]">
              <MediaLibraryPanel
                key="bulk-audio-library"
                token={token}
                initialMediaType="audio"
                onSelect={handleSelectLibraryAudio}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1 bg-[#151517]">
              {rows.map((row, idx) => {
                const isSelected = selectedRowId === row.id;
                const hasVideo = isDualVideo ? (row.video1 && row.video2) : row.video1;
                return (
                  <div
                    key={row.id}
                    onClick={() => centerOnRow(row)}
                    className={`group w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-xs font-semibold cursor-pointer border transition-all duration-150 ${isSelected
                        ? 'bg-[#7831d6]/20 text-white border-[#7831d6]/70 shadow-sm'
                        : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-gray-200'
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
                          handleRemoveRow(row.id);
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
                onClick={addRow}
                className="w-full mt-2 rounded-lg border border-dashed border-white/15 bg-transparent py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider transition-all hover:border-[#7831d6]/60 hover:bg-[#7831d6]/10 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Frame
              </button>
            </div>
          )}

          <div className="p-2.5 bg-[#1a1a1d] border-t border-[#303034] shrink-0 text-[10px] text-gray-400 leading-normal font-medium">
            💡 <strong className="text-gray-300">Ctrl + Scroll</strong> to zoom. <strong className="text-gray-300">Scroll / Space + Drag</strong> to pan.
          </div>
        </aside>
      )}

      {/* Sidebar toggle button (docked on sidebar right edge or top left) */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen((open) => !open)}
        className={`absolute top-3.5 z-30 p-2 bg-[#1c1c1f] hover:bg-[#232326] text-gray-400 hover:text-white border border-[#303034] shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center ${isSidebarOpen ? 'left-[320px] rounded-r-lg border-l-0' : 'left-3 rounded-lg'
          }`}
        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-[#c4b5fd]" />}
      </button>

      {/* Caption AI generator Drawer */}
      {captionDrawerRow && (
        <CaptionDrawer
          targetRowId={captionDrawerRow.id}
          token={token}
          currentCaption={captionDrawerRow.caption || ''}
          suggestions={generatedSuggestions}
          onSuggestionsChange={setGeneratedSuggestions}
          vibe={suggestionsVibe}
          onVibeChange={setSuggestionsVibe}
          onApply={handleApplyCaption}
          onClose={() => setCaptionDrawerRowId(null)}
        />
      )}

      <BulkAgentComposer
        key={campaignId || 'no-campaign'}
        token={token}
        campaignId={campaignId}
        isDualVideo={isDualVideo}
        isOpen={isAiDrawerOpen}
        onOpenChange={setIsAiDrawerOpen}
        canvasLeftOffset={isSidebarOpen ? 320 : 0}
        currentFrameCount={rows.length}
        currentRows={rows}
        onApplyPlan={handleApplyAgentPlan}
        onUndoPlan={handleUndoAgentPlan}
        onModeLockChange={setIsAgentModeLocked}
      />

      {/* Clear Confirmation Dialog Modal */}
      {showClearDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-clear-dialog-title"
            className="w-full max-w-md rounded-2xl border border-[#303034] bg-[#151517] p-6 shadow-2xl text-white"
          >
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950/40 border border-red-800/40 shrink-0">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 id="bulk-clear-dialog-title" className="text-sm font-bold uppercase tracking-wider text-white">
                  Clear All Frames
                </h3>
                <p className="text-xs text-zinc-400">
                  {rows.length} {rows.length === 1 ? 'frame' : 'frames'} on planning board
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              This removes every planned frame and replaces the board with one new blank frame. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkVideoBuilder;
