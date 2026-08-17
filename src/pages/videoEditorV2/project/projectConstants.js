export const PROJECT_SCHEMA_VERSION = 1;

export const PROJECT_HARD_MAX_DURATION = 30;
export const MIN_CLIP_DURATION = 0.1;
export const MIN_CROP_SIZE = 0.01;
export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 4;
export const DEFAULT_CLIP_DURATION = 5;
export const DEFAULT_HISTORY_LIMIT = 100;

export const TRACK_TYPES = Object.freeze({
  VIDEO: 'video',
  TEXT: 'text',
  AUDIO: 'audio',
  IMAGE: 'image',
});

export const TRACK_TYPE_VALUES = Object.freeze(Object.values(TRACK_TYPES));

export const DEFAULT_OUTPUT_SETTINGS = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  maxDuration: PROJECT_HARD_MAX_DURATION,
  backgroundColor: '#000000',
});

export const DEFAULT_CROP = Object.freeze({
  x: 0,
  y: 0,
  width: 1,
  height: 1,
});

export const DEFAULT_TRANSFORM = Object.freeze({
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipX: false,
  flipY: false,
});

export const DEFAULT_TEXT_STYLE = Object.freeze({
  fontFamily: 'Outfit',
  fontWeight: 600,
  fontSize: 40,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 3,
  backgroundColor: '#000000',
  backgroundType: 'none',
  textAlign: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  maxWidth: 0.82,
  // Explicit text-box dimensions as output ratios; zero keeps content-driven sizing.
  boxWidth: 0,
  boxHeight: 0,
  padding: 0,
  // Optional axis-specific padding. Null preserves the editor's legacy auto-padding.
  paddingX: null,
  paddingY: null,
  borderRadius: 12,
  shadowColor: 'transparent',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
});

export const DEFAULT_TEXT_ANIMATION = Object.freeze({
  in: 'none',
  out: 'none',
  inDuration: 0,
  outDuration: 0,
});

export const DEFAULT_TRACK_DEFINITIONS = Object.freeze([
  Object.freeze({ type: TRACK_TYPES.VIDEO, name: 'Video' }),
  Object.freeze({ type: TRACK_TYPES.TEXT, name: 'Text' }),
  Object.freeze({ type: TRACK_TYPES.AUDIO, name: 'Audio' }),
]);
