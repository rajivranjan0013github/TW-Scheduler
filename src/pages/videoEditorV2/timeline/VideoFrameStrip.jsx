import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_FRAME_WIDTH = 32;
const MAX_FRAME_SAMPLES = 96;
const CACHE_LIMIT = 40;
const frameStripCache = new Map();
let extractionQueue = Promise.resolve();

const createAbortError = () => new DOMException('Frame extraction cancelled.', 'AbortError');

const waitForMediaEvent = (media, eventName, signal, timeoutMs = 12_000) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError());
    return;
  }
  let timeoutId;
  const cleanup = () => {
    clearTimeout(timeoutId);
    media.removeEventListener(eventName, handleSuccess);
    media.removeEventListener('error', handleError);
    signal?.removeEventListener('abort', handleAbort);
  };
  const handleSuccess = () => {
    cleanup();
    resolve();
  };
  const handleError = () => {
    cleanup();
    reject(new Error('The video frames could not be read.'));
  };
  const handleAbort = () => {
    cleanup();
    reject(createAbortError());
  };

  media.addEventListener(eventName, handleSuccess, { once: true });
  media.addEventListener('error', handleError, { once: true });
  signal?.addEventListener('abort', handleAbort, { once: true });
  timeoutId = setTimeout(() => {
    cleanup();
    reject(new Error('Video frame extraction timed out.'));
  }, timeoutMs);
});

const seekVideo = async (video, time, signal) => {
  if (signal?.aborted) throw createAbortError();
  if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.002) return;
  const seeked = waitForMediaEvent(video, 'seeked', signal, 6_000);
  video.currentTime = time;
  await seeked;
};

const drawFrameCover = (context, video, x, width, height) => {
  const sourceWidth = Math.max(1, video.videoWidth);
  const sourceHeight = Math.max(1, video.videoHeight);
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    x,
    0,
    width,
    height,
  );
};

const extractFrameStrip = async ({
  sourceUrl,
  sourceStart,
  duration,
  playbackRate,
  frameCount,
  sampleStepSeconds,
  renderWidth,
  renderHeight,
  signal,
}) => {
  if (signal?.aborted) throw createAbortError();
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  if (!sourceUrl.startsWith('blob:') && !sourceUrl.startsWith('data:')) {
    video.crossOrigin = 'anonymous';
  }

  try {
    const metadataLoaded = waitForMediaEvent(video, 'loadedmetadata', signal);
    video.src = sourceUrl;
    video.load();
    await metadataLoaded;
    if (video.readyState < 2) await waitForMediaEvent(video, 'loadeddata', signal);

    const canvas = document.createElement('canvas');
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The frame-strip canvas is unavailable.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'medium';

    const maximumSourceTime = Number.isFinite(video.duration)
      ? Math.max(0, video.duration - 0.002)
      : Number.POSITIVE_INFINITY;
    const renderedPixelsPerSecond = renderWidth / duration;
    const frameWidth = sampleStepSeconds * renderedPixelsPerSecond;
    for (let index = 0; index < frameCount; index += 1) {
      if (signal?.aborted) throw createAbortError();
      const frameTimelineStart = index * sampleStepSeconds;
      const frameTimelineDuration = Math.min(
        sampleStepSeconds,
        Math.max(0, duration - frameTimelineStart),
      );
      const timelineOffset = frameTimelineStart + (frameTimelineDuration / 2);
      const sourceTime = Math.min(
        maximumSourceTime,
        Math.max(0, sourceStart + (timelineOffset * playbackRate)),
      );
      await seekVideo(video, sourceTime, signal);
      const frameX = index * frameWidth;
      const renderedFrameWidth = Math.min(frameWidth, renderWidth - frameX);
      drawFrameCover(context, video, frameX, renderedFrameWidth, renderHeight);
      if (index > 0) {
        context.fillStyle = 'rgba(255, 255, 255, 0.12)';
        context.fillRect(Math.round(frameX), 0, 1, renderHeight);
      }
    }

    return canvas.toDataURL('image/webp', 0.88);
  } finally {
    video.removeAttribute('src');
    video.load?.();
  }
};

const queueExtraction = (task) => {
  const result = extractionQueue.then(task, task);
  extractionQueue = result.catch(() => undefined);
  return result;
};

const cacheFrameStrip = (key, value) => {
  if (frameStripCache.has(key)) frameStripCache.delete(key);
  frameStripCache.set(key, value);
  while (frameStripCache.size > CACHE_LIMIT) {
    frameStripCache.delete(frameStripCache.keys().next().value);
  }
};

export const VideoFrameStrip = ({
  clip,
  width,
  height,
  fps = 30,
  pixelsPerSecond,
}) => {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [generatedStrip, setGeneratedStrip] = useState({ key: '', url: '' });
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const sourceStart = Math.max(0, Number(clip.sourceStart) || 0);
  const playbackRate = Math.max(0.01, Number(clip.playbackRate) || 1);
  const renderWidth = Math.max(1, Math.ceil(Number(width) || 1));
  const renderHeight = Math.max(1, Math.ceil(Number(height) || 1));
  const preferredFrameWidth = Math.max(MIN_FRAME_WIDTH, renderHeight * 0.6);
  const timelineFps = Math.max(1, Number(fps) || 30);
  const timelinePixelsPerSecond = Math.max(1, Number(pixelsPerSecond) || 1);
  const pixelsPerFrame = timelinePixelsPerSecond / timelineFps;
  const totalFrames = Math.max(1, Math.ceil(duration * timelineFps));
  const framesPerThumbnail = Math.max(
    1,
    Math.ceil(preferredFrameWidth / pixelsPerFrame),
    Math.ceil(totalFrames / MAX_FRAME_SAMPLES),
  );
  const sampleStepSeconds = framesPerThumbnail / timelineFps;
  const frameCount = Math.max(1, Math.ceil(totalFrames / framesPerThumbnail));
  const cacheKey = useMemo(() => [
    clip.mediaId || clip.sourceUrl,
    clip.sourceUrl,
    sourceStart.toFixed(3),
    duration.toFixed(3),
    playbackRate.toFixed(3),
    timelineFps.toFixed(3),
    framesPerThumbnail,
    frameCount,
    renderWidth,
    renderHeight,
  ].join('|'), [
    clip.mediaId,
    clip.sourceUrl,
    duration,
    framesPerThumbnail,
    frameCount,
    playbackRate,
    renderHeight,
    renderWidth,
    sourceStart,
    timelineFps,
  ]);
  const stripUrl = generatedStrip.key === cacheKey
    ? generatedStrip.url
    : (frameStripCache.get(cacheKey) || '');

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '160px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !clip.sourceUrl) return undefined;
    const cached = frameStripCache.get(cacheKey);
    if (cached) return undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      queueExtraction(() => extractFrameStrip({
        sourceUrl: clip.sourceUrl,
        sourceStart,
        duration,
        playbackRate,
        frameCount,
        sampleStepSeconds,
        renderWidth,
        renderHeight,
        signal: controller.signal,
      })).then((url) => {
        if (controller.signal.aborted) return;
        cacheFrameStrip(cacheKey, url);
        setGeneratedStrip({ key: cacheKey, url });
      }).catch(() => {
        if (!controller.signal.aborted) setGeneratedStrip({ key: cacheKey, url: '' });
      });
    }, 120);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    cacheKey,
    clip.sourceUrl,
    duration,
    frameCount,
    playbackRate,
    renderHeight,
    renderWidth,
    sourceStart,
    sampleStepSeconds,
    visible,
  ]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {stripUrl && (
        <img
          src={stripUrl}
          alt=""
          draggable="false"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
};
