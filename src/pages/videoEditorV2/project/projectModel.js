import {
  DEFAULT_CLIP_DURATION,
  DEFAULT_CROP,
  DEFAULT_OUTPUT_SETTINGS,
  DEFAULT_TEXT_ANIMATION,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRACK_DEFINITIONS,
  DEFAULT_TRANSFORM,
  MAX_PLAYBACK_RATE,
  MIN_CLIP_DURATION,
  MIN_CROP_SIZE,
  MIN_PLAYBACK_RATE,
  PROJECT_HARD_MAX_DURATION,
  PROJECT_SCHEMA_VERSION,
  TRACK_TYPES,
  TRACK_TYPE_VALUES,
} from './projectConstants.js';

let fallbackIdCounter = 0;

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const createEditorId = (prefix = 'item') => {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const clampNumber = (value, min, max, fallback = min) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
};

export const roundTimelineTime = (value) => Math.round(Number(value || 0) * 1_000_000) / 1_000_000;

export const sanitizeJsonValue = (value, seen = new WeakSet()) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item, seen))
      .filter((item) => item !== undefined);
  }
  if (!isPlainObject(value)) return undefined;
  if (seen.has(value)) return undefined;

  seen.add(value);
  const sanitized = {};
  Object.entries(value).forEach(([key, item]) => {
    const nextValue = sanitizeJsonValue(item, seen);
    if (nextValue !== undefined) sanitized[key] = nextValue;
  });
  seen.delete(value);
  return sanitized;
};

const asString = (value, fallback = '') => (
  typeof value === 'string' ? value : fallback
);

const normalizeColor = (value, fallback) => (
  typeof value === 'string' && value.trim() ? value : fallback
);

const normalizeFontWeight = (value) => {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return Math.round(clampNumber(numericValue, 100, 900, DEFAULT_TEXT_STYLE.fontWeight));
  }

  const namedWeights = {
    thin: 100,
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  };
  return namedWeights[String(value || '').replace(/\s+/g, '').toLowerCase()]
    || DEFAULT_TEXT_STYLE.fontWeight;
};

const normalizeSourceDuration = (value) => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? roundTimelineTime(duration) : 0;
};

const normalizePlaybackRate = (value) => clampNumber(
  value,
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  1,
);

const getAvailableTimelineDuration = (clip) => {
  const { sourceDuration, sourceStart, playbackRate } = clip;
  if (clip.type === TRACK_TYPES.AUDIO && clip.loop) {
    return Number.POSITIVE_INFINITY;
  }
  if (sourceDuration <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, (sourceDuration - sourceStart) / playbackRate);
};

const normalizeTimedMediaFields = (input, defaultDuration = DEFAULT_CLIP_DURATION) => {
  const sourceDuration = normalizeSourceDuration(input.sourceDuration ?? input.mediaDuration);
  const playbackRate = normalizePlaybackRate(input.playbackRate);
  const maximumSourceStart = sourceDuration > 0
    ? Math.max(0, sourceDuration - Math.min(sourceDuration, MIN_CLIP_DURATION * playbackRate))
    : Number.MAX_SAFE_INTEGER;
  const sourceStart = roundTimelineTime(clampNumber(input.sourceStart, 0, maximumSourceStart, 0));
  const availableDuration = getAvailableTimelineDuration({ sourceDuration, sourceStart, playbackRate });
  const durationFallback = sourceDuration > 0
    ? Math.min(defaultDuration, availableDuration)
    : defaultDuration;
  const requestedDuration = clampNumber(
    input.duration,
    Math.min(MIN_CLIP_DURATION, availableDuration),
    availableDuration,
    durationFallback,
  );

  return {
    timelineStart: roundTimelineTime(clampNumber(input.timelineStart, 0, Number.MAX_SAFE_INTEGER, 0)),
    sourceStart,
    duration: roundTimelineTime(requestedDuration),
    sourceDuration,
    playbackRate,
  };
};

export const normalizeCrop = (crop = {}) => {
  const cropInput = isPlainObject(crop) ? crop : {};
  const maximumOrigin = 1 - MIN_CROP_SIZE;
  const x = clampNumber(cropInput.x, 0, maximumOrigin, DEFAULT_CROP.x);
  const y = clampNumber(cropInput.y, 0, maximumOrigin, DEFAULT_CROP.y);
  const maximumWidth = 1 - x;
  const maximumHeight = 1 - y;
  const width = clampNumber(
    cropInput.width,
    MIN_CROP_SIZE,
    maximumWidth,
    Math.min(DEFAULT_CROP.width, maximumWidth),
  );
  const height = clampNumber(
    cropInput.height,
    MIN_CROP_SIZE,
    maximumHeight,
    Math.min(DEFAULT_CROP.height, maximumHeight),
  );

  return { x, y, width, height };
};

export const normalizeTransform = (transform = {}) => ({
  x: clampNumber(transform.x, 0, 1, DEFAULT_TRANSFORM.x),
  y: clampNumber(transform.y, 0, 1, DEFAULT_TRANSFORM.y),
  scale: clampNumber(transform.scale, 0.01, 100, DEFAULT_TRANSFORM.scale),
  rotation: clampNumber(transform.rotation, -3600, 3600, DEFAULT_TRANSFORM.rotation),
  opacity: clampNumber(transform.opacity, 0, 1, DEFAULT_TRANSFORM.opacity),
  flipX: Boolean(transform.flipX),
  flipY: Boolean(transform.flipY),
});

const createMediaIdentity = (input) => ({
  mediaId: asString(input.mediaId ?? input.assetId ?? input.id),
  sourceUrl: asString(input.sourceUrl ?? input.url),
  originalUrl: asString(input.originalUrl),
  sourceType: asString(input.sourceType, 'library'),
  mimeType: asString(input.mimeType ?? input.mimetype),
});

const createBaseClip = (type, input, defaultDuration) => ({
  id: asString(input.id) || createEditorId('clip'),
  type,
  name: asString(input.name, type === TRACK_TYPES.TEXT ? 'Text' : `Untitled ${type}`),
  enabled: input.enabled !== false,
  ...normalizeTimedMediaFields(input, defaultDuration),
  metadata: sanitizeJsonValue(input.metadata) || {},
});

export const createVideoClip = (input = {}) => ({
  ...createBaseClip(TRACK_TYPES.VIDEO, input, DEFAULT_CLIP_DURATION),
  ...createMediaIdentity(input),
  volume: clampNumber(input.volume, 0, 2, 1),
  muted: Boolean(input.muted),
  fit: ['fit', 'fill', 'stretch'].includes(input.fit) ? input.fit : 'fill',
  crop: normalizeCrop(input.crop),
  transform: normalizeTransform(input.transform),
  effects: {
    brightness: clampNumber(input.effects?.brightness, -1, 1, 0),
    contrast: clampNumber(input.effects?.contrast, -1, 1, 0),
    saturation: clampNumber(input.effects?.saturation, 0, 3, 1),
    blur: clampNumber(input.effects?.blur, 0, 100, 0),
  },
});

export const createAudioClip = (input = {}) => {
  const loop = Boolean(input.loop);
  const actualSourceDuration = normalizeSourceDuration(input.sourceDuration ?? input.mediaDuration);
  const clip = createBaseClip(
    TRACK_TYPES.AUDIO,
    loop ? { ...input, sourceDuration: 0 } : input,
    DEFAULT_CLIP_DURATION,
  );
  const maximumFade = clip.duration / 2;

  return {
    ...clip,
    ...createMediaIdentity(input),
    sourceDuration: actualSourceDuration,
    volume: clampNumber(input.volume, 0, 2, 1),
    muted: Boolean(input.muted),
    loop,
    fadeIn: clampNumber(input.fadeIn, 0, maximumFade, 0),
    fadeOut: clampNumber(input.fadeOut, 0, maximumFade, 0),
    frequency: clampNumber(input.frequency, 20, 20_000, 180),
  };
};

export const createTextClip = (input = {}) => {
  const styleInput = input.style || {};
  const animationInput = input.animation || {};
  const clip = createBaseClip(TRACK_TYPES.TEXT, input, 3);

  return {
    ...clip,
    sourceStart: 0,
    sourceDuration: 0,
    playbackRate: 1,
    text: asString(input.text, 'Add text'),
    style: {
      fontFamily: asString(styleInput.fontFamily, DEFAULT_TEXT_STYLE.fontFamily),
      fontWeight: normalizeFontWeight(styleInput.fontWeight),
      fontSize: clampNumber(styleInput.fontSize, 1, 1000, DEFAULT_TEXT_STYLE.fontSize),
      color: normalizeColor(styleInput.color ?? styleInput.fontColor, DEFAULT_TEXT_STYLE.color),
      strokeColor: normalizeColor(styleInput.strokeColor, DEFAULT_TEXT_STYLE.strokeColor),
      strokeWidth: clampNumber(styleInput.strokeWidth, 0, 100, DEFAULT_TEXT_STYLE.strokeWidth),
      backgroundColor: normalizeColor(styleInput.backgroundColor ?? styleInput.bgColor, DEFAULT_TEXT_STYLE.backgroundColor),
      backgroundType: asString(styleInput.backgroundType ?? styleInput.bgType, DEFAULT_TEXT_STYLE.backgroundType),
      textAlign: ['left', 'center', 'right'].includes(styleInput.textAlign)
        ? styleInput.textAlign
        : DEFAULT_TEXT_STYLE.textAlign,
      lineHeight: clampNumber(styleInput.lineHeight, 0.5, 5, DEFAULT_TEXT_STYLE.lineHeight),
      letterSpacing: clampNumber(styleInput.letterSpacing, -100, 500, DEFAULT_TEXT_STYLE.letterSpacing),
      maxWidth: clampNumber(styleInput.maxWidth, 0.05, 1, DEFAULT_TEXT_STYLE.maxWidth),
      boxWidth: clampNumber(styleInput.boxWidth, 0, 1, DEFAULT_TEXT_STYLE.boxWidth),
      boxHeight: clampNumber(styleInput.boxHeight, 0, 1, DEFAULT_TEXT_STYLE.boxHeight),
      padding: clampNumber(styleInput.padding, 0, 300, DEFAULT_TEXT_STYLE.padding),
      paddingX: styleInput.paddingX === null || styleInput.paddingX === undefined
        ? DEFAULT_TEXT_STYLE.paddingX
        : clampNumber(styleInput.paddingX, 0, 300, 0),
      paddingY: styleInput.paddingY === null || styleInput.paddingY === undefined
        ? DEFAULT_TEXT_STYLE.paddingY
        : clampNumber(styleInput.paddingY, 0, 300, 0),
      borderRadius: clampNumber(styleInput.borderRadius, 0, 300, DEFAULT_TEXT_STYLE.borderRadius),
      shadowColor: normalizeColor(styleInput.shadowColor, DEFAULT_TEXT_STYLE.shadowColor),
      shadowBlur: clampNumber(styleInput.shadowBlur, 0, 100, DEFAULT_TEXT_STYLE.shadowBlur),
      shadowOffsetX: clampNumber(styleInput.shadowOffsetX, -500, 500, DEFAULT_TEXT_STYLE.shadowOffsetX),
      shadowOffsetY: clampNumber(styleInput.shadowOffsetY, -500, 500, DEFAULT_TEXT_STYLE.shadowOffsetY),
    },
    transform: normalizeTransform(input.transform),
    animation: {
      in: asString(animationInput.in, DEFAULT_TEXT_ANIMATION.in),
      out: asString(animationInput.out, DEFAULT_TEXT_ANIMATION.out),
      inDuration: clampNumber(animationInput.inDuration, 0, clip.duration, DEFAULT_TEXT_ANIMATION.inDuration),
      outDuration: clampNumber(animationInput.outDuration, 0, clip.duration, DEFAULT_TEXT_ANIMATION.outDuration),
    },
  };
};

export const createImageClip = (input = {}) => ({
  ...createBaseClip(TRACK_TYPES.IMAGE, input, 3),
  ...createMediaIdentity(input),
  sourceStart: 0,
  sourceDuration: 0,
  playbackRate: 1,
  fit: ['fit', 'fill', 'stretch'].includes(input.fit) ? input.fit : 'fit',
  crop: normalizeCrop(input.crop),
  transform: normalizeTransform(input.transform),
});

export const createClip = (type, input = {}) => {
  switch (type) {
    case TRACK_TYPES.VIDEO:
      return createVideoClip(input);
    case TRACK_TYPES.AUDIO:
      return createAudioClip(input);
    case TRACK_TYPES.TEXT:
      return createTextClip(input);
    case TRACK_TYPES.IMAGE:
      return createImageClip(input);
    default:
      throw new Error(`Unsupported clip type: ${type}`);
  }
};

export const createTrack = (type, input = {}) => {
  if (!TRACK_TYPE_VALUES.includes(type)) {
    throw new Error(`Unsupported track type: ${type}`);
  }

  return {
    id: asString(input.id) || createEditorId(`${type}-track`),
    type,
    name: asString(input.name, `${type.charAt(0).toUpperCase()}${type.slice(1)}`),
    locked: Boolean(input.locked),
    muted: Boolean(input.muted),
    hidden: Boolean(input.hidden),
    clips: Array.isArray(input.clips)
      ? input.clips
        .filter((clip) => isPlainObject(clip) && (!clip.type || clip.type === type))
        .map((clip) => createClip(type, clip))
      : [],
  };
};

export const normalizeOutputSettings = (output = {}) => ({
  width: Math.round(clampNumber(output.width, 16, 3840, DEFAULT_OUTPUT_SETTINGS.width)),
  height: Math.round(clampNumber(output.height, 16, 3840, DEFAULT_OUTPUT_SETTINGS.height)),
  fps: clampNumber(output.fps, 1, 60, DEFAULT_OUTPUT_SETTINGS.fps),
  maxDuration: clampNumber(
    output.maxDuration,
    MIN_CLIP_DURATION,
    PROJECT_HARD_MAX_DURATION,
    DEFAULT_OUTPUT_SETTINGS.maxDuration,
  ),
  backgroundColor: normalizeColor(output.backgroundColor, DEFAULT_OUTPUT_SETTINGS.backgroundColor),
});

const asTrackArray = (tracks) => {
  if (Array.isArray(tracks)) return tracks;
  if (!isPlainObject(tracks)) return [];

  return Object.entries(tracks).map(([type, value]) => ({
    type,
    clips: Array.isArray(value) ? value : value?.clips,
    ...(isPlainObject(value) ? value : {}),
  }));
};

const constrainClipToProject = (clip, maxDuration) => {
  const maximumStart = Math.max(0, maxDuration - Math.min(MIN_CLIP_DURATION, maxDuration));
  const timelineStart = roundTimelineTime(clampNumber(clip.timelineStart, 0, maximumStart, 0));
  const maximumTimelineDuration = Math.max(0, maxDuration - timelineStart);
  const maximumSourceDuration = getAvailableTimelineDuration(clip);
  const maximumDuration = Math.min(maximumTimelineDuration, maximumSourceDuration);
  const minimumDuration = Math.min(MIN_CLIP_DURATION, maximumDuration);

  return createClip(clip.type, {
    ...clip,
    timelineStart,
    duration: clampNumber(clip.duration, minimumDuration, maximumDuration, minimumDuration),
  });
};

export const calculateProjectDuration = (project) => {
  const maximum = asTrackArray(project?.tracks).reduce((projectEnd, track) => {
    const trackEnd = (Array.isArray(track.clips) ? track.clips : []).reduce((clipEnd, clip) => {
      const start = Number(clip.timelineStart);
      const duration = Number(clip.duration);
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return clipEnd;
      return Math.max(clipEnd, start + duration);
    }, 0);
    return Math.max(projectEnd, trackEnd);
  }, 0);

  const maxDuration = normalizeOutputSettings(project?.output).maxDuration;
  return roundTimelineTime(Math.min(maximum, maxDuration));
};

export const normalizeProject = (project = {}) => {
  const output = normalizeOutputSettings(project.output);
  const providedTracks = asTrackArray(project.tracks)
    .filter((track) => TRACK_TYPE_VALUES.includes(track?.type))
    .map((track) => createTrack(track.type, track));

  const tracks = [...providedTracks];
  DEFAULT_TRACK_DEFINITIONS.forEach((definition) => {
    if (!tracks.some((track) => track.type === definition.type)) {
      tracks.push(createTrack(definition.type, definition));
    }
  });

  const constrainedTracks = tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => constrainClipToProject(clip, output.maxDuration)),
  }));
  const now = new Date().toISOString();
  const normalized = {
    version: PROJECT_SCHEMA_VERSION,
    id: asString(project.id) || createEditorId('project'),
    name: asString(project.name, 'Untitled Video'),
    createdAt: asString(project.createdAt, now),
    updatedAt: asString(project.updatedAt, now),
    output,
    tracks: constrainedTracks,
    metadata: sanitizeJsonValue(project.metadata) || {},
  };

  return {
    ...normalized,
    duration: calculateProjectDuration(normalized),
  };
};

export const createEditorProject = (input = {}) => {
  const requestedTracks = asTrackArray(input.tracks);
  const tracks = requestedTracks.length > 0
    ? requestedTracks
    : DEFAULT_TRACK_DEFINITIONS.map((definition) => createTrack(definition.type, definition));

  return normalizeProject({
    ...input,
    tracks,
  });
};

export const serializeProject = (project) => JSON.stringify(normalizeProject(project));

export const deserializeProject = (serializedProject) => {
  const parsedProject = typeof serializedProject === 'string'
    ? JSON.parse(serializedProject)
    : serializedProject;
  return normalizeProject(parsedProject);
};

export const cloneProject = (project) => deserializeProject(serializeProject(project));

export const isEditorProject = (project) => (
  isPlainObject(project)
  && Number(project.version) === PROJECT_SCHEMA_VERSION
  && (Array.isArray(project.tracks) || isPlainObject(project.tracks))
);
