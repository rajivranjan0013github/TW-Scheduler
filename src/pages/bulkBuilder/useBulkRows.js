import { useState, useCallback, useEffect } from 'react';

export const BULK_ROWS_STORAGE_KEY = 'tw_bulk_builder_rows';

export const DEFAULT_TEXT_SETTINGS = {
  fontFamily: 'TikTok Sans',
  fontWeight: 'Regular',
  fontSize: 15,
  fontColor: '#FFFFFF',
  strokeWidth: 3,
  strokeColor: '#000000',
  bgType: 'None',
  bgColor: '#000000',
};

export const DEFAULT_DRAG_POS = { x: 20, y: 220 };

const isBlobUrl = (url) => typeof url === 'string' && url.startsWith('blob:');

const getIsDualVideoFromStorage = () => {
  try {
    const saved = localStorage.getItem('tw_bulk_builder_dual_video');
    return saved !== 'false';
  } catch {
    return true;
  }
};

const deriveRowStatus = (row) => {
  if (row.status === 'processing' || row.status === 'saving') return row.status;
  if (row.status === 'done' && (row.resultMediaId || row.resultMediaUrl)) return 'done';
  if (row.status === 'error') return 'error';
  const isDual = getIsDualVideoFromStorage();
  return row.video1 && (!isDual || row.video2) ? 'ready' : 'draft';
};

export const sanitizeBulkRowForStorage = (row) => {
  const sanitized = {
    ...row,
    textSettings: { ...DEFAULT_TEXT_SETTINGS, ...(row.textSettings || {}) },
    dragPos: { ...DEFAULT_DRAG_POS, ...(row.dragPos || {}) },
    canvasPos: row.canvasPos || { x: 100, y: 100 },
    resultVideoUrl: isBlobUrl(row.resultVideoUrl) ? '' : (row.resultVideoUrl || ''),
  };

  return {
    ...sanitized,
    status: deriveRowStatus(sanitized),
  };
};

export const normalizeBulkRowsFromStorage = (rows) => {
  const isDual = getIsDualVideoFromStorage();
  return Array.isArray(rows)
    ? rows.map((row) => {
        const sanitized = sanitizeBulkRowForStorage(row);
        if (sanitized.status === 'processing' || sanitized.status === 'saving') {
          return {
            ...sanitized,
            status: sanitized.video1 && (!isDual || sanitized.video2) ? 'ready' : 'draft',
          };
        }
        return sanitized;
      })
    : [];
};

const createEmptyRow = (index = 0) => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  video1: null,
  video1Url: '',
  video2: null,
  video2Url: '',
  audio: null,
  caption: '',
  textSettings: { ...DEFAULT_TEXT_SETTINGS },
  dragPos: { ...DEFAULT_DRAG_POS },
  canvasPos: {
    x: 50 + (index % 6) * 370,
    y: 80 + Math.floor(index / 6) * 450
  },
  status: 'draft',
  resultMediaId: '',
  resultMediaUrl: '',
  resultMediaName: '',
  resultVideoUrl: '',
});

/**
 * Custom hook managing bulk builder rows with localStorage persistence.
 */
export const useBulkRows = () => {
  const [isDualVideo, setIsDualVideo] = useState(getIsDualVideoFromStorage);
  const [persistenceError, setPersistenceError] = useState('');

  const [rows, setRows] = useState(() => {
    try {
      const saved = normalizeBulkRowsFromStorage(JSON.parse(localStorage.getItem(BULK_ROWS_STORAGE_KEY) || '[]'));
      if (saved.length > 0) return saved;
    } catch { /* ignore parse errors */ }
    return [createEmptyRow(0)];
  });

  const toggleDualVideo = useCallback((val) => {
    setIsDualVideo(val);
    try {
      localStorage.setItem('tw_bulk_builder_dual_video', String(val));
    } catch { /* ignore */ }
    // Force recalculate row statuses for all rows
    setRows((prev) => prev.map((r) => sanitizeBulkRowForStorage(r)));
  }, []);

  // Auto-save to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(BULK_ROWS_STORAGE_KEY, JSON.stringify(rows.map(sanitizeBulkRowForStorage)));
      queueMicrotask(() => setPersistenceError(''));
    } catch (error) {
      console.error('Unable to save the bulk planning board:', error);
      queueMicrotask(() => setPersistenceError('Changes could not be saved in this browser. Keep this page open and remove unused frames or temporary assets.'));
    }
  }, [rows]);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow(prev.length)]);
  }, []);

  const removeRow = useCallback((rowId) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length > 0 ? next : [createEmptyRow(0)];
    });
  }, []);

  const updateRow = useCallback((rowId, partialData) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, ...partialData };
        if (Object.prototype.hasOwnProperty.call(partialData, 'status') || Object.prototype.hasOwnProperty.call(partialData, 'canvasPos')) {
          return sanitizeBulkRowForStorage(updated);
        }
        const isDual = getIsDualVideoFromStorage();
        return {
          ...sanitizeBulkRowForStorage(updated),
          status: updated.video1 && (!isDual || updated.video2) ? 'ready' : 'draft',
          resultMediaId: '',
          resultMediaUrl: '',
          resultMediaName: '',
          resultVideoUrl: '',
        };
      })
    );
  }, []);

  const updateRowTextSettings = useCallback((rowId, partialSettings) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isDual = getIsDualVideoFromStorage();
        return {
          ...r,
          textSettings: { ...r.textSettings, ...partialSettings },
          status: r.video1 && (!isDual || r.video2) ? 'ready' : 'draft',
          resultMediaId: '',
          resultMediaUrl: '',
          resultMediaName: '',
          resultVideoUrl: '',
        };
      })
    );
  }, []);

  const updateRowDragPos = useCallback((rowId, dragPos) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isDual = getIsDualVideoFromStorage();
        return {
          ...r,
          dragPos: { ...DEFAULT_DRAG_POS, ...dragPos },
          status: r.video1 && (!isDual || r.video2) ? 'ready' : 'draft',
          resultMediaId: '',
          resultMediaUrl: '',
          resultMediaName: '',
          resultVideoUrl: '',
        };
      })
    );
  }, []);

  const getReadyRows = useCallback(() => {
    const isDual = getIsDualVideoFromStorage();
    return rows.filter((r) => r.video1 && (!isDual || r.video2) && r.status !== 'done');
  }, [rows]);

  const markRowStatus = useCallback((rowId, status) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, status } : r))
    );
  }, []);

  const clearAllRows = useCallback(() => {
    setRows([createEmptyRow(0)]);
  }, []);

  const addRowsWithFirstVideos = useCallback((video1List) => {
    setRows((prev) => {
      const startIdx = prev.length;
      const newRows = video1List.map((video, idx) => ({
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${Math.random().toString(36).slice(2, 5)}`,
        video1: video,
        video1Url: video.url,
        video2: null,
        video2Url: '',
        audio: null,
        caption: '',
        textSettings: { ...DEFAULT_TEXT_SETTINGS },
        dragPos: { ...DEFAULT_DRAG_POS },
        canvasPos: {
          x: 50 + ((startIdx + idx) % 6) * 370,
          y: 80 + Math.floor((startIdx + idx) / 6) * 450
        },
        status: 'draft',
        resultMediaId: '',
        resultMediaUrl: '',
        resultMediaName: '',
        resultVideoUrl: '',
      }));
      const isEmptyRow = (r) => !r.video1 && !r.video2 && !r.caption && !r.audio;
      if (prev.length === 1 && isEmptyRow(prev[0])) {
        return newRows.map((r, idx) => ({
          ...r,
          canvasPos: {
            x: 50 + (idx % 6) * 370,
            y: 80 + Math.floor(idx / 6) * 450
          }
        }));
      }
      return [...prev, ...newRows];
    });
  }, []);

  return {
    rows,
    addRow,
    removeRow,
    updateRow,
    updateRowTextSettings,
    updateRowDragPos,
    getReadyRows,
    markRowStatus,
    clearAllRows,
    addRowsWithFirstVideos,
    DEFAULT_TEXT_SETTINGS,
    isDualVideo,
    toggleDualVideo,
    persistenceError,
  };
};
