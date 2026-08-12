import { fetchFile } from '@ffmpeg/util';
import { VideoExportError, throwIfAborted } from './errors.js';

const MIME_EXTENSIONS = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const VALID_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'mkv',
  'avi',
  'mp3',
  'm4a',
  'aac',
  'wav',
  'ogg',
  'flac',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
]);

const getRegistryValue = (registry, mediaId) => {
  if (!registry || !mediaId) return undefined;
  if (registry instanceof Map) return registry.get(mediaId);
  return registry[mediaId];
};

const unwrapMediaSource = (resolved) => {
  if (!resolved || typeof resolved !== 'object') return resolved;

  return (
    resolved.data ??
    resolved.bytes ??
    resolved.file ??
    resolved.blob ??
    resolved.url ??
    resolved.sourceUrl ??
    resolved
  );
};

export const resolveClipMedia = async ({
  clip,
  project,
  mediaRegistry,
  resolveMedia,
  signal,
}) => {
  throwIfAborted(signal);

  let resolved;
  if (typeof resolveMedia === 'function') {
    resolved = await resolveMedia(clip, { project, signal });
  }

  if (resolved == null) {
    resolved = getRegistryValue(mediaRegistry, clip.mediaId);
  }

  if (resolved == null && clip.sourceUrl) {
    resolved = clip.sourceUrl;
  }

  const source = unwrapMediaSource(resolved);
  if (source == null || source === '') {
    throw new VideoExportError(
      `Could not resolve media for “${clip.name || clip.id}”.`,
      {
        code: 'MEDIA_NOT_FOUND',
        details: { clipId: clip.id, mediaId: clip.mediaId },
      },
    );
  }

  throwIfAborted(signal);
  try {
    let bytes;
    if (source instanceof Uint8Array) bytes = source;
    else if (source instanceof ArrayBuffer) bytes = new Uint8Array(source);
    if (ArrayBuffer.isView(source)) {
      bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    }
    if (!bytes && typeof Blob !== 'undefined' && source instanceof Blob) {
      bytes = new Uint8Array(await source.arrayBuffer());
    }
    if (!bytes && typeof Response !== 'undefined' && source instanceof Response) {
      bytes = new Uint8Array(await source.arrayBuffer());
    }
    if (!bytes) bytes = await fetchFile(source);

    if (!bytes.byteLength) {
      throw new Error('The resolved media file is empty.');
    }
    return bytes;
  } catch (error) {
    throw new VideoExportError(
      `Could not read media for “${clip.name || clip.id}”. Remote files must allow browser CORS access.`,
      {
        code: 'MEDIA_READ_FAILED',
        cause: error,
        details: { clipId: clip.id, mediaId: clip.mediaId },
      },
    );
  }
};

export const inferMediaExtension = (clip, resolvedValue) => {
  const mimeType =
    clip.mimeType ||
    resolvedValue?.type ||
    resolvedValue?.mimeType ||
    '';
  if (MIME_EXTENSIONS[mimeType]) return MIME_EXTENSIONS[mimeType];

  const candidate =
    resolvedValue?.name ||
    resolvedValue?.fileName ||
    clip.name ||
    clip.sourceUrl ||
    '';
  const cleanCandidate = String(candidate).split(/[?#]/)[0];
  const match = cleanCandidate.match(/\.([a-z0-9]{2,5})$/i);
  const extension = match?.[1]?.toLowerCase();
  if (extension && VALID_EXTENSIONS.has(extension)) return extension;

  if (clip.type === 'audio') return 'mp3';
  if (clip.type === 'image') return 'png';
  return 'mp4';
};

export const getClipMediaCacheKey = (clip) =>
  clip.mediaId || clip.sourceUrl || clip.id || clip.key;

export const safeDeleteFile = async (ffmpeg, path) => {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // The FFmpeg virtual filesystem throws if the path no longer exists.
  }
};

const bytesToText = (value) => {
  if (typeof value === 'string') return value;
  return new TextDecoder().decode(value);
};

/** Probe a virtual filesystem media file for its first audio stream. */
export const hasAudioStream = async (
  ffmpeg,
  inputFile,
  { signal, timeoutMs = 30_000, probeFile = `probe-${Date.now()}.txt` } = {},
) => {
  throwIfAborted(signal);

  if (typeof ffmpeg.ffprobe === 'function') {
    try {
      const exitCode = await ffmpeg.ffprobe(
        [
          '-v',
          'error',
          '-select_streams',
          'a:0',
          '-show_entries',
          'stream=index',
          '-of',
          'csv=p=0',
          inputFile,
          '-o',
          probeFile,
        ],
        timeoutMs,
        { signal },
      );
      if (exitCode !== 0) return false;
      const result = await ffmpeg.readFile(probeFile, 'utf8', { signal });
      return bytesToText(result).trim().length > 0;
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
    } finally {
      await safeDeleteFile(ffmpeg, probeFile);
    }
  }

  const nullOutput = `${probeFile}.null`;
  try {
    const exitCode = await ffmpeg.exec(
      [
        '-v',
        'error',
        '-i',
        inputFile,
        '-map',
        '0:a:0',
        '-frames:a',
        '1',
        '-f',
        'null',
        nullOutput,
      ],
      timeoutMs,
      { signal },
    );
    return exitCode === 0;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    return false;
  } finally {
    await safeDeleteFile(ffmpeg, nullOutput);
  }
};
