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

const deriveRowStatus = (row) => {
  if (row.status === 'processing' || row.status === 'saving') return row.status;
  if (row.status === 'done' && (row.resultMediaId || row.resultMediaUrl)) return 'done';
  if (row.status === 'error') return 'error';
  return row.video1 && row.video2 ? 'ready' : 'draft';
};

export const sanitizeBulkRowForStorage = (row) => {
  const sanitized = {
    ...row,
    textSettings: { ...DEFAULT_TEXT_SETTINGS, ...(row.textSettings || {}) },
    dragPos: { ...DEFAULT_DRAG_POS, ...(row.dragPos || {}) },
    resultVideoUrl: isBlobUrl(row.resultVideoUrl) ? '' : (row.resultVideoUrl || ''),
  };

  return {
    ...sanitized,
    status: deriveRowStatus(sanitized),
  };
};

export const normalizeBulkRowsFromStorage = (rows) => (
  Array.isArray(rows)
    ? rows.map((row) => {
        const sanitized = sanitizeBulkRowForStorage(row);
        if (sanitized.status === 'processing' || sanitized.status === 'saving') {
          return {
            ...sanitized,
            status: sanitized.video1 && sanitized.video2 ? 'ready' : 'draft',
          };
        }
        return sanitized;
      })
    : []
);

const createEmptyRow = () => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  video1: null,
  video1Url: '',
  video2: null,
  video2Url: '',
  audio: null,
  caption: '',
  textSettings: { ...DEFAULT_TEXT_SETTINGS },
  dragPos: { ...DEFAULT_DRAG_POS },
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
  const [rows, setRows] = useState(() => {
    try {
      const saved = normalizeBulkRowsFromStorage(JSON.parse(localStorage.getItem(BULK_ROWS_STORAGE_KEY) || '[]'));
      if (saved.length > 0) return saved;
    } catch { /* ignore parse errors */ }
    return [createEmptyRow()];
  });

  // Auto-save to localStorage on every change
  useEffect(() => {
    localStorage.setItem(BULK_ROWS_STORAGE_KEY, JSON.stringify(rows.map(sanitizeBulkRowForStorage)));
  }, [rows]);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((rowId) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  }, []);

  const updateRow = useCallback((rowId, partialData) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, ...partialData };
        if (Object.prototype.hasOwnProperty.call(partialData, 'status')) {
          return sanitizeBulkRowForStorage(updated);
        }
        return {
          ...sanitizeBulkRowForStorage(updated),
          status: updated.video1 && updated.video2 ? 'ready' : 'draft',
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
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              textSettings: { ...r.textSettings, ...partialSettings },
              status: r.video1 && r.video2 ? 'ready' : 'draft',
              resultMediaId: '',
              resultMediaUrl: '',
              resultMediaName: '',
              resultVideoUrl: '',
            }
          : r
      )
    );
  }, []);

  const updateRowDragPos = useCallback((rowId, dragPos) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              dragPos: { ...DEFAULT_DRAG_POS, ...dragPos },
              status: r.video1 && r.video2 ? 'ready' : 'draft',
              resultMediaId: '',
              resultMediaUrl: '',
              resultMediaName: '',
              resultVideoUrl: '',
            }
          : r
      )
    );
  }, []);

  const getReadyRows = useCallback(() => {
    return rows.filter((r) => r.video1 && r.video2 && r.status !== 'done');
  }, [rows]);

  const markRowStatus = useCallback((rowId, status) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, status } : r))
    );
  }, []);

  const clearAllRows = useCallback(() => {
    setRows([createEmptyRow()]);
  }, []);

  const addRowsWithFirstVideos = useCallback((video1List) => {
    setRows((prev) => {
      const newRows = video1List.map((video) => ({
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${Math.random().toString(36).slice(2, 5)}`,
        video1: video,
        video1Url: video.url,
        video2: null,
        video2Url: '',
        audio: null,
        caption: '',
        textSettings: { ...DEFAULT_TEXT_SETTINGS },
        dragPos: { ...DEFAULT_DRAG_POS },
        status: 'draft',
        resultMediaId: '',
        resultMediaUrl: '',
        resultMediaName: '',
        resultVideoUrl: '',
      }));
      const isEmptyRow = (r) => !r.video1 && !r.video2 && !r.caption && !r.audio;
      if (prev.length === 1 && isEmptyRow(prev[0])) {
        return newRows;
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
  };
};
