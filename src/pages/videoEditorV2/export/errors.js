export class VideoExportError extends Error {
  constructor(message, { code = 'VIDEO_EXPORT_FAILED', cause, details } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'VideoExportError';
    this.code = code;
    this.details = details;
  }
}

export const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw new VideoExportError('Video export was cancelled.', {
      code: 'EXPORT_CANCELLED',
      cause: signal.reason,
    });
  }
};

export const toExportError = (error, fallbackMessage = 'Video export failed.') => {
  if (error instanceof VideoExportError) return error;

  if (error?.name === 'AbortError') {
    return new VideoExportError('Video export was cancelled.', {
      code: 'EXPORT_CANCELLED',
      cause: error,
    });
  }

  return new VideoExportError(error?.message || fallbackMessage, {
    cause: error,
  });
};
