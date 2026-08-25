import { useState, useCallback, useEffect, useRef } from 'react';
import {
  readBulkRowsSnapshot,
  subscribeToBulkRows,
  writeBulkRowsSnapshot,
} from './bulkProjectStore';
import {
  collectAgentReservations,
  queueAgentReservationReleases,
} from './bulkAgentReservations';
import { getActiveCampaignId } from '../../utils/campaignScope';
import {
  bulkRowToProject,
  projectToBulkRow,
  syncBulkRowContent,
  updateClipById,
} from '../videoEditorV2/project';
import { applyTasksToBoard } from './taskDispatcher.js';

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

export const BULK_TEXT_SIZING_VERSION = 1;

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
export const normalizeMediaId = (asset) => String(asset?.mediaId || asset?.id || asset?._id || '');

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
  'textOverlays',
]);

const isStatusOrCanvasOnlyUpdate = (partialData) => {
  const fields = Object.keys(partialData || {});
  return fields.every((field) => NON_CONTENT_ROW_FIELDS.has(field));
};

const hasCanonicalContentUpdate = (partialData) => Object.keys(partialData || {})
  .some((field) => CANONICAL_CONTENT_FIELDS.has(field));

export const getIsDualVideoFromStorage = () => {
  try {
    const saved = localStorage.getItem('tw_bulk_builder_dual_video');
    return saved !== 'false';
  } catch {
    return true;
  }
};

export const deriveRowStatus = (row) => {
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
    textOverlays: Array.isArray(row.textOverlays)
      ? row.textOverlays.map((overlay) => ({
          ...overlay,
          style: { ...(overlay?.style || {}) },
          position: { ...(overlay?.position || {}) },
        }))
      : [],
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

export const createEmptyRow = (index = 0) => ({
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
  textOverlays: [],
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

export const normalizeAgentAsset = (asset) => {
  if (!asset) return null;
  const mediaId = String(asset.mediaId || asset.id || asset._id || '');
  const url = asset.originalUrl || asset.url || '';
  return {
    id: mediaId,
    mediaId,
    name: asset.name || 'Media Library asset',
    sourceType: 'library',
    type: asset.type || 'video',
    mediaType: asset.type || 'video',
    url,
    originalUrl: url,
    thumbnailUrl: asset.thumbnailUrl || '',
    duration: Number(asset.duration || 0),
  };
};

export const normalizeAgentTextOverlays = (overlays) => (
  (Array.isArray(overlays) ? overlays : []).slice(0, 20).flatMap((overlay, index) => {
    const text = String(overlay?.text || '').trim().slice(0, 5000);
    if (!text) return [];
    return [{
      id: String(overlay?.id || `overlay-${index + 1}`).slice(0, 100),
      text,
      binding: ['video1', 'video2', 'bulkVideos', 'custom'].includes(overlay?.binding)
        ? overlay.binding
        : 'video1',
      start: Math.max(0, Math.min(30, Number(overlay?.start) || 0)),
      duration: Math.max(0, Math.min(30, Number(overlay?.duration) || 0)),
      style: { ...(overlay?.style || {}) },
      position: { preset: 'center', ...(overlay?.position || {}) },
    }];
  })
);

export const rowHasPlannedContent = (row) => Boolean(
  row?.video1 || row?.video2 || row?.audio || String(row?.caption || '').trim()
  || row?.textOverlays?.length,
);

export const stripAgentReservations = (row, slots) => {
  if (!row?.agentReservations) return row;
  const reservations = { ...row.agentReservations };
  slots.forEach((slot) => delete reservations[slot]);
  return {
    ...row,
    agentReservations: Object.keys(reservations).length > 0 ? reservations : undefined,
  };
};

const queueRowReservationReleases = (rows, campaignId, slots) => {
  const reservations = collectAgentReservations(rows, slots);
  if (reservations.length > 0) queueAgentReservationReleases(reservations, campaignId);
  return reservations;
};

const createRowFromAgentAssignment = (assignment, index, isDualVideo, planId) => {
  const video1 = normalizeAgentAsset(assignment?.video1);
  const video2 = isDualVideo ? normalizeAgentAsset(assignment?.video2) : null;
  const audio = normalizeAgentAsset(assignment?.audio);
  const caption = String(assignment?.caption || '').trim();
  const textOverlays = normalizeAgentTextOverlays(assignment?.textOverlays);
  const row = {
    ...createEmptyRow(index),
    video1,
    video1Url: video1?.url || '',
    video2,
    video2Url: video2?.url || '',
    audio,
    caption,
    textOverlays,
    agentReservations: {
      ...(video1 ? { video1: { planId, mediaId: normalizeMediaId(video1) } } : {}),
      ...(video2 ? { video2: { planId, mediaId: normalizeMediaId(video2) } } : {}),
      ...(audio ? { audio: { planId, mediaId: normalizeMediaId(audio) } } : {}),
    },
  };
  return sanitizeBulkRowForStorage(syncBulkRowContent(row, {
    video1,
    video1Url: video1?.url || '',
    video2,
    video2Url: video2?.url || '',
    audio,
    caption,
    textOverlays,
  }, {
    isDualVideo,
    clearResult: true,
  }));
};

const AGENT_MEDIA_FIELDS = ['video1', 'video2', 'audio'];
const AGENT_MUTABLE_FIELDS = [...AGENT_MEDIA_FIELDS, 'caption', 'textOverlays'];
const SLOT_URL_FIELDS = { video1: 'video1Url', video2: 'video2Url' };

const getAssignmentChangedFields = (assignment) => {
  const requested = Array.isArray(assignment?.changedFields)
    ? assignment.changedFields
    : AGENT_MUTABLE_FIELDS.filter((field) => (
        Object.prototype.hasOwnProperty.call(assignment || {}, field)
      ));
  return [...new Set(requested)].filter((field) => AGENT_MUTABLE_FIELDS.includes(field));
};

const resolveTargetRowIndex = (rows, assignment) => {
  const targetRowId = String(assignment?.targetRowId || '');
  if (targetRowId) {
    return rows.findIndex((row) => String(row.id) === targetRowId);
  }
  const targetIndex = Number(assignment?.targetIndex);
  return Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < rows.length
    ? targetIndex
    : -1;
};

const createAgentRowPatch = (row, assignment, changedFields, planId, isDualVideo) => {
  const changedSlots = changedFields.filter((field) => AGENT_MEDIA_FIELDS.includes(field));
  let sourceRow = stripAgentReservations(row, changedSlots);
  const patch = {};
  const nextReservations = { ...(sourceRow.agentReservations || {}) };

  changedFields.forEach((field) => {
    if (field === 'caption') {
      patch.caption = String(assignment?.caption || '').trim();
      return;
    }
    if (field === 'textOverlays') {
      patch.textOverlays = normalizeAgentTextOverlays(assignment?.textOverlays);
      return;
    }
    const asset = field === 'video2' && !isDualVideo
      ? null
      : normalizeAgentAsset(assignment?.[field]);
    patch[field] = asset;
    if (SLOT_URL_FIELDS[field]) patch[SLOT_URL_FIELDS[field]] = asset?.url || '';
    if (asset) {
      nextReservations[field] = { planId, mediaId: normalizeMediaId(asset) };
    } else {
      delete nextReservations[field];
    }
  });

  sourceRow = {
    ...sourceRow,
    agentReservations: Object.keys(nextReservations).length > 0 ? nextReservations : undefined,
  };
  return sanitizeBulkRowForStorage(syncBulkRowContent(sourceRow, patch, {
    isDualVideo,
    clearResult: true,
  }));
};

export const cloneValue = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

export const valuesEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const getUndoComparableRow = (row) => ({
  video1: row?.video1 || null,
  video1Url: row?.video1Url || '',
  video2: row?.video2 || null,
  video2Url: row?.video2Url || '',
  audio: row?.audio || null,
  caption: row?.caption || '',
  textOverlays: row?.textOverlays || [],
  agentReservations: row?.agentReservations || null,
});

export const hasAppliedAgentPlan = (rows, planId) => Boolean(
  planId && (rows || []).some((row) => row?.agentBoardRevisionPlanId === String(planId)),
);

/**
 * Custom hook managing bulk builder rows with localStorage persistence.
 */
export const useBulkRows = ({ campaignId = getActiveCampaignId() } = {}) => {
  const [isDualVideo, setIsDualVideo] = useState(getIsDualVideoFromStorage);
  const [persistenceError, setPersistenceError] = useState('');
  const lastPersistedSnapshotRef = useRef('');

  const [rows, setRows] = useState(() => {
    try {
      const saved = normalizeBulkRowsFromStorage(readBulkRowsSnapshot(campaignId));
      if (saved.length > 0) return saved;
    } catch { /* ignore parse errors */ }
    return [createEmptyRow(0)];
  });
  const rowsRef = useRef(rows);
  const campaignIdRef = useRef(campaignId);
  const skipNextCampaignPersistenceRef = useRef(false);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (campaignIdRef.current === campaignId) return;
    campaignIdRef.current = campaignId;
    skipNextCampaignPersistenceRef.current = true;
    const storedRows = normalizeBulkRowsFromStorage(readBulkRowsSnapshot(campaignId));
    const nextRows = storedRows.length > 0 ? storedRows : [createEmptyRow(0)];
    rowsRef.current = nextRows;
    lastPersistedSnapshotRef.current = JSON.stringify(storedRows);
    setRows(nextRows);
  }, [campaignId]);

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
    if (skipNextCampaignPersistenceRef.current) {
      skipNextCampaignPersistenceRef.current = false;
      return;
    }
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
      writeBulkRowsSnapshot(synchronizedRows, { source: 'bulk-board', campaignId });
      lastPersistedSnapshotRef.current = snapshot;
      queueMicrotask(() => setPersistenceError(''));
    } catch (error) {
      console.error('Unable to save the bulk planning board:', error);
      queueMicrotask(() => setPersistenceError('Changes could not be saved in this browser. Keep this page open and remove unused frames or temporary assets.'));
    }
  }, [campaignId, rows]);

  useEffect(() => subscribeToBulkRows(({ source }) => {
    if (source === 'bulk-board') return;
    try {
      const storedRows = readBulkRowsSnapshot(campaignId);
      lastPersistedSnapshotRef.current = JSON.stringify(storedRows);
      const nextRows = normalizeBulkRowsFromStorage(storedRows);
      setRows(nextRows.length > 0 ? nextRows : [createEmptyRow(0)]);
    } catch {
      // Keep the current in-memory board when an external snapshot is invalid.
    }
  }, { campaignId }), [campaignId]);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow(prev.length)]);
  }, []);

  const removeRow = useCallback((rowId) => {
    const removedRow = rowsRef.current.find((row) => row.id === rowId);
    if (removedRow) queueRowReservationReleases(removedRow, campaignId);
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      return next.length > 0 ? next : [createEmptyRow(0)];
    });
  }, [campaignId]);

  const updateRow = useCallback((rowId, partialData) => {
    const currentRow = rowsRef.current.find((row) => row.id === rowId);
    const replacedSlots = ['video1', 'video2', 'audio'].filter((slot) => (
      Object.prototype.hasOwnProperty.call(partialData || {}, slot)
      && normalizeMediaId(partialData?.[slot]) !== normalizeMediaId(currentRow?.[slot])
    ));
    if (currentRow && replacedSlots.length > 0) {
      queueRowReservationReleases(currentRow, campaignId, replacedSlots);
    }
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const sourceRow = stripAgentReservations(r, replacedSlots);
        const updated = { ...sourceRow, ...partialData };
        if (isStatusOrCanvasOnlyUpdate(partialData)) {
          return sanitizeBulkRowForStorage(updated);
        }
        const isDual = getIsDualVideoFromStorage();
        if (hasCanonicalContentUpdate(partialData)) {
          return sanitizeBulkRowForStorage(syncBulkRowContent(sourceRow, partialData, {
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
  }, [campaignId]);

  const updateRowCanvasPositions = useCallback((positionsByRowId) => {
    setRows((prev) => prev.map((row) => {
      const nextCanvasPos = positionsByRowId?.[row.id];
      if (!nextCanvasPos) return row;
      if (
        row.canvasPos?.x === nextCanvasPos.x
        && row.canvasPos?.y === nextCanvasPos.y
      ) {
        return row;
      }
      return sanitizeBulkRowForStorage({
        ...row,
        canvasPos: nextCanvasPos,
      });
    }));
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
    const currentRow = rowsRef.current.find((row) => row.id === rowId);
    const dualVideoEnabled = getIsDualVideoFromStorage();
    let replacedSlots = [];
    if (currentRow) {
      const currentProject = bulkRowToProject(currentRow, { isDualVideo: dualVideoEnabled });
      const nextProject = updateClipById(currentProject, clipId, changes);
      const candidateRow = projectToBulkRow(nextProject, currentRow, {
        isDualVideo: dualVideoEnabled,
        clearResult: true,
      });
      replacedSlots = ['video1', 'video2', 'audio'].filter((slot) => (
        normalizeMediaId(currentRow[slot]) !== normalizeMediaId(candidateRow[slot])
      ));
      if (replacedSlots.length > 0) {
        queueRowReservationReleases(currentRow, campaignId, replacedSlots);
      }
    }
    setRows((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      const project = bulkRowToProject(row, { isDualVideo: dualVideoEnabled });
      const nextProject = updateClipById(project, clipId, changes);

      return sanitizeBulkRowForStorage(projectToBulkRow(
        nextProject,
        stripAgentReservations(row, replacedSlots),
        {
        isDualVideo: dualVideoEnabled,
        clearResult: true,
        },
      ));
    }));
  }, [campaignId]);

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
    queueRowReservationReleases(rowsRef.current, campaignId);
    setRows([createEmptyRow(0)]);
  }, [campaignId]);

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

  const applyAgentPlan = useCallback((plan) => {
    const assignments = Array.isArray(plan?.assignments) ? plan.assignments : [];
    const operation = plan?.operation || 'append';
    if (assignments.length === 0 && !['clear', 'remove'].includes(operation)) return null;

    const planId = String(plan?.id || '');
    const dualVideoEnabled = typeof plan?.isDualVideo === 'boolean'
      ? plan.isDualVideo
      : getIsDualVideoFromStorage();
    const previousRows = rowsRef.current;

    const {
      nextRows,
      changeSet,
      reservationsToRelease,
      alreadyApplied,
    } = applyTasksToBoard({
      tasks: Array.isArray(plan?.tasks) ? plan.tasks : [],
      assignments,
      operation,
      planId,
      isDualVideo: dualVideoEnabled,
      currentRows: previousRows,
      targetRows: plan?.targetRows || [],
      targetIndexes: plan?.targetIndexes || [],
      targetRowIds: plan?.targetRowIds || [],
    });

    if (alreadyApplied) {
      return changeSet;
    }

    rowsRef.current = nextRows;
    writeBulkRowsSnapshot(nextRows, { source: 'bulk-board', campaignId });
    lastPersistedSnapshotRef.current = JSON.stringify(nextRows);
    setRows(nextRows);
    if (reservationsToRelease.length > 0) {
      queueAgentReservationReleases(reservationsToRelease, campaignId);
    }
    return changeSet;
  }, [campaignId]);

  const undoAgentPlan = useCallback((changeSet) => {
    if (!changeSet) return [];
    let nextRows = [...rowsRef.current];
    const releasedReservations = [];

    (changeSet.updatedRows || []).forEach((change) => {
      const rowIndex = nextRows.findIndex((row) => String(row.id) === String(change.rowId));
      if (rowIndex < 0) return;
      let nextRow = nextRows[rowIndex];
      let changed = false;
      (change.fields || []).forEach((field) => {
        if (!valuesEqual(nextRow[field], change.after?.[field])) return;
        if (['video1', 'video2', 'audio'].includes(field)) {
          releasedReservations.push(...collectAgentReservations(nextRow, [field]));
        }
        nextRow = { ...nextRow, [field]: cloneValue(change.before?.[field]) };
        changed = true;
      });
      if (changed) nextRows[rowIndex] = sanitizeBulkRowForStorage(nextRow);
    });

    const addedIds = new Set((changeSet.addedRows || []).map(({ row }) => String(row.id)));
    nextRows = nextRows.filter((row) => {
      if (!addedIds.has(String(row.id))) return true;
      const appliedRow = (changeSet.addedRows || []).find(({ row: candidate }) => (
        String(candidate.id) === String(row.id)
      ))?.row;
      if (!valuesEqual(getUndoComparableRow(row), getUndoComparableRow(appliedRow))) return true;
      releasedReservations.push(...collectAgentReservations(row));
      return false;
    });

    [...(changeSet.removedRows || [])]
      .sort((left, right) => left.index - right.index)
      .forEach(({ row, index }) => {
        if (nextRows.some((candidate) => String(candidate.id) === String(row.id))) return;
        nextRows.splice(Math.min(Math.max(0, index), nextRows.length), 0, row);
      });

    nextRows = nextRows.map((row) => (
      row.agentBoardRevisionPlanId === changeSet.planId
        ? { ...row, agentBoardRevisionPlanId: undefined }
        : row
    ));

    if (nextRows.length === 0) nextRows = [createEmptyRow(0)];
    rowsRef.current = nextRows;
    writeBulkRowsSnapshot(nextRows, { source: 'bulk-board', campaignId });
    lastPersistedSnapshotRef.current = JSON.stringify(nextRows);
    setRows(nextRows);
    if (releasedReservations.length > 0) {
      queueAgentReservationReleases(releasedReservations, campaignId);
    }
    return releasedReservations;
  }, [campaignId]);

  const restoreRows = useCallback((snapshot) => {
    const normalized = normalizeBulkRowsFromStorage(snapshot);
    setRows(normalized.length > 0 ? normalized : [createEmptyRow(0)]);
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
    updateRowCanvasPositions,
    updateRowVideoDuration,
    updateRowTextSettings,
    updateRowDragPos,
    updateRowEditorClip,
    getReadyRows,
    markRowStatus,
    clearAllRows,
    addRowsWithFirstVideos,
    applyAgentPlan,
    undoAgentPlan,
    restoreRows,
    DEFAULT_TEXT_SETTINGS,
    isDualVideo,
    toggleDualVideo,
    persistenceError,
  };
};
