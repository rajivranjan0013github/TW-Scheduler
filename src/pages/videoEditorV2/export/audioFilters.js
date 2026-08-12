const number = (value) => Number(Number(value).toFixed(8)).toString();

/**
 * Builds a valid atempo chain for rates outside FFmpeg's per-filter 0.5-2 range.
 */
export const createAtempoFilters = (playbackRate) => {
  const rate = Number(playbackRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError('Audio playback rate must be greater than zero.');
  }

  const filters = [];
  let remaining = rate;
  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${number(remaining)}`);
  return filters;
};
