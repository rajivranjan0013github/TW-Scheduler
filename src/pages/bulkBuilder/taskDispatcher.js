import {
  collectAgentReservations,
} from './bulkAgentReservations.js';
import { syncBulkRowContent } from '../videoEditorV2/project';
import {
  BULK_TEXT_SIZING_VERSION,
  DEFAULT_DRAG_POS,
  DEFAULT_TEXT_SETTINGS,
  createEmptyRow,
  normalizeAgentAsset,
  normalizeAgentTextOverlays,
  normalizeMediaId,
  rowHasPlannedContent,
  sanitizeBulkRowForStorage,
  stripAgentReservations,
  cloneValue,
  valuesEqual,
  hasAppliedAgentPlan,
} from './useBulkRows.js';

const AGENT_MEDIA_FIELDS = ['video1', 'video2', 'audio'];
const AGENT_MUTABLE_FIELDS = [...AGENT_MEDIA_FIELDS, 'caption', 'textOverlays'];
const SLOT_URL_FIELDS = { video1: 'video1Url', video2: 'video2Url' };

export const resolveTargetRowIndexes = (rows, target = {}) => {
  const scope = target?.scope || 'allFrames';
  if (scope === 'board' || scope === 'allFrames' || scope === 'allCaptions') {
    return rows.map((_, index) => index);
  }
  if (scope === 'frameNumbers') {
    const frameNumbers = Array.isArray(target?.frameNumbers) ? target.frameNumbers : [];
    const indexSet = new Set(frameNumbers.map((num) => Number(num) - 1));
    return rows.map((_, index) => index).filter((index) => indexSet.has(index));
  }
  if (target?.rowId) {
    const index = rows.findIndex((row) => String(row.id) === String(target.rowId));
    return index >= 0 ? [index] : [];
  }
  if (Number.isInteger(target?.index) && target.index >= 0 && target.index < rows.length) {
    return [target.index];
  }
  return [];
};

/**
 * Task: createFrames
 */
export const executeCreateFrames = (rows, count, isDualVideo, planId) => {
  const safeCount = Math.max(1, Math.min(100, Number(count) || 1));
  const newRows = [];
  for (let i = 0; i < safeCount; i += 1) {
    const plannedRow = {
      ...createEmptyRow(rows.length + i),
      ...(planId ? { agentOriginPlanId: planId, agentBoardRevisionPlanId: planId } : {}),
    };
    newRows.push(sanitizeBulkRowForStorage(plannedRow));
  }
  return newRows;
};

/**
 * Task: updateTextStyle
 */
export const executeUpdateTextStyle = (rows, target, style, isDualVideo) => {
  const targetIndexes = new Set(resolveTargetRowIndexes(rows, target));
  if (targetIndexes.size === 0 || !style) return rows;

  return rows.map((row, index) => {
    if (!targetIndexes.has(index)) return row;
    const currentSettings = row.textSettings || DEFAULT_TEXT_SETTINGS;
    const nextSettings = { ...currentSettings, ...style };
    return sanitizeBulkRowForStorage(syncBulkRowContent(row, {
      textSettings: nextSettings,
    }, {
      isDualVideo,
      clearResult: true,
    }));
  });
};

/**
 * Task: setTextPosition
 */
export const executeSetTextPosition = (rows, target, position, isDualVideo) => {
  const targetIndexes = new Set(resolveTargetRowIndexes(rows, target));
  if (targetIndexes.size === 0 || !position) return rows;

  return rows.map((row, index) => {
    if (!targetIndexes.has(index)) return row;
    let nextDragPos = row.dragPos || DEFAULT_DRAG_POS;
    if (position.preset) {
      const preset = String(position.preset).toLowerCase();
      if (preset.includes('top')) nextDragPos = { x: 20, y: 40 };
      else if (preset.includes('bottom')) nextDragPos = { x: 20, y: 220 };
      else nextDragPos = { x: 20, y: 130 };
    } else if (Number.isFinite(position.x) || Number.isFinite(position.y)) {
      nextDragPos = {
        x: Number.isFinite(position.x) ? position.x * 270 : (row.dragPos?.x ?? 20),
        y: Number.isFinite(position.y) ? position.y * 350 : (row.dragPos?.y ?? 220),
      };
    }
    return sanitizeBulkRowForStorage(syncBulkRowContent(row, {
      dragPos: nextDragPos,
    }, {
      isDualVideo,
      clearResult: true,
    }));
  });
};

/**
 * Task: addTextOverlay / updateTextContent
 */
export const executeAddTextOverlay = (rows, target, overlayData, isDualVideo) => {
  const targetIndexes = new Set(resolveTargetRowIndexes(rows, target));
  if (targetIndexes.size === 0) return rows;
  const text = typeof overlayData === 'string' ? overlayData : String(overlayData?.text || '');

  return rows.map((row, index) => {
    if (!targetIndexes.has(index)) return row;
    return sanitizeBulkRowForStorage(syncBulkRowContent(row, {
      caption: text,
      ...(overlayData?.overlays ? { textOverlays: overlayData.overlays } : {}),
    }, {
      isDualVideo,
      clearResult: true,
    }));
  });
};

/**
 * Task: removeText
 */
export const executeRemoveText = (rows, target, isDualVideo) => {
  const targetIndexes = new Set(resolveTargetRowIndexes(rows, target));
  if (targetIndexes.size === 0) return rows;

  return rows.map((row, index) => {
    if (!targetIndexes.has(index)) return row;
    return sanitizeBulkRowForStorage(syncBulkRowContent(row, {
      caption: '',
      textOverlays: [],
    }, {
      isDualVideo,
      clearResult: true,
    }));
  });
};

/**
 * Task: removeAudio
 */
export const executeRemoveAudio = (rows, target, isDualVideo) => {
  const targetIndexes = new Set(resolveTargetRowIndexes(rows, target));
  if (targetIndexes.size === 0) return rows;

  return rows.map((row, index) => {
    if (!targetIndexes.has(index)) return row;
    const stripped = stripAgentReservations(row, ['audio']);
    return sanitizeBulkRowForStorage(syncBulkRowContent(stripped, {
      audio: null,
    }, {
      isDualVideo,
      clearResult: true,
    }));
  });
};

/**
 * Main Dispatcher: Orchestrates execution of tasks & assignments onto planning board.
 */
export const applyTasksToBoard = ({
  tasks = [],
  assignments = [],
  operation = 'append',
  planId = '',
  isDualVideo = true,
  currentRows = [],
  targetRows = [],
  targetIndexes: inputTargetIndexes = [],
  targetRowIds: inputTargetRowIds = [],
}) => {
  if (hasAppliedAgentPlan(currentRows, planId)) {
    return {
      planId,
      operation,
      alreadyApplied: true,
      addedRows: [],
      removedRows: [],
      updatedRows: [],
      nextRows: currentRows,
      reservationsToRelease: [],
    };
  }

  let nextRows = [...currentRows];
  const changeSet = {
    planId,
    operation,
    addedRows: [],
    removedRows: [],
    updatedRows: [],
  };
  const reservationsToRelease = [];

  // Operation 1: replace or clear
  if (operation === 'replace' || operation === 'clear') {
    changeSet.removedRows = currentRows.map((row, index) => ({
      row: cloneValue(stripAgentReservations(row, ['video1', 'video2', 'audio'])),
      index,
    }));
    reservationsToRelease.push(...collectAgentReservations(currentRows));
    nextRows = [];
  }

  // Operation 2: append or replace (insert assignments)
  if (operation === 'append' || operation === 'replace') {
    if (operation === 'append') {
      const retainedRows = nextRows.filter(rowHasPlannedContent);
      const retainedIds = new Set(retainedRows.map((row) => row.id));
      nextRows.forEach((row, index) => {
        if (!retainedIds.has(row.id)) {
          changeSet.removedRows.push({ row: cloneValue(row), index });
        }
      });
      nextRows = retainedRows;
    }

    // If assignments exist, construct rows from assignments
    if (assignments.length > 0) {
      assignments.forEach((assignment) => {
        const video1 = normalizeAgentAsset(assignment?.video1);
        const video2 = isDualVideo ? normalizeAgentAsset(assignment?.video2) : null;
        const audio = normalizeAgentAsset(assignment?.audio);
        const caption = String(assignment?.caption || '').trim();
        const textOverlays = normalizeAgentTextOverlays(assignment?.textOverlays);
        const plannedRow = {
          ...createEmptyRow(nextRows.length),
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
          agentOriginPlanId: planId,
          agentBoardRevisionPlanId: planId,
        };
        const synchronizedRow = sanitizeBulkRowForStorage(syncBulkRowContent(plannedRow, {
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
        changeSet.addedRows.push({ row: cloneValue(synchronizedRow), index: nextRows.length });
        nextRows.push(synchronizedRow);
      });
    } else {
      // Execute createFrames task directly if no media assignments (e.g. blank frame creation)
      const createTask = tasks.find((task) => task.type === 'createFrames');
      const count = createTask?.params?.count || 1;
      const created = executeCreateFrames(nextRows, count, isDualVideo, planId);
      created.forEach((row) => {
        changeSet.addedRows.push({ row: cloneValue(row), index: nextRows.length });
        nextRows.push(row);
      });
    }
  } else if (operation === 'update') {
    // Apply granular assignment updates
    assignments.forEach((assignment) => {
      let rowIndex = -1;
      const targetRowId = String(assignment?.targetRowId || '');
      if (targetRowId) {
        rowIndex = nextRows.findIndex((row) => String(row.id) === targetRowId);
      } else if (Number.isInteger(Number(assignment?.targetIndex))) {
        rowIndex = Number(assignment.targetIndex);
      }
      if (rowIndex < 0 || rowIndex >= nextRows.length) return;

      const beforeRow = nextRows[rowIndex];
      const changedFields = Array.isArray(assignment?.changedFields)
        ? assignment.changedFields
        : AGENT_MUTABLE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(assignment || {}, field));
      if (changedFields.length === 0) return;

      const changedSlots = changedFields.filter((field) => AGENT_MEDIA_FIELDS.includes(field));
      reservationsToRelease.push(...collectAgentReservations(beforeRow, changedSlots));

      let sourceRow = stripAgentReservations(beforeRow, changedSlots);
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
      const afterRow = sanitizeBulkRowForStorage(syncBulkRowContent(sourceRow, patch, {
        isDualVideo,
        clearResult: true,
      }));

      const trackedFields = [...new Set([
        ...changedFields,
        ...changedSlots.map((slot) => SLOT_URL_FIELDS[slot]).filter(Boolean),
        'agentReservations',
      ])];
      changeSet.updatedRows.push({
        rowId: String(beforeRow.id),
        fields: trackedFields,
        before: Object.fromEntries(trackedFields.map((field) => [
          field,
          cloneValue(field === 'agentReservations'
            ? stripAgentReservations(beforeRow, changedSlots).agentReservations
            : beforeRow[field]),
        ])),
        after: Object.fromEntries(trackedFields.map((field) => [field, cloneValue(afterRow[field])])),
      });
      nextRows[rowIndex] = afterRow;
    });

    // Execute standalone non-media tasks if present
    tasks.forEach((task) => {
      if (task.type === 'updateTextStyle' && task.params?.style) {
        nextRows = executeUpdateTextStyle(nextRows, task.target, task.params.style, isDualVideo);
      } else if (task.type === 'setTextPosition' && task.params) {
        nextRows = executeSetTextPosition(nextRows, task.target, task.params, isDualVideo);
      } else if (task.type === 'removeText') {
        nextRows = executeRemoveText(nextRows, task.target, isDualVideo);
      } else if (task.type === 'removeAudio') {
        nextRows = executeRemoveAudio(nextRows, task.target, isDualVideo);
      }
    });
  } else if (operation === 'remove') {
    const targets = (inputTargetRowIds || []).map((rowId) => ({ rowId: String(rowId) }));
    if (targets.length === 0) {
      (inputTargetIndexes || []).forEach((index) => targets.push({ index: Number(index) }));
    }
    (targetRows || []).forEach((target) => {
      if (typeof target === 'string') targets.push({ rowId: target });
      else if (typeof target === 'number') targets.push({ index: target });
      else targets.push({
        rowId: target?.rowId ? String(target.rowId) : '',
        index: Number(target?.index ?? target?.targetIndex),
      });
    });
    assignments.forEach((assignment) => {
      targets.push({
        rowId: assignment?.targetRowId ? String(assignment.targetRowId) : '',
        index: Number(assignment?.targetIndex),
      });
    });
    const removedIndexes = new Set();
    targets.forEach((target) => {
      const rowIndex = target.rowId
        ? nextRows.findIndex((row) => String(row.id) === target.rowId)
        : Number.isInteger(target.index) ? target.index : -1;
      if (rowIndex >= 0 && rowIndex < nextRows.length) removedIndexes.add(rowIndex);
    });
    const removedRows = nextRows
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => removedIndexes.has(index));
    reservationsToRelease.push(...collectAgentReservations(
      removedRows.map(({ row }) => row),
    ));
    changeSet.removedRows = removedRows.map(({ row, index }) => ({
      row: cloneValue(stripAgentReservations(row, ['video1', 'video2', 'audio'])),
      index,
    }));
    nextRows = nextRows.filter((_, index) => !removedIndexes.has(index));
  }

  if (nextRows.length === 0) nextRows = [createEmptyRow(0)];
  if (planId) {
    nextRows = nextRows.map((row) => ({ ...row, agentBoardRevisionPlanId: planId }));
  }

  return {
    nextRows,
    changeSet,
    reservationsToRelease,
  };
};
