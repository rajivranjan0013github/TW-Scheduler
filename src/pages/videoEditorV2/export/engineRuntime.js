import { VideoExportError } from './errors.js';

const activeEngines = new WeakSet();

export const createEngineJobId = (prefix = 'v2') => {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || Math.random().toString(36).slice(2);
  const safePrefix = String(prefix).replace(/[^a-z0-9-]/gi, '') || 'v2';
  return `${safePrefix}-${Date.now()}-${randomPart}`.replace(/[^a-z0-9-]/gi, '');
};

/**
 * Reserves one FFmpeg instance until the returned release callback is invoked.
 * FFmpeg.wasm has one virtual filesystem/process and cannot safely run jobs in parallel.
 */
export const acquireFFmpegEngine = (
  ffmpeg,
  {
    code = 'FFMPEG_ALREADY_RUNNING',
    message = 'This FFmpeg engine is already processing another job.',
  } = {},
) => {
  if (activeEngines.has(ffmpeg)) {
    throw new VideoExportError(message, { code });
  }

  activeEngines.add(ffmpeg);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeEngines.delete(ffmpeg);
  };
};
