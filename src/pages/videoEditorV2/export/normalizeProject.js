import {
  DEFAULT_EXPORT_OPTIONS,
  MAX_EXPORT_DURATION_SECONDS,
  MAX_OUTPUT_EDGE,
  MAX_OUTPUT_PIXELS,
  SUPPORTED_PRESETS,
} from './constants.js';
import { VideoExportError } from './errors.js';
import {
  DEFAULT_TEXT_STYLE,
  MAX_PLAYBACK_RATE,
  MIN_CROP_SIZE,
  MIN_PLAYBACK_RATE,
} from '../project/projectConstants.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const finiteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const positiveNumber = (value, fallback) => {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
};

const evenInteger = (value, fallback) => {
  const rounded = Math.round(positiveNumber(value, fallback));
  return rounded % 2 === 0 ? rounded : rounded - 1;
};

const normalizeAudioBitrate = (value) => {
  const candidate = String(value || DEFAULT_EXPORT_OPTIONS.audioBitrate).trim();
  return /^\d{2,4}k$/i.test(candidate)
    ? candidate.toLowerCase()
    : DEFAULT_EXPORT_OPTIONS.audioBitrate;
};

export const normalizeHexColor = (value, fallback = '#000000') => {
  const candidate = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(candidate)) return candidate.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return `#${candidate
      .slice(1)
      .split('')
      .map((part) => `${part}${part}`)
      .join('')}`.toUpperCase();
  }
  return fallback;
};

const normalizeCrop = (crop = {}) => {
  const maximumOrigin = 1 - MIN_CROP_SIZE;
  const x = clamp(finiteNumber(crop.x, 0), 0, maximumOrigin);
  const y = clamp(finiteNumber(crop.y, 0), 0, maximumOrigin);
  const width = clamp(positiveNumber(crop.width, 1), MIN_CROP_SIZE, 1 - x);
  const height = clamp(positiveNumber(crop.height, 1), MIN_CROP_SIZE, 1 - y);

  return { x, y, width, height };
};

const normalizeTransform = (transform = {}) => ({
  x: clamp(finiteNumber(transform.x, 0.5), -1, 2),
  y: clamp(finiteNumber(transform.y, 0.5), -1, 2),
  scale: clamp(positiveNumber(transform.scale, 1), 0.05, 10),
  rotation: clamp(finiteNumber(transform.rotation, 0), -360, 360),
  opacity: clamp(finiteNumber(transform.opacity, 1), 0, 1),
  flipX: Boolean(transform.flipX),
  flipY: Boolean(transform.flipY),
});

const normalizeFit = (fit) => {
  if (fit === 'fill' || fit === 'cover') return 'cover';
  if (fit === 'stretch') return 'stretch';
  return 'contain';
};

const normalizeStyle = (style = {}) => ({
  fontFamily: String(style.fontFamily || DEFAULT_TEXT_STYLE.fontFamily),
  fontWeight: style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
  fontSize: clamp(positiveNumber(style.fontSize, DEFAULT_TEXT_STYLE.fontSize), 1, 1000),
  color: String(style.color || style.fontColor || '#FFFFFF'),
  strokeColor: String(style.strokeColor || '#000000'),
  strokeWidth: clamp(finiteNumber(style.strokeWidth, DEFAULT_TEXT_STYLE.strokeWidth), 0, 100),
  backgroundColor: String(style.backgroundColor || 'transparent'),
  backgroundType: String(style.backgroundType || style.bgType || 'none'),
  textAlign: ['left', 'right', 'center'].includes(style.textAlign)
    ? style.textAlign
    : 'center',
  lineHeight: clamp(positiveNumber(style.lineHeight, 1.2), 0.5, 4),
  letterSpacing: clamp(finiteNumber(style.letterSpacing, 0), -20, 100),
  maxWidth: positiveNumber(style.maxWidth, 0.82),
  boxWidth: clamp(finiteNumber(style.boxWidth, 0), 0, 1),
  boxHeight: clamp(finiteNumber(style.boxHeight, 0), 0, 1),
  padding: clamp(finiteNumber(style.padding, 0), 0, 300),
  paddingX: style.paddingX === null || style.paddingX === undefined
    ? null
    : clamp(finiteNumber(style.paddingX, 0), 0, 300),
  paddingY: style.paddingY === null || style.paddingY === undefined
    ? null
    : clamp(finiteNumber(style.paddingY, 0), 0, 300),
  borderRadius: clamp(finiteNumber(style.borderRadius, 12), 0, 300),
  shadowColor: String(style.shadowColor || 'transparent'),
  shadowBlur: clamp(finiteNumber(style.shadowBlur, 0), 0, 100),
  shadowOffsetX: finiteNumber(style.shadowOffsetX, 0),
  shadowOffsetY: finiteNumber(style.shadowOffsetY, 0),
});

const normalizeAnimation = (animation = {}) => ({
  in: String(animation.in || 'none').toLowerCase(),
  out: String(animation.out || 'none').toLowerCase(),
  inDuration: Math.max(0, finiteNumber(animation.inDuration, 0)),
  outDuration: Math.max(0, finiteNumber(animation.outDuration, 0)),
});

const normalizeClip = (clip, track, trackIndex, clipIndex) => {
  const type = String(clip?.type || track.type || '').toLowerCase();
  const playbackRate = clamp(
    positiveNumber(clip?.playbackRate, 1),
    MIN_PLAYBACK_RATE,
    MAX_PLAYBACK_RATE,
  );
  const sourceStart = Math.max(0, finiteNumber(clip?.sourceStart, 0));
  const sourceDuration = Math.max(0, finiteNumber(clip?.sourceDuration, 0));
  const timelineStart = Math.max(
    0,
    finiteNumber(clip?.timelineStart ?? clip?.startTime ?? clip?.start, 0),
  );
  let duration = Math.max(0, finiteNumber(clip?.duration, 0));
  const loops = type === 'audio' && Boolean(clip?.loop);

  if (sourceDuration > 0 && !loops) {
    duration = Math.min(
      duration,
      Math.max(0, (sourceDuration - sourceStart) / playbackRate),
    );
  }

  const base = {
    ...clip,
    key: `track-${trackIndex}-clip-${clipIndex}`,
    id: String(clip?.id || `clip-${trackIndex}-${clipIndex}`),
    enabled: clip?.enabled !== false,
    type,
    name: String(clip?.name || `${type || 'media'} clip`),
    mediaId: clip?.mediaId == null ? '' : String(clip.mediaId),
    sourceUrl: String(clip?.sourceUrl || clip?.url || clip?.originalUrl || ''),
    sourceType: String(clip?.sourceType || ''),
    mimeType: String(clip?.mimeType || ''),
    timelineStart,
    sourceStart,
    sourceDuration,
    duration,
    playbackRate,
    trackIndex,
    clipIndex,
    trackMuted: Boolean(track.muted),
    trackHidden: Boolean(track.hidden),
  };

  if (type === 'video' || type === 'image') {
    return {
      ...base,
      volume: clamp(finiteNumber(clip?.volume, 1), 0, 4),
      muted: Boolean(clip?.muted),
      crop: normalizeCrop(clip?.crop),
      transform: normalizeTransform(clip?.transform),
      fit: normalizeFit(clip?.fit),
    };
  }

  if (type === 'audio') {
    return {
      ...base,
      volume: clamp(finiteNumber(clip?.volume, 1), 0, 4),
      muted: Boolean(clip?.muted),
      loop: Boolean(clip?.loop),
      fadeIn: Math.max(0, finiteNumber(clip?.fadeIn, 0)),
      fadeOut: Math.max(0, finiteNumber(clip?.fadeOut, 0)),
      frequency: clamp(finiteNumber(clip?.frequency, 180), 20, 20000),
    };
  }

  if (type === 'text') {
    return {
      ...base,
      text: String(clip?.text || ''),
      style: normalizeStyle(clip?.style),
      transform: normalizeTransform(clip?.transform),
      animation: normalizeAnimation(clip?.animation),
    };
  }

  return base;
};

const getProjectDuration = (project, clips) => {
  const derivedDuration = clips.filter((clip) => clip.enabled).reduce(
    (maximum, clip) => Math.max(maximum, clip.timelineStart + clip.duration),
    0,
  );
  const declaredDuration = Math.max(0, finiteNumber(project?.duration, 0));
  return Math.max(derivedDuration, declaredDuration);
};

/**
 * Validates and normalizes a serializable V2 project without mutating it.
 * Track order is retained and is used as visual bottom-to-top layer order.
 */
export const normalizeProject = (project, exportOptions = {}) => {
  if (!project || typeof project !== 'object') {
    throw new VideoExportError('A valid video project is required.', {
      code: 'INVALID_PROJECT',
    });
  }

  const tracks = Array.isArray(project.tracks) ? project.tracks : [];
  const clips = tracks.flatMap((track, trackIndex) => {
    const trackClips = Array.isArray(track?.clips) ? track.clips : [];
    return trackClips.map((clip, clipIndex) =>
      normalizeClip(clip, track || {}, trackIndex, clipIndex),
    );
  });
  const duration = getProjectDuration(project, clips);

  if (duration <= 0) {
    throw new VideoExportError('The project has no timed content to export.', {
      code: 'EMPTY_PROJECT',
    });
  }

  const projectLimit = positiveNumber(
    project.output?.maxDuration,
    MAX_EXPORT_DURATION_SECONDS,
  );
  const maximumDuration = Math.min(projectLimit, MAX_EXPORT_DURATION_SECONDS);
  if (duration > maximumDuration + 0.001) {
    throw new VideoExportError(
      `This editor exports at most ${maximumDuration} seconds. Shorten the timeline before exporting.`,
      {
        code: 'PROJECT_TOO_LONG',
        details: { duration, maximumDuration },
      },
    );
  }

  const width = evenInteger(
    exportOptions.width ?? project.output?.width,
    DEFAULT_EXPORT_OPTIONS.width,
  );
  const height = evenInteger(
    exportOptions.height ?? project.output?.height,
    DEFAULT_EXPORT_OPTIONS.height,
  );

  if (
    width < 2 ||
    height < 2 ||
    width > MAX_OUTPUT_EDGE ||
    height > MAX_OUTPUT_EDGE ||
    width * height > MAX_OUTPUT_PIXELS
  ) {
    throw new VideoExportError(
      `Output resolution ${width}x${height} exceeds the editor limit.`,
      {
        code: 'INVALID_OUTPUT_RESOLUTION',
        details: { width, height },
      },
    );
  }

  const preset = String(exportOptions.preset || DEFAULT_EXPORT_OPTIONS.preset);
  const normalizedPreset = SUPPORTED_PRESETS.has(preset)
    ? preset
    : DEFAULT_EXPORT_OPTIONS.preset;

  const output = {
    width,
    height,
    fps: clamp(
      finiteNumber(exportOptions.fps ?? project.output?.fps, DEFAULT_EXPORT_OPTIONS.fps),
      1,
      60,
    ),
    backgroundColor: normalizeHexColor(
      exportOptions.backgroundColor ?? project.output?.backgroundColor,
      DEFAULT_EXPORT_OPTIONS.backgroundColor,
    ),
    videoCodec: DEFAULT_EXPORT_OPTIONS.videoCodec,
    audioCodec: DEFAULT_EXPORT_OPTIONS.audioCodec,
    preset: normalizedPreset,
    crf: clamp(
      finiteNumber(exportOptions.crf, DEFAULT_EXPORT_OPTIONS.crf),
      18,
      35,
    ),
    audioBitrate: normalizeAudioBitrate(exportOptions.audioBitrate),
    audioSampleRate: Math.round(
      clamp(
        finiteNumber(
          exportOptions.audioSampleRate,
          DEFAULT_EXPORT_OPTIONS.audioSampleRate,
        ),
        8000,
        96000,
      ),
    ),
  };

  const activeClips = clips
    .filter(
      (clip) =>
        clip.enabled && clip.duration >= 0.01 && clip.timelineStart < duration,
    )
    .map((clip) => ({
      ...clip,
      duration: Math.min(clip.duration, duration - clip.timelineStart),
    }));

  return {
    ...project,
    duration,
    output,
    clips: activeClips,
  };
};
