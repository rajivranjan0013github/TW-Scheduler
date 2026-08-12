import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getActiveCampaignId } from '../../utils/campaignScope';
import { getMediaUrl } from '../../utils/mediaUrls';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';
import { VideoLibraryPickerDialog } from '../videoEditor/VideoLibraryPickerDialog';
import {
  normalizeBulkRowsFromStorage,
  sanitizeBulkRowForStorage,
} from '../bulkBuilder/useBulkRows';
import {
  readBulkRowsSnapshot,
  subscribeToBulkRows,
  writeBulkRowsSnapshot,
} from '../bulkBuilder/bulkProjectStore';
import { EditorToolbar } from './components/EditorToolbar';
import { ExportDialog } from './components/ExportDialog';
import { InspectorPanel } from './components/InspectorPanel';
import { MediaPanel } from './components/MediaPanel';
import { PreviewStage } from './components/PreviewStage';
import { ProjectSettingsDialog } from './components/ProjectSettingsDialog';
import { usePlaybackClock } from './hooks/usePlaybackClock';
import {
  createAssetFromFile,
  createGeneratedAudioAsset,
  createLibraryAsset,
  revokeAssetUrl,
} from './media/mediaRegistry';
import {
  bulkRowToProject,
  calculateProjectDuration,
  canRedo,
  canUndo,
  createAudioClip,
  createEditorProject,
  createImageClip,
  createInitialEditorState,
  createTextClip,
  createVideoClip,
  deserializeProject,
  editorActions,
  editorReducer,
  findClipById,
  getPrimaryTrackByType,
  hydrateBulkProjectDurations,
  projectToBulkRow,
  serializeProject,
} from './project';
import { Timeline } from './timeline';

const DRAFT_STORAGE_KEY = 'tw_video_editor_v2_draft';
const TIMELINE_MIN_HEIGHT = 220;
const TIMELINE_MAX_HEIGHT = 480;
const WORKSPACE_MIN_HEIGHT = 260;
const EDITOR_TOOLBAR_HEIGHT = 58;

const createEmptyExportState = (overrides = {}) => ({
  open: false,
  exporting: false,
  format: 'video',
  progress: 0,
  message: '',
  error: '',
  resultUrl: '',
  resultFileName: '',
  resultMimeType: '',
  ...overrides,
});

const clampTimelineHeight = (value, maximum = TIMELINE_MAX_HEIGHT) => Math.min(
  Math.max(TIMELINE_MIN_HEIGHT, maximum),
  Math.max(TIMELINE_MIN_HEIGHT, Number(value) || TIMELINE_MIN_HEIGHT),
);

const getInitialTimelineHeight = () => {
  if (typeof window === 'undefined') return 260;
  return clampTimelineHeight(window.innerHeight * 0.32, 280);
};

const getInitialTimelineMaximum = () => {
  if (typeof window === 'undefined') return TIMELINE_MAX_HEIGHT;
  return Math.max(
    TIMELINE_MIN_HEIGHT,
    Math.min(
      TIMELINE_MAX_HEIGHT,
      window.innerHeight - EDITOR_TOOLBAR_HEIGHT - WORKSPACE_MIN_HEIGHT,
    ),
  );
};

const getBulkRows = () => {
  return normalizeBulkRowsFromStorage(readBulkRowsSnapshot());
};

const persistProjectToBulkRow = (project, bulkRowId, { clearResult = true } = {}) => {
  const rows = getBulkRows();
  const rowIndex = rows.findIndex((row) => String(row.id) === String(bulkRowId));
  if (rowIndex < 0) throw new Error('The Bulk Planning Board row no longer exists.');

  const isDualVideo = localStorage.getItem('tw_bulk_builder_dual_video') !== 'false';
  rows[rowIndex] = sanitizeBulkRowForStorage(projectToBulkRow(project, rows[rowIndex], {
    isDualVideo,
    clearResult,
  }));
  writeBulkRowsSnapshot(rows, { source: 'editor-v2', rowId: bulkRowId });
  return serializeProject(project);
};

const removeExpiredUploadClips = (project) => {
  let removedCount = 0;
  const nextProject = createEditorProject({
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => {
        const expired = clip.sourceType === 'upload'
          && String(clip.sourceUrl || '').startsWith('blob:');
        if (expired) removedCount += 1;
        return !expired;
      }),
    })),
  });

  return { project: nextProject, removedCount };
};

const loadInitialContext = ({ bulkRowId, isBulkProject }) => {
  if (isBulkProject && bulkRowId) {
    const rows = getBulkRows();
    const row = rows.find((candidate) => String(candidate.id) === String(bulkRowId));
    if (row) {
      return {
        project: bulkRowToProject(row, { defaultClipDuration: 5 }),
        bulkRow: row,
        contextKey: `bulk:${bulkRowId}`,
        projectPersisted: Boolean(row.editorProject),
        warning: row.editorProjectStale
          ? 'This row was edited on the Bulk Planning Board after its timeline was saved. The advanced timeline is preserved, but save it again before using advanced export.'
          : '',
      };
    }
  }

  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      const restored = removeExpiredUploadClips(deserializeProject(saved));
      return {
        project: restored.project,
        bulkRow: null,
        contextKey: 'draft',
        projectPersisted: true,
        warning: restored.removedCount > 0
          ? `${restored.removedCount} local upload${restored.removedCount === 1 ? '' : 's'} could not survive the browser reload and were removed. Re-import them or use Media Library assets for persistent drafts.`
          : '',
      };
    }
  } catch {
    // Start with a clean project if a stale draft cannot be restored.
  }
  return {
    project: createEditorProject(),
    bulkRow: null,
    contextKey: 'draft',
    projectPersisted: true,
    warning: '',
  };
};

const getUploadedMediaSummary = (media) => ({
  resultMediaId: media?._id || media?.id || media?.mediaId || '',
  resultMediaUrl: media?.url || '',
  resultMediaName: media?.name || media?.filename || '',
});

const projectAssets = (project) => {
  const assets = new Map();
  project.tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      if (!['video', 'audio', 'image'].includes(clip.type) || !clip.sourceUrl) return;
      const id = clip.mediaId || clip.id;
      if (assets.has(id)) return;
      assets.set(id, {
        id,
        mediaId: clip.mediaId || '',
        sourceType: clip.sourceType || 'library',
        type: clip.type,
        name: clip.name || `${clip.type} asset`,
        url: clip.sourceUrl,
        originalUrl: clip.originalUrl || '',
        duration: clip.sourceDuration || clip.duration || 0,
        mimeType: clip.mimeType || '',
      });
    });
  });
  return [...assets.values()];
};

const getNextTrackStart = (track, preferredTime, durationLimit) => {
  if (!track) return 0;
  const latestEnd = track.clips.reduce(
    (maximum, clip) => Math.max(maximum, Number(clip.timelineStart || 0) + Number(clip.duration || 0)),
    0,
  );
  const preferred = Number(preferredTime || 0);
  return Math.min(durationLimit, track.type === 'video' ? latestEnd : preferred);
};

const hasExtractedAudioClip = (project, sourceClipId) => project.tracks.some((track) => (
  track.clips.some((clip) => clip.metadata?.extractedFromClipId === sourceClipId)
));

const getClipTrack = (project, clipId) => project.tracks.find((track) => (
  track.clips.some((clip) => clip.id === clipId)
));

export const VideoEditorV2 = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const isBulkProject = searchParams.get('mode') === 'bulk';
  const bulkRowId = searchParams.get('rowId') || '';
  const openedFromLegacyEditor = searchParams.get('returnTo') === 'legacy-editor';
  const initialContext = useMemo(
    () => loadInitialContext({ bulkRowId, isBulkProject }),
    [bulkRowId, isBulkProject],
  );
  const [state, dispatch] = useReducer(
    editorReducer,
    initialContext.project,
    createInitialEditorState,
  );
  const [assets, setAssets] = useState(() => projectAssets(initialContext.project));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState('video');
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [rippleDeleteEnabled, setRippleDeleteEnabled] = useState(false);
  const [extractingAudioClipId, setExtractingAudioClipId] = useState(null);
  const [status, setStatus] = useState(() => (
    initialContext.warning
      ? { type: 'warning', text: initialContext.warning }
      : null
  ));
  const [exportState, setExportState] = useState(createEmptyExportState);
  const [savingResult, setSavingResult] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(getInitialTimelineHeight);
  const [timelineMaximum, setTimelineMaximum] = useState(getInitialTimelineMaximum);
  const assetsRef = useRef(assets);
  const editorLayoutRef = useRef(null);
  const timelineResizeRef = useRef(null);
  const mediaRegistryRef = useRef(new Map());
  const ffmpegRef = useRef(null);
  const exportAbortRef = useRef(null);
  const audioExtractionAbortRef = useRef(null);
  const resultUrlRef = useRef('');
  const autosaveTimerRef = useRef(null);
  const contextKeyRef = useRef(initialContext.contextKey);
  const bulkSyncedProjectRef = useRef(serializeProject(initialContext.project));
  const savedProjectRef = useRef(
    initialContext.projectPersisted ? serializeProject(initialContext.project) : '',
  );

  const { project, currentTime, isPlaying, selectedClipId } = state;
  const projectRef = useRef(project);
  const selectedClip = findClipById(project, selectedClipId);
  const selectedClipTrack = selectedClipId ? getClipTrack(project, selectedClipId) : null;
  const extractAudioDisabled = Boolean(extractingAudioClipId)
    || selectedClip?.type !== 'video'
    || selectedClipTrack?.locked
    || (!selectedClip?.sourceUrl && !selectedClip?.mediaId)
    || hasExtractedAudioClip(project, selectedClipId);
  const contentDuration = calculateProjectDuration(project);
  const projectDuration = Math.max(0.1, contentDuration);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    if (!isBulkProject || !bulkRowId) return undefined;
    return subscribeToBulkRows(({ source, rowId }) => {
      if (source === 'editor-v2') return;
      if (rowId && String(rowId) !== String(bulkRowId)) return;

      const latestRow = getBulkRows().find((row) => (
        String(row.id) === String(bulkRowId)
      ));
      if (!latestRow?.editorProject) return;

      const latestProject = bulkRowToProject(latestRow);
      const latestSnapshot = serializeProject(latestProject);
      if (latestSnapshot === bulkSyncedProjectRef.current) return;

      const localSnapshot = serializeProject(projectRef.current);
      if (localSnapshot !== bulkSyncedProjectRef.current) {
        setStatus({
          type: 'error',
          text: 'This bulk row changed elsewhere while local timeline edits were pending. Return to the board and reopen the row to choose the latest version.',
        });
        return;
      }

      exportAbortRef.current?.abort(new Error('The bulk project changed.'));
      exportAbortRef.current = null;
      audioExtractionAbortRef.current?.abort(new Error('The bulk project changed.'));
      audioExtractionAbortRef.current = null;
      const nextAssets = projectAssets(latestProject);
      assetsRef.current.forEach((asset) => {
        if (!nextAssets.some((candidate) => candidate.url === asset.url)) {
          revokeAssetUrl(asset);
        }
      });
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
      dispatch(editorActions.loadProject(latestProject));
      bulkSyncedProjectRef.current = latestSnapshot;
      savedProjectRef.current = latestSnapshot;
      setStatus(null);
    });
  }, [bulkRowId, isBulkProject]);

  useEffect(() => {
    if (
      !isBulkProject
      || !bulkRowId
      || contextKeyRef.current !== initialContext.contextKey
    ) {
      return;
    }
    const snapshot = serializeProject(project);
    if (snapshot === bulkSyncedProjectRef.current) return;

    try {
      persistProjectToBulkRow(project, bulkRowId, { clearResult: true });
      bulkSyncedProjectRef.current = snapshot;
      savedProjectRef.current = snapshot;
    } catch (error) {
      setStatus({
        type: 'error',
        text: error.message || 'Changes could not be synced to the Bulk Planning Board.',
      });
    }
  }, [bulkRowId, initialContext.contextKey, isBulkProject, project]);

  useEffect(() => {
    assetsRef.current = assets;
    const registry = new Map();
    assets.forEach((asset) => registry.set(asset.id, asset));
    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const asset = assets.find((candidate) => (
          candidate.id === clip.mediaId || candidate.mediaId === clip.mediaId
        ));
        if (clip.mediaId && asset) registry.set(clip.mediaId, asset);
      });
    });
    mediaRegistryRef.current = registry;
  }, [assets, project.tracks]);

  useEffect(() => () => {
    assetsRef.current.forEach(revokeAssetUrl);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    ffmpegRef.current?.terminate?.();
    exportAbortRef.current?.abort();
    audioExtractionAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (isBulkProject) return undefined;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, serializeProject(project));
      } catch {
        setStatus({ type: 'error', text: 'This browser could not autosave the project.' });
      }
    }, 500);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [isBulkProject, project]);

  const setCurrentTime = useCallback((time) => {
    dispatch(editorActions.setCurrentTime(time));
  }, []);
  const setPlaying = useCallback((nextPlaying) => {
    dispatch(editorActions.setPlaying(nextPlaying));
  }, []);
  const { seek } = usePlaybackClock({
    isPlaying,
    currentTime,
    duration: projectDuration,
    onTimeChange: setCurrentTime,
    onPlayingChange: setPlaying,
  });

  useEffect(() => {
    const layout = editorLayoutRef.current;
    if (!layout) return undefined;

    const updateTimelineBounds = () => {
      const maximum = Math.max(
        TIMELINE_MIN_HEIGHT,
        Math.min(TIMELINE_MAX_HEIGHT, layout.clientHeight - WORKSPACE_MIN_HEIGHT),
      );
      setTimelineMaximum(maximum);
      setTimelineHeight((current) => clampTimelineHeight(current, maximum));
    };

    updateTimelineBounds();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateTimelineBounds);
      observer.observe(layout);
      return () => {
        observer.disconnect();
        timelineResizeRef.current = null;
      };
    }

    window.addEventListener('resize', updateTimelineBounds);
    return () => {
      window.removeEventListener('resize', updateTimelineBounds);
      timelineResizeRef.current = null;
    };
  }, []);

  const handleTimelineResizeStart = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    timelineResizeRef.current = {
      pointerId: event.pointerId,
      startHeight: timelineHeight,
      startY: event.clientY,
      maximum: timelineMaximum,
    };
  }, [timelineHeight, timelineMaximum]);

  const handleTimelineResizeMove = useCallback((event) => {
    const interaction = timelineResizeRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextHeight = interaction.startHeight + (interaction.startY - event.clientY);
    setTimelineHeight(clampTimelineHeight(nextHeight, interaction.maximum));
  }, []);

  const handleTimelineResizeEnd = useCallback((event) => {
    const interaction = timelineResizeRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    timelineResizeRef.current = null;
  }, []);

  const handleTimelineResizeKeyDown = useCallback((event) => {
    const step = event.shiftKey ? 40 : 12;
    let nextHeight = timelineHeight;
    if (event.key === 'ArrowUp') nextHeight += step;
    else if (event.key === 'ArrowDown') nextHeight -= step;
    else if (event.key === 'Home') nextHeight = TIMELINE_MIN_HEIGHT;
    else if (event.key === 'End') nextHeight = timelineMaximum;
    else return;

    event.preventDefault();
    setTimelineHeight(clampTimelineHeight(nextHeight, timelineMaximum));
  }, [timelineHeight, timelineMaximum]);

  useEffect(() => {
    if (contextKeyRef.current === initialContext.contextKey) return;
    contextKeyRef.current = initialContext.contextKey;
    exportAbortRef.current?.abort(new Error('The editor project changed.'));
    exportAbortRef.current = null;
    audioExtractionAbortRef.current?.abort(new Error('The editor project changed.'));
    audioExtractionAbortRef.current = null;
    assetsRef.current.forEach(revokeAssetUrl);
    const nextAssets = projectAssets(initialContext.project);
    assetsRef.current = nextAssets;
    setAssets(nextAssets);
    dispatch(editorActions.loadProject(initialContext.project));
    bulkSyncedProjectRef.current = serializeProject(initialContext.project);
    savedProjectRef.current = initialContext.projectPersisted
      ? serializeProject(initialContext.project)
      : '';
    setLibraryOpen(false);
    setProjectSettingsOpen(false);
    setExtractingAudioClipId(null);
    setExportState(createEmptyExportState());
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = '';
    }
    setStatus(initialContext.warning
      ? { type: 'warning', text: initialContext.warning }
      : null);
  }, [initialContext]);

  useEffect(() => {
    const bulkRow = initialContext.bulkRow;
    if (!isBulkProject || !bulkRow) return undefined;
    const estimatedClips = initialContext.project.tracks.flatMap((track) => (
      track.type === 'video'
        ? track.clips.filter((clip) => clip.metadata?.durationEstimated && clip.sourceUrl)
        : []
    ));
    if (estimatedClips.length === 0) return undefined;

    let cancelled = false;
    const initialSnapshot = serializeProject(initialContext.project);
    setStatus({ type: 'warning', text: 'Reading source durations before this timeline can be saved…' });

    const hydrateDurations = async () => {
      const results = await Promise.allSettled(estimatedClips.map(async (clip) => {
        const asset = await createLibraryAsset({
          id: clip.mediaId || clip.id,
          mediaId: clip.mediaId || '',
          name: clip.name,
          type: 'video',
          url: clip.sourceUrl,
          originalUrl: clip.originalUrl || '',
          duration: 0,
        });
        return {
          slot: clip.metadata?.bulkSlot,
          duration: Number(asset.duration || 0),
        };
      }));
      if (cancelled) return;

      const videoDurations = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.slot && result.value.duration > 0) {
          videoDurations[result.value.slot] = result.value.duration;
        }
      });
      if (Object.keys(videoDurations).length === 0) {
        setStatus({
          type: 'warning',
          text: 'Source durations could not be read. The timeline is using an estimated 30-second budget; verify trims before saving.',
        });
        return;
      }
      if (serializeProject(projectRef.current) !== initialSnapshot) {
        setStatus({
          type: 'warning',
          text: 'Source durations finished loading after the timeline was edited, so your edits were kept. Verify the estimated clip lengths before saving.',
        });
        return;
      }

      const hydratedProject = hydrateBulkProjectDurations(
        projectRef.current,
        videoDurations,
      );
      const hydratedSnapshot = serializeProject(hydratedProject);
      if (hydratedSnapshot === initialSnapshot) return;

      try {
        persistProjectToBulkRow(hydratedProject, bulkRowId, { clearResult: false });
      } catch (error) {
        setStatus({
          type: 'error',
          text: error.message || 'Source durations loaded, but could not be synced to the Bulk Planning Board.',
        });
        return;
      }

      bulkSyncedProjectRef.current = hydratedSnapshot;
      dispatch(editorActions.loadProject(hydratedProject));
      const nextAssets = projectAssets(hydratedProject);
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
      savedProjectRef.current = hydratedSnapshot;
      const hasRemainingEstimates = hydratedProject.tracks.some((track) => (
        track.clips.some((clip) => clip.metadata?.durationEstimated === true)
      ));
      setStatus(hasRemainingEstimates
        ? {
            type: 'warning',
            text: 'Some source durations could not be read. Resolved clips were saved; verify the remaining estimated clip lengths before export.',
          }
        : { type: 'success', text: 'Source durations loaded. The timeline is ready.' });
    };

    void hydrateDurations();
    return () => {
      cancelled = true;
    };
  }, [bulkRowId, initialContext, isBulkProject]);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (projectSettingsOpen) return;
      const target = event.target;
      const isRangeInput = target instanceof HTMLInputElement && target.type === 'range';
      if (event.code === 'Space' && isRangeInput) {
        event.preventDefault();
        target.blur();
        if (!event.repeat) setPlaying(!isPlaying);
        return;
      }
      const isTyping = target instanceof HTMLElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      );
      const withCommand = event.metaKey || event.ctrlKey;
      const isSplitShortcut = event.code === 'KeyS' && !withCommand && !event.altKey;
      if (isTyping && !(isRangeInput && isSplitShortcut)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) setPlaying(!isPlaying);
      } else if (
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        && !event.altKey
        && !withCommand
      ) {
        event.preventDefault();
        const fps = Math.max(1, Number(project.output.fps) || 30);
        const framePosition = currentTime * fps;
        const frameIndex = event.key === 'ArrowRight'
          ? Math.floor(framePosition + 0.000001) + 1
          : Math.ceil(framePosition - 0.000001) - 1;
        setPlaying(false);
        seek(frameIndex / fps);
      } else if (withCommand && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        dispatch(editorActions.redo());
      } else if (withCommand && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch(editorActions.undo());
      } else if (isSplitShortcut && selectedClipId) {
        event.preventDefault();
        if (event.repeat) return;
        if (isRangeInput) target.blur();
        setPlaying(false);
        dispatch(editorActions.splitClip(selectedClipId, currentTime));
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedClipId) {
        event.preventDefault();
        dispatch(rippleDeleteEnabled
          ? editorActions.rippleDeleteClip(selectedClipId)
          : editorActions.deleteClip(selectedClipId));
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [
    currentTime,
    isPlaying,
    project.output.fps,
    projectSettingsOpen,
    rippleDeleteEnabled,
    seek,
    selectedClipId,
    setPlaying,
  ]);

  const addAssetToTimeline = useCallback((asset) => {
    const type = asset.type;
    const track = getPrimaryTrackByType(project, type);
    if (!track) {
      setStatus({ type: 'error', text: `The project has no ${type} track.` });
      return;
    }
    const timelineStart = getNextTrackStart(track, currentTime, project.output.maxDuration);
    const remaining = project.output.maxDuration - timelineStart;
    if (remaining < 0.1) {
      setStatus({ type: 'error', text: 'The 30-second timeline is full.' });
      return;
    }
    const duration = Math.min(
      remaining,
      type === 'image' ? 3 : Math.max(0.1, Number(asset.duration || 5)),
    );
    const input = {
      name: asset.name,
      mediaId: asset.id,
      sourceUrl: asset.url,
      originalUrl: asset.originalUrl || '',
      sourceType: asset.sourceType,
      mimeType: asset.mimeType || '',
      sourceDuration: type === 'image' ? 0 : Number(asset.duration || duration),
      timelineStart,
      duration,
    };
    const clip = type === 'audio'
      ? createAudioClip(input)
      : type === 'image'
        ? createImageClip(input)
        : createVideoClip(input);
    dispatch(editorActions.addClip(clip));
    seek(timelineStart);
  }, [currentTime, project, seek]);

  const handleFilesSelected = useCallback(async (files) => {
    if (!files.length) return;
    if (isBulkProject) {
      setStatus({
        type: 'error',
        text: 'For Bulk Planning Board rows, choose reusable assets from Media Library so they remain available to the export queue.',
      });
      return;
    }
    const results = await Promise.allSettled(files.map(createAssetFromFile));
    const imported = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failed = results.filter((result) => result.status === 'rejected');
    if (imported.length) {
      setAssets((current) => [...imported, ...current]);
      setStatus({ type: 'success', text: `${imported.length} media file${imported.length === 1 ? '' : 's'} imported.` });
    }
    if (failed.length) {
      setStatus({ type: 'error', text: failed[0].reason?.message || 'One or more files could not be imported.' });
    }
  }, [isBulkProject]);

  const handleLibrarySelection = useCallback(async (item) => {
    const asset = await createLibraryAsset({ ...item, type: item.type || libraryMode });
    setAssets((current) => current.some((candidate) => candidate.id === asset.id)
      ? current
      : [asset, ...current]);
    setLibraryOpen(false);
    addAssetToTimeline(asset);
  }, [addAssetToTimeline, libraryMode]);

  const addText = useCallback((text) => {
    const duration = Math.min(3, Math.max(0.1, project.output.maxDuration - currentTime));
    if (duration < 0.1) return;
    dispatch(editorActions.addClip(createTextClip({
      name: text,
      text,
      timelineStart: currentTime,
      duration,
      style: {
        fontFamily: 'Outfit',
        fontWeight: '700',
        fontSize: 72,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 3,
        backgroundColor: 'transparent',
        backgroundType: 'None',
        textAlign: 'center',
      },
      transform: { x: 0.5, y: 0.25, scale: 1, rotation: 0, opacity: 1 },
    })));
  }, [currentTime, project.output.maxDuration]);

  const updateSelectedClip = useCallback((changes) => {
    if (selectedClipId) dispatch(editorActions.updateClip(selectedClipId, changes));
  }, [selectedClipId]);

  const setSelectedClipPlaybackRate = useCallback((playbackRate, options) => {
    if (selectedClipId) {
      dispatch(editorActions.setClipPlaybackRate(selectedClipId, playbackRate, options));
    }
  }, [selectedClipId]);

  const extractSelectedVideoAudio = useCallback(async (clipId) => {
    if (extractingAudioClipId) return;
    const sourceClip = findClipById(projectRef.current, clipId);
    if (!sourceClip || sourceClip.type !== 'video') {
      setStatus({ type: 'error', text: 'Select a video clip before extracting MP3 audio.' });
      return;
    }
    if (!sourceClip.sourceUrl && !sourceClip.mediaId) {
      setStatus({ type: 'error', text: 'The selected video source is unavailable.' });
      return;
    }
    if (getClipTrack(projectRef.current, clipId)?.locked) {
      setStatus({ type: 'error', text: 'Unlock the video track before extracting audio.' });
      return;
    }
    if (hasExtractedAudioClip(projectRef.current, clipId)) {
      setStatus({ type: 'error', text: 'MP3 audio has already been extracted from this clip.' });
      return;
    }

    setPlaying(false);
    setExtractingAudioClipId(clipId);
    const controller = new AbortController();
    audioExtractionAbortRef.current = controller;
    try {
      const {
        extractAudioToMp3InBrowser,
        loadBrowserFFmpeg,
      } = await import('./export/index.js');
      const ffmpeg = ffmpegRef.current || await loadBrowserFFmpeg({
        signal: controller.signal,
      });
      ffmpegRef.current = ffmpeg;
      const result = await extractAudioToMp3InBrowser({
        clip: sourceClip,
        project: projectRef.current,
        ffmpeg,
        mediaRegistry: mediaRegistryRef.current,
        signal: controller.signal,
      });
      const currentSourceClip = findClipById(projectRef.current, clipId);
      const sourceChanged = !currentSourceClip
        || currentSourceClip.type !== 'video'
        || currentSourceClip.mediaId !== sourceClip.mediaId
        || currentSourceClip.sourceUrl !== sourceClip.sourceUrl
        || currentSourceClip.sourceStart !== sourceClip.sourceStart
        || currentSourceClip.duration !== sourceClip.duration
        || currentSourceClip.playbackRate !== sourceClip.playbackRate;
      if (sourceChanged) {
        throw new Error('The selected video changed before MP3 extraction finished.');
      }
      if (getClipTrack(projectRef.current, clipId)?.locked) {
        throw new Error('Unlock the video track before attaching extracted audio.');
      }
      if (hasExtractedAudioClip(projectRef.current, clipId)) {
        throw new Error('MP3 audio has already been extracted from this clip.');
      }
      let asset;
      if (isBulkProject) {
        const file = new File([result.blob], result.fileName, { type: 'audio/mpeg' });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', 'null');
        formData.append('tags', 'editor,timeline,audio,extracted');
        formData.append('campaignId', getActiveCampaignId());
        const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'The extracted MP3 could not be saved for the bulk project.');
        }
        const uploadedAudio = await response.json();
        asset = await createLibraryAsset({
          ...uploadedAudio,
          id: uploadedAudio._id || uploadedAudio.id || uploadedAudio.mediaId,
          mediaId: uploadedAudio._id || uploadedAudio.id || uploadedAudio.mediaId,
          name: uploadedAudio.name || uploadedAudio.filename || result.fileName,
          url: getMediaUrl(uploadedAudio.url),
          originalUrl: getMediaUrl(uploadedAudio.originalUrl || uploadedAudio.url),
          type: 'audio',
          duration: result.duration,
          mimeType: result.mimeType,
        });
      } else {
        asset = createGeneratedAudioAsset({
          blob: result.blob,
          fileName: result.fileName,
          duration: result.duration,
        });
      }
      const audioClip = createAudioClip({
        name: result.fileName,
        mediaId: asset.id,
        sourceUrl: asset.url,
        sourceType: asset.sourceType,
        mimeType: result.mimeType,
        sourceStart: 0,
        sourceDuration: result.duration,
        timelineStart: currentSourceClip.timelineStart,
        duration: result.duration,
        playbackRate: 1,
        volume: currentSourceClip.volume,
        muted: false,
        loop: false,
        metadata: {
          extractedFromClipId: currentSourceClip.id,
          format: 'mp3',
        },
      });

      setAssets((current) => [asset, ...current]);
      dispatch(editorActions.attachExtractedAudio(currentSourceClip.id, audioClip));
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus({ type: 'error', text: error.message || 'Could not extract MP3 audio.' });
      }
    } finally {
      if (audioExtractionAbortRef.current === controller) {
        audioExtractionAbortRef.current = null;
      }
      setExtractingAudioClipId(null);
    }
  }, [extractingAudioClipId, isBulkProject, setPlaying, token]);

  const saveProject = useCallback(() => {
    try {
      const snapshot = serializeProject(project);
      if (isBulkProject && bulkRowId) {
        const rows = getBulkRows();
        const rowIndex = rows.findIndex((row) => String(row.id) === String(bulkRowId));
        if (rowIndex < 0) throw new Error('The Bulk Planning Board row no longer exists.');
        if (snapshot === savedProjectRef.current && rows[rowIndex].editorProject) {
          setStatus({
            type: rows[rowIndex].editorProjectStale ? 'warning' : 'success',
            text: rows[rowIndex].editorProjectStale
              ? 'The board and timeline are out of sync. Adjust the timeline as needed, then save to make it the active version.'
              : 'This timeline is already saved. The existing exported result was kept.',
          });
          return true;
        }
        const savedSnapshot = persistProjectToBulkRow(project, bulkRowId, {
          clearResult: true,
        });
        savedProjectRef.current = savedSnapshot;
        bulkSyncedProjectRef.current = savedSnapshot;
        setStatus({ type: 'success', text: 'Timeline changes saved to the Bulk Planning Board row.' });
      } else {
        localStorage.setItem(DRAFT_STORAGE_KEY, snapshot);
        savedProjectRef.current = snapshot;
        const hasLocalUploads = project.tracks.some((track) => track.clips.some((clip) => (
          clip.sourceType === 'upload' && String(clip.sourceUrl || '').startsWith('blob:')
        )));
        setStatus({
          type: hasLocalUploads ? 'warning' : 'success',
          text: hasLocalUploads
            ? 'Draft metadata saved. Local uploads stay available only in this open browser session; use Media Library assets for reload-safe drafts.'
            : 'Draft saved in this browser.',
        });
      }
      return true;
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Project could not be saved.' });
      return false;
    }
  }, [bulkRowId, isBulkProject, project]);

  const handleBack = useCallback(() => {
    if (isBulkProject && bulkRowId) {
      const currentProject = projectRef.current;
      const snapshot = serializeProject(currentProject);
      if (snapshot !== bulkSyncedProjectRef.current) {
        try {
          const savedSnapshot = persistProjectToBulkRow(currentProject, bulkRowId, {
            clearResult: true,
          });
          savedProjectRef.current = savedSnapshot;
          bulkSyncedProjectRef.current = savedSnapshot;
        } catch (error) {
          setStatus({
            type: 'error',
            text: error.message || 'Changes could not be synced to the Bulk Planning Board.',
          });
          return;
        }
      }
    }
    if (!isBulkProject && openedFromLegacyEditor) {
      const snapshot = serializeProject(projectRef.current);
      localStorage.setItem(DRAFT_STORAGE_KEY, snapshot);
      savedProjectRef.current = snapshot;
    }
    navigate(openedFromLegacyEditor
      ? (isBulkProject ? '/media/editor?mode=bulk' : '/media/editor')
      : (isBulkProject ? '/media/bulk-builder' : '/media'));
  }, [bulkRowId, isBulkProject, navigate, openedFromLegacyEditor]);

  const openExportDialog = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = '';
    }
    setExportState((current) => createEmptyExportState({
      open: true,
      format: current.format,
    }));
  }, []);

  const handleExport = useCallback(async (requestedFormat = 'video') => {
    if (calculateProjectDuration(project) <= 0) {
      setExportState((current) => ({
        ...current,
        open: true,
        exporting: false,
        error: 'Add at least one clip before exporting.',
      }));
      return;
    }
    const format = requestedFormat === 'audio' ? 'audio' : 'video';
    setPlaying(false);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportState(createEmptyExportState({
      open: true,
      exporting: true,
      format,
      message: 'Loading the media engine…',
    }));
    try {
      const {
        exportProjectAudioToMp3InBrowser,
        exportProjectInBrowser,
        loadBrowserFFmpeg,
      } = await import('./export/index.js');
      const ffmpeg = ffmpegRef.current || await loadBrowserFFmpeg({ signal: controller.signal });
      ffmpegRef.current = ffmpeg;
      const exportProject = format === 'audio'
        ? exportProjectAudioToMp3InBrowser
        : exportProjectInBrowser;
      const result = await exportProject({
        project,
        ffmpeg,
        mediaRegistry: mediaRegistryRef.current,
        signal: controller.signal,
        onProgress: ({ progress, message }) => {
          setExportState((current) => ({
            ...current,
            progress: Math.round(Number(progress || 0) * 100),
            message,
          }));
        },
      });
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const resultUrl = URL.createObjectURL(result.blob);
      resultUrlRef.current = resultUrl;
      setExportState(createEmptyExportState({
        open: true,
        format,
        progress: 100,
        message: 'Export complete.',
        resultUrl,
        resultFileName: result.fileName,
        resultMimeType: result.mimeType || (format === 'audio' ? 'audio/mpeg' : 'video/mp4'),
      }));
    } catch (error) {
      setExportState((current) => ({
        ...current,
        exporting: false,
        error: error.message || `The ${format === 'audio' ? 'audio' : 'video'} could not be exported.`,
      }));
    } finally {
      exportAbortRef.current = null;
    }
  }, [project, setPlaying]);

  const saveResultToLibrary = useCallback(async () => {
    if (!resultUrlRef.current) return;
    setSavingResult(true);
    try {
      const isAudioExport = exportState.format === 'audio';
      const blobResponse = await fetch(resultUrlRef.current);
      if (!blobResponse.ok) {
        throw new Error(`The exported ${isAudioExport ? 'audio' : 'video'} is no longer available.`);
      }
      const blob = await blobResponse.blob();
      const fallbackName = `${project.name || (isAudioExport ? 'audio' : 'video')}.${isAudioExport ? 'mp3' : 'mp4'}`;
      const fileName = exportState.resultFileName || fallbackName;
      const mimeType = exportState.resultMimeType || (isAudioExport ? 'audio/mpeg' : 'video/mp4');
      const formData = new FormData();
      formData.append('file', new File([blob], fileName, { type: mimeType }));
      formData.append('folderId', 'null');
      formData.append('tags', isAudioExport ? 'editor,timeline,audio' : 'editor,timeline');
      formData.append('campaignId', getActiveCampaignId());
      const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Could not save the ${isAudioExport ? 'audio' : 'video'} to Media Library.`);
      }
      const uploadedMedia = await response.json();
      if (isBulkProject && bulkRowId && !isAudioExport) {
        const rows = getBulkRows();
        const rowIndex = rows.findIndex((row) => String(row.id) === String(bulkRowId));
        if (rowIndex < 0) throw new Error('The Bulk Planning Board row no longer exists.');
        const isDualVideo = localStorage.getItem('tw_bulk_builder_dual_video') !== 'false';
        const rowWithProject = projectToBulkRow(project, rows[rowIndex], {
          isDualVideo,
          clearResult: false,
        });
        rows[rowIndex] = sanitizeBulkRowForStorage({
          ...rowWithProject,
          ...getUploadedMediaSummary(uploadedMedia),
          resultVideoUrl: '',
          status: 'done',
        });
        writeBulkRowsSnapshot(rows, { source: 'editor-v2', rowId: bulkRowId });
        const savedSnapshot = serializeProject(project);
        savedProjectRef.current = savedSnapshot;
        bulkSyncedProjectRef.current = savedSnapshot;
        setStatus({
          type: 'success',
          text: 'Video added to Media Library and the Bulk Planning Board row was updated.',
        });
      } else {
        setStatus({
          type: 'success',
          text: `${isAudioExport ? 'Audio' : 'Video'} added to the Media Library.`,
        });
      }
      setExportState((current) => ({ ...current, open: false }));
    } catch (error) {
      setExportState((current) => ({ ...current, error: error.message || 'Save failed.' }));
    } finally {
      setSavingResult(false);
    }
  }, [bulkRowId, exportState.format, exportState.resultFileName, exportState.resultMimeType, isBulkProject, project, token]);

  return (
    <div className="flex h-[100dvh] min-w-[1080px] flex-col overflow-hidden bg-[#090a0d] text-[#f5f7fa] [color-scheme:dark]">
      <EditorToolbar
        projectName={project.name}
        output={project.output}
        canUndo={canUndo(state)}
        canRedo={canRedo(state)}
        isExporting={exportState.exporting}
        isBulkProject={isBulkProject}
        onProjectNameChange={(name) => dispatch(editorActions.renameProject(name))}
        onUndo={() => dispatch(editorActions.undo())}
        onRedo={() => dispatch(editorActions.redo())}
        onOpenProjectSettings={() => setProjectSettingsOpen(true)}
        onPreview={() => setPlaying(!isPlaying)}
        onExport={openExportDialog}
        onSaveProject={saveProject}
        onBack={handleBack}
        backLabel={openedFromLegacyEditor
          ? 'Return to old Video Editor'
          : undefined}
      />

      <div
        ref={editorLayoutRef}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_clamp(340px,26vw,420px)] overflow-hidden"
        style={{
          gridTemplateRows: `minmax(${WORKSPACE_MIN_HEIGHT}px, 1fr) ${timelineHeight}px`,
        }}
      >
        <MediaPanel
          assets={assets}
          onFilesSelected={handleFilesSelected}
          onOpenLibrary={(mode) => {
            setLibraryMode(mode);
            setLibraryOpen(true);
          }}
          onAddAsset={addAssetToTimeline}
          onAddText={addText}
        />
        <InspectorPanel
          selectedClip={selectedClip}
          maxDuration={project.output.maxDuration}
          onUpdateClip={updateSelectedClip}
          onSetPlaybackRate={setSelectedClipPlaybackRate}
          onExtractAudio={extractSelectedVideoAudio}
          extractingAudio={Boolean(
            selectedClipId && extractingAudioClipId === selectedClipId
          )}
          extractAudioDisabled={extractAudioDisabled}
        />
        <div className="col-start-3 row-span-2 row-start-1 min-h-0">
          <PreviewStage
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            selectedClipId={selectedClipId}
            onSelectClip={(clipId) => dispatch(editorActions.selectClip(clipId))}
            onUpdateClip={(clipId, changes) => dispatch(editorActions.updateClip(clipId, changes))}
            onTogglePlay={() => setPlaying(!isPlaying)}
          />
        </div>

        <div
          id="video-editor-timeline"
          className="relative col-span-2 col-start-1 row-start-2 h-full min-h-0"
        >
          <div
            role="separator"
            aria-label="Resize timeline height"
            aria-controls="video-editor-timeline"
            aria-orientation="horizontal"
            aria-valuemin={TIMELINE_MIN_HEIGHT}
            aria-valuemax={Math.round(timelineMaximum)}
            aria-valuenow={Math.round(timelineHeight)}
            aria-valuetext={`${Math.round(timelineHeight)} pixels high`}
            tabIndex={0}
            title="Drag to resize timeline. Use Arrow Up or Arrow Down when focused."
            onPointerDown={handleTimelineResizeStart}
            onPointerMove={handleTimelineResizeMove}
            onPointerUp={handleTimelineResizeEnd}
            onPointerCancel={handleTimelineResizeEnd}
            onLostPointerCapture={handleTimelineResizeEnd}
            onKeyDown={handleTimelineResizeKeyDown}
            className="absolute inset-x-0 -top-1 z-[70] h-3 cursor-row-resize touch-none outline-none"
          />

          <Timeline
            tracks={project.tracks}
            duration={project.output.maxDuration}
            contentDuration={contentDuration}
            currentTime={currentTime}
            selectedClipId={selectedClipId}
            rippleDeleteEnabled={rippleDeleteEnabled}
            className="h-full"
            onSeek={seek}
            onSelectClip={({ clipId }) => dispatch(editorActions.selectClip(clipId))}
            onMoveClip={({ clipId, timelineStart }) => dispatch(editorActions.moveClip(clipId, { timelineStart }))}
            onTrimClip={({ clipId, ...trim }) => dispatch(editorActions.trimClip(clipId, trim))}
            onSplitClip={({ clipId, time }) => dispatch(editorActions.splitClip(clipId, time))}
            onDeleteClip={({ clipId }) => dispatch(editorActions.deleteClip(clipId))}
            onRippleDeleteClip={({ clipId }) => dispatch(editorActions.rippleDeleteClip(clipId))}
            onRippleDeleteEnabledChange={setRippleDeleteEnabled}
            onUpdateTrack={({ trackId, changes }) => dispatch(editorActions.updateTrack(trackId, changes))}
          />
        </div>
      </div>

      {status?.type === 'error' && (
        <button
          type="button"
          onClick={() => setStatus(null)}
          style={{
            left: 'calc((100vw - clamp(340px, 26vw, 420px)) / 2)',
            bottom: timelineHeight + 12,
          }}
          className="fixed z-50 max-w-md -translate-x-1/2 rounded-xl border border-red-400/30 bg-[#2a1519] px-4 py-2.5 text-[11px] font-bold text-red-200 shadow-lg"
        >
          {status.text}
        </button>
      )}

      {libraryOpen && (
        <VideoLibraryPickerDialog
          slotLabel="First Video"
          token={token}
          mediaType={libraryMode}
          theme="dark"
          onClose={() => setLibraryOpen(false)}
          onSelectVideo={handleLibrarySelection}
          onSelectAudio={handleLibrarySelection}
        />
      )}

      {projectSettingsOpen && (
        <ProjectSettingsDialog
          output={project.output}
          onClose={() => setProjectSettingsOpen(false)}
          onApply={(settings) => {
            dispatch(editorActions.setOutputSettings(settings));
            setProjectSettingsOpen(false);
            setStatus({ type: 'success', text: 'Project settings updated.' });
          }}
        />
      )}

      <ExportDialog
        {...exportState}
        saving={savingResult}
        onFormatChange={(format) => setExportState((current) => ({
          ...current,
          format: format === 'audio' ? 'audio' : 'video',
          error: '',
        }))}
        onStartExport={handleExport}
        onClose={() => setExportState((current) => ({ ...current, open: false }))}
        onCancel={() => exportAbortRef.current?.abort(new Error('Export cancelled by user.'))}
        onSaveToLibrary={saveResultToLibrary}
      />
    </div>
  );
};

export default VideoEditorV2;
