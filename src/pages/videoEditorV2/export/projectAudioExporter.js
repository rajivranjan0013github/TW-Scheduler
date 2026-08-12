import { appendProjectAudioGraph } from './audioGraph.js';
import { DEFAULT_EXPORT_OPTIONS } from './constants.js';
import { acquireFFmpegEngine, createEngineJobId } from './engineRuntime.js';
import {
  VideoExportError,
  throwIfAborted,
  toExportError,
} from './errors.js';
import {
  getClipMediaCacheKey,
  hasAudioStream,
  inferMediaExtension,
  resolveClipMedia,
  safeDeleteFile,
} from './media.js';
import { normalizeProject } from './normalizeProject.js';

const AUDIO_MIME_TYPE = 'audio/mpeg';
const AUDIO_SAMPLE_RATE = 44_100;
const AUDIO_CHANNELS = 2;
const MAX_LOG_LINES = 100;

const number = (value) => Number(Number(value).toFixed(6)).toString();
const clamp = (value, minimum, maximum) => Math.min(
  maximum,
  Math.max(minimum, value),
);

const emitProgress = (callback, payload) => {
  if (typeof callback !== 'function') return;
  try {
    callback(payload);
  } catch {
    // Consumer progress handlers must not interrupt an export.
  }
};

const getRegistryValue = (registry, mediaId) => {
  if (!registry || !mediaId) return undefined;
  if (registry instanceof Map) return registry.get(mediaId);
  return registry[mediaId];
};

const normalizeBitrate = (value) => {
  const candidate = String(value ?? DEFAULT_EXPORT_OPTIONS.audioBitrate)
    .trim()
    .toLowerCase();
  const match = candidate.match(/^(\d{1,3})k?$/);
  const kilobits = Number(match?.[1]);
  if (!Number.isInteger(kilobits) || kilobits < 8 || kilobits > 320) {
    throw new VideoExportError(
      'MP3 bitrate must be between 8k and 320k.',
      { code: 'INVALID_AUDIO_BITRATE', details: { bitrate: value } },
    );
  }
  return `${kilobits}k`;
};

const isAudibleClip = (clip) => (
  (clip.type === 'video' || clip.type === 'audio')
  && !clip.trackHidden
  && !clip.trackMuted
  && !clip.muted
  && clip.volume > 0
);

const createInputArguments = (descriptors) => descriptors.flatMap((descriptor) => (
  descriptor.kind === 'audio' && descriptor.loop
    ? ['-stream_loop', '-1', '-i', descriptor.fileName]
    : ['-i', descriptor.fileName]
));

const hasUnsupportedAudioCodecLog = (logText) => (
  /unknown decoder|decoder[^\n]*(?:not found|unsupported)|unsupported codec/i.test(logText)
);

const getUsefulLogLine = (lines) => [...lines].reverse().find((line) => (
  /error|invalid|failed|unable|not found|unknown|cannot|matches no streams/i.test(line)
));

const createFFmpegFailure = ({ logLines, exitCode, cause }) => {
  const logText = logLines.join('\n');
  if (
    /unknown encoder[^\n]*libmp3lame|encoder[^\n]*libmp3lame[^\n]*(?:not found|unknown)|error selecting an encoder/i
      .test(logText)
  ) {
    return new VideoExportError(
      'This browser video engine does not include the MP3 encoder (libmp3lame).',
      { code: 'MP3_ENCODER_UNAVAILABLE', cause, details: { exitCode } },
    );
  }
  if (hasUnsupportedAudioCodecLog(logText)) {
    return new VideoExportError(
      'An audio codec in this project is not supported by the browser video engine.',
      { code: 'AUDIO_CODEC_UNSUPPORTED', cause, details: { exitCode } },
    );
  }
  if (/matches no streams|does not contain any stream|stream specifier[^\n]*a:0[^\n]*matches no streams/i.test(logText)) {
    return new VideoExportError(
      'An audio clip in this project does not contain a usable audio track.',
      { code: 'NO_AUDIO_STREAM', cause, details: { exitCode } },
    );
  }
  return new VideoExportError(
    getUsefulLogLine(logLines)
      || 'Could not export project audio. One of its audio codecs may not be supported.',
    {
      code: 'PROJECT_AUDIO_EXPORT_FAILED',
      cause,
      details: { exitCode },
    },
  );
};

const createOutput = (data, project, bitrate) => {
  if (typeof data === 'string') {
    throw new VideoExportError('FFmpeg returned text instead of an MP3 file.', {
      code: 'INVALID_AUDIO_OUTPUT',
    });
  }
  const sourceBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!sourceBytes.byteLength) {
    throw new VideoExportError('FFmpeg produced an empty MP3 file.', {
      code: 'INVALID_AUDIO_OUTPUT',
    });
  }
  const bytes = new Uint8Array(sourceBytes.byteLength);
  bytes.set(sourceBytes);
  const baseName = String(project.name || 'project')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'project';
  return {
    blob: new Blob([bytes], { type: AUDIO_MIME_TYPE }),
    bytes,
    fileName: `${baseName}-audio.mp3`,
    duration: project.duration,
    mimeType: AUDIO_MIME_TYPE,
    output: {
      codec: 'libmp3lame',
      bitrate,
      sampleRate: AUDIO_SAMPLE_RATE,
      channels: AUDIO_CHANNELS,
    },
  };
};

/**
 * Mixes the complete audible V2 timeline and exports it as an MP3 in the browser.
 */
export const exportProjectAudioToMp3InBrowser = async ({
  project,
  ffmpeg,
  mediaRegistry,
  resolveMedia,
  onProgress,
  onLog,
  signal,
  exportOptions = {},
} = {}) => {
  if (
    !ffmpeg
    || typeof ffmpeg.exec !== 'function'
    || typeof ffmpeg.writeFile !== 'function'
    || typeof ffmpeg.readFile !== 'function'
  ) {
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
  const bitrate = normalizeBitrate(
    exportOptions.bitrate
      ?? exportOptions.audioBitrate
      ?? normalizedProject.output.audioBitrate,
  );
  const timeoutMs = Math.max(
    1_000,
    Number(exportOptions.timeoutMs) || DEFAULT_EXPORT_OPTIONS.timeoutMs,
  );
  const audibleClips = normalizedProject.clips.filter(isAudibleClip);
  if (audibleClips.length === 0) {
    throw new VideoExportError('This project has no audible audio to export.', {
      code: 'NO_AUDIBLE_AUDIO',
    });
  }

  const jobId = createEngineJobId('v2-project-audio');
  const outputFile = `${jobId}-output.mp3`;
  const cleanupFiles = new Set([outputFile]);
  const sourceFiles = new Map();
  const inputDescriptors = [];
  const probeCache = new Map();
  const logLines = [];

  const logHandler = (event) => {
    const message = String(event?.message || '');
    logLines.push(message);
    if (logLines.length > MAX_LOG_LINES) logLines.shift();
    if (typeof onLog === 'function') {
      try {
        onLog(event);
      } catch {
        // Consumer log handlers must not interrupt an export.
      }
    }
  };
  const progressHandler = ({ progress }) => {
    const normalized = clamp(Number(progress) || 0, 0, 1);
    emitProgress(onProgress, {
      phase: 'rendering',
      progress: 0.3 + normalized * 0.65,
      message: `Mixing audio… ${Math.round(normalized * 100)}%`,
    });
  };
  const releaseEngine = acquireFFmpegEngine(ffmpeg, {
    code: 'FFMPEG_ALREADY_RUNNING',
    message: 'This video engine is already processing another export or extraction.',
  });

  try {
    throwIfAborted(signal);
    ffmpeg.on?.('log', logHandler);
    emitProgress(onProgress, {
      phase: 'preparing',
      progress: 0,
      message: 'Preparing project audio…',
    });

    const mediaClips = audibleClips.filter((clip) => (
      !(clip.type === 'audio' && clip.sourceType === 'generated')
    ));
    for (let index = 0; index < mediaClips.length; index += 1) {
      const clip = mediaClips[index];
      throwIfAborted(signal);
      const cacheKey = getClipMediaCacheKey(clip);
      let fileName = sourceFiles.get(cacheKey);
      if (!fileName) {
        const extension = inferMediaExtension(
          clip,
          getRegistryValue(mediaRegistry, clip.mediaId),
        );
        fileName = `${jobId}-source-${sourceFiles.size}.${extension}`;
        const bytes = await resolveClipMedia({
          clip,
          project: normalizedProject,
          mediaRegistry,
          resolveMedia,
          signal,
        });
        throwIfAborted(signal);
        await ffmpeg.writeFile(fileName, bytes, { signal });
        sourceFiles.set(cacheKey, fileName);
        cleanupFiles.add(fileName);
      }
      inputDescriptors.push({
        key: clip.key,
        clip,
        kind: clip.type,
        fileName,
        loop: Boolean(clip.loop),
        hasAudio: false,
      });
      emitProgress(onProgress, {
        phase: 'preparing',
        progress: mediaClips.length
          ? ((index + 1) / mediaClips.length) * 0.15
          : 0.15,
        message: `Loading audio source ${index + 1} of ${mediaClips.length}…`,
      });
    }

    emitProgress(onProgress, {
      phase: 'probing',
      progress: 0.16,
      message: 'Checking source audio…',
    });
    for (let index = 0; index < inputDescriptors.length; index += 1) {
      const descriptor = inputDescriptors[index];
      throwIfAborted(signal);
      if (!probeCache.has(descriptor.fileName)) {
        const probeFile = `${jobId}-probe-${probeCache.size}.txt`;
        cleanupFiles.add(probeFile);
        cleanupFiles.add(`${probeFile}.null`);
        probeCache.set(
          descriptor.fileName,
          await hasAudioStream(ffmpeg, descriptor.fileName, {
            signal,
            timeoutMs: Math.min(timeoutMs, 30_000),
            probeFile,
          }),
        );
      }
      descriptor.hasAudio = probeCache.get(descriptor.fileName);
      if (!descriptor.hasAudio && hasUnsupportedAudioCodecLog(logLines.join('\n'))) {
        throw new VideoExportError(
          `The audio codec for “${descriptor.clip.name}” is not supported by the browser video engine.`,
          {
            code: 'AUDIO_CODEC_UNSUPPORTED',
            details: { clipId: descriptor.clip.id },
          },
        );
      }
      if (!descriptor.hasAudio && descriptor.kind === 'audio') {
        throw new VideoExportError(
          `“${descriptor.clip.name}” does not contain a usable audio track.`,
          {
            code: 'NO_AUDIO_STREAM',
            details: { clipId: descriptor.clip.id },
          },
        );
      }
      emitProgress(onProgress, {
        phase: 'probing',
        progress: 0.16 + ((index + 1) / inputDescriptors.length) * 0.1,
        message: `Checking audio source ${index + 1} of ${inputDescriptors.length}…`,
      });
    }

    const renderDescriptors = inputDescriptors
      .filter((descriptor) => descriptor.kind === 'audio' || descriptor.hasAudio)
      .map((descriptor, index) => ({ ...descriptor, index }));
    const descriptorMap = new Map(
      renderDescriptors.map((descriptor) => [descriptor.key, descriptor]),
    );
    const filterParts = [];
    const graph = appendProjectAudioGraph({
      clips: normalizedProject.clips,
      descriptorMap,
      duration: normalizedProject.duration,
      sampleRate: AUDIO_SAMPLE_RATE,
      filterParts,
      allowSilence: false,
    });
    if (!graph.outputLabel) {
      throw new VideoExportError('This project has no audible audio to export.', {
        code: 'NO_AUDIBLE_AUDIO',
      });
    }

    throwIfAborted(signal);
    const args = [
      '-y',
      ...createInputArguments(renderDescriptors),
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      `[${graph.outputLabel}]`,
      '-t',
      number(normalizedProject.duration),
      '-vn',
      '-c:a',
      'libmp3lame',
      '-b:a',
      bitrate,
      '-ar',
      String(AUDIO_SAMPLE_RATE),
      '-ac',
      String(AUDIO_CHANNELS),
      outputFile,
    ];
    ffmpeg.on?.('progress', progressHandler);
    emitProgress(onProgress, {
      phase: 'rendering',
      progress: 0.3,
      message: 'Mixing project audio…',
    });
    const exitCode = await ffmpeg.exec(args, timeoutMs, { signal });
    if (exitCode !== 0) {
      throw createFFmpegFailure({ logLines, exitCode });
    }

    throwIfAborted(signal);
    emitProgress(onProgress, {
      phase: 'finalizing',
      progress: 0.96,
      message: 'Finalizing MP3…',
    });
    const data = await ffmpeg.readFile(outputFile, undefined, { signal });
    const result = createOutput(data, normalizedProject, bitrate);
    emitProgress(onProgress, {
      phase: 'complete',
      progress: 1,
      message: 'Audio export complete.',
    });
    return result;
  } catch (error) {
    if (error instanceof VideoExportError) throw error;
    const convertedError = toExportError(error, 'Project audio export failed.');
    if (convertedError.code === 'EXPORT_CANCELLED') throw convertedError;
    throw createFFmpegFailure({ logLines, cause: error });
  } finally {
    ffmpeg.off?.('log', logHandler);
    ffmpeg.off?.('progress', progressHandler);
    for (const path of cleanupFiles) {
      await safeDeleteFile(ffmpeg, path);
    }
    releaseEngine();
  }
};
