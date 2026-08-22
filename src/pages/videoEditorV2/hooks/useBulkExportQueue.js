import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  BULK_ROWS_STORAGE_KEY,
  readBulkRowsSnapshot,
  subscribeToBulkRows,
  writeBulkRowsSnapshot,
} from '../../bulkBuilder/bulkProjectStore.js';
import { loadBrowserFFmpeg } from '../export/loadFFmpeg.js';
import {
  BULK_EXPORT_ITEM_STATUS,
  BulkExportQueueError,
  ensureHydratedBulkProject,
  getCanonicalBulkProject,
  getCanonicalBulkRowIds,
  isCanonicalBulkRowExportable,
  runSequentialBulkExport,
} from '../bulkQueue/bulkExportQueue.js';

const exportProjectWithPreferredEngine = async (options) => {
  const { exportProjectWithBestAvailableEngine } = await import('../export/hardwareExporter.js');
  return exportProjectWithBestAvailableEngine(options);
};

const QUEUE_SOURCE = 'editor-v2-bulk-queue';
const EMPTY_ROWS_SNAPSHOT = '[]';

const getRowsStorageSnapshot = () => {
  try {
    return localStorage.getItem(BULK_ROWS_STORAGE_KEY) || EMPTY_ROWS_SNAPSHOT;
  } catch {
    return EMPTY_ROWS_SNAPSHOT;
  }
};

const subscribeToRowsSnapshot = (notify) => subscribeToBulkRows(notify);

const parseRowsSnapshot = (snapshot) => {
  try {
    const rows = JSON.parse(snapshot);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const toRowId = (value) => String(value ?? '');

const uniqueRowIds = (rowIds) => [...new Set(
  (Array.isArray(rowIds) ? rowIds : [rowIds])
    .map(toRowId)
    .filter(Boolean),
)];

const createQueueState = (overrides = {}) => ({
  status: 'idle',
  phase: 'idle',
  currentRowId: '',
  order: [],
  items: {},
  completed: 0,
  total: 0,
  error: '',
  lastSummary: null,
  ...overrides,
});

const createQueuedItem = (rowId) => ({
  rowId,
  status: BULK_EXPORT_ITEM_STATUS.QUEUED,
  phase: 'queued',
  progress: 0,
  message: 'Waiting to export…',
  error: '',
  resultMediaId: '',
  resultMediaUrl: '',
  resultMediaName: '',
  renderedVideoUrl: '',
  renderedFileName: '',
});

const revokeRenderedResults = (results) => {
  results.forEach((entry) => {
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  });
  results.clear();
};

/**
 * Updates one row against the latest complete storage snapshot. This avoids
 * replacing the board with a filtered or stale queue-local row array.
 */
export const updateStoredBulkRowById = async (
  rowId,
  updater,
  { source = QUEUE_SOURCE } = {},
) => {
  const normalizedRowId = toRowId(rowId);
  const rows = readBulkRowsSnapshot();
  const rowIndex = rows.findIndex((row) => toRowId(row.id) === normalizedRowId);
  if (rowIndex < 0) {
    throw new BulkExportQueueError('The planning-board row no longer exists.', {
      code: 'ROW_NOT_FOUND',
    });
  }

  const currentRow = rows[rowIndex];
  const candidateResult = typeof updater === 'function'
    ? updater(currentRow)
    : { ...currentRow, ...(updater || {}) };
  const candidate = candidateResult && typeof candidateResult.then === 'function'
    ? await candidateResult
    : candidateResult;
  if (!candidate || typeof candidate !== 'object') {
    throw new BulkExportQueueError('The planning-board row update was invalid.', {
      code: 'INVALID_ROW_UPDATE',
    });
  }

  const nextRow = { ...candidate, id: currentRow.id };
  const nextRows = [...rows];
  nextRows[rowIndex] = nextRow;
  writeBulkRowsSnapshot(nextRows, { source, rowId: normalizedRowId });
  return nextRow;
};

/**
 * Sequential V2 bulk-export orchestration.
 *
 * The required `uploadResult` callback owns authenticated Media Library upload
 * behavior. See `runSequentialBulkExport` for its argument and return contract.
 */
export const useBulkExportQueue = ({
  ffmpeg,
  ffmpegRef,
  loadFFmpeg = loadBrowserFFmpeg,
  exportProject = exportProjectWithPreferredEngine,
  uploadResult,
  mediaRegistry,
  resolveMedia,
  exportOptions,
  loadFFmpegOptions,
  readRows = readBulkRowsSnapshot,
  updateRow = updateStoredBulkRowById,
} = {}) => {
  const rowsSnapshot = useSyncExternalStore(
    subscribeToRowsSnapshot,
    getRowsStorageSnapshot,
    () => EMPTY_ROWS_SNAPSHOT,
  );
  const rows = useMemo(() => parseRowsSnapshot(rowsSnapshot), [rowsSnapshot]);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [queue, setQueue] = useState(createQueueState);
  const controllerRef = useRef(null);
  const engineRef = useRef(null);
  const ownsEngineRef = useRef(false);
  const runningRef = useRef(false);
  const renderedResultsRef = useRef(new Map());

  const getRow = useCallback(async (rowId) => (
    (await readRows()).find((row) => toRowId(row.id) === toRowId(rowId)) || null
  ), [readRows]);

  const getFFmpeg = useCallback(async (signal) => {
    const candidate = ffmpeg || ffmpegRef?.current || engineRef.current;
    if (candidate?.loaded) return candidate;

    const loaded = await loadFFmpeg({
      ...(loadFFmpegOptions || {}),
      ...(candidate ? { ffmpeg: candidate } : {}),
      signal,
    });
    if (ffmpegRef) {
      ffmpegRef.current = loaded;
    } else if (!ffmpeg) {
      engineRef.current = loaded;
      ownsEngineRef.current = true;
    }
    return loaded;
  }, [ffmpeg, ffmpegRef, loadFFmpeg, loadFFmpegOptions]);

  useEffect(() => () => {
    controllerRef.current?.abort(new Error('Bulk export view was closed.'));
    revokeRenderedResults(renderedResultsRef.current);
    if (ownsEngineRef.current) engineRef.current?.terminate?.();
    controllerRef.current = null;
    engineRef.current = null;
  }, []);

  const updateQueueItem = useCallback(({ rowId, ...changes }) => {
    const normalizedRowId = toRowId(rowId);
    setQueue((current) => ({
      ...current,
      order: current.order.includes(normalizedRowId)
        ? current.order
        : [...current.order, normalizedRowId],
      items: {
        ...current.items,
        [normalizedRowId]: {
          ...(current.items[normalizedRowId] || createQueuedItem(normalizedRowId)),
          ...changes,
          rowId: normalizedRowId,
        },
      },
    }));
  }, []);

  const updateQueueStatus = useCallback((changes) => {
    setQueue((current) => ({ ...current, ...changes }));
  }, []);

  const run = useCallback(async (requestedRowIds, runOptions = {}) => {
    if (runningRef.current) {
      throw new BulkExportQueueError('A bulk export is already running.', {
        code: 'BULK_EXPORT_ALREADY_RUNNING',
      });
    }

    const rowIds = uniqueRowIds(requestedRowIds);
    const items = Object.fromEntries(rowIds.map((rowId) => [
      rowId,
      createQueuedItem(rowId),
    ]));
    const controller = new AbortController();
    controllerRef.current = controller;
    runningRef.current = true;
    setQueue(createQueueState({
      status: 'running',
      phase: 'queued',
      order: rowIds,
      items,
      total: rowIds.length,
    }));

    try {
      const summary = await runSequentialBulkExport({
        rowIds,
        getRow,
        updateRow,
        getFFmpeg,
        exportProject,
        uploadResult,
        mediaRegistry,
        resolveMedia,
        exportOptions: runOptions.exportOptions || exportOptions,
        uploadOptions: runOptions.uploadOptions,
        signal: controller.signal,
        onItemUpdate: updateQueueItem,
        onQueueUpdate: updateQueueStatus,
      });
      setQueue((current) => ({
        ...current,
        status: summary.status,
        phase: summary.status,
        currentRowId: '',
        completed: summary.total,
        lastSummary: summary,
      }));
      return summary;
    } catch (error) {
      setQueue((current) => ({
        ...current,
        status: controller.signal.aborted ? 'cancelled' : 'error',
        phase: controller.signal.aborted ? 'cancelled' : 'error',
        currentRowId: '',
        error: error.message || 'Bulk export could not start.',
      }));
      throw error;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      runningRef.current = false;
    }
  }, [
    exportOptions,
    exportProject,
    getFFmpeg,
    getRow,
    mediaRegistry,
    resolveMedia,
    updateQueueItem,
    updateQueueStatus,
    updateRow,
    uploadResult,
  ]);

  const exportCurrent = useCallback((rowId, options) => {
    const requestedId = toRowId(rowId);
    if (!requestedId) {
      return Promise.reject(new BulkExportQueueError('Choose a row to export.', {
        code: 'ROW_REQUIRED',
      }));
    }
    return run([requestedId], options);
  }, [run]);

  const exportSelected = useCallback((options) => {
    const existingIds = new Set(rows.map((row) => toRowId(row.id)));
    return run(selectedRowIds.filter((rowId) => existingIds.has(rowId)), options);
  }, [rows, run, selectedRowIds]);

  const exportAll = useCallback((options = {}) => {
    return run(getCanonicalBulkRowIds(rows, {
      includeCompleted: Boolean(options.includeCompleted),
    }), options);
  }, [rows, run]);

  const retry = useCallback((rowIds, options) => {
    const retriesAllFailed = rowIds === undefined
      || (rowIds && typeof rowIds === 'object' && !Array.isArray(rowIds));
    const retryOptions = retriesAllFailed && rowIds !== undefined ? rowIds : options;
    const requestedIds = retriesAllFailed
      ? queue.order.filter((rowId) => (
          queue.items[rowId]?.status === BULK_EXPORT_ITEM_STATUS.ERROR
          || queue.items[rowId]?.status === BULK_EXPORT_ITEM_STATUS.CANCELLED
        ))
      : uniqueRowIds(rowIds);
    return run(requestedIds, retryOptions);
  }, [queue.items, queue.order, run]);

  const cancel = useCallback(() => {
    if (!controllerRef.current) return false;
    controllerRef.current.abort(new BulkExportQueueError('Bulk export was cancelled.', {
      code: 'BULK_EXPORT_CANCELLED',
    }));
    return true;
  }, []);

  const render = useCallback(async (requestedRowIds) => {
    if (runningRef.current) {
      throw new BulkExportQueueError('A bulk export is already running.', {
        code: 'BULK_EXPORT_ALREADY_RUNNING',
      });
    }
    const rowIds = uniqueRowIds(requestedRowIds);
    const controller = new AbortController();
    controllerRef.current = controller;
    runningRef.current = true;
    revokeRenderedResults(renderedResultsRef.current);
    setQueue(createQueueState({
      status: 'running',
      phase: 'rendering',
      order: rowIds,
      items: Object.fromEntries(rowIds.map((rowId) => [rowId, createQueuedItem(rowId)])),
      total: rowIds.length,
    }));

    const summary = { status: 'running', total: rowIds.length, succeeded: [], failed: [], cancelled: [] };
    try {
      const engine = await getFFmpeg(controller.signal);
      for (let index = 0; index < rowIds.length; index += 1) {
        const rowId = rowIds[index];
        if (controller.signal.aborted) {
          rowIds.slice(index).forEach((pendingId) => {
            summary.cancelled.push({ rowId: pendingId });
            updateQueueItem({ rowId: pendingId, status: BULK_EXPORT_ITEM_STATUS.CANCELLED, phase: 'cancelled', message: 'Cancelled.', progress: 0 });
          });
          break;
        }
        updateQueueStatus({ currentRowId: rowId, completed: index, phase: 'rendering' });
        let previousStatus = 'ready';
        try {
          const row = await getRow(rowId);
          if (!row) throw new BulkExportQueueError('The planning-board row no longer exists.', { code: 'ROW_NOT_FOUND' });
          previousStatus = ['ready', 'draft', 'done', 'error'].includes(row.status) ? row.status : 'ready';
          let project = getCanonicalBulkProject(row);
          project = await ensureHydratedBulkProject(project);
          const projectSnapshot = JSON.stringify(project);
          await updateRow(rowId, (latest) => ({ ...latest, status: 'processing', bulkExportError: '' }));
          updateQueueItem({ rowId, status: BULK_EXPORT_ITEM_STATUS.PROCESSING, phase: 'rendering', progress: 0, message: 'Rendering video…', error: '' });
          const result = await exportProject({
            project,
            ffmpeg: engine,
            mediaRegistry,
            resolveMedia,
            signal: controller.signal,
            exportOptions,
            onProgress: ({ progress, message } = {}) => updateQueueItem({
              rowId,
              status: BULK_EXPORT_ITEM_STATUS.PROCESSING,
              phase: 'rendering',
              progress: Math.min(1, Math.max(0, Number(progress) || 0)),
              message: message || 'Rendering video…',
            }),
          });
          const latest = await getRow(rowId);
          const latestProject = latest ? await ensureHydratedBulkProject(getCanonicalBulkProject(latest)) : null;
          if (!latest || JSON.stringify(latestProject) !== projectSnapshot) {
            throw new BulkExportQueueError('This timeline changed during rendering. Render it again.', { code: 'PROJECT_CHANGED_DURING_EXPORT' });
          }
          const objectUrl = URL.createObjectURL(result.blob);
          renderedResultsRef.current.set(rowId, {
            row,
            project,
            projectSnapshot,
            result,
            objectUrl,
          });
          await updateRow(rowId, (current) => ({ ...current, status: previousStatus, bulkExportError: '' }));
          summary.succeeded.push({ rowId });
          updateQueueItem({
            rowId,
            status: BULK_EXPORT_ITEM_STATUS.RENDERED,
            phase: 'rendered',
            progress: 1,
            message: 'Ready to save.',
            error: '',
            renderedVideoUrl: objectUrl,
            renderedFileName: result.fileName || `bulk-video-${index + 1}.mp4`,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            summary.cancelled.push({ rowId });
            updateQueueItem({ rowId, status: BULK_EXPORT_ITEM_STATUS.CANCELLED, phase: 'cancelled', progress: 0, message: 'Cancelled.', error: '' });
            break;
          }
          const message = error.message || 'The video could not be rendered.';
          summary.failed.push({ rowId, error: message });
          await updateRow(rowId, (latest) => ({ ...latest, status: 'error', bulkExportError: message })).catch(() => {});
          updateQueueItem({ rowId, status: BULK_EXPORT_ITEM_STATUS.ERROR, phase: 'error', progress: 1, message: 'Render failed.', error: message });
        }
        updateQueueStatus({ completed: index + 1 });
      }
      summary.status = summary.cancelled.length ? 'cancelled' : 'rendered';
      setQueue((current) => ({ ...current, status: summary.status, phase: summary.status, currentRowId: '', completed: rowIds.length, lastSummary: summary }));
      return summary;
    } catch (error) {
      setQueue((current) => ({
        ...current,
        status: controller.signal.aborted ? 'cancelled' : 'error',
        phase: controller.signal.aborted ? 'cancelled' : 'error',
        currentRowId: '',
        error: error.message || 'The videos could not be rendered.',
      }));
      throw error;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      runningRef.current = false;
    }
  }, [exportOptions, exportProject, getFFmpeg, getRow, mediaRegistry, resolveMedia, updateQueueItem, updateQueueStatus, updateRow]);

  const saveRendered = useCallback(async (requestedRowIds, { uploadOptions } = {}) => {
    if (runningRef.current) throw new BulkExportQueueError('A bulk export is already running.', { code: 'BULK_EXPORT_ALREADY_RUNNING' });
    const rowIds = uniqueRowIds(requestedRowIds).filter((rowId) => renderedResultsRef.current.has(rowId));
    if (!rowIds.length) throw new BulkExportQueueError('No rendered videos are ready to save.', { code: 'NO_RENDERED_RESULTS' });
    const controller = new AbortController();
    controllerRef.current = controller;
    runningRef.current = true;
    setQueue((current) => ({ ...current, status: 'running', phase: 'saving', currentRowId: '', completed: 0, total: rowIds.length }));
    const summary = { status: 'running', total: rowIds.length, succeeded: [], failed: [], cancelled: [] };
    try {
      for (let index = 0; index < rowIds.length; index += 1) {
        const rowId = rowIds[index];
        if (controller.signal.aborted) {
          rowIds.slice(index).forEach((pendingId) => summary.cancelled.push({ rowId: pendingId }));
          break;
        }
        const rendered = renderedResultsRef.current.get(rowId);
        updateQueueStatus({ currentRowId: rowId, completed: index, phase: 'saving' });
        try {
          const latest = await getRow(rowId);
          if (!latest || JSON.stringify(getCanonicalBulkProject(latest)) !== rendered.projectSnapshot) {
            throw new BulkExportQueueError('This timeline changed after rendering. Render it again before saving.', { code: 'PROJECT_CHANGED_AFTER_RENDER' });
          }
          await updateRow(rowId, (current) => ({ ...current, status: 'saving', bulkExportError: '' }));
          updateQueueItem({ rowId, status: BULK_EXPORT_ITEM_STATUS.SAVING, phase: 'uploading', progress: 0, message: 'Saving to Media Library…', error: '' });
          const uploaded = await uploadResult({
            row: latest,
            project: rendered.project,
            blob: rendered.result.blob,
            bytes: rendered.result.bytes,
            fileName: rendered.result.fileName,
            mimeType: 'video/mp4',
            duration: rendered.result.duration,
            output: rendered.result.output,
            signal: controller.signal,
            index,
            total: rowIds.length,
            uploadOptions,
            onProgress: (progress, message) => updateQueueItem({
              rowId,
              status: BULK_EXPORT_ITEM_STATUS.SAVING,
              phase: 'uploading',
              progress: Math.min(1, Math.max(0, Number(progress) || 0)),
              message: message || 'Saving to Media Library…',
            }),
          });
          const media = uploaded?.media || uploaded?.uploadedMedia || uploaded;
          const resultMediaId = media?._id || media?.id || media?.mediaId || '';
          const resultMediaUrl = media?.url || media?.originalUrl || '';
          if (!resultMediaId && !resultMediaUrl) throw new BulkExportQueueError('The Media Library upload returned no media record.', { code: 'INVALID_UPLOAD_RESULT' });
          const generatedCaption = typeof uploaded?.generatedCaption === 'string' ? uploaded.generatedCaption : null;
          await updateRow(rowId, (current) => ({
            ...current,
            resultMediaId,
            resultMediaUrl,
            resultMediaName: media?.name || media?.filename || rendered.result.fileName || '',
            resultVideoUrl: '',
            ...(generatedCaption !== null ? { generatedCaption } : {}),
            status: 'done',
            bulkExportError: '',
          }));
          summary.succeeded.push({ rowId, media });
          updateQueueItem({
            rowId,
            status: BULK_EXPORT_ITEM_STATUS.DONE,
            phase: 'complete',
            progress: 1,
            message: 'Saved.',
            error: '',
            resultMediaId,
            resultMediaUrl,
            renderedVideoUrl: rendered.objectUrl,
            renderedFileName: rendered.result.fileName || `bulk-video-${index + 1}.mp4`,
            generatedCaption: generatedCaption || '',
          });
        } catch (error) {
          if (controller.signal.aborted) {
            summary.cancelled.push({ rowId });
            break;
          }
          const message = error.message || 'The rendered video could not be saved.';
          summary.failed.push({ rowId, error: message });
          await updateRow(rowId, (latest) => ({ ...latest, status: 'error', bulkExportError: message })).catch(() => {});
          updateQueueItem({ rowId, status: BULK_EXPORT_ITEM_STATUS.ERROR, phase: 'error', progress: 1, message: 'Save failed.', error: message });
        }
        updateQueueStatus({ completed: index + 1 });
      }
      summary.status = summary.cancelled.length ? 'cancelled' : 'completed';
      setQueue((current) => ({ ...current, status: summary.status, phase: summary.status, currentRowId: '', completed: rowIds.length, lastSummary: summary }));
      return summary;
    } catch (error) {
      setQueue((current) => ({
        ...current,
        status: controller.signal.aborted ? 'cancelled' : 'error',
        phase: controller.signal.aborted ? 'cancelled' : 'error',
        currentRowId: '',
        error: error.message || 'The rendered videos could not be saved.',
      }));
      throw error;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      runningRef.current = false;
    }
  }, [getRow, updateQueueItem, updateQueueStatus, updateRow, uploadResult]);

  const reset = useCallback(() => {
    if (runningRef.current) return false;
    revokeRenderedResults(renderedResultsRef.current);
    setQueue(createQueueState());
    return true;
  }, []);

  const selectRow = useCallback((rowId, selected = true) => {
    const normalizedRowId = toRowId(rowId);
    if (!normalizedRowId) return;
    setSelectedRowIds((current) => {
      if (selected) {
        return current.includes(normalizedRowId)
          ? current
          : [...current, normalizedRowId];
      }
      return current.filter((currentId) => currentId !== normalizedRowId);
    });
  }, []);

  const selectAll = useCallback(({ includeCompleted = false } = {}) => {
    setSelectedRowIds(getCanonicalBulkRowIds(rows, { includeCompleted }));
  }, [rows]);

  const clearSelection = useCallback(() => setSelectedRowIds([]), []);
  const existingRowIds = useMemo(
    () => new Set(rows.map((row) => toRowId(row.id))),
    [rows],
  );
  const visibleSelectedRowIds = useMemo(
    () => selectedRowIds.filter((rowId) => existingRowIds.has(rowId)),
    [existingRowIds, selectedRowIds],
  );
  const items = useMemo(
    () => queue.order.map((rowId) => queue.items[rowId]).filter(Boolean),
    [queue.items, queue.order],
  );
  const currentItem = queue.currentRowId ? queue.items[queue.currentRowId] || null : null;
  const overallProgress = queue.total > 0
    ? items.reduce((total, item) => {
      const isFinished = [
          BULK_EXPORT_ITEM_STATUS.DONE,
          BULK_EXPORT_ITEM_STATUS.ERROR,
          BULK_EXPORT_ITEM_STATUS.CANCELLED,
        ].includes(item.status) || (
          BULK_EXPORT_ITEM_STATUS.RENDERED === item.status
          && queue.phase !== 'saving'
        );
        return total + (isFinished ? 1 : (Number(item.progress) || 0));
      }, 0) / queue.total
    : 0;

  return {
    rows,
    exportableRows: rows.filter((row) => isCanonicalBulkRowExportable(row)),
    selectedRowIds: visibleSelectedRowIds,
    selectedRows: rows.filter((row) => visibleSelectedRowIds.includes(toRowId(row.id))),
    selectRow,
    selectAll,
    clearSelection,
    queue,
    items,
    currentItem,
    currentRowId: queue.currentRowId,
    overallProgress,
    isRunning: queue.status === 'running',
    exportCurrent,
    exportSelected,
    exportAll,
    run,
    render,
    saveRendered,
    retry,
    cancel,
    reset,
  };
};
