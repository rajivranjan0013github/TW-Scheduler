import { createAtempoFilters } from './audioFilters.js';
import { DEFAULT_EXPORT_OPTIONS } from './constants.js';
import { acquireFFmpegEngine, createEngineJobId } from './engineRuntime.js';
import {
  VideoExportError,
  throwIfAborted,
  toExportError,
} from './errors.js';
import {
  hasAudioStream,
  inferMediaExtension,
  resolveClipMedia,
  safeDeleteFile,
} from './media.js';

const AUDIO_MIME_TYPE = 'audio/mpeg';
const AUDIO_SAMPLE_RATE = 44_100;
const MAX_LOG_LINES = 80;

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
    // Consumer progress handlers must not interrupt extraction.
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

const normalizeClip = (clip) => {
  if (!clip || typeof clip !== 'object' || String(clip.type).toLowerCase() !== 'video') {
    throw new VideoExportError('Select a video clip before extracting audio.', {
      code: 'VIDEO_CLIP_REQUIRED',
    });
  }

  const duration = Number(clip.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new VideoExportError('The selected video clip has no extractable duration.', {
      code: 'INVALID_AUDIO_SPAN',
      details: { clipId: clip.id, duration: clip.duration },
    });
  }

  const sourceStartValue = Number(clip.sourceStart ?? 0);
  const sourceStart = Number.isFinite(sourceStartValue)
    ? Math.max(0, sourceStartValue)
    : 0;
  const playbackRateValue = Number(clip.playbackRate ?? 1);
  if (!Number.isFinite(playbackRateValue) || playbackRateValue <= 0) {
    throw new VideoExportError('The selected video clip has an invalid playback speed.', {
      code: 'INVALID_PLAYBACK_RATE',
      details: { clipId: clip.id, playbackRate: clip.playbackRate },
    });
  }

  return {
    ...clip,
    type: 'video',
    sourceStart,
    duration,
    playbackRate: playbackRateValue,
  };
};

const createOutput = (data, clip) => {
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
  const baseName = String(clip.name || 'extracted-audio')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'extracted-audio';

  return {
    blob: new Blob([bytes], { type: AUDIO_MIME_TYPE }),
    bytes,
    fileName: `${baseName}.mp3`,
    duration: clip.duration,
    mimeType: AUDIO_MIME_TYPE,
  };
};

const getUsefulLogLine = (lines) => [...lines].reverse().find((line) => (
  /error|invalid|failed|unable|not found|unknown|cannot|matches no streams/i.test(line)
));

const hasUnsupportedAudioCodecLog = (logText) => (
  /unknown decoder|decoder[^\n]*(?:not found|unsupported)|unsupported codec/i.test(logText)
);

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
  if (/matches no streams|does not contain any stream|stream specifier[^\n]*a:0[^\n]*matches no streams/i.test(logText)) {
    return new VideoExportError('The selected video does not contain an audio track.', {
      code: 'NO_AUDIO_STREAM',
      cause,
      details: { exitCode },
    });
  }
  if (hasUnsupportedAudioCodecLog(logText)) {
    return new VideoExportError(
      'The audio codec in this video is not supported by the browser video engine.',
      { code: 'AUDIO_CODEC_UNSUPPORTED', cause, details: { exitCode } },
    );
  }

  return new VideoExportError(
    getUsefulLogLine(logLines)
      || 'Could not extract audio from this video. Its audio codec may not be supported.',
    {
      code: 'AUDIO_EXTRACTION_FAILED',
      cause,
      details: { exitCode },
    },
  );
};

/**
 * Extracts the selected V2 video clip's audible source span into a browser MP3.
 * The source is decoded directly from the original video; no intermediate file is persisted.
 */
export const extractAudioToMp3InBrowser = async ({
  clip: clipInput,
  project,
  ffmpeg,
  mediaRegistry,
  resolveMedia,
  signal,
  onProgress,
  bitrate,
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

  const clip = normalizeClip(clipInput);
  const normalizedBitrate = normalizeBitrate(bitrate);
  const jobId = createEngineJobId('v2-audio');
  const registryValue = getRegistryValue(mediaRegistry, clip.mediaId);
  const extension = inferMediaExtension(clip, registryValue);
  const inputFile = `${jobId}-source.${extension}`;
  const outputFile = `${jobId}-output.mp3`;
  const probeFile = `${jobId}-probe.txt`;
  const cleanupFiles = new Set([
    inputFile,
    outputFile,
    probeFile,
    `${probeFile}.null`,
  ]);
  const logLines = [];

  const logHandler = (event) => {
    logLines.push(String(event?.message || ''));
    if (logLines.length > MAX_LOG_LINES) logLines.shift();
  };
  const progressHandler = ({ progress }) => {
    const normalized = clamp(Number(progress) || 0, 0, 1);
    emitProgress(onProgress, {
      phase: 'extracting',
      progress: 0.25 + normalized * 0.7,
      message: `Extracting audio… ${Math.round(normalized * 100)}%`,
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
      message: 'Loading source video…',
    });
    const sourceBytes = await resolveClipMedia({
      clip,
      project,
      mediaRegistry,
      resolveMedia,
      signal,
    });
    throwIfAborted(signal);
    await ffmpeg.writeFile(inputFile, sourceBytes, { signal });

    emitProgress(onProgress, {
      phase: 'probing',
      progress: 0.15,
      message: 'Checking source audio…',
    });
    const sourceHasAudio = await hasAudioStream(ffmpeg, inputFile, {
      signal,
      timeoutMs: Math.min(DEFAULT_EXPORT_OPTIONS.timeoutMs, 30_000),
      probeFile,
    });
    if (!sourceHasAudio) {
      if (hasUnsupportedAudioCodecLog(logLines.join('\n'))) {
        throw new VideoExportError(
          'The audio codec in this video is not supported by the browser video engine.',
          { code: 'AUDIO_CODEC_UNSUPPORTED', details: { clipId: clip.id } },
        );
      }
      throw new VideoExportError('The selected video does not contain an audio track.', {
        code: 'NO_AUDIO_STREAM',
        details: { clipId: clip.id },
      });
    }

    throwIfAborted(signal);
    const sourceEnd = clip.sourceStart + (clip.duration * clip.playbackRate);
    const filters = [
      `atrim=start=${number(clip.sourceStart)}:end=${number(sourceEnd)}`,
      'asetpts=PTS-STARTPTS',
      ...createAtempoFilters(clip.playbackRate),
      `atrim=duration=${number(clip.duration)}`,
      `aformat=sample_fmts=fltp:sample_rates=${AUDIO_SAMPLE_RATE}:channel_layouts=stereo`,
    ];
    const args = [
      '-y',
      '-i',
      inputFile,
      '-map',
      '0:a:0',
      '-af',
      filters.join(','),
      '-vn',
      '-c:a',
      'libmp3lame',
      '-b:a',
      normalizedBitrate,
      '-ar',
      String(AUDIO_SAMPLE_RATE),
      '-ac',
      '2',
      outputFile,
    ];

    ffmpeg.on?.('progress', progressHandler);
    emitProgress(onProgress, {
      phase: 'extracting',
      progress: 0.25,
      message: 'Extracting audio…',
    });
    const exitCode = await ffmpeg.exec(
      args,
      DEFAULT_EXPORT_OPTIONS.timeoutMs,
      { signal },
    );
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
    const result = createOutput(data, clip);
    emitProgress(onProgress, {
      phase: 'complete',
      progress: 1,
      message: 'Audio extraction complete.',
    });
    return result;
  } catch (error) {
    if (error instanceof VideoExportError) throw error;
    const convertedError = toExportError(error, 'Audio extraction failed.');
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
