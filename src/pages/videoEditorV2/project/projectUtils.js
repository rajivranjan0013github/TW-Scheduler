import {
  CLIP_TYPE_VALUES,
  MAX_PLAYBACK_RATE,
  MIN_CLIP_DURATION,
  MIN_PLAYBACK_RATE,
  PROJECT_HARD_MAX_DURATION,
  TRACK_TYPES,
  TRACK_TYPE_VALUES,
  trackAcceptsClipType,
} from './projectConstants.js';
import {
  clampNumber,
  createClip,
  createEditorId,
  createTrack,
  normalizeProject,
  roundTimelineTime,
} from './projectModel.js';

export const getClipEnd = (clip) => roundTimelineTime(
  Number(clip?.timelineStart || 0) + Number(clip?.duration || 0),
);

export const sortClipsByTimeline = (clips = []) => [...clips].sort((left, right) => (
  Number(left.timelineStart || 0) - Number(right.timelineStart || 0)
  || getClipEnd(left) - getClipEnd(right)
  || String(left.id).localeCompare(String(right.id))
));

export const getAllClips = (project) => (
  Array.isArray(project?.tracks)
    ? project.tracks.flatMap((track) => track.clips || [])
    : []
);

export const getTrackById = (project, trackId) => (
  project?.tracks?.find((track) => track.id === trackId) || null
);

export const getTracksByType = (project, type) => (
  project?.tracks?.filter((track) => track.type === type) || []
);

export const getPrimaryTrackByType = (project, type) => (
  getTracksByType(project, type)[0] || null
);

const clipsOverlap = (left, right) => (
  Number(left.timelineStart) < getClipEnd(right)
  && Number(right.timelineStart) < getClipEnd(left)
);

export const getAvailableOverlayTrack = (project, clip, options = {}) => {
  if (!clip || !trackAcceptsClipType(TRACK_TYPES.OVERLAY, clip.type)) return null;
  const excludedClipId = options.excludeClipId || clip.id;
  return getTracksByType(project, TRACK_TYPES.OVERLAY).find((track) => (
    !track.hidden
    && !track.locked
    && !(track.clips || []).some((currentClip) => (
      currentClip.id !== excludedClipId && clipsOverlap(currentClip, clip)
    ))
  )) || null;
};

const canPlaceExtractedAudioOnTrack = (track, clip) => (
  track?.type === TRACK_TYPES.AUDIO
  && !track.hidden
  && !track.locked
  && !track.muted
  && !(track.clips || []).some((currentClip) => clipsOverlap(currentClip, clip))
);

/**
 * Atomically associates an already-created MP3 clip with its source video.
 *
 * The helper is intentionally state-only: media generation and registration happen before it is
 * called. Invalid or duplicate requests return the original project with `attached: false`.
 */
export const attachExtractedAudioClip = (project, {
  sourceClipId,
  audioClip,
  trackId,
} = {}) => {
  const sourceLocation = getClipLocation(project, sourceClipId);
  const isValidAudio = (
    audioClip
    && typeof audioClip === 'object'
    && audioClip.type === TRACK_TYPES.AUDIO
    && typeof audioClip.id === 'string'
    && audioClip.id.length > 0
    && (
      !audioClip.mimeType
      || String(audioClip.mimeType).toLowerCase().startsWith('audio/')
    )
    && Number.isFinite(Number(audioClip.duration))
    && Number(audioClip.duration) > 0
  );

  if (
    !sourceLocation
    || sourceLocation.clip.type !== TRACK_TYPES.VIDEO
    || sourceLocation.track.locked
    || !isValidAudio
    || findClipById(project, audioClip.id)
  ) {
    return { project, clip: null, trackId: null, attached: false };
  }

  const extractedFromClipId = audioClip.metadata?.extractedFromClipId;
  if (extractedFromClipId && extractedFromClipId !== sourceClipId) {
    return { project, clip: null, trackId: null, attached: false };
  }

  const duplicate = getAllClips(project).some((clip) => (
    clip.metadata?.extractedFromClipId === sourceClipId
  ));
  if (duplicate) {
    return { project, clip: null, trackId: null, attached: false };
  }

  const clip = createClip(TRACK_TYPES.AUDIO, {
    ...audioClip,
    type: TRACK_TYPES.AUDIO,
    metadata: {
      ...audioClip.metadata,
      extractedFromClipId: sourceClipId,
    },
  });
  const requestedTrack = trackId ? getTrackById(project, trackId) : null;
  let targetTrack = canPlaceExtractedAudioOnTrack(requestedTrack, clip)
    ? requestedTrack
    : getTracksByType(project, TRACK_TYPES.AUDIO)
      .find((track) => canPlaceExtractedAudioOnTrack(track, clip));
  let projectWithTarget = project;

  if (!targetTrack) {
    targetTrack = createTrack(TRACK_TYPES.AUDIO, { name: 'Extracted audio' });
    projectWithTarget = {
      ...project,
      tracks: [...project.tracks, targetTrack],
    };
  }

  const nextProject = {
    ...projectWithTarget,
    tracks: projectWithTarget.tracks.map((track) => {
      if (track.id === sourceLocation.track.id) {
        return {
          ...track,
          clips: track.clips.map((currentClip) => (
            currentClip.id === sourceClipId
              ? createClip(TRACK_TYPES.VIDEO, { ...currentClip, muted: true })
              : currentClip
          )),
        };
      }
      if (track.id === targetTrack.id) {
        return {
          ...track,
          clips: sortClipsByTimeline([...(track.clips || []), clip]),
        };
      }
      return track;
    }),
  };

  return {
    project: nextProject,
    clip,
    trackId: targetTrack.id,
    attached: true,
  };
};

export const updateTrackById = (project, trackId, changes = {}) => {
  const track = getTrackById(project, trackId);
  if (!track || !changes || typeof changes !== 'object') return project;

  const nextTrack = {
    ...track,
    name: typeof changes.name === 'string' ? changes.name : track.name,
    locked: Object.prototype.hasOwnProperty.call(changes, 'locked')
      ? Boolean(changes.locked)
      : track.locked,
    muted: Object.prototype.hasOwnProperty.call(changes, 'muted')
      ? Boolean(changes.muted)
      : track.muted,
    hidden: Object.prototype.hasOwnProperty.call(changes, 'hidden')
      ? Boolean(changes.hidden)
      : track.hidden,
  };

  return {
    ...project,
    tracks: project.tracks.map((currentTrack) => (
      currentTrack.id === trackId ? nextTrack : currentTrack
    )),
  };
};

export const getClipLocation = (project, clipId) => {
  if (!clipId || !Array.isArray(project?.tracks)) return null;

  for (let trackIndex = 0; trackIndex < project.tracks.length; trackIndex += 1) {
    const track = project.tracks[trackIndex];
    const clipIndex = track.clips.findIndex((clip) => clip.id === clipId);
    if (clipIndex >= 0) {
      return {
        track,
        trackIndex,
        clip: track.clips[clipIndex],
        clipIndex,
      };
    }
  }

  return null;
};

export const findClipById = (project, clipId) => (
  getClipLocation(project, clipId)?.clip || null
);

export const getActiveClipsAtTime = (project, time, types = CLIP_TYPE_VALUES) => {
  const currentTime = Math.max(0, Number(time) || 0);
  const allowedTypes = new Set(Array.isArray(types) ? types : [types]);

  return (project?.tracks || []).flatMap((track) => {
    if (track.hidden) return [];
    return (track.clips || []).filter((clip) => (
      clip.enabled !== false
      && allowedTypes.has(clip.type)
      && currentTime >= clip.timelineStart
      && currentTime < getClipEnd(clip)
    ));
  });
};

const mergeClipChanges = (clip, changes) => ({
  ...clip,
  ...changes,
  crop: changes.crop ? { ...clip.crop, ...changes.crop } : clip.crop,
  transform: changes.transform ? { ...clip.transform, ...changes.transform } : clip.transform,
  effects: changes.effects ? { ...clip.effects, ...changes.effects } : clip.effects,
  style: changes.style ? { ...clip.style, ...changes.style } : clip.style,
  animation: changes.animation ? { ...clip.animation, ...changes.animation } : clip.animation,
  metadata: changes.metadata ? { ...clip.metadata, ...changes.metadata } : clip.metadata,
});

export const updateClipById = (project, clipId, changes) => {
  const location = getClipLocation(project, clipId);
  if (!location) return project;

  const resolvedChanges = typeof changes === 'function' ? changes(location.clip) : changes;
  if (!resolvedChanges || typeof resolvedChanges !== 'object') return project;
  const nextClip = createClip(location.clip.type, mergeClipChanges(location.clip, resolvedChanges));

  return {
    ...project,
    tracks: project.tracks.map((track, trackIndex) => (
      trackIndex === location.trackIndex
        ? {
            ...track,
            clips: track.clips.map((clip, clipIndex) => (
              clipIndex === location.clipIndex ? nextClip : clip
            )),
          }
        : track
    )),
  };
};

export const retimeClipPlaybackRate = (
  project,
  clipId,
  requestedRate,
  options = {},
) => {
  const location = getClipLocation(project, clipId);
  if (!location || ![TRACK_TYPES.VIDEO, TRACK_TYPES.AUDIO].includes(location.clip.type)) {
    return project;
  }

  const clip = location.clip;
  const currentRate = clampNumber(
    clip.playbackRate,
    MIN_PLAYBACK_RATE,
    MAX_PLAYBACK_RATE,
    1,
  );
  const currentDuration = Math.max(0, Number(clip.duration) || 0);
  const sourceDuration = Math.max(0, Number(clip.sourceDuration) || 0);
  const sourceStart = Math.max(0, Number(clip.sourceStart) || 0);
  const loops = clip.type === TRACK_TYPES.AUDIO && clip.loop;
  const availableSourceSpan = sourceDuration > 0 && !loops
    ? Math.max(0, sourceDuration - sourceStart)
    : Number.POSITIVE_INFINITY;
  const requestedSourceSpan = Number(options.sourceSpan);
  const sourceSpan = Math.min(
    Number.isFinite(requestedSourceSpan) && requestedSourceSpan > 0
      ? requestedSourceSpan
      : currentDuration * currentRate,
    availableSourceSpan,
  );
  const projectDuration = Math.max(
    MIN_CLIP_DURATION,
    Number(project?.output?.maxDuration) || PROJECT_HARD_MAX_DURATION,
  );
  const currentClipEnd = getClipEnd(clip);
  const shouldRippleFollowingClips = options.rippleFollowingClips === true;
  const followingClips = shouldRippleFollowingClips
    ? location.track.clips.filter((candidate) => (
        candidate.id !== clipId
        && Number(candidate.timelineStart || 0) >= currentClipEnd - 0.000001
      ))
    : [];
  const latestFollowingEnd = followingClips.reduce(
    (latestEnd, candidate) => Math.max(latestEnd, getClipEnd(candidate)),
    currentClipEnd,
  );
  const rippleLimitedDuration = currentDuration + Math.max(
    0,
    projectDuration - latestFollowingEnd,
  );
  const availableTimelineDuration = Math.min(
    shouldRippleFollowingClips ? rippleLimitedDuration : Number.POSITIVE_INFINITY,
    Math.max(0, projectDuration - Number(clip.timelineStart || 0)),
  );
  const minimumDuration = Math.min(MIN_CLIP_DURATION, currentDuration);

  if (sourceSpan <= 0 || availableTimelineDuration <= 0 || minimumDuration <= 0) {
    return project;
  }

  const minimumRate = Math.max(
    MIN_PLAYBACK_RATE,
    sourceSpan / availableTimelineDuration,
  );
  const maximumRate = Math.min(
    MAX_PLAYBACK_RATE,
    sourceSpan / minimumDuration,
  );
  if (minimumRate > maximumRate) return project;

  const playbackRate = clampNumber(
    requestedRate,
    minimumRate,
    maximumRate,
    currentRate,
  );
  const duration = roundTimelineTime(sourceSpan / playbackRate);
  if (
    Math.abs(playbackRate - currentRate) < 0.000001
    && Math.abs(duration - currentDuration) < 0.000001
  ) {
    return project;
  }

  const retimedProject = updateClipById(project, clipId, { playbackRate, duration });
  const durationDelta = roundTimelineTime(duration - currentDuration);
  if (!shouldRippleFollowingClips || followingClips.length === 0 || Math.abs(durationDelta) < 0.000001) {
    return retimedProject;
  }

  const followingClipIds = new Set(followingClips.map((candidate) => candidate.id));
  return {
    ...retimedProject,
    tracks: retimedProject.tracks.map((track) => {
      if (track.id !== location.track.id) return track;
      return {
        ...track,
        clips: track.clips.map((candidate) => (
          followingClipIds.has(candidate.id)
            ? createClip(candidate.type, {
                ...candidate,
                timelineStart: roundTimelineTime(
                  Math.max(0, Number(candidate.timelineStart || 0) + durationDelta),
                ),
              })
            : candidate
        )),
      };
    }),
  };
};

export const removeClipById = (project, clipId) => {
  const location = getClipLocation(project, clipId);
  if (!location) return project;

  return {
    ...project,
    tracks: project.tracks.map((track, trackIndex) => (
      trackIndex === location.trackIndex
        ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
        : track
    )),
  };
};

export const rippleDeleteClipById = (project, clipId) => {
  const location = getClipLocation(project, clipId);
  if (!location || location.track.locked) return project;

  const removedClipEnd = getClipEnd(location.clip);
  const removedDuration = Math.max(0, Number(location.clip.duration) || 0);

  return {
    ...project,
    tracks: project.tracks.map((track, trackIndex) => {
      if (trackIndex !== location.trackIndex) return track;

      return {
        ...track,
        clips: track.clips
          .filter((clip) => clip.id !== clipId)
          .map((clip) => {
            const clipStart = Number(clip.timelineStart) || 0;
            if (clipStart < removedClipEnd) return clip;

            return createClip(clip.type, {
              ...clip,
              timelineStart: roundTimelineTime(Math.max(0, clipStart - removedDuration)),
            });
          }),
      };
    }),
  };
};

export const insertClip = (project, { trackId, trackType, clip, index }) => {
  const targetTrack = trackId
    ? getTrackById(project, trackId)
    : getPrimaryTrackByType(project, trackType || clip?.type);
  if (!targetTrack || !clip || !trackAcceptsClipType(targetTrack.type, clip.type)) return project;

  const nextClip = createClip(clip.type, clip);
  const insertionIndex = Number.isInteger(index)
    ? clampNumber(index, 0, targetTrack.clips.length, targetTrack.clips.length)
    : targetTrack.clips.length;

  return {
    ...project,
    tracks: project.tracks.map((track) => {
      if (track.id !== targetTrack.id) return track;
      const clips = [...track.clips];
      clips.splice(insertionIndex, 0, nextClip);
      return { ...track, clips };
    }),
  };
};

export const addTrackToProject = (project, type, options = {}) => {
  if (!TRACK_TYPE_VALUES.includes(type)) return project;
  const track = createTrack(type, options);
  const index = Number.isInteger(options.index)
    ? clampNumber(options.index, 0, project.tracks.length, project.tracks.length)
    : project.tracks.length;
  const tracks = [...project.tracks];
  tracks.splice(index, 0, track);
  return { ...project, tracks };
};

export const moveClip = (project, {
  clipId,
  toTrackId,
  timelineStart,
  index,
}) => {
  const location = getClipLocation(project, clipId);
  if (!location) return project;
  const targetTrack = toTrackId ? getTrackById(project, toTrackId) : location.track;
  if (
    !targetTrack
    || !trackAcceptsClipType(targetTrack.type, location.clip.type)
    || targetTrack.locked
  ) return project;

  const maximumStart = Math.max(0, project.output.maxDuration - MIN_CLIP_DURATION);
  const nextClip = createClip(location.clip.type, {
    ...location.clip,
    timelineStart: roundTimelineTime(clampNumber(
      timelineStart,
      0,
      maximumStart,
      location.clip.timelineStart,
    )),
  });
  const tracksWithoutClip = project.tracks.map((track) => (
    track.id === location.track.id
      ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
      : track
  ));
  const destination = tracksWithoutClip.find((track) => track.id === targetTrack.id);
  const insertionIndex = Number.isInteger(index)
    ? clampNumber(index, 0, destination.clips.length, destination.clips.length)
    : destination.clips.length;

  return {
    ...project,
    tracks: tracksWithoutClip.map((track) => {
      if (track.id !== targetTrack.id) return track;
      const clips = [...track.clips];
      clips.splice(insertionIndex, 0, nextClip);
      return { ...track, clips };
    }),
  };
};

export const trimClip = (clip, {
  edge,
  time,
  timelineStart,
  timelineEnd,
  sourceStart,
  duration,
  maxDuration = 30,
  minDuration = MIN_CLIP_DURATION,
} = {}) => {
  if (!clip) return null;
  const currentStart = clip.timelineStart;
  const currentEnd = getClipEnd(clip);
  const playbackRate = Number(clip.playbackRate) || 1;
  let nextStart = currentStart;
  let nextSourceStart = Number(clip.sourceStart) || 0;
  let nextDuration = clip.duration;

  if (edge === 'start') {
    const requestedStart = Number.isFinite(Number(time)) ? Number(time) : Number(timelineStart);
    const hasUnboundedStart = (
      clip.type === TRACK_TYPES.TEXT
      || clip.type === TRACK_TYPES.IMAGE
      || (
        clip.type === TRACK_TYPES.AUDIO
        && (clip.loop || clip.sourceType === 'generated')
      )
    );
    const earliestStartFromSource = hasUnboundedStart
      ? 0
      : currentStart - (nextSourceStart / playbackRate);
    nextStart = clampNumber(
      requestedStart,
      Math.max(0, earliestStartFromSource),
      currentEnd - minDuration,
      currentStart,
    );
    const timelineDelta = nextStart - currentStart;
    nextSourceStart = Math.max(0, nextSourceStart + (timelineDelta * playbackRate));
    nextDuration = currentEnd - nextStart;
  } else if (edge === 'end') {
    const requestedEnd = Number.isFinite(Number(time)) ? Number(time) : Number(timelineEnd);
    const sourceDuration = Number(clip.sourceDuration) || 0;
    const maximumEndFromSource = sourceDuration > 0 && !clip.loop
      ? currentStart + Math.max(0, (sourceDuration - nextSourceStart) / playbackRate)
      : Number.POSITIVE_INFINITY;
    const nextEnd = clampNumber(
      requestedEnd,
      currentStart + minDuration,
      Math.min(maxDuration, maximumEndFromSource),
      currentEnd,
    );
    nextDuration = nextEnd - currentStart;
  } else {
    if (Number.isFinite(Number(timelineStart))) nextStart = Math.max(0, Number(timelineStart));
    if (Number.isFinite(Number(sourceStart))) nextSourceStart = Math.max(0, Number(sourceStart));
    if (Number.isFinite(Number(duration))) nextDuration = Math.max(minDuration, Number(duration));
    if (Number.isFinite(Number(timelineEnd))) nextDuration = Number(timelineEnd) - nextStart;
  }

  nextStart = clampNumber(nextStart, 0, Math.max(0, maxDuration - minDuration), currentStart);
  const sourceDuration = Number(clip.sourceDuration) || 0;
  const maximumDurationFromSource = sourceDuration > 0 && !clip.loop
    ? Math.max(0, (sourceDuration - nextSourceStart) / playbackRate)
    : Number.POSITIVE_INFINITY;
  const maximumAllowedDuration = Math.min(maxDuration - nextStart, maximumDurationFromSource);
  nextDuration = clampNumber(
    nextDuration,
    Math.min(minDuration, maximumAllowedDuration),
    maximumAllowedDuration,
    Math.min(clip.duration, maximumAllowedDuration),
  );

  return createClip(clip.type, {
    ...clip,
    timelineStart: roundTimelineTime(nextStart),
    sourceStart: roundTimelineTime(nextSourceStart),
    duration: roundTimelineTime(nextDuration),
  });
};

export const splitClip = (clip, time, options = {}) => {
  if (!clip) return null;
  const minimumDuration = options.minDuration ?? MIN_CLIP_DURATION;
  const splitTime = Number(time);
  const clipEnd = getClipEnd(clip);

  if (
    !Number.isFinite(splitTime)
    || splitTime <= clip.timelineStart + minimumDuration
    || splitTime >= clipEnd - minimumDuration
  ) {
    return null;
  }

  const leftDuration = roundTimelineTime(splitTime - clip.timelineStart);
  const playbackRate = Number(clip.playbackRate) || 1;
  const rightSourceStart = roundTimelineTime(
    Number(clip.sourceStart || 0) + (leftDuration * playbackRate),
  );

  return {
    left: createClip(clip.type, {
      ...clip,
      id: options.leftId || createEditorId('clip'),
      duration: leftDuration,
    }),
    right: createClip(clip.type, {
      ...clip,
      id: options.rightId || createEditorId('clip'),
      timelineStart: splitTime,
      sourceStart: rightSourceStart,
      duration: roundTimelineTime(clipEnd - splitTime),
    }),
  };
};

export const replaceClipWithSplit = (project, clipId, time) => {
  const location = getClipLocation(project, clipId);
  if (!location || location.track.locked) return { project, split: null };
  const split = splitClip(location.clip, time);
  if (!split) return { project, split: null };

  const nextProject = {
    ...project,
    tracks: project.tracks.map((track, trackIndex) => {
      if (trackIndex !== location.trackIndex) return track;
      const clips = [...track.clips];
      clips.splice(location.clipIndex, 1, split.left, split.right);
      return { ...track, clips };
    }),
  };

  return { project: nextProject, split };
};

export const finalizeProjectChange = (project) => normalizeProject({
  ...project,
  updatedAt: new Date().toISOString(),
});
