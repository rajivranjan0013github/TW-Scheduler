import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeVideo,
} from 'mediabunny';
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
import { renderTextClipToPng } from './textOverlayRenderer.js';
import {
  createPatchRemovalBuffers,
  drawPatchedMediaFrame,
} from './patchRemovalRenderer.js';
import {
  getClipSourceTime,
  hasPatchRemovalMask,
  resolvePatchRemovalAtSourceTime,
} from '../project/patchRemoval.js';

const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
);

const number = (value) => Number(Number(value).toFixed(6)).toString();

const emitProgress = (callback, payload) => {
  if (typeof callback !== 'function') return;
  try {
    callback(payload);
  } catch {
    // Progress observers must not interrupt an export.
  }
};

const isCancellation = (error, signal) => (
  Boolean(signal?.aborted)
  || error?.name === 'AbortError'
  || error?.code === 'EXPORT_CANCELLED'
);

const isVisualClip = (clip) => (
  !clip.trackHidden
  && ['video', 'image', 'text'].includes(clip.type)
  && !(clip.type === 'text' && !clip.text.trim())
);

const isAudibleClip = (clip) => {
  if (!['video', 'audio'].includes(clip.type)) return false;
  return !clip.trackHidden
    && !clip.trackMuted
    && !clip.muted
    && clip.volume > 0;
};

const needsResolvedMedia = (clip) => (
  (isVisualClip(clip) && ['video', 'image'].includes(clip.type))
  || (isAudibleClip(clip) && clip.sourceType !== 'generated')
);

const getVideoBitrate = (output) => {
  const pixelsPerSecond = output.width * output.height * output.fps;
  const crfAdjustment = clamp(1 + (26 - output.crf) * 0.08, 0.65, 1.75);
  return Math.round(clamp(pixelsPerSecond * 0.12 * crfAdjustment, 2_000_000, 18_000_000));
};

const createCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new VideoExportError('Hardware export requires a browser canvas.', {
    code: 'HARDWARE_CANVAS_UNAVAILABLE',
  });
};

const createBitmap = async (bytes, mimeType, signal) => {
  throwIfAborted(signal);
  if (typeof createImageBitmap !== 'function') {
    throw new VideoExportError('This browser cannot prepare images for hardware export.', {
      code: 'IMAGE_BITMAP_UNAVAILABLE',
    });
  }
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType || 'image/png' }));
  if (signal?.aborted) {
    bitmap.close?.();
    throwIfAborted(signal);
  }
  return bitmap;
};

const getSourceTime = (clip, timelineTime) => (
  Math.max(0, Number(clip.sourceStart) || 0)
  + Math.max(0, timelineTime - clip.timelineStart) * Math.max(0.01, clip.playbackRate)
);

const isActiveAtTime = (clip, timelineTime) => (
  timelineTime >= clip.timelineStart
  && timelineTime < clip.timelineStart + clip.duration
);

const getTextFadeOpacity = (clip, timelineTime) => {
  const localTime = Math.max(0, timelineTime - clip.timelineStart);
  const remaining = Math.max(0, clip.duration - localTime);
  const fadeIn = clip.animation?.in === 'fade'
    ? Math.min(clip.duration, clip.animation.inDuration || 0)
    : 0;
  const fadeOut = clip.animation?.out === 'fade'
    ? Math.min(clip.duration, clip.animation.outDuration || 0)
    : 0;
  const fadeInOpacity = fadeIn > 0 ? clamp(localTime / fadeIn, 0, 1) : 1;
  const fadeOutOpacity = fadeOut > 0 ? clamp(remaining / fadeOut, 0, 1) : 1;
  return Math.min(fadeInOpacity, fadeOutOpacity);
};

const drawMediaLayer = ({
  context,
  source,
  clip,
  output,
  patchSurfaces,
  timelineTime,
}) => {
  let mediaSource = source;
  const sourceWidth = Math.max(1, Number(source.width || source.videoWidth) || output.width);
  const sourceHeight = Math.max(1, Number(source.height || source.videoHeight) || output.height);
  const crop = clip.crop || { x: 0, y: 0, width: 1, height: 1 };
  const transform = clip.transform || {
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipX: false,
    flipY: false,
  };
  let sourceX = crop.x * sourceWidth;
  let sourceY = crop.y * sourceHeight;
  let croppedWidth = Math.max(1, crop.width * sourceWidth);
  let croppedHeight = Math.max(1, crop.height * sourceHeight);

  const resolvedPatchRemoval = clip.type === 'video'
    ? resolvePatchRemovalAtSourceTime(
        clip.patchRemoval,
        getClipSourceTime(clip, timelineTime),
      )
    : null;
  if (clip.type === 'video' && hasPatchRemovalMask(resolvedPatchRemoval)) {
    const maximumPatchEdge = Math.max(output.width, output.height, 1280);
    const patchScale = Math.min(1, maximumPatchEdge / Math.max(croppedWidth, croppedHeight));
    const patchWidth = Math.max(1, Math.round(croppedWidth * patchScale));
    const patchHeight = Math.max(1, Math.round(croppedHeight * patchScale));
    let surface = patchSurfaces.get(clip.id);
    if (!surface) {
      surface = {
        canvas: createCanvas(patchWidth, patchHeight),
        buffers: createPatchRemovalBuffers(),
      };
      patchSurfaces.set(clip.id, surface);
    }
    drawPatchedMediaFrame({
      destination: surface.canvas,
      source,
      crop,
      patchRemoval: resolvedPatchRemoval,
      width: patchWidth,
      height: patchHeight,
      buffers: surface.buffers,
    });
    mediaSource = surface.canvas;
    sourceX = 0;
    sourceY = 0;
    croppedWidth = patchWidth;
    croppedHeight = patchHeight;
  }
  const croppedAspect = croppedWidth / croppedHeight;
  const targetWidth = output.width * transform.scale;
  const targetHeight = output.height * transform.scale;
  const targetAspect = targetWidth / targetHeight;
  let drawWidth = targetWidth;
  let drawHeight = targetHeight;
  let clipToTarget = false;

  if (clip.fit === 'contain') {
    if (croppedAspect >= targetAspect) drawHeight = targetWidth / croppedAspect;
    else drawWidth = targetHeight * croppedAspect;
  } else if (clip.fit === 'cover') {
    clipToTarget = true;
    if (croppedAspect >= targetAspect) drawWidth = targetHeight * croppedAspect;
    else drawHeight = targetWidth / croppedAspect;
  }

  context.save();
  context.translate(output.width * transform.x, output.height * transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  context.globalAlpha = transform.opacity;
  if (clipToTarget) {
    context.beginPath();
    context.rect(-targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
    context.clip();
  }
  context.drawImage(
    mediaSource,
    sourceX,
    sourceY,
    croppedWidth,
    croppedHeight,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();
};

const drawTextLayer = ({ context, bitmap, clip, timelineTime, output }) => {
  context.save();
  context.globalAlpha = getTextFadeOpacity(clip, timelineTime);
  context.drawImage(bitmap, 0, 0, output.width, output.height);
  context.restore();
};

const resolveMedia = async ({
  project,
  mediaRegistry,
  resolveMedia: resolveMediaOverride,
  signal,
  onProgress,
}) => {
  const requiredClips = project.clips.filter(needsResolvedMedia);
  const uniqueClips = [];
  const seen = new Set();
  requiredClips.forEach((clip) => {
    const key = getClipMediaCacheKey(clip);
    if (seen.has(key)) return;
    seen.add(key);
    uniqueClips.push(clip);
  });

  const media = new Map();
  for (let index = 0; index < uniqueClips.length; index += 1) {
    throwIfAborted(signal);
    const clip = uniqueClips[index];
    const key = getClipMediaCacheKey(clip);
    const bytes = await resolveClipMedia({
      clip,
      project,
      mediaRegistry,
      resolveMedia: resolveMediaOverride,
      signal,
    });
    media.set(key, {
      bytes,
      blob: new Blob([bytes], { type: clip.mimeType || '' }),
      extension: inferMediaExtension(clip, mediaRegistry?.get?.(clip.mediaId)),
    });
    emitProgress(onProgress, {
      phase: 'preparing',
      progress: uniqueClips.length ? ((index + 1) / uniqueClips.length) * 0.14 : 0.14,
      message: `Loading media ${index + 1} of ${uniqueClips.length}…`,
    });
  }
  return media;
};

const buildFrameTimestamps = ({ clip, frameCount, fps, firstTimestamp }) => {
  const timestamps = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const timelineTime = frameIndex / fps;
    if (!isActiveAtTime(clip, timelineTime)) continue;
    timestamps.push(firstTimestamp + getSourceTime(clip, timelineTime));
  }
  return timestamps;
};

const prepareVisualResources = async ({ project, media, frameCount, signal, onProgress }) => {
  const visualClips = project.clips
    .filter(isVisualClip)
    .sort((left, right) => (
      left.trackIndex - right.trackIndex || left.clipIndex - right.clipIndex
    ));
  const resources = [];

  try {
    for (let index = 0; index < visualClips.length; index += 1) {
      throwIfAborted(signal);
      const clip = visualClips[index];
      if (clip.type === 'text') {
        const bytes = await renderTextClipToPng(clip, {
          width: project.output.width,
          height: project.output.height,
          signal,
        });
        resources.push({
          clip,
          kind: 'text',
          bitmap: await createBitmap(bytes, 'image/png', signal),
        });
      } else if (clip.type === 'image') {
        const resolved = media.get(getClipMediaCacheKey(clip));
        if (resolved.extension === 'gif' || clip.mimeType === 'image/gif') {
          throw new VideoExportError(
            `Animated image “${clip.name}” requires compatibility export.`,
            { code: 'HARDWARE_ANIMATED_IMAGE_UNSUPPORTED' },
          );
        }
        resources.push({
          clip,
          kind: 'image',
          bitmap: await createBitmap(resolved.bytes, clip.mimeType, signal),
        });
      } else {
        const resolved = media.get(getClipMediaCacheKey(clip));
        const input = new Input({
          formats: ALL_FORMATS,
          source: new BlobSource(resolved.blob),
        });
        const resource = { clip, kind: 'video', input, iterator: null };
        resources.push(resource);
        if (!await input.canRead()) {
          throw new VideoExportError(`The browser cannot read “${clip.name}” for hardware export.`, {
            code: 'HARDWARE_INPUT_UNREADABLE',
            details: { clipId: clip.id },
          });
        }
        const track = await input.getPrimaryVideoTrack();
        if (!track) {
          throw new VideoExportError(`“${clip.name}” has no browser-decodable video track.`, {
            code: 'HARDWARE_VIDEO_TRACK_MISSING',
            details: { clipId: clip.id },
          });
        }
        if (!await track.canDecode()) {
          throw new VideoExportError(`The browser cannot decode “${clip.name}” with hardware export.`, {
            code: 'HARDWARE_VIDEO_CODEC_UNSUPPORTED',
            details: { clipId: clip.id },
          });
        }
        const firstTimestamp = await track.getFirstTimestamp();
        const sink = new CanvasSink(track, {
          alpha: true,
          poolSize: 1,
          decoderOptions: {
            hardwareAcceleration: 'prefer-hardware',
            optimizeForLatency: true,
          },
        });
        const timestamps = buildFrameTimestamps({
          clip,
          frameCount,
          fps: project.output.fps,
          firstTimestamp,
        });
        resource.iterator = sink.canvasesAtTimestamps(timestamps);
      }

      emitProgress(onProgress, {
        phase: 'preparing',
        progress: 0.14 + (visualClips.length ? ((index + 1) / visualClips.length) * 0.08 : 0.08),
        message: `Preparing layer ${index + 1} of ${visualClips.length}…`,
      });
    }
    return resources;
  } catch (error) {
    await cleanupVisualResources(resources);
    throw error;
  }
};

const cleanupVisualResources = async (resources) => {
  for (const resource of resources) {
    try {
      await resource.iterator?.return?.();
    } catch {
      // The iterator may already have released its decoder.
    }
    resource.bitmap?.close?.();
    resource.input?.dispose?.();
  }
};

const renderHardwareVideo = async ({ project, media, signal, onProgress }) => {
  const { output, duration } = project;
  const frameDuration = 1 / output.fps;
  const frameCount = Math.max(1, Math.ceil(duration * output.fps));
  const canvas = createCanvas(output.width, output.height);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new VideoExportError('Could not create the hardware rendering canvas.', {
      code: 'HARDWARE_CANVAS_CONTEXT_UNAVAILABLE',
    });
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const resources = await prepareVisualResources({
    project,
    media,
    frameCount,
    signal,
    onProgress,
  });
  const patchSurfaces = new Map();
  const target = new BufferTarget();
  const container = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({
      bitrate: getVideoBitrate(output),
      bitrateMode: 'variable',
    }),
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'quality',
    alpha: 'discard',
    keyFrameInterval: 2,
    contentHint: 'motion',
  });
  container.addVideoTrack(videoSource, { frameRate: output.fps });
  let cancellationPromise = null;
  const cancelHardwareWork = () => {
    resources.forEach((resource) => resource.input?.dispose?.());
    cancellationPromise ??= container.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancelHardwareWork, { once: true });

  try {
    throwIfAborted(signal);
    await container.start();
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      throwIfAborted(signal);
      const timelineTime = frameIndex / output.fps;
      context.save();
      context.globalAlpha = 1;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = output.backgroundColor;
      context.fillRect(0, 0, output.width, output.height);
      context.restore();

      const activeResources = resources.filter((resource) => (
        isActiveAtTime(resource.clip, timelineTime)
      ));
      const videoFrames = new Map();
      await Promise.all(activeResources.map(async (resource) => {
        if (resource.kind !== 'video') return;
        const result = await resource.iterator.next();
        videoFrames.set(resource, result.done ? null : result.value?.canvas || null);
      }));

      activeResources.forEach((resource) => {
        if (resource.kind === 'text') {
          drawTextLayer({
            context,
            bitmap: resource.bitmap,
            clip: resource.clip,
            timelineTime,
            output,
          });
          return;
        }
        const source = resource.kind === 'video'
          ? videoFrames.get(resource)
          : resource.bitmap;
        if (source) drawMediaLayer({
          context,
          source,
          clip: resource.clip,
          output,
          patchSurfaces,
          timelineTime,
        });
      });

      await videoSource.add(
        timelineTime,
        Math.min(frameDuration, Math.max(frameDuration / 2, duration - timelineTime)),
        { keyFrame: frameIndex % Math.max(1, Math.round(output.fps * 2)) === 0 },
      );

      if (frameIndex === frameCount - 1 || frameIndex % Math.max(1, Math.round(output.fps / 2)) === 0) {
        emitProgress(onProgress, {
          phase: 'rendering',
          progress: 0.22 + ((frameIndex + 1) / frameCount) * 0.61,
          message: `Hardware rendering… ${Math.round(((frameIndex + 1) / frameCount) * 100)}%`,
        });
      }
    }

    videoSource.close();
    throwIfAborted(signal);
    emitProgress(onProgress, {
      phase: 'finalizing',
      progress: 0.84,
      message: 'Finalizing hardware-encoded video…',
    });
    await container.finalize();
    if (!target.buffer) {
      throw new VideoExportError('The hardware encoder returned an empty video.', {
        code: 'HARDWARE_OUTPUT_EMPTY',
      });
    }
    const bytes = new Uint8Array(target.buffer.byteLength);
    bytes.set(new Uint8Array(target.buffer));
    return bytes;
  } finally {
    signal?.removeEventListener('abort', cancelHardwareWork);
    if (!['finalized', 'canceled'].includes(container.state)) {
      try {
        await container.cancel();
      } catch {
        // Preserve the original render error.
      }
    }
    await cancellationPromise;
    await cleanupVisualResources(resources);
  }
};

const createAudioInputArguments = (descriptors) => descriptors.flatMap((descriptor) => (
  descriptor.kind === 'audio' && descriptor.loop
    ? ['-stream_loop', '-1', '-i', descriptor.fileName]
    : ['-i', descriptor.fileName]
));

const muxHardwareVideoWithProjectAudio = async ({
  project,
  hardwareVideoBytes,
  media,
  ffmpeg,
  signal,
  onProgress,
  onLog,
  timeoutMs,
}) => {
  const releaseEngine = acquireFFmpegEngine(ffmpeg, {
    code: 'EXPORT_ALREADY_RUNNING',
    message: 'This media engine is already exporting another video.',
  });
  const jobId = createEngineJobId('v2-hw');
  const hardwareFile = `${jobId}-video.mp4`;
  const outputFile = `${jobId}-output.mp4`;
  const cleanupFiles = new Set([hardwareFile, outputFile]);
  const sourceFiles = new Map();
  const descriptors = [];
  const audioProbeCache = new Map();
  const logs = [];
  const logHandler = (event) => {
    logs.push(String(event?.message || ''));
    if (logs.length > 80) logs.shift();
    if (typeof onLog === 'function') {
      try {
        onLog(event);
      } catch {
        // Log observers must not interrupt the mux.
      }
    }
  };
  const progressHandler = ({ progress }) => {
    emitProgress(onProgress, {
      phase: 'finalizing',
      progress: 0.86 + clamp(Number(progress) || 0, 0, 1) * 0.12,
      message: 'Mixing audio and finalizing MP4…',
    });
  };

  try {
    throwIfAborted(signal);
    await ffmpeg.writeFile(hardwareFile, hardwareVideoBytes, { signal });
    const audioClips = project.clips.filter(isAudibleClip);
    for (const clip of audioClips) {
      if (clip.sourceType === 'generated') continue;
      const key = getClipMediaCacheKey(clip);
      const resolved = media.get(key);
      let fileName = sourceFiles.get(key);
      if (!fileName) {
        fileName = `${jobId}-audio-source-${sourceFiles.size}.${resolved.extension}`;
        await ffmpeg.writeFile(fileName, resolved.bytes, { signal });
        sourceFiles.set(key, fileName);
        cleanupFiles.add(fileName);
      }
      if (clip.type === 'video' && !audioProbeCache.has(fileName)) {
        const probeFile = `${jobId}-probe-${audioProbeCache.size}.txt`;
        audioProbeCache.set(fileName, await hasAudioStream(ffmpeg, fileName, {
          signal,
          timeoutMs: Math.min(timeoutMs, 30_000),
          probeFile,
        }));
      }
      const hasAudio = clip.type === 'audio' || audioProbeCache.get(fileName) === true;
      if (!hasAudio) continue;
      descriptors.push({
        key: clip.key,
        kind: clip.type,
        fileName,
        loop: Boolean(clip.loop),
        index: descriptors.length + 1,
        hasAudio,
      });
    }

    const filterParts = [];
    appendProjectAudioGraph({
      clips: project.clips,
      descriptorMap: new Map(descriptors.map((descriptor) => [descriptor.key, descriptor])),
      duration: project.duration,
      sampleRate: project.output.audioSampleRate,
      filterParts,
    });
    const args = [
      '-y',
      '-i',
      hardwareFile,
      ...createAudioInputArguments(descriptors),
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      '0:v:0',
      '-map',
      '[outa]',
      '-t',
      number(project.duration),
      '-c:v',
      'copy',
      '-c:a',
      project.output.audioCodec,
      '-b:a',
      project.output.audioBitrate,
      '-ar',
      number(project.output.audioSampleRate),
      '-ac',
      '2',
      '-max_muxing_queue_size',
      '1024',
      '-movflags',
      '+faststart',
      outputFile,
    ];

    ffmpeg.on('log', logHandler);
    ffmpeg.on('progress', progressHandler);
    emitProgress(onProgress, {
      phase: 'finalizing',
      progress: 0.86,
      message: 'Mixing audio and finalizing MP4…',
    });
    const exitCode = await ffmpeg.exec(args, timeoutMs, { signal });
    if (exitCode !== 0) {
      const usefulLog = [...logs].reverse().find((line) => (
        /error|invalid|failed|unable|not found|cannot/i.test(line)
      ));
      throw new VideoExportError(usefulLog || 'The accelerated video audio mix failed.', {
        code: 'HARDWARE_AUDIO_MUX_FAILED',
        details: { exitCode },
      });
    }

    throwIfAborted(signal);
    const data = await ffmpeg.readFile(outputFile, undefined, { signal });
    if (typeof data === 'string') {
      throw new VideoExportError('The accelerated exporter returned invalid MP4 data.', {
        code: 'HARDWARE_INVALID_OUTPUT',
      });
    }
    const sourceBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const bytes = new Uint8Array(sourceBytes.byteLength);
    bytes.set(sourceBytes);
    return bytes;
  } finally {
    ffmpeg.off?.('log', logHandler);
    ffmpeg.off?.('progress', progressHandler);
    for (const fileName of cleanupFiles) {
      await safeDeleteFile(ffmpeg, fileName);
    }
    releaseEngine();
  }
};

export const canUseHardwareAcceleratedExport = async (project, exportOptions = {}) => {
  if (
    typeof window === 'undefined'
    || typeof VideoEncoder === 'undefined'
    || typeof VideoFrame === 'undefined'
  ) {
    return false;
  }
  const normalizedProject = normalizeProject(project, exportOptions);
  try {
    return await canEncodeVideo('avc', {
      width: normalizedProject.output.width,
      height: normalizedProject.output.height,
      quality: new Quality({ bitrate: getVideoBitrate(normalizedProject.output) }),
      hardwareAcceleration: 'prefer-hardware',
    });
  } catch {
    return false;
  }
};

export const exportProjectWithHardwareAcceleration = async ({
  project,
  ffmpeg,
  mediaRegistry,
  resolveMedia: resolveMediaOverride,
  onProgress,
  onLog,
  signal,
  exportOptions = {},
} = {}) => {
  if (!ffmpeg?.loaded) {
    throw new VideoExportError('A loaded media engine is required for accelerated audio mixing.', {
      code: 'FFMPEG_NOT_LOADED',
    });
  }
  const normalizedProject = normalizeProject(project, exportOptions);
  const timeoutMs = Math.max(
    1_000,
    Number(exportOptions.timeoutMs) || DEFAULT_EXPORT_OPTIONS.timeoutMs,
  );

  try {
    throwIfAborted(signal);
    emitProgress(onProgress, {
      phase: 'preparing',
      progress: 0,
      message: 'Preparing hardware-accelerated export…',
    });
    const media = await resolveMedia({
      project: normalizedProject,
      mediaRegistry,
      resolveMedia: resolveMediaOverride,
      signal,
      onProgress,
    });
    const hardwareVideoBytes = await renderHardwareVideo({
      project: normalizedProject,
      media,
      signal,
      onProgress,
    });
    const bytes = await muxHardwareVideoWithProjectAudio({
      project: normalizedProject,
      hardwareVideoBytes,
      media,
      ffmpeg,
      signal,
      onProgress,
      onLog,
      timeoutMs,
    });
    const fileName = `${String(normalizedProject.name || 'video')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'video'}.mp4`;
    emitProgress(onProgress, {
      phase: 'complete',
      progress: 1,
      message: 'Hardware-accelerated export complete.',
    });
    return {
      bytes,
      blob: new Blob([bytes], { type: 'video/mp4' }),
      fileName,
      mimeType: 'video/mp4',
      duration: normalizedProject.duration,
      output: normalizedProject.output,
      engine: 'webcodecs',
    };
  } catch (error) {
    if (signal?.aborted) throwIfAborted(signal);
    throw toExportError(error, 'Hardware-accelerated video export failed.');
  }
};

export const exportProjectWithBestAvailableEngine = async (options = {}) => {
  const {
    project,
    exportOptions = {},
    onProgress,
    signal,
  } = options;
  const hasPatchRemoval = project?.tracks?.some((track) => (
    track.clips?.some((clip) => clip.type === 'video' && hasPatchRemovalMask(clip.patchRemoval))
  ));
  if (exportOptions.hardwareAcceleration === false) {
    if (hasPatchRemoval) {
      throw new VideoExportError(
        'Patch removal requires browser hardware video encoding. Enable hardware acceleration to export this project.',
        { code: 'PATCH_REMOVAL_HARDWARE_REQUIRED' },
      );
    }
    const { exportProjectInBrowser } = await import('./browserExporter.js');
    return exportProjectInBrowser(options);
  }

  const supported = await canUseHardwareAcceleratedExport(project, exportOptions);
  if (!supported) {
    if (hasPatchRemoval) {
      throw new VideoExportError(
        'This browser cannot export patch removal. Use a browser with WebCodecs hardware encoding support.',
        { code: 'PATCH_REMOVAL_HARDWARE_UNAVAILABLE' },
      );
    }
    emitProgress(onProgress, {
      phase: 'preparing',
      progress: 0,
      message: 'Hardware encoding unavailable; using compatibility export…',
    });
    const { exportProjectInBrowser } = await import('./browserExporter.js');
    return exportProjectInBrowser(options);
  }

  try {
    return await exportProjectWithHardwareAcceleration(options);
  } catch (error) {
    if (isCancellation(error, signal)) throw error;
    if (hasPatchRemoval) throw error;
    emitProgress(onProgress, {
      phase: 'preparing',
      progress: 0,
      message: 'Hardware export was unavailable for this media; retrying with compatibility export…',
    });
    const { exportProjectInBrowser } = await import('./browserExporter.js');
    return exportProjectInBrowser(options);
  }
};
