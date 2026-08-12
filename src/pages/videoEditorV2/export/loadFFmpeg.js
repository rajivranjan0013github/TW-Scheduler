import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { DEFAULT_FFMPEG_CORE_BASE_URL } from './constants.js';
import { VideoExportError, throwIfAborted } from './errors.js';

/**
 * Creates and loads an FFmpeg.wasm instance. Pass loadConfig with self-hosted
 * coreURL/wasmURL in production; the CDN base is only a convenient default.
 */
export const loadBrowserFFmpeg = async ({
  ffmpeg = new FFmpeg(),
  coreBaseURL = DEFAULT_FFMPEG_CORE_BASE_URL,
  loadConfig,
  signal,
} = {}) => {
  if (ffmpeg.loaded) return ffmpeg;
  throwIfAborted(signal);

  try {
    let config = loadConfig;
    if (!config) {
      config = {
        coreURL: await toBlobURL(
          `${coreBaseURL}/ffmpeg-core.js`,
          'text/javascript',
        ),
        wasmURL: await toBlobURL(
          `${coreBaseURL}/ffmpeg-core.wasm`,
          'application/wasm',
        ),
      };
    }
    throwIfAborted(signal);
    await ffmpeg.load(config, { signal });
    return ffmpeg;
  } catch (error) {
    if (error instanceof VideoExportError) throw error;
    throw new VideoExportError(
      'Could not load the browser video-processing engine.',
      {
        code: 'FFMPEG_LOAD_FAILED',
        cause: error,
      },
    );
  }
};
