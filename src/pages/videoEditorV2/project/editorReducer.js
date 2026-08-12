import {
  DEFAULT_HISTORY_LIMIT,
  TRACK_TYPE_VALUES,
} from './projectConstants.js';
import {
  calculateProjectDuration,
  createClip,
  createEditorProject,
  normalizeOutputSettings,
} from './projectModel.js';
import {
  addTrackToProject,
  attachExtractedAudioClip,
  finalizeProjectChange,
  findClipById,
  getClipLocation,
  getPrimaryTrackByType,
  getTrackById,
  insertClip,
  moveClip,
  removeClipById,
  replaceClipWithSplit,
  retimeClipPlaybackRate,
  rippleDeleteClipById,
  trimClip,
  updateClipById,
  updateTrackById,
} from './projectUtils.js';

export const EDITOR_ACTIONS = Object.freeze({
  LOAD_PROJECT: 'editor/load-project',
  ADD_TRACK: 'editor/add-track',
  UPDATE_TRACK: 'editor/update-track',
  ADD_CLIP: 'editor/add-clip',
  ATTACH_EXTRACTED_AUDIO: 'editor/attach-extracted-audio',
  UPDATE_CLIP: 'editor/update-clip',
  SET_CLIP_PLAYBACK_RATE: 'editor/set-clip-playback-rate',
  DELETE_CLIP: 'editor/delete-clip',
  RIPPLE_DELETE_CLIP: 'editor/ripple-delete-clip',
  MOVE_CLIP: 'editor/move-clip',
  TRIM_CLIP: 'editor/trim-clip',
  SPLIT_CLIP: 'editor/split-clip',
  SELECT_CLIP: 'editor/select-clip',
  SELECT_TRACK: 'editor/select-track',
  SET_CURRENT_TIME: 'editor/set-current-time',
  SET_PLAYING: 'editor/set-playing',
  SET_PROJECT_DETAILS: 'editor/set-project-details',
  SET_OUTPUT_SETTINGS: 'editor/set-output-settings',
  UNDO: 'editor/undo',
  REDO: 'editor/redo',
  CLEAR_HISTORY: 'editor/clear-history',
});

const clampCurrentTime = (project, value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(project.output.maxDuration, numericValue));
};

const reconcileEditorSelection = (state, project, overrides = {}) => {
  const requestedClipId = Object.prototype.hasOwnProperty.call(overrides, 'selectedClipId')
    ? overrides.selectedClipId
    : state.selectedClipId;
  const selectedClipId = requestedClipId && findClipById(project, requestedClipId)
    ? requestedClipId
    : null;
  const selectedLocation = selectedClipId ? getClipLocation(project, selectedClipId) : null;
  const requestedTrackId = Object.prototype.hasOwnProperty.call(overrides, 'selectedTrackId')
    ? overrides.selectedTrackId
    : state.selectedTrackId;
  const selectedTrackId = selectedLocation?.track.id
    || (requestedTrackId && getTrackById(project, requestedTrackId) ? requestedTrackId : null);

  return {
    selectedClipId,
    selectedTrackId,
    currentTime: clampCurrentTime(project, overrides.currentTime ?? state.currentTime),
  };
};

const commitProject = (state, candidateProject, overrides = {}) => {
  if (!candidateProject || candidateProject === state.project) return state;
  const project = finalizeProjectChange(candidateProject);
  const historyLimit = state.historyLimit || DEFAULT_HISTORY_LIMIT;
  const past = [...state.past, state.project].slice(-historyLimit);

  return {
    ...state,
    ...reconcileEditorSelection(state, project, overrides),
    project,
    past,
    future: [],
  };
};

export const createInitialEditorState = (projectInput, options = {}) => {
  const project = createEditorProject(projectInput);
  const selectedClipId = options.selectedClipId && findClipById(project, options.selectedClipId)
    ? options.selectedClipId
    : null;
  const selectedLocation = selectedClipId ? getClipLocation(project, selectedClipId) : null;
  const selectedTrackId = selectedLocation?.track.id
    || (options.selectedTrackId && getTrackById(project, options.selectedTrackId)
      ? options.selectedTrackId
      : null);

  return {
    project,
    past: [],
    future: [],
    historyLimit: Math.max(1, Number(options.historyLimit) || DEFAULT_HISTORY_LIMIT),
    selectedClipId,
    selectedTrackId,
    currentTime: clampCurrentTime(project, options.currentTime || 0),
    isPlaying: Boolean(options.isPlaying),
  };
};

const undo = (state) => {
  if (state.past.length === 0) return state;
  const project = state.past[state.past.length - 1];

  return {
    ...state,
    ...reconcileEditorSelection(state, project),
    project,
    past: state.past.slice(0, -1),
    future: [state.project, ...state.future].slice(0, state.historyLimit),
    isPlaying: false,
  };
};

const redo = (state) => {
  if (state.future.length === 0) return state;
  const [project, ...future] = state.future;

  return {
    ...state,
    ...reconcileEditorSelection(state, project),
    project,
    past: [...state.past, state.project].slice(-state.historyLimit),
    future,
    isPlaying: false,
  };
};

export function editorReducer(state, action) {
  const payload = action?.payload || {};

  switch (action?.type) {
    case EDITOR_ACTIONS.LOAD_PROJECT: {
      const project = createEditorProject(payload.project ?? action.project);
      const selection = reconcileEditorSelection(state, project, {
        selectedClipId: payload.selectedClipId ?? null,
        selectedTrackId: payload.selectedTrackId ?? null,
        currentTime: payload.currentTime ?? 0,
      });
      return {
        ...state,
        ...selection,
        project,
        past: [],
        future: [],
        isPlaying: false,
      };
    }

    case EDITOR_ACTIONS.ADD_TRACK: {
      const type = payload.type;
      if (!TRACK_TYPE_VALUES.includes(type)) return state;
      const nextProject = addTrackToProject(state.project, type, payload.track || payload);
      const addedTrack = nextProject.tracks.find((track) => (
        !state.project.tracks.some((currentTrack) => currentTrack.id === track.id)
      ));
      return commitProject(state, nextProject, {
        selectedTrackId: addedTrack?.id || state.selectedTrackId,
      });
    }

    case EDITOR_ACTIONS.UPDATE_TRACK: {
      const track = getTrackById(state.project, payload.trackId);
      if (!track) return state;
      return commitProject(
        state,
        updateTrackById(state.project, track.id, payload.changes),
        { selectedTrackId: track.id },
      );
    }

    case EDITOR_ACTIONS.ADD_CLIP: {
      const requestedType = payload.clip?.type || payload.trackType || payload.type;
      const targetTrack = payload.trackId
        ? getTrackById(state.project, payload.trackId)
        : getPrimaryTrackByType(state.project, requestedType);
      if (!targetTrack || targetTrack.locked) return state;

      const clip = createClip(targetTrack.type, {
        ...payload.clip,
        type: targetTrack.type,
      });
      if (findClipById(state.project, clip.id)) return state;
      const nextProject = insertClip(state.project, {
        trackId: targetTrack.id,
        clip,
        index: payload.index,
      });
      return commitProject(state, nextProject, {
        selectedClipId: payload.select === false ? state.selectedClipId : clip.id,
        selectedTrackId: targetTrack.id,
      });
    }

    case EDITOR_ACTIONS.ATTACH_EXTRACTED_AUDIO: {
      const result = attachExtractedAudioClip(state.project, payload);
      if (!result.attached) return state;
      return commitProject(state, result.project, {
        selectedClipId: result.clip.id,
        selectedTrackId: result.trackId,
      });
    }

    case EDITOR_ACTIONS.UPDATE_CLIP: {
      const location = getClipLocation(state.project, payload.clipId);
      if (!location || location.track.locked) return state;
      const changes = payload.changes;
      const changesPlaybackRate = changes
        && typeof changes === 'object'
        && Object.prototype.hasOwnProperty.call(changes, 'playbackRate');
      if (changesPlaybackRate) {
        const { playbackRate, ...remainingChanges } = changes;
        const projectWithOtherChanges = Object.keys(remainingChanges).length > 0
          ? updateClipById(state.project, payload.clipId, remainingChanges)
          : state.project;
        const nextProject = retimeClipPlaybackRate(
          projectWithOtherChanges,
          payload.clipId,
          playbackRate,
        );
        return commitProject(state, nextProject, {
          currentTime: Math.min(state.currentTime, calculateProjectDuration(nextProject)),
        });
      }
      return commitProject(
        state,
        updateClipById(state.project, payload.clipId, changes),
      );
    }

    case EDITOR_ACTIONS.SET_CLIP_PLAYBACK_RATE: {
      const location = getClipLocation(state.project, payload.clipId);
      if (!location || location.track.locked) return state;
      const nextProject = retimeClipPlaybackRate(
        state.project,
        payload.clipId,
        payload.playbackRate,
        { sourceSpan: payload.sourceSpan },
      );
      return commitProject(state, nextProject, {
        currentTime: Math.min(state.currentTime, calculateProjectDuration(nextProject)),
      });
    }

    case EDITOR_ACTIONS.DELETE_CLIP: {
      const clipId = payload.clipId || state.selectedClipId;
      const location = getClipLocation(state.project, clipId);
      if (!location || location.track.locked) return state;
      return commitProject(state, removeClipById(state.project, clipId), {
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
        selectedTrackId: location.track.id,
      });
    }

    case EDITOR_ACTIONS.RIPPLE_DELETE_CLIP: {
      const clipId = payload.clipId || state.selectedClipId;
      const location = getClipLocation(state.project, clipId);
      if (!location || location.track.locked) return state;
      return commitProject(state, rippleDeleteClipById(state.project, clipId), {
        selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
        selectedTrackId: location.track.id,
      });
    }

    case EDITOR_ACTIONS.MOVE_CLIP: {
      const location = getClipLocation(state.project, payload.clipId);
      const targetTrack = payload.toTrackId
        ? getTrackById(state.project, payload.toTrackId)
        : location?.track;
      if (!location || location.track.locked || targetTrack?.locked) return state;
      return commitProject(state, moveClip(state.project, payload), {
        selectedClipId: payload.clipId,
        selectedTrackId: targetTrack?.id,
      });
    }

    case EDITOR_ACTIONS.TRIM_CLIP: {
      const location = getClipLocation(state.project, payload.clipId);
      if (!location || location.track.locked) return state;
      const nextClip = trimClip(location.clip, {
        ...payload,
        maxDuration: state.project.output.maxDuration,
      });
      if (!nextClip) return state;
      return commitProject(
        state,
        updateClipById(state.project, payload.clipId, nextClip),
        { selectedClipId: payload.clipId, selectedTrackId: location.track.id },
      );
    }

    case EDITOR_ACTIONS.SPLIT_CLIP: {
      const clipId = payload.clipId || state.selectedClipId;
      const splitTime = payload.time ?? state.currentTime;
      const result = replaceClipWithSplit(state.project, clipId, splitTime);
      if (!result.split) return state;
      return commitProject(state, result.project, {
        selectedClipId: payload.selectSide === 'left'
          ? result.split.left.id
          : result.split.right.id,
        selectedTrackId: getClipLocation(state.project, clipId)?.track.id,
      });
    }

    case EDITOR_ACTIONS.SELECT_CLIP: {
      const clipId = payload.clipId ?? action.clipId ?? null;
      const location = clipId ? getClipLocation(state.project, clipId) : null;
      return {
        ...state,
        selectedClipId: location ? clipId : null,
        selectedTrackId: location?.track.id || state.selectedTrackId,
      };
    }

    case EDITOR_ACTIONS.SELECT_TRACK: {
      const trackId = payload.trackId ?? action.trackId ?? null;
      return {
        ...state,
        selectedTrackId: trackId && getTrackById(state.project, trackId) ? trackId : null,
        selectedClipId: payload.keepClipSelection ? state.selectedClipId : null,
      };
    }

    case EDITOR_ACTIONS.SET_CURRENT_TIME:
      return {
        ...state,
        currentTime: clampCurrentTime(state.project, payload.time ?? action.time),
      };

    case EDITOR_ACTIONS.SET_PLAYING:
      return {
        ...state,
        isPlaying: Boolean(payload.isPlaying ?? action.isPlaying),
      };

    case EDITOR_ACTIONS.SET_PROJECT_DETAILS: {
      const changes = payload.changes ?? payload.details ?? {};
      const name = typeof changes.name === 'string'
        ? changes.name.trim().slice(0, 200) || 'Untitled Video'
        : state.project.name;
      const metadata = changes.metadata && typeof changes.metadata === 'object'
        ? { ...state.project.metadata, ...changes.metadata }
        : state.project.metadata;
      if (name === state.project.name && metadata === state.project.metadata) return state;
      return commitProject(state, { ...state.project, name, metadata });
    }

    case EDITOR_ACTIONS.SET_OUTPUT_SETTINGS: {
      const changes = payload.settings ?? payload.changes ?? {};
      const output = normalizeOutputSettings({ ...state.project.output, ...changes });
      return commitProject(state, { ...state.project, output });
    }

    case EDITOR_ACTIONS.UNDO:
      return undo(state);

    case EDITOR_ACTIONS.REDO:
      return redo(state);

    case EDITOR_ACTIONS.CLEAR_HISTORY:
      return { ...state, past: [], future: [] };

    default:
      return state;
  }
}

export const editorActions = Object.freeze({
  loadProject: (project, options = {}) => ({
    type: EDITOR_ACTIONS.LOAD_PROJECT,
    payload: { ...options, project },
  }),
  addTrack: (type, track = {}) => ({
    type: EDITOR_ACTIONS.ADD_TRACK,
    payload: { type, track },
  }),
  updateTrack: (trackId, changes) => ({
    type: EDITOR_ACTIONS.UPDATE_TRACK,
    payload: { trackId, changes },
  }),
  addClip: (clip, options = {}) => ({
    type: EDITOR_ACTIONS.ADD_CLIP,
    payload: { ...options, clip },
  }),
  attachExtractedAudio: (sourceClipId, audioClip, options = {}) => ({
    type: EDITOR_ACTIONS.ATTACH_EXTRACTED_AUDIO,
    payload: { ...options, sourceClipId, audioClip },
  }),
  updateClip: (clipId, changes) => ({
    type: EDITOR_ACTIONS.UPDATE_CLIP,
    payload: { clipId, changes },
  }),
  setClipPlaybackRate: (clipId, playbackRate, options = {}) => ({
    type: EDITOR_ACTIONS.SET_CLIP_PLAYBACK_RATE,
    payload: { ...options, clipId, playbackRate },
  }),
  deleteClip: (clipId) => ({
    type: EDITOR_ACTIONS.DELETE_CLIP,
    payload: { clipId },
  }),
  rippleDeleteClip: (clipId) => ({
    type: EDITOR_ACTIONS.RIPPLE_DELETE_CLIP,
    payload: { clipId },
  }),
  moveClip: (clipId, changes = {}) => ({
    type: EDITOR_ACTIONS.MOVE_CLIP,
    payload: { ...changes, clipId },
  }),
  trimClip: (clipId, trim = {}) => ({
    type: EDITOR_ACTIONS.TRIM_CLIP,
    payload: { ...trim, clipId },
  }),
  splitClip: (clipId, time, options = {}) => ({
    type: EDITOR_ACTIONS.SPLIT_CLIP,
    payload: { ...options, clipId, time },
  }),
  selectClip: (clipId) => ({
    type: EDITOR_ACTIONS.SELECT_CLIP,
    payload: { clipId },
  }),
  selectTrack: (trackId, options = {}) => ({
    type: EDITOR_ACTIONS.SELECT_TRACK,
    payload: { ...options, trackId },
  }),
  setCurrentTime: (time) => ({
    type: EDITOR_ACTIONS.SET_CURRENT_TIME,
    payload: { time },
  }),
  setPlaying: (isPlaying) => ({
    type: EDITOR_ACTIONS.SET_PLAYING,
    payload: { isPlaying },
  }),
  setProjectDetails: (changes) => ({
    type: EDITOR_ACTIONS.SET_PROJECT_DETAILS,
    payload: { changes },
  }),
  renameProject: (name) => ({
    type: EDITOR_ACTIONS.SET_PROJECT_DETAILS,
    payload: { changes: { name } },
  }),
  setOutputSettings: (settings) => ({
    type: EDITOR_ACTIONS.SET_OUTPUT_SETTINGS,
    payload: { settings },
  }),
  undo: () => ({ type: EDITOR_ACTIONS.UNDO }),
  redo: () => ({ type: EDITOR_ACTIONS.REDO }),
  clearHistory: () => ({ type: EDITOR_ACTIONS.CLEAR_HISTORY }),
});

export const canUndo = (state) => Boolean(state?.past?.length);
export const canRedo = (state) => Boolean(state?.future?.length);
