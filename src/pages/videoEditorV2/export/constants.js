export const MAX_EXPORT_DURATION_SECONDS = 30;
export const MAX_OUTPUT_EDGE = 1920;
export const MAX_OUTPUT_PIXELS = 1280 * 1920;

export const DEFAULT_EXPORT_OPTIONS = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  backgroundColor: '#000000',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  preset: 'ultrafast',
  crf: 26,
  audioBitrate: '192k',
  audioSampleRate: 44100,
  timeoutMs: 15 * 60 * 1000,
});

export const DEFAULT_FFMPEG_CORE_BASE_URL =
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export const SUPPORTED_PRESETS = new Set([
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
]);
