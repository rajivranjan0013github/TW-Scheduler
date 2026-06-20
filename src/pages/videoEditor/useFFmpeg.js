import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

/**
 * Manages the FFmpeg.wasm lifecycle: loading, SharedArrayBuffer check,
 * and provides helpers for probing/cleaning the virtual filesystem.
 */
export const useFFmpeg = () => {
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [engineError, setEngineError] = useState('');
  const ffmpegRef = useRef(new FFmpeg());
  const ffmpegLogHandlerRef = useRef(null);
  const ffmpegLogLinesRef = useRef([]);

  const loadFFmpeg = useCallback(async () => {
    // SharedArrayBuffer is required by FFmpeg.wasm
    if (typeof SharedArrayBuffer === 'undefined') {
      setEngineError(
        'Your browser environment does not support SharedArrayBuffer. ' +
        'The server must send Cross-Origin-Isolation headers (COOP + COEP) for video processing to work.'
      );
      return;
    }

    try {
      setFfmpegLoading(true);
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const ffmpeg = ffmpegRef.current;

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setFfmpegLoaded(true);
    } catch (err) {
      console.error('Failed to load FFmpeg.wasm:', err);
      setEngineError('Error loading video processing engine. Please reload the page.');
    } finally {
      setFfmpegLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]);

  /** Check whether a file in the virtual filesystem has an audio stream. */
  const hasAudioStream = useCallback(async (inputName) => {
    const ffmpeg = ffmpegRef.current;
    const probeOutput = `probe_audio_${inputName}.null`;

    try {
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-map', '0:a:0',
        '-frames:a', '1',
        '-f', 'null',
        probeOutput,
      ]);
      return exitCode === 0;
    } catch {
      return false;
    }
  }, []);

  /** Safely delete a file from FFmpeg's virtual filesystem. */
  const removeIfExists = useCallback(async (path) => {
    try {
      await ffmpegRef.current.deleteFile(path);
    } catch {
      // FFmpeg's virtual filesystem throws when the file is absent.
    }
  }, []);

  return {
    ffmpegRef,
    ffmpegLoaded,
    ffmpegLoading,
    engineError,
    hasAudioStream,
    removeIfExists,
    ffmpegLogHandlerRef,
    ffmpegLogLinesRef,
  };
};
