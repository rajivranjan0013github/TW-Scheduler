import { VideoExportError } from './errors.js';
import { appendProjectAudioGraph } from './audioGraph.js';

const number = (value) => Number(value.toFixed(4)).toString();
const even = (value) => {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
};

const createEvenCropSizeExpression = (inputSize, ratio) =>
  `min(trunc(${inputSize}/2)*2\\,max(2\\,trunc(${inputSize}*${number(ratio)}/2)*2))`;

const createEvenCropOriginExpression = (inputSize, outputSize, ratio) =>
  `min(trunc((${inputSize}-${outputSize})/2)*2\\,` +
  `max(0\\,trunc(${inputSize}*${number(ratio)}/2)*2))`;

const getDescriptorMap = (inputDescriptors) =>
  new Map(inputDescriptors.map((descriptor) => [descriptor.key, descriptor]));

const createInputArguments = (inputDescriptors, fps) =>
  inputDescriptors.flatMap((descriptor) => {
    if (descriptor.kind === 'text' || descriptor.kind === 'image') {
      return [
        '-loop',
        '1',
        '-framerate',
        number(fps),
        '-t',
        number(descriptor.duration),
        '-i',
        descriptor.fileName,
      ];
    }

    if (descriptor.kind === 'audio' && descriptor.loop) {
      return ['-stream_loop', '-1', '-i', descriptor.fileName];
    }

    return ['-i', descriptor.fileName];
  });

const createVisualTransformFilters = (clip, output) => {
  const { width, height } = output;
  const crop = clip.crop || { x: 0, y: 0, width: 1, height: 1 };
  const transform = clip.transform || {
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    opacity: 1,
  };
  const targetWidth = even(width * transform.scale);
  const targetHeight = even(height * transform.scale);
  const cropWidth = createEvenCropSizeExpression('iw', crop.width);
  const cropHeight = createEvenCropSizeExpression('ih', crop.height);
  const cropX = createEvenCropOriginExpression('iw', 'out_w', crop.x);
  const cropY = createEvenCropOriginExpression('ih', 'out_h', crop.y);
  const filters = [];

  filters.push(
    `crop=w='${cropWidth}':h='${cropHeight}':x='${cropX}':y='${cropY}'`,
  );

  if (clip.fit === 'stretch') {
    filters.push(`scale=${targetWidth}:${targetHeight}`);
  } else if (clip.fit === 'cover') {
    filters.push(
      `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
      `crop=${targetWidth}:${targetHeight}`,
    );
  } else {
    filters.push(
      `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    );
  }

  if (transform.flipX) filters.push('hflip');
  if (transform.flipY) filters.push('vflip');
  if (Math.abs(transform.rotation) > 0.001) {
    const radians = number((transform.rotation * Math.PI) / 180);
    filters.push(`rotate=${radians}:ow=rotw(${radians}):oh=roth(${radians}):c=none`);
  }

  filters.push('setsar=1', 'format=rgba');
  if (transform.opacity < 0.9999) {
    filters.push(`colorchannelmixer=aa=${number(transform.opacity)}`);
  }

  return filters;
};

const addVisualLayer = ({
  clip,
  descriptor,
  output,
  layerNumber,
  canvasInput,
  filterParts,
}) => {
  const localLabel = `visual${layerNumber}`;
  const outputLabel = `canvas${layerNumber + 1}`;
  const clipFilters = [];

  if (clip.type === 'video') {
    const sourceEnd = clip.sourceStart + clip.duration * clip.playbackRate;
    clipFilters.push(
      `trim=start=${number(clip.sourceStart)}:end=${number(sourceEnd)}`,
      `setpts=(PTS-STARTPTS)/${number(clip.playbackRate)}`,
      `fps=${number(output.fps)}`,
      ...createVisualTransformFilters(clip, output),
      `trim=duration=${number(clip.duration)}`,
      `setpts=PTS-STARTPTS+${number(clip.timelineStart)}/TB`,
    );
  } else if (clip.type === 'image') {
    clipFilters.push(
      `fps=${number(output.fps)}`,
      ...createVisualTransformFilters(clip, output),
      `trim=duration=${number(clip.duration)}`,
      `setpts=PTS-STARTPTS+${number(clip.timelineStart)}/TB`,
    );
  } else {
    clipFilters.push(
      'format=rgba',
      `trim=duration=${number(clip.duration)}`,
    );

    const fadeIn = Math.min(clip.animation?.inDuration || 0, clip.duration);
    const fadeOut = Math.min(clip.animation?.outDuration || 0, clip.duration);
    if (clip.animation?.in === 'fade' && fadeIn > 0) {
      clipFilters.push(`fade=t=in:st=0:d=${number(fadeIn)}:alpha=1`);
    }
    if (clip.animation?.out === 'fade' && fadeOut > 0) {
      clipFilters.push(
        `fade=t=out:st=${number(Math.max(0, clip.duration - fadeOut))}:d=${number(fadeOut)}:alpha=1`,
      );
    }
    clipFilters.push(`setpts=PTS-STARTPTS+${number(clip.timelineStart)}/TB`);
  }

  filterParts.push(`[${descriptor.index}:v]${clipFilters.join(',')}[${localLabel}]`);

  const end = clip.timelineStart + clip.duration;
  const isFullCanvas = clip.type === 'text';
  const x = isFullCanvas
    ? '0'
    : `main_w*${number(clip.transform.x)}-overlay_w/2`;
  const y = isFullCanvas
    ? '0'
    : `main_h*${number(clip.transform.y)}-overlay_h/2`;

  filterParts.push(
    `[${canvasInput}][${localLabel}]overlay=` +
      `x='${x}':y='${y}':format=auto:eof_action=pass:repeatlast=0:shortest=0:` +
      `enable='between(t,${number(clip.timelineStart)},${number(end)})'[${outputLabel}]`,
  );

  return outputLabel;
};

/**
 * Builds one FFmpeg argument array from a normalized project and prepared inputs.
 * This is pure and can also be reused by a future native/server FFmpeg runner.
 */
export const buildFFmpegArguments = ({
  project,
  inputDescriptors,
  outputFile,
}) => {
  const descriptorMap = getDescriptorMap(inputDescriptors);
  const { output, duration, clips } = project;
  const filterParts = [];
  const ffmpegColor = `0x${output.backgroundColor.slice(1)}`;

  filterParts.push(
    `color=c=${ffmpegColor}:s=${output.width}x${output.height}:r=${number(output.fps)}:` +
      `d=${number(duration)},format=rgba[canvas0]`,
  );

  const visualPriority = { video: 0, image: 1, text: 2 };
  const visualClips = clips
    .filter(
      (clip) =>
        !clip.trackHidden &&
        (clip.type === 'video' || clip.type === 'image' || clip.type === 'text') &&
        !(clip.type === 'text' && !clip.text.trim()),
    )
    .sort((left, right) => visualPriority[left.type] - visualPriority[right.type]);

  let canvasInput = 'canvas0';
  visualClips.forEach((clip, layerNumber) => {
    const descriptor = descriptorMap.get(clip.key);
    if (!descriptor) {
      throw new VideoExportError(`Missing prepared input for “${clip.name}”.`, {
        code: 'MISSING_RENDER_INPUT',
        details: { clipId: clip.id },
      });
    }
    canvasInput = addVisualLayer({
      clip,
      descriptor,
      output,
      layerNumber,
      canvasInput,
      filterParts,
    });
  });
  filterParts.push(
    `[${canvasInput}]fps=${number(output.fps)},format=yuv420p[outv]`,
  );

  appendProjectAudioGraph({
    clips,
    descriptorMap,
    duration,
    sampleRate: output.audioSampleRate,
    filterParts,
  });

  const filterComplex = filterParts.join(';');
  const args = [
    '-y',
    ...createInputArguments(inputDescriptors, output.fps),
    '-filter_complex',
    filterComplex,
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-t',
    number(duration),
    '-c:v',
    output.videoCodec,
    '-preset',
    output.preset,
    '-crf',
    number(output.crf),
    '-r',
    number(output.fps),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    output.audioCodec,
    '-b:a',
    output.audioBitrate,
    '-ar',
    number(output.audioSampleRate),
    '-ac',
    '2',
    '-max_muxing_queue_size',
    '1024',
    '-movflags',
    '+faststart',
    outputFile,
  ];

  return { args, filterComplex };
};
