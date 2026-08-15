import { useEffect, useRef, useState } from 'react';

const PEAKS_PER_SECOND = 80;
const MIN_PEAK_COUNT = 256;
const MAX_PEAK_COUNT = 12_000;
const MAX_CACHE_ENTRIES = 50;
const MAX_SAMPLES_TO_SCAN_PER_CHANNEL = 2_000_000;
const waveformCache = new Map();

let decodingContext = null;

const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
);

const getDecodingContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Audio decoding is not supported by this browser.');
  if (!decodingContext || decodingContext.state === 'closed') {
    decodingContext = new AudioContextClass();
  }
  return decodingContext;
};

const createPeaks = (audioBuffer) => {
  const duration = Math.max(0, Number(audioBuffer.duration) || 0);
  const sampleLength = Math.max(0, Number(audioBuffer.length) || 0);
  const peakCount = clamp(
    Math.ceil(duration * PEAKS_PER_SECOND),
    MIN_PEAK_COUNT,
    Math.min(MAX_PEAK_COUNT, Math.max(MIN_PEAK_COUNT, sampleLength)),
  );
  const peaks = new Float32Array(peakCount);
  const channels = Array.from(
    { length: Math.max(1, Number(audioBuffer.numberOfChannels) || 1) },
    (_, index) => audioBuffer.getChannelData(index),
  );
  const sampleStride = Math.max(
    1,
    Math.ceil(sampleLength / MAX_SAMPLES_TO_SCAN_PER_CHANNEL),
  );
  let maximumPeak = 0;

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const sampleStart = Math.floor((peakIndex / peakCount) * sampleLength);
    const sampleEnd = Math.max(
      sampleStart + 1,
      Math.floor(((peakIndex + 1) / peakCount) * sampleLength),
    );
    let peak = 0;

    for (const channel of channels) {
      for (
        let sampleIndex = sampleStart;
        sampleIndex < sampleEnd;
        sampleIndex += sampleStride
      ) {
        peak = Math.max(peak, Math.abs(channel[sampleIndex] || 0));
      }
    }

    peaks[peakIndex] = peak;
    maximumPeak = Math.max(maximumPeak, peak);
  }

  if (maximumPeak > 0) {
    for (let index = 0; index < peaks.length; index += 1) {
      peaks[index] /= maximumPeak;
    }
  }

  return { duration, peaks };
};

const decodeWaveform = async (sourceUrl) => {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error('The audio source could not be loaded.');
  const encodedAudio = await response.arrayBuffer();
  const audioBuffer = await getDecodingContext().decodeAudioData(encodedAudio.slice(0));
  return createPeaks(audioBuffer);
};

const getWaveform = (sourceUrl) => {
  if (waveformCache.has(sourceUrl)) return waveformCache.get(sourceUrl);
  if (waveformCache.size >= MAX_CACHE_ENTRIES) {
    waveformCache.delete(waveformCache.keys().next().value);
  }
  const waveformPromise = decodeWaveform(sourceUrl);
  waveformCache.set(sourceUrl, waveformPromise);
  return waveformPromise;
};

const getSourceTime = ({ clip, timelineTime, sourceDuration }) => {
  const sourceStart = Math.max(0, Number(clip.sourceStart) || 0);
  const playbackRate = Math.max(0.01, Number(clip.playbackRate) || 1);
  const absoluteTime = sourceStart + (timelineTime * playbackRate);
  if (!clip.loop || sourceDuration <= 0 || absoluteTime < sourceDuration) {
    return absoluteTime;
  }
  return (absoluteTime - sourceDuration) % sourceDuration;
};

const getPeakAtTime = (waveform, sourceTime) => {
  if (!waveform?.peaks?.length || waveform.duration <= 0) return 0;
  const progress = clamp(sourceTime / waveform.duration, 0, 0.999999);
  return waveform.peaks[Math.floor(progress * waveform.peaks.length)] || 0;
};

const drawWaveform = ({ canvas, waveform, clip, selected }) => {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const targetWidth = Math.round(width * pixelRatio);
  const targetHeight = Math.round(height * pixelRatio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = selected ? 'rgba(255,255,255,0.9)' : 'rgba(236,253,245,0.68)';

  const barPitch = 2;
  const barWidth = 1;
  const barCount = Math.max(1, Math.floor(width / barPitch));
  const clipDuration = Math.max(0.01, Number(clip.duration) || 0.01);
  const centerY = height / 2;
  const maximumBarHeight = Math.max(2, height - 8);

  for (let index = 0; index < barCount; index += 1) {
    const timelineStart = (index / barCount) * clipDuration;
    const timelineEnd = ((index + 1) / barCount) * clipDuration;
    let peak = 0;

    for (let sample = 0; sample < 3; sample += 1) {
      const timelineTime = timelineStart + ((sample + 0.5) / 3) * (timelineEnd - timelineStart);
      const sourceTime = getSourceTime({
        clip,
        timelineTime,
        sourceDuration: waveform.duration,
      });
      peak = Math.max(peak, getPeakAtTime(waveform, sourceTime));
    }

    const barHeight = Math.max(1, peak * maximumBarHeight);
    context.fillRect(index * barPitch, centerY - (barHeight / 2), barWidth, barHeight);
  }
};

const LoadingWaveform = () => (
  <div
    className="absolute inset-0 flex items-center gap-px overflow-hidden px-1 opacity-35"
    aria-hidden="true"
  >
    {[7, 12, 18, 10, 15, 21, 13, 8, 17, 23, 12, 19, 9, 15, 22, 11, 18, 7, 14, 20, 10, 16, 22, 12].map((height, index) => (
      <span
        key={`${height}-${index}`}
        className="w-px flex-none rounded-full bg-white"
        style={{ height }}
      />
    ))}
  </div>
);

export const AudioWaveform = ({ clip, selected = false }) => {
  const canvasRef = useRef(null);
  const [waveformState, setWaveformState] = useState({ sourceUrl: '', waveform: null });
  const sourceUrl = clip.sourceUrl || clip.url || '';
  const waveform = waveformState.sourceUrl === sourceUrl ? waveformState.waveform : null;

  useEffect(() => {
    let active = true;
    if (!sourceUrl) return () => { active = false; };

    void getWaveform(sourceUrl)
      .then((result) => {
        if (active) setWaveformState({ sourceUrl, waveform: result });
      })
      .catch(() => {});

    return () => { active = false; };
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return undefined;
    const redraw = () => drawWaveform({ canvas, waveform, clip, selected });
    redraw();

    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [clip, selected, waveform]);

  if (!waveform) return <LoadingWaveform />;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
};
