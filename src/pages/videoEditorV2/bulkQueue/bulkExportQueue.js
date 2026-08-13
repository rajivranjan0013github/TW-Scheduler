import {
  calculateProjectDuration,
  deserializeProject,
  serializeProject,
} from '../project/projectModel.js';

export const BULK_EXPORT_ITEM_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  RENDERED: 'rendered',
  SAVING: 'saving',
  DONE: 'done',
  ERROR: 'error',
  CANCELLED: 'cancelled',
});

export class BulkExportQueueError extends Error {
  constructor(message, { code = 'BULK_EXPORT_QUEUE_FAILED', cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'BulkExportQueueError';
    this.code = code;
  }
}

const toRowId = (value) => String(value ?? '');

const uniqueRowIds = (rowIds) => [...new Set(
  (Array.isArray(rowIds) ? rowIds : [rowIds])
    .map(toRowId)
    .filter(Boolean),
)];

const getErrorMessage = (error, fallback = 'The video could not be exported.') => (
  error?.message || fallback
);

const isCancellation = (error, signal) => (
  Boolean(signal?.aborted)
  || error?.name === 'AbortError'
  || error?.code === 'EXPORT_CANCELLED'
  || error?.code === 'BULK_EXPORT_CANCELLED'
);

const throwIfCancelled = (signal) => {
  if (!signal?.aborted) return;
  throw new BulkExportQueueError('Bulk export was cancelled.', {
    code: 'BULK_EXPORT_CANCELLED',
    cause: signal.reason,
  });
};

const emit = (callback, payload) => {
  if (typeof callback !== 'function') return;
  try {
    callback(payload);
  } catch {
    // Queue observers must not interrupt the active export.
  }
};

const normalizeProgress = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const getUploadedMedia = (value) => value?.media || value?.uploadedMedia || value;

const getUploadedMediaSummary = (uploadResult, fallbackName) => {
  const media = getUploadedMedia(uploadResult);
  if (!media || typeof media !== 'object') {
    throw new BulkExportQueueError(
      'The Media Library upload did not return a media record.',
      { code: 'INVALID_UPLOAD_RESULT' },
    );
  }

  const resultMediaId = media._id || media.id || media.mediaId || '';
  const resultMediaUrl = media.url || media.originalUrl || '';
  if (!resultMediaId && !resultMediaUrl) {
    throw new BulkExportQueueError(
      'The Media Library upload result has no media ID or URL.',
      { code: 'INVALID_UPLOAD_RESULT' },
    );
  }

  return {
    resultMediaId,
    resultMediaUrl,
    resultMediaName: media.name || media.filename || fallbackName || '',
    resultVideoUrl: '',
  };
};

/**
 * Reads and validates the canonical V2 project stored on a bulk row.
 */
export const getCanonicalBulkProject = (row) => {
  if (!row?.editorProject) {
    throw new BulkExportQueueError(
      'This planning-board row has no timeline project.',
      { code: 'CANONICAL_PROJECT_REQUIRED' },
    );
  }

  try {
    const project = deserializeProject(row.editorProject);
    if (calculateProjectDuration(project) <= 0) {
      throw new BulkExportQueueError(
        'Add at least one timed clip before exporting this row.',
        { code: 'EMPTY_PROJECT' },
      );
    }
    return project;
  } catch (error) {
    if (error instanceof BulkExportQueueError) throw error;
    throw new BulkExportQueueError(
      'This planning-board row contains an invalid timeline project.',
      { code: 'INVALID_CANONICAL_PROJECT', cause: error },
    );
  }
};

export const isCanonicalBulkRowExportable = (row, { includeCompleted = false } = {}) => {
  if (!row?.id || (!includeCompleted && row.status === 'done')) return false;
  try {
    getCanonicalBulkProject(row);
    return true;
  } catch {
    return false;
  }
};

export const getCanonicalBulkRowIds = (rows, options) => (
  (Array.isArray(rows) ? rows : [])
    .filter((row) => isCanonicalBulkRowExportable(row, options))
    .map((row) => toRowId(row.id))
);

/**
 * Runs canonical bulk projects one at a time against a single FFmpeg engine.
 *
 * `uploadResult` is intentionally supplied by the parent application because
 * authentication, campaign scope, folder selection, and the upload endpoint
 * belong outside the queue. It receives:
 *
 *   { row, project, blob, bytes, fileName, mimeType, duration, output,
 *     signal, index, total, uploadOptions, onProgress }
 *
 * It must resolve to a Media Library record (or `{ media: record }`) containing
 * an `_id`/`id`/`mediaId` and/or `url`.
 */
export const runSequentialBulkExport = async ({
  rowIds,
  getRow,
  updateRow,
  getFFmpeg,
  exportProject,
  uploadResult,
  mediaRegistry,
  resolveMedia,
  exportOptions,
  uploadOptions,
  signal,
  onItemUpdate,
  onQueueUpdate,
} = {}) => {
  const ids = uniqueRowIds(rowIds);
  if (ids.length === 0) {
    return {
      status: 'completed',
      total: 0,
      succeeded: [],
      failed: [],
      cancelled: [],
    };
  }
  if (typeof getRow !== 'function' || typeof updateRow !== 'function') {
    throw new BulkExportQueueError('Bulk row read and update callbacks are required.', {
      code: 'ROW_STORE_REQUIRED',
    });
  }
  if (typeof getFFmpeg !== 'function' || typeof exportProject !== 'function') {
    throw new BulkExportQueueError('FFmpeg loader and exporter callbacks are required.', {
      code: 'EXPORT_ENGINE_REQUIRED',
    });
  }
  if (typeof uploadResult !== 'function') {
    throw new BulkExportQueueError('A Media Library upload callback is required.', {
      code: 'UPLOAD_CALLBACK_REQUIRED',
    });
  }

  const summary = {
    status: 'running',
    total: ids.length,
    succeeded: [],
    failed: [],
    cancelled: [],
  };
  const updateItem = (rowId, changes) => emit(onItemUpdate, {
    rowId,
    ...changes,
  });

  ids.forEach((rowId) => updateItem(rowId, {
    status: BULK_EXPORT_ITEM_STATUS.QUEUED,
    phase: 'queued',
    progress: 0,
    message: 'Waiting to export…',
    error: '',
  }));
  emit(onQueueUpdate, {
    status: 'running',
    currentRowId: '',
    completed: 0,
    total: ids.length,
  });

  let ffmpeg;
  try {
    throwIfCancelled(signal);
    emit(onQueueUpdate, {
      status: 'running',
      phase: 'loading-engine',
      currentRowId: '',
      completed: 0,
      total: ids.length,
    });
    ffmpeg = await getFFmpeg(signal);
    throwIfCancelled(signal);
  } catch (error) {
    const cancelled = isCancellation(error, signal);
    if (!cancelled) {
      await Promise.all(ids.map(async (rowId) => {
        try {
          await updateRow(rowId, (latestRow) => ({
            ...latestRow,
            status: 'error',
            bulkExportError: getErrorMessage(error, 'The export engine could not be loaded.'),
          }));
        } catch {
          // A removed row still receives its error in the in-memory queue.
        }
      }));
    }
    ids.forEach((rowId) => {
      const item = {
        rowId,
        error: cancelled ? '' : getErrorMessage(error, 'The export engine could not be loaded.'),
      };
      if (cancelled) summary.cancelled.push(item);
      else summary.failed.push(item);
      updateItem(rowId, {
        status: cancelled
          ? BULK_EXPORT_ITEM_STATUS.CANCELLED
          : BULK_EXPORT_ITEM_STATUS.ERROR,
        phase: cancelled ? 'cancelled' : 'error',
        message: cancelled ? 'Cancelled.' : 'Export engine unavailable.',
        error: item.error,
      });
    });
    summary.status = cancelled ? 'cancelled' : 'completed';
    emit(onQueueUpdate, {
      status: summary.status,
      currentRowId: '',
      completed: ids.length,
      total: ids.length,
    });
    return summary;
  }

  for (let index = 0; index < ids.length; index += 1) {
    const rowId = ids[index];
    if (signal?.aborted) {
      ids.slice(index).forEach((pendingRowId) => {
        summary.cancelled.push({ rowId: pendingRowId, error: '' });
        updateItem(pendingRowId, {
          status: BULK_EXPORT_ITEM_STATUS.CANCELLED,
          phase: 'cancelled',
          message: 'Cancelled.',
          error: '',
        });
      });
      break;
    }

    emit(onQueueUpdate, {
      status: 'running',
      phase: 'processing',
      currentRowId: rowId,
      completed: index,
      total: ids.length,
    });
    let previousStatus = 'ready';
    let canonicalSnapshot;

    try {
      const row = await getRow(rowId);
      if (!row) {
        throw new BulkExportQueueError('This planning-board row no longer exists.', {
          code: 'ROW_NOT_FOUND',
        });
      }
      previousStatus = ['ready', 'draft', 'done', 'error'].includes(row.status)
        ? row.status
        : 'ready';
      const project = getCanonicalBulkProject(row);
      canonicalSnapshot = serializeProject(project);
      throwIfCancelled(signal);

      await updateRow(rowId, (latestRow) => ({
        ...latestRow,
        status: 'processing',
        bulkExportError: '',
      }));
      updateItem(rowId, {
        status: BULK_EXPORT_ITEM_STATUS.PROCESSING,
        phase: 'preparing',
        progress: 0,
        message: 'Preparing project…',
        error: '',
      });

      const result = await exportProject({
        project,
        ffmpeg,
        mediaRegistry,
        resolveMedia,
        signal,
        exportOptions,
        onProgress: ({ phase, progress, message } = {}) => {
          updateItem(rowId, {
            status: BULK_EXPORT_ITEM_STATUS.PROCESSING,
            phase: phase || 'rendering',
            progress: normalizeProgress(progress) * 0.9,
            message: message || 'Rendering video…',
          });
        },
      });
      throwIfCancelled(signal);

      const latestBeforeUpload = await getRow(rowId);
      if (!latestBeforeUpload) {
        throw new BulkExportQueueError('This planning-board row was removed during export.', {
          code: 'ROW_REMOVED_DURING_EXPORT',
        });
      }
      const latestSnapshot = serializeProject(getCanonicalBulkProject(latestBeforeUpload));
      if (latestSnapshot !== canonicalSnapshot) {
        throw new BulkExportQueueError(
          'This timeline changed during export. Export it again to use the latest edits.',
          { code: 'PROJECT_CHANGED_DURING_EXPORT' },
        );
      }

      await updateRow(rowId, (latestRow) => ({
        ...latestRow,
        status: 'saving',
      }));
      updateItem(rowId, {
        status: BULK_EXPORT_ITEM_STATUS.SAVING,
        phase: 'uploading',
        progress: 0.9,
        message: 'Saving to Media Library…',
      });

      const uploaded = await uploadResult({
        row: latestBeforeUpload,
        project,
        blob: result.blob,
        bytes: result.bytes,
        fileName: result.fileName,
        mimeType: 'video/mp4',
        duration: result.duration,
        output: result.output,
        signal,
        index,
        total: ids.length,
        uploadOptions,
        onProgress: (progress, message = 'Saving to Media Library…') => {
          updateItem(rowId, {
            status: BULK_EXPORT_ITEM_STATUS.SAVING,
            phase: 'uploading',
            progress: 0.9 + normalizeProgress(progress) * 0.1,
            message,
          });
        },
      });
      throwIfCancelled(signal);

      const latestBeforeCommit = await getRow(rowId);
      if (!latestBeforeCommit) {
        throw new BulkExportQueueError('This planning-board row was removed while saving.', {
          code: 'ROW_REMOVED_DURING_UPLOAD',
        });
      }
      if (serializeProject(getCanonicalBulkProject(latestBeforeCommit)) !== canonicalSnapshot) {
        throw new BulkExportQueueError(
          'This timeline changed while its export was being saved. The saved file was not linked to the newer row.',
          { code: 'PROJECT_CHANGED_DURING_UPLOAD' },
        );
      }

      const mediaSummary = getUploadedMediaSummary(uploaded, result.fileName);
      const generatedCaption = typeof uploaded?.generatedCaption === 'string'
        ? uploaded.generatedCaption
        : null;
      await updateRow(rowId, (latestRow) => ({
        ...latestRow,
        ...mediaSummary,
        ...(generatedCaption !== null ? { generatedCaption } : {}),
        status: 'done',
        bulkExportError: '',
      }));
      const completedItem = {
        rowId,
        fileName: mediaSummary.resultMediaName,
        media: getUploadedMedia(uploaded),
      };
      summary.succeeded.push(completedItem);
      updateItem(rowId, {
        status: BULK_EXPORT_ITEM_STATUS.DONE,
        phase: 'complete',
        progress: 1,
        message: 'Export complete.',
        error: '',
        resultMediaId: mediaSummary.resultMediaId,
        resultMediaUrl: mediaSummary.resultMediaUrl,
        resultMediaName: mediaSummary.resultMediaName,
      });
    } catch (error) {
      const cancelled = isCancellation(error, signal);
      try {
        const errorMessage = cancelled ? '' : getErrorMessage(error);
        await updateRow(rowId, (latestRow) => ({
          ...latestRow,
          status: cancelled ? previousStatus : 'error',
          bulkExportError: errorMessage,
        }));
      } catch {
        // The row may have been removed; retain the error in queue state.
      }

      if (cancelled) {
        summary.cancelled.push({ rowId, error: '' });
        updateItem(rowId, {
          status: BULK_EXPORT_ITEM_STATUS.CANCELLED,
          phase: 'cancelled',
          message: 'Cancelled.',
          error: '',
        });
        ids.slice(index + 1).forEach((pendingRowId) => {
          summary.cancelled.push({ rowId: pendingRowId, error: '' });
          updateItem(pendingRowId, {
            status: BULK_EXPORT_ITEM_STATUS.CANCELLED,
            phase: 'cancelled',
            message: 'Cancelled.',
            error: '',
          });
        });
        break;
      }

      const errorMessage = getErrorMessage(error);
      summary.failed.push({ rowId, error: errorMessage, code: error?.code || '' });
      updateItem(rowId, {
        status: BULK_EXPORT_ITEM_STATUS.ERROR,
        phase: 'error',
        message: 'Export failed.',
        error: errorMessage,
      });
    }

    emit(onQueueUpdate, {
      status: 'running',
      phase: 'processing',
      currentRowId: '',
      completed: index + 1,
      total: ids.length,
    });
  }

  summary.status = summary.cancelled.length > 0 ? 'cancelled' : 'completed';
  emit(onQueueUpdate, {
    status: summary.status,
    phase: summary.status,
    currentRowId: '',
    completed: ids.length,
    total: ids.length,
  });
  return summary;
};
