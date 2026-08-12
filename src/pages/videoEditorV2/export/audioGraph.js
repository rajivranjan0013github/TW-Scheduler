import { createAtempoFilters } from './audioFilters.js';
import { VideoExportError } from './errors.js';

const number = (value) => Number(Number(value).toFixed(4)).toString();

const addAudioClip = ({ clip, descriptor, sampleRate, audioNumber, filterParts }) => {
  const outputLabel = `audio${audioNumber}`;
  const filters = [];

  if (descriptor?.generated) {
    filters.push(
      `sine=frequency=${number(clip.frequency)}:sample_rate=${sampleRate}:duration=${number(clip.duration)}`,
    );
  } else {
    const sourceEnd = clip.sourceStart + clip.duration * clip.playbackRate;
    filters.push(
      `[${descriptor.index}:a]atrim=start=${number(clip.sourceStart)}:end=${number(sourceEnd)}`,
      'asetpts=PTS-STARTPTS',
      ...createAtempoFilters(clip.playbackRate),
      `atrim=duration=${number(clip.duration)}`,
    );
  }

  const fadeIn = Math.min(clip.fadeIn || 0, clip.duration);
  const fadeOut = Math.min(clip.fadeOut || 0, clip.duration);
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${number(fadeIn)}`);
  if (fadeOut > 0) {
    filters.push(
      `afade=t=out:st=${number(Math.max(0, clip.duration - fadeOut))}:d=${number(fadeOut)}`,
    );
  }
  filters.push(
    `volume=${number(clip.volume)}`,
    `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=stereo`,
  );

  const delay = Math.max(0, Math.round(clip.timelineStart * 1000));
  filters.push(`adelay=${delay}|${delay}`);

  const firstFilter = filters.shift();
  filterParts.push(`${firstFilter},${filters.join(',')}[${outputLabel}]`);
  return outputLabel;
};

/**
 * Appends the editor's canonical audio graph and returns its final label.
 * Keeping this shared ensures MP4 and audio-only exports mix identically.
 */
export const appendProjectAudioGraph = ({
  clips,
  descriptorMap,
  duration,
  sampleRate,
  filterParts,
  allowSilence = true,
  outputLabel = 'outa',
}) => {
  const audioLabels = [];

  clips.forEach((clip) => {
    let descriptor = descriptorMap.get(clip.key);
    let audioClip = clip;

    if (clip.type === 'video') {
      if (
        clip.trackHidden
        || clip.trackMuted
        || clip.muted
        || clip.volume <= 0
        || !descriptor?.hasAudio
      ) {
        return;
      }
      audioClip = { ...clip, fadeIn: 0, fadeOut: 0 };
    } else if (clip.type === 'audio') {
      if (clip.trackHidden || clip.trackMuted || clip.muted || clip.volume <= 0) return;
      if (clip.sourceType === 'generated' && !descriptor) {
        descriptor = { generated: true };
      }
      if (!descriptor) {
        throw new VideoExportError(`Missing prepared audio for “${clip.name}”.`, {
          code: 'MISSING_RENDER_INPUT',
          details: { clipId: clip.id },
        });
      }
    } else {
      return;
    }

    audioLabels.push(
      addAudioClip({
        clip: audioClip,
        descriptor,
        sampleRate,
        audioNumber: audioLabels.length,
        filterParts,
      }),
    );
  });

  if (audioLabels.length === 0 && !allowSilence) {
    return { audioLabels, outputLabel: null };
  }

  if (audioLabels.length === 0) {
    filterParts.push(
      `anullsrc=r=${sampleRate}:cl=stereo:d=${number(duration)},` +
        `atrim=duration=${number(duration)},asetpts=PTS-STARTPTS[${outputLabel}]`,
    );
  } else if (audioLabels.length === 1) {
    filterParts.push(
      `[${audioLabels[0]}]atrim=duration=${number(duration)},` +
        `asetpts=PTS-STARTPTS[${outputLabel}]`,
    );
  } else {
    filterParts.push(
      `${audioLabels.map((label) => `[${label}]`).join('')}amix=` +
        `inputs=${audioLabels.length}:duration=longest:dropout_transition=0:normalize=0,` +
        `alimiter=limit=0.95,atrim=duration=${number(duration)},` +
        `asetpts=PTS-STARTPTS[${outputLabel}]`,
    );
  }

  return { audioLabels, outputLabel };
};
