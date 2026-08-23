import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BULK_ROWS_STORAGE_KEY,
  subscribeToBulkRows,
  writeBulkRowsSnapshot,
} from './bulkProjectStore';
import {
  bulkRowToProject,
  projectToBulkRow,
  syncBulkRowContent,
  updateClipById,
} from '../videoEditorV2/project';

export { BULK_ROWS_STORAGE_KEY } from './bulkProjectStore';

export const DEFAULT_TEXT_SETTINGS = {
  fontFamily: 'TikTok Sans',
  fontWeight: 'SemiBold',
  // Bulk controls use the 270px preview coordinate space. These values map
  // exactly to 40px text and a 3px stroke in the 720px timeline output.
  fontSize: 15,
  fontColor: '#FFFFFF',
  strokeWidth: 1.125,
  strokeColor: '#000000',
  bgType: 'None',
  bgColor: '#000000',
};

// Keep incomplete rows created by older releases visually stable. New rows are
// explicitly stamped with DEFAULT_TEXT_SETTINGS below.
const STORED_TEXT_SETTINGS_FALLBACK = {
  ...DEFAULT_TEXT_SETTINGS,
  fontWeight: 'Regular',
  fontSize: 15,
  strokeWidth: 3,
};

const BULK_TEXT_SIZING_VERSION = 1;

const hasUnscaledTimelineDefaults = (settings = {}) => (
  settings.fontFamily === 'TikTok Sans'
  && settings.fontWeight === 'SemiBold'
  && Number(settings.fontSize) === 40
  && Number(settings.strokeWidth) === 3
);

const getTextDefaultMigrationPatch = (row) => (
  hasUnscaledTimelineDefaults(row?.textSettings)
    ? {
        textSettings: {
          ...row.textSettings,
          fontSize: DEFAULT_TEXT_SETTINGS.fontSize,
          strokeWidth: DEFAULT_TEXT_SETTINGS.strokeWidth,
        },
      }
    : null
);

const hasScaledTimelineDefaults = (settings = {}) => (
  settings.fontFamily === DEFAULT_TEXT_SETTINGS.fontFamily
  && settings.fontWeight === DEFAULT_TEXT_SETTINGS.fontWeight
  && Number(settings.fontSize) === DEFAULT_TEXT_SETTINGS.fontSize
  && Math.abs(Number(settings.strokeWidth) - DEFAULT_TEXT_SETTINGS.strokeWidth) < 0.01
);

export const DEFAULT_DRAG_POS = { x: 20, y: 220 };

const isBlobUrl = (url) => typeof url === 'string' && url.startsWith('blob:');

const NON_CONTENT_ROW_FIELDS = new Set(['status', 'canvasPos']);
const CANONICAL_CONTENT_FIELDS = new Set([
  'video1',
  'video1Url',
  'video2',
  'video2Url',
  'audio',
  'caption',
  'textSettings',
  'dragPos',
]);

const isStatusOrCanvasOnlyUpdate = (partialData) => {
  const fields = Object.keys(partialData || {});
  return fields.every((field) => NON_CONTENT_ROW_FIELDS.has(field));
};

const hasCanonicalContentUpdate = (partialData) => Object.keys(partialData || {})
  .some((field) => CANONICAL_CONTENT_FIELDS.has(field));

const getIsDualVideoFromStorage = () => {
  try {
    const saved = localStorage.getItem('tw_bulk_builder_dual_video');
    return saved !== 'false';
  } catch {
    return true;
  }
};

const deriveRowStatus = (row) => {
  if (['queued', 'processing', 'exporting', 'saving', 'uploading'].includes(row.status)) {
    return row.status;
  }
  if (row.status === 'done' && (row.resultMediaId || row.resultMediaUrl)) return 'done';
  if (row.status === 'error') return 'error';
  const isDual = getIsDualVideoFromStorage();
  return row.video1 && (!isDual || row.video2) ? 'ready' : 'draft';
};

export const sanitizeBulkRowForStorage = (row) => {
  const sanitized = {
    ...row,
    textSettings: { ...STORED_TEXT_SETTINGS_FALLBACK, ...(row.textSettings || {}) },
    dragPos: { ...DEFAULT_DRAG_POS, ...(row.dragPos || {}) },
    canvasPos: row.canvasPos || { x: 100, y: 100 },
    resultVideoUrl: isBlobUrl(row.resultVideoUrl) ? '' : (row.resultVideoUrl || ''),
  };

  return {
    ...sanitized,
    status: deriveRowStatus(sanitized),
  };
};

export const normalizeBulkRowsFromStorage = (rows, { resetTransientStatus = false } = {}) => {
  const isDual = getIsDualVideoFromStorage();
  return Array.isArray(rows)
    ? rows.map((row) => {
        const migrationPatch = getTextDefaultMigrationPatch(row);
        const shouldRepairTextGeometry = Boolean(migrationPatch) || (
          row?.bulkTextSizingVersion !== BULK_TEXT_SIZING_VERSION
          && hasScaledTimelineDefaults(row?.textSettings)
        );
        const sanitized = sanitizeBulkRowForStorage(
          shouldRepairTextGeometry
            ? {
                ...row,
                ...(migrationPatch || {}),
                bulkTextSizingVersion: BULK_TEXT_SIZING_VERSION,
              }
            : row,
        );
        const synchronized = syncBulkRowContent(
          sanitized,
          migrationPatch || (shouldRepairTextGeometry
            ? { textSettings: sanitized.textSettings }
            : {}),
          {
            isDualVideo: isDual,
            resetTextGeometry: shouldRepairTextGeometry,
          },
        );
        if (
          resetTransientStatus
          && (synchronized.status === 'processing' || synchronized.status === 'saving')
        ) {
          return {
            ...synchronized,
            status: synchronized.video1 && (!isDual || synchronized.video2) ? 'ready' : 'draft',
          };
        }
        return synchronized;
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
  bulkTextSizingVersion: BULK_TEXT_SIZING_VERSION,
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
  const lastPersistedSnapshotRef = useRef('');

  const [rows, setRows] = useState(() => {
    try {
      const saved = normalizeBulkRowsFromStorage(
        JSON.parse(localStorage.getItem(BULK_ROWS_STORAGE_KEY) || '[]'),
      );
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
      const dualVideoEnabled = getIsDualVideoFromStorage();
      const synchronizedRows = rows.map((row) => sanitizeBulkRowForStorage(
        syncBulkRowContent(row, {}, {
          isDualVideo: dualVideoEnabled,
          clearResult: false,
        }),
      ));
      const snapshot = JSON.stringify(synchronizedRows);
      if (snapshot === lastPersistedSnapshotRef.current) return;
      writeBulkRowsSnapshot(synchronizedRows, { source: 'bulk-board' });
      lastPersistedSnapshotRef.current = snapshot;
      queueMicrotask(() => setPersistenceError(''));
    } catch (error) {
      console.error('Unable to save the bulk planning board:', error);
      queueMicrotask(() => setPersistenceError('Changes could not be saved in this browser. Keep this page open and remove unused frames or temporary assets.'));
    }
  }, [rows]);

  useEffect(() => subscribeToBulkRows(({ source }) => {
    if (source === 'bulk-board') return;
    try {
      const storedRows = JSON.parse(localStorage.getItem(BULK_ROWS_STORAGE_KEY) || '[]');
      lastPersistedSnapshotRef.current = JSON.stringify(storedRows);
      const nextRows = normalizeBulkRowsFromStorage(storedRows);
      setRows(nextRows.length > 0 ? nextRows : [createEmptyRow(0)]);
    } catch {
      // Keep the current in-memory board when an external snapshot is invalid.
    }
  }), []);

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
        if (isStatusOrCanvasOnlyUpdate(partialData)) {
          return sanitizeBulkRowForStorage(updated);
        }
        const isDual = getIsDualVideoFromStorage();
        if (hasCanonicalContentUpdate(partialData)) {
          return sanitizeBulkRowForStorage(syncBulkRowContent(r, partialData, {
            isDualVideo: isDual,
            clearResult: true,
          }));
        }
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
        return sanitizeBulkRowForStorage(syncBulkRowContent(r, {
          textSettings: partialSettings,
        }, {
          isDualVideo: isDual,
          clearResult: true,
        }));
      })
    );
  }, []);

  const updateRowDragPos = useCallback((rowId, dragPos) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const isDual = getIsDualVideoFromStorage();
        return sanitizeBulkRowForStorage(syncBulkRowContent(r, {
          dragPos: { ...DEFAULT_DRAG_POS, ...dragPos },
        }, {
          isDualVideo: isDual,
          clearResult: true,
        }));
      })
    );
  }, []);

  const updateRowEditorClip = useCallback((rowId, clipId, changes) => {
    setRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      const dualVideoEnabled = getIsDualVideoFromStorage();
      const project = bulkRowToProject(row, { isDualVideo: dualVideoEnabled });
      const nextProject = updateClipById(project, clipId, changes);

      return sanitizeBulkRowForStorage(projectToBulkRow(nextProject, row, {
        isDualVideo: dualVideoEnabled,
        clearResult: true,
      }));
    }));
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
        bulkTextSizingVersion: BULK_TEXT_SIZING_VERSION,
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

  const updateRowVideoDuration = useCallback((rowId, slot, duration) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const currentMedia = r[slot];
        if (currentMedia && Math.abs((Number(currentMedia.duration) || 0) - duration) < 0.05) {
          return r;
        }
        const updatedMedia = currentMedia
          ? { ...currentMedia, duration }
          : { url: r[`${slot}Url`] || '', duration };
        const isDual = getIsDualVideoFromStorage();
        const updatedRow = {
          ...r,
          [slot]: updatedMedia,
          [`${slot}Url`]: updatedMedia.url || r[`${slot}Url`] || '',
        };
        const synchronized = syncBulkRowContent(
          updatedRow,
          { [slot]: updatedMedia },
          {
            isDualVideo: isDual,
            videoDurations: { [slot]: duration },
            clearResult: false,
          },
        );
        return sanitizeBulkRowForStorage(synchronized);
      })
    );
  }, []);

  return {
    rows,
    addRow,
    removeRow,
    updateRow,
    updateRowVideoDuration,
    updateRowTextSettings,
    updateRowDragPos,
    updateRowEditorClip,
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
