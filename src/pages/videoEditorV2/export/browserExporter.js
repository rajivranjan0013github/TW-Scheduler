import { DEFAULT_EXPORT_OPTIONS } from './constants.js';
import { buildFFmpegArguments } from './buildFFmpegArguments.js';
import {
  getClipMediaCacheKey,
  hasAudioStream,
  inferMediaExtension,
  resolveClipMedia,
  safeDeleteFile,
} from './media.js';
import { normalizeProject } from './normalizeProject.js';
import { renderTextClipToPng } from './textOverlayRenderer.js';
import {
  VideoExportError,
  throwIfAborted,
  toExportError,
} from './errors.js';
import { acquireFFmpegEngine, createEngineJobId } from './engineRuntime.js';

const emitProgress = (callback, payload) => {
  if (typeof callback !== 'function') return;
  try {
    callback(payload);
  } catch {
    // Consumer progress handlers must not interrupt an export.
  }
};

const getUsefulLogLine = (lines) =>
  [...lines]
    .reverse()
    .find(
      (line) =>
        /error|invalid|failed|unable|not found|unconnected|cannot/i.test(line) &&
        !line.includes('deprecated pixel format'),
    );

const isMediaClipNeeded = (clip) => {
  if (clip.type === 'video') {
    return !clip.trackHidden;
  }
  if (clip.type === 'image') return !clip.trackHidden;
  if (clip.type === 'audio') {
    return (
      !clip.trackHidden &&
      !clip.trackMuted &&
      !clip.muted &&
      clip.volume > 0 &&
      clip.sourceType !== 'generated'
    );
  }
  return false;
};

const createBinaryBlob = (data) => {
  if (typeof data === 'string') {
    throw new VideoExportError('FFmpeg returned text instead of an MP4 file.', {
      code: 'INVALID_EXPORT_OUTPUT',
    });
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  return {
    bytes: stableBytes,
    blob: new Blob([stableBytes], { type: 'video/mp4' }),
  };
};

/**
 * Export a V2 project entirely in the browser.
 *
 * @param {object} options
 * @param {object} options.project Serializable V2 project.
 * @param {object} options.ffmpeg A loaded @ffmpeg/ffmpeg FFmpeg instance.
 * @param {Map|object} [options.mediaRegistry] mediaId -> File/Blob/URL/data entry.
 * @param {Function} [options.resolveMedia] async (clip, {project, signal}) => media.
 * @param {Function} [options.onProgress] receives {phase, progress, message}.
 * @param {Function} [options.onLog] receives each FFmpeg log event.
 * @param {AbortSignal} [options.signal] cancellation signal.
 * @param {object} [options.exportOptions] output/encoder overrides.
 * @returns {Promise<{blob: Blob, bytes: Uint8Array, fileName: string, duration: number, output: object}>}
 */
export const exportProjectInBrowser = async ({
  project,
  ffmpeg,
  mediaRegistry,
  resolveMedia,
  onProgress,
  onLog,
  signal,
  exportOptions = {},
} = {}) => {
  if (!ffmpeg || typeof ffmpeg.exec !== 'function') {
    throw new VideoExportError('A loaded FFmpeg instance is required.', {
      code: 'FFMPEG_REQUIRED',
    });
  }
  if (!ffmpeg.loaded) {
    throw new VideoExportError('FFmpeg is not loaded yet.', {
      code: 'FFMPEG_NOT_LOADED',
    });
  }
  const normalizedProject = normalizeProject(project, exportOptions);
  const timeoutMs = Math.max(
    1_000,
    Number(exportOptions.timeoutMs) || DEFAULT_EXPORT_OPTIONS.timeoutMs,
  );
  const jobId = createEngineJobId('v2');
  const outputFile = `${jobId}-output.mp4`;
  const cleanupFiles = new Set([outputFile]);
  const sourceFiles = new Map();
  const inputDescriptors = [];
  const audioProbeCache = new Map();
  const logLines = [];

  const logHandler = (event) => {
    const message = String(event?.message || '');
    logLines.push(message);
    if (logLines.length > 80) logLines.shift();
    if (typeof onLog === 'function') {
      try {
        onLog(event);
      } catch {
        // Consumer log handlers must not interrupt an export.
      }
    }
  };
  const progressHandler = ({ progress }) => {
    const normalized = Math.min(1, Math.max(0, Number(progress) || 0));
    emitProgress(onProgress, {
      phase: 'rendering',
      progress: 0.25 + normalized * 0.7,
      message: `Rendering video… ${Math.round(normalized * 100)}%`,
    });
  };
  const releaseEngine = acquireFFmpegEngine(ffmpeg, {
    code: 'EXPORT_ALREADY_RUNNING',
    message: 'This FFmpeg engine is already exporting another video.',
  });

  try {
    throwIfAborted(signal);
    emitProgress(onProgress, {
      phase: 'preparing',
      progress: 0,
      message: 'Preparing project…',
    });

    const mediaClips = normalizedProject.clips.filter(isMediaClipNeeded);
    for (let index = 0; index < mediaClips.length; index += 1) {
      const clip = mediaClips[index];
      throwIfAborted(signal);
      const cacheKey = getClipMediaCacheKey(clip);
      let fileName = sourceFiles.get(cacheKey);

      if (!fileName) {
        const extension = inferMediaExtension(clip, mediaRegistry?.get?.(clip.mediaId));
        fileName = `${jobId}-source-${sourceFiles.size}.${extension}`;
        const bytes = await resolveClipMedia({
          clip,
          project: normalizedProject,
          mediaRegistry,
          resolveMedia,
          signal,
        });
        await ffmpeg.writeFile(fileName, bytes, { signal });
        cleanupFiles.add(fileName);
        sourceFiles.set(cacheKey, fileName);
      }

      inputDescriptors.push({
        key: clip.key,
        kind: clip.type,
        fileName,
        duration: clip.duration,
        loop: Boolean(clip.loop),
        index: inputDescriptors.length,
        hasAudio: false,
      });

      emitProgress(onProgress, {
        phase: 'preparing',
        progress: mediaClips.length
          ? ((index + 1) / mediaClips.length) * 0.15
          : 0.15,
        message: `Loading media ${index + 1} of ${mediaClips.length}…`,
      });
    }

    const textClips = normalizedProject.clips.filter(
      (clip) => clip.type === 'text' && !clip.trackHidden && clip.text.trim(),
    );
    for (let index = 0; index < textClips.length; index += 1) {
      const clip = textClips[index];
      throwIfAborted(signal);
      const fileName = `${jobId}-text-${index}.png`;
      const bytes = await renderTextClipToPng(clip, {
        width: normalizedProject.output.width,
        height: normalizedProject.output.height,
        signal,
      });
      await ffmpeg.writeFile(fileName, bytes, { signal });
      cleanupFiles.add(fileName);
      inputDescriptors.push({
        key: clip.key,
        kind: 'text',
        fileName,
        duration: clip.duration,
        loop: true,
        index: inputDescriptors.length,
        hasAudio: false,
      });
      emitProgress(onProgress, {
        phase: 'preparing',
        progress: 0.15 + ((index + 1) / textClips.length) * 0.05,
        message: `Rendering text ${index + 1} of ${textClips.length}…`,
      });
    }

    emitProgress(onProgress, {
      phase: 'probing',
      progress: 0.2,
      message: 'Checking source audio…',
    });
    for (const descriptor of inputDescriptors) {
      if (descriptor.kind !== 'video') continue;
      if (!audioProbeCache.has(descriptor.fileName)) {
        const probeFile = `${jobId}-probe-${audioProbeCache.size}.txt`;
        cleanupFiles.add(probeFile);
        audioProbeCache.set(
          descriptor.fileName,
          await hasAudioStream(ffmpeg, descriptor.fileName, {
            signal,
            timeoutMs: Math.min(timeoutMs, 30_000),
            probeFile,
          }),
        );
      }
      descriptor.hasAudio = audioProbeCache.get(descriptor.fileName);
    }

    throwIfAborted(signal);
    const { args, filterComplex } = buildFFmpegArguments({
      project: normalizedProject,
      inputDescriptors,
      outputFile,
    });

    ffmpeg.on('log', logHandler);
    ffmpeg.on('progress', progressHandler);
    emitProgress(onProgress, {
      phase: 'rendering',
      progress: 0.25,
      message: 'Rendering video…',
    });
    const exitCode = await ffmpeg.exec(args, timeoutMs, { signal });
    if (exitCode !== 0) {
      throw new VideoExportError(
        getUsefulLogLine(logLines) ||
          'FFmpeg could not render this project. Check the source file formats.',
        {
          code: exitCode === 1 ? 'EXPORT_TIMEOUT_OR_FAILURE' : 'FFMPEG_FAILED',
          details: { exitCode, filterComplex },
        },
      );
    }

    throwIfAborted(signal);
    emitProgress(onProgress, {
      phase: 'finalizing',
      progress: 0.96,
      message: 'Finalizing MP4…',
    });
    const data = await ffmpeg.readFile(outputFile, undefined, { signal });
    const result = createBinaryBlob(data);
    const fileName = `${String(normalizedProject.name || 'video')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'video'}.mp4`;

    emitProgress(onProgress, {
      phase: 'complete',
      progress: 1,
      message: 'Export complete.',
    });
    return {
      ...result,
      fileName,
      duration: normalizedProject.duration,
      output: normalizedProject.output,
    };
  } catch (error) {
    throw toExportError(error);
  } finally {
    ffmpeg.off?.('log', logHandler);
    ffmpeg.off?.('progress', progressHandler);
    for (const path of cleanupFiles) {
      await safeDeleteFile(ffmpeg, path);
    }
    releaseEngine();
  }
};
