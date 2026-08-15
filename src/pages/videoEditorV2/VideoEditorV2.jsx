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
import { getActiveCampaignId, withCampaignScope } from '../../utils/campaignScope';
import { getMediaUrl } from '../../utils/mediaUrls';
import {
  API_BASE_URL,
  PLATFORM_AUDIO_FOLDER_ID,
  PREVIEW_FRAME_WIDTH,
} from '../videoEditor/videoEditorConstants';
import { VideoLibraryPickerDialog } from '../videoEditor/VideoLibraryPickerDialog';
import { CaptionDrawer } from '../bulkBuilder/CaptionDrawer';
import {
  DEFAULT_TEXT_SETTINGS,
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
import { BulkExportDialog } from './components/BulkExportDialog';
import { InspectorPanel } from './components/InspectorPanel';
import { MediaPanel } from './components/MediaPanel';
import { PreviewStage } from './components/PreviewStage';
import { ProjectSettingsDialog } from './components/ProjectSettingsDialog';
import { usePlaybackClock } from './hooks/usePlaybackClock';
import {
  updateStoredBulkRowById,
  useBulkExportQueue,
} from './hooks/useBulkExportQueue';
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
  editorActions,
  editorReducer,
  findClipById,
  getPrimaryTrackByType,
  hydrateBulkProjectDurations,
  projectToBulkRow,
  serializeProject,
  sortClipsByTimeline,
} from './project';
import { Timeline } from './timeline';

const DRAFT_STORAGE_KEY = 'tw_video_editor_v2_draft';
const TIMELINE_MIN_HEIGHT = 220;
const TIMELINE_MAX_HEIGHT = 480;
// 40px toolbar + 36px ruler + three 62px tracks + scrollbar/borders.
const TIMELINE_DEFAULT_HEIGHT = 268;
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
  folderId: 'root',
  folders: [],
  foldersLoading: false,
  folderError: '',
  ...overrides,
});

const createEmptyBulkExportDialog = (overrides = {}) => ({
  open: false,
  rowIds: [],
  generatingCaptions: false,
  folderId: 'root',
  folders: [],
  foldersLoading: false,
  folderError: '',
  phase: 'rendering',
  ...overrides,
});

const clampTimelineHeight = (value, maximum = TIMELINE_MAX_HEIGHT) => Math.min(
  Math.max(TIMELINE_MIN_HEIGHT, maximum),
  Math.max(TIMELINE_MIN_HEIGHT, Number(value) || TIMELINE_MIN_HEIGHT),
);

const getInitialTimelineHeight = () => {
  if (typeof window === 'undefined') return TIMELINE_DEFAULT_HEIGHT;
  const availableHeight = Math.max(
    TIMELINE_MIN_HEIGHT,
    Math.min(
      TIMELINE_MAX_HEIGHT,
      window.innerHeight - EDITOR_TOOLBAR_HEIGHT - WORKSPACE_MIN_HEIGHT,
    ),
  );
  return clampTimelineHeight(TIMELINE_DEFAULT_HEIGHT, availableHeight);
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
    return {
      project: createEditorProject({ name: 'Missing bulk project' }),
      bulkRow: null,
      contextKey: `bulk-missing:${bulkRowId}`,
      projectPersisted: false,
      warning: 'This Bulk Planning Board row no longer exists. Choose another project from Bulk Queue or return to the board.',
    };
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

const hasBulkQueueVideo = (row) => Boolean(
  row?.video1
  || row?.video1Url
  || row?.video
  || row?.videoUrl
  || row?.resultMediaId
  || row?.resultMediaUrl
  || row?.resultVideoUrl
  || (row?.editorProject && calculateProjectDuration(row.editorProject) > 0)
);

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
  const requestedBulkRowId = searchParams.get('rowId') || '';
  const requestedBulkMode = searchParams.get('mode') === 'bulk';
  const fallbackBulkRowId = useMemo(() => (
    requestedBulkMode && !requestedBulkRowId
      ? String(getBulkRows()[0]?.id || '')
      : ''
  ), [requestedBulkMode, requestedBulkRowId]);
  const bulkRowId = requestedBulkRowId || fallbackBulkRowId;
  const isBulkProject = requestedBulkMode && Boolean(bulkRowId);
  useEffect(() => {
    if (!requestedBulkMode || requestedBulkRowId) return;
    if (!fallbackBulkRowId) {
      navigate('/media/bulk-builder', { replace: true });
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', 'bulk');
    nextParams.set('rowId', fallbackBulkRowId);
    nextParams.set('panel', 'bulk');
    navigate(`/media/editor?${nextParams.toString()}`, { replace: true });
  }, [fallbackBulkRowId, navigate, requestedBulkMode, requestedBulkRowId, searchParams]);
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
  const [audioPoolLoading, setAudioPoolLoading] = useState(true);
  const [audioPoolError, setAudioPoolError] = useState('');
  const [promoAssets, setPromoAssets] = useState([]);
  const [promoFolderName, setPromoFolderName] = useState('');
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoError, setPromoError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState('video');
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [textAiDrawerClipId, setTextAiDrawerClipId] = useState(null);
  const [textAiSuggestions, setTextAiSuggestions] = useState([]);
  const [textAiVibe, setTextAiVibe] = useState('');
  const [rippleDeleteEnabled, setRippleDeleteEnabled] = useState(true);
  const [extractingAudioClipId, setExtractingAudioClipId] = useState(null);
  const [status, setStatus] = useState(() => (
    initialContext.warning
      ? { type: 'warning', text: initialContext.warning }
      : null
  ));
  const [exportState, setExportState] = useState(createEmptyExportState);
  const [bulkExportDialog, setBulkExportDialog] = useState(createEmptyBulkExportDialog);
  const [savingResult, setSavingResult] = useState(false);
  const [selectedBulkRowIds, setSelectedBulkRowIds] = useState(() => (
    isBulkProject && bulkRowId ? [bulkRowId] : []
  ));
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

  const uploadBulkQueueResult = useCallback(async ({
    row,
    blob,
    fileName,
    mimeType,
    signal,
    uploadOptions,
    onProgress,
  }) => {
    if (signal.aborted) throw signal.reason || new Error('Bulk export cancelled.');
    let generatedCaption = row.generatedCaption || '';
    if (uploadOptions?.generateCaptions) {
      onProgress?.(0.05, 'Generating AI caption…');
      const captionResponse = await fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          videoName: row.caption || row.video1?.name || row.id || 'short video',
        }),
        signal,
      });
      if (!captionResponse.ok) {
        const payload = await captionResponse.json().catch(() => ({}));
        throw new Error(payload.message || 'The AI caption could not be generated.');
      }
      const captionPayload = await captionResponse.json();
      generatedCaption = captionPayload.caption || '';
      onProgress?.(0.35, 'Caption generated. Saving video…');
    }
    const resolvedName = fileName || `${row.caption || row.id || 'bulk-video'}.mp4`;
    const formData = new FormData();
    formData.append('file', new File([blob], resolvedName, { type: mimeType || 'video/mp4' }));
    const folderId = uploadOptions?.folderId || 'root';
    formData.append('folderId', folderId === 'root' ? 'null' : folderId);
    formData.append('tags', 'editor,timeline,bulk');
    formData.append('campaignId', getActiveCampaignId());
    if (generatedCaption) formData.append('caption', generatedCaption);
    onProgress?.(0.5, 'Uploading to Media Library…');
    const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'The rendered video could not be uploaded to Media Library.');
    }
    const payload = await response.json();
    onProgress?.(1, 'Saved to Media Library.');
    return {
      media: payload?.media || payload,
      generatedCaption,
    };
  }, [token]);

  const bulkExportQueue = useBulkExportQueue({
    ffmpegRef,
    uploadResult: uploadBulkQueueResult,
  });
  const bulkQueueState = useMemo(() => ({
    running: bulkExportQueue.isRunning,
    progress: Math.round(Number(bulkExportQueue.overallProgress) * 100),
    message: bulkExportQueue.currentItem?.message
      || (bulkExportQueue.isRunning ? 'Preparing bulk queue…' : ''),
    completed: bulkExportQueue.queue.completed,
    total: bulkExportQueue.queue.total,
    status: bulkExportQueue.queue.status,
  }), [
    bulkExportQueue.currentItem,
    bulkExportQueue.isRunning,
    bulkExportQueue.overallProgress,
    bulkExportQueue.queue.completed,
    bulkExportQueue.queue.status,
    bulkExportQueue.queue.total,
  ]);
  const bulkQueueRows = useMemo(() => bulkExportQueue.rows
    .filter(hasBulkQueueVideo)
    .map((row) => {
      const item = bulkExportQueue.queue.items[String(row.id)];
      const itemMatchesStoredResult = item && (
        (row.status === 'done' && item.status === 'done')
        || (row.status === 'error' && item.status === 'error')
        || item.status === 'rendered'
      );
      return item && (bulkExportQueue.isRunning || itemMatchesStoredResult) ? {
        ...row,
        queueStatus: item.status,
        bulkExportError: item.error || '',
        queueMessage: item.message || '',
        renderedVideoUrl: item.renderedVideoUrl || '',
        renderedFileName: item.renderedFileName || '',
        generatedCaption: item.generatedCaption ?? row.generatedCaption,
        queueResultUrl: getMediaUrl(row.resultMediaUrl || row.resultVideoUrl),
      } : {
        ...row,
        queueResultUrl: getMediaUrl(row.resultMediaUrl || row.resultVideoUrl),
      };
    }), [bulkExportQueue.isRunning, bulkExportQueue.queue.items, bulkExportQueue.rows]);
  const bulkExportDialogRows = useMemo(() => {
    const requestedIds = new Set(bulkExportDialog.rowIds.map(String));
    return bulkQueueRows.filter((row) => requestedIds.has(String(row.id)));
  }, [bulkExportDialog.rowIds, bulkQueueRows]);

  const { project, currentTime, isPlaying, selectedClipId } = state;
  const projectRef = useRef(project);
  const selectedClip = findClipById(project, selectedClipId);
  const textAiTargetClip = textAiDrawerClipId
    ? findClipById(project, textAiDrawerClipId)
    : null;
  const selectedClipTrack = selectedClipId ? getClipTrack(project, selectedClipId) : null;
  const extractAudioDisabled = Boolean(extractingAudioClipId)
    || bulkQueueState.running
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
    if (!isBulkProject) return;
    const storedRows = readBulkRowsSnapshot();
    const canonicalRows = getBulkRows().map(sanitizeBulkRowForStorage);
    if (JSON.stringify(storedRows) !== JSON.stringify(canonicalRows)) {
      writeBulkRowsSnapshot(canonicalRows, { source: 'editor-v2-bulk-migration' });
    }
  }, [isBulkProject]);

  useEffect(() => {
    if (!isBulkProject || !bulkRowId) return;
    queueMicrotask(() => setSelectedBulkRowIds((current) => (
      current.length > 0 ? current : [bulkRowId]
    )));
  }, [bulkRowId, isBulkProject]);

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
    const availableAssets = [...assets, ...promoAssets];
    availableAssets.forEach((asset) => registry.set(asset.id, asset));
    project.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const asset = availableAssets.find((candidate) => (
          candidate.id === clip.mediaId || candidate.mediaId === clip.mediaId
        ));
        if (clip.mediaId && asset) registry.set(clip.mediaId, asset);
      });
    });
    mediaRegistryRef.current = registry;
  }, [assets, project.tracks, promoAssets]);

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
    const controller = new AbortController();

    const loadPlatformAudio = async () => {
      setAudioPoolLoading(true);
      setAudioPoolError('');
      try {
        const params = new URLSearchParams();
        const campaignId = getActiveCampaignId();
        if (campaignId) params.set('campaignId', campaignId);
        params.set('folderId', PLATFORM_AUDIO_FOLDER_ID);
        const response = await fetch(`${API_BASE_URL}/api/media?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to load audio from the Bulk Queue folder.');

        const payload = await response.json();
        const tracks = (Array.isArray(payload) ? payload : [])
          .filter((item) => item?.url)
          .map((item) => ({
            id: String(item._id || item.id || item.mediaId),
            mediaId: String(item._id || item.id || item.mediaId),
            sourceType: 'library',
            type: 'audio',
            name: item.name || item.filename || 'Platform audio',
            url: getMediaUrl(item.url, { apiBaseUrl: API_BASE_URL }),
            originalUrl: item.url,
            mimeType: item.mimeType || item.mimetype || '',
            duration: Number(item.duration || 0),
            width: 0,
            height: 0,
          }));

        setAssets((current) => {
          const existingIds = new Set(current.map((asset) => String(asset.id)));
          return [...current, ...tracks.filter((track) => !existingIds.has(track.id))];
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          setAudioPoolError(error.message || 'Unable to load audio from the Bulk Queue folder.');
        }
      } finally {
        if (!controller.signal.aborted) setAudioPoolLoading(false);
      }
    };

    void loadPlatformAudio();
    return () => controller.abort();
  }, [initialContext.contextKey, token]);

  useEffect(() => {
    const controller = new AbortController();

    const loadPromoVideos = async () => {
      setPromoLoading(true);
      setPromoError('');
      setPromoAssets([]);
      setPromoFolderName('');

      const campaignId = getActiveCampaignId();
      if (!campaignId) {
        setPromoLoading(false);
        return;
      }

      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const campaignsResponse = await fetch(`${API_BASE_URL}/api/accounts/campaigns`, {
          headers,
          signal: controller.signal,
        });
        const campaignsPayload = await campaignsResponse.json();
        if (!campaignsResponse.ok) {
          throw new Error(campaignsPayload.message || 'Unable to load the campaign promo folder.');
        }
        const campaign = (Array.isArray(campaignsPayload) ? campaignsPayload : [])
          .find((item) => String(item._id) === String(campaignId));
        const promoFolderId = String(campaign?.promoFolderId?._id || campaign?.promoFolderId || '');
        if (!promoFolderId) return;

        const scope = new URLSearchParams({ campaignId });
        const mediaParams = new URLSearchParams({ campaignId, folderId: promoFolderId });
        const [foldersResponse, mediaResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/media/folders?${scope.toString()}`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${API_BASE_URL}/api/media?${mediaParams.toString()}`, {
            headers,
            signal: controller.signal,
          }),
        ]);
        const [foldersPayload, mediaPayload] = await Promise.all([
          foldersResponse.json(),
          mediaResponse.json(),
        ]);
        if (!foldersResponse.ok) {
          throw new Error(foldersPayload.message || 'Unable to read the assigned promo folder.');
        }
        if (!mediaResponse.ok) {
          throw new Error(mediaPayload.message || 'Unable to load promo videos.');
        }

        const folder = (Array.isArray(foldersPayload) ? foldersPayload : [])
          .find((item) => String(item._id) === promoFolderId);
        setPromoFolderName(folder?.name || 'Promo folder');
        setPromoAssets((Array.isArray(mediaPayload) ? mediaPayload : [])
          .filter((item) => item?.type === 'video' && item.url)
          .map((item) => ({
            id: String(item._id || item.id || item.mediaId),
            mediaId: String(item._id || item.id || item.mediaId),
            sourceType: 'library',
            type: 'video',
            name: item.name || item.filename || 'Promo video',
            url: getMediaUrl(item.url, { apiBaseUrl: API_BASE_URL }),
            originalUrl: item.url,
            thumbnailUrl: item.thumbnailUrl || '',
            mimeType: item.mimeType || item.mimetype || '',
            duration: Number(item.duration || 0),
            width: Number(item.width || 0),
            height: Number(item.height || 0),
          })));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setPromoError(error.message || 'Unable to load promo videos.');
        }
      } finally {
        if (!controller.signal.aborted) setPromoLoading(false);
      }
    };

    void loadPromoVideos();
    return () => controller.abort();
  }, [initialContext.contextKey, token]);

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

  const addAssetToTimeline = useCallback(async (asset) => {
    try {
      const type = asset.type;
      const needsDuration = ['audio', 'video'].includes(type)
        && Number(asset.duration || 0) <= 0;
      const resolvedAsset = needsDuration
        ? await createLibraryAsset(asset)
        : asset;
      const sourceDuration = Number(resolvedAsset.duration || 0);

      if (type === 'audio' && sourceDuration <= 0) {
        throw new Error('The full audio duration could not be read. Try the track again after it finishes loading.');
      }

      const track = getPrimaryTrackByType(project, type);
      if (!track) throw new Error(`The project has no ${type} track.`);

      const timelineStart = getNextTrackStart(track, currentTime, project.output.maxDuration);
      const remaining = project.output.maxDuration - timelineStart;
      if (remaining < 0.1) throw new Error('The 30-second timeline is full.');

      const duration = Math.min(
        remaining,
        type === 'image' ? 3 : Math.max(0.1, sourceDuration || 5),
      );
      const input = {
        name: resolvedAsset.name,
        mediaId: resolvedAsset.id,
        sourceUrl: resolvedAsset.url,
        originalUrl: resolvedAsset.originalUrl || '',
        sourceType: resolvedAsset.sourceType,
        mimeType: resolvedAsset.mimeType || '',
        sourceDuration: type === 'image' ? 0 : (sourceDuration || duration),
        timelineStart,
        duration,
      };
      const clip = type === 'audio'
        ? createAudioClip(input)
        : type === 'image'
          ? createImageClip(input)
          : createVideoClip(input);

      if (resolvedAsset !== asset) {
        setAssets((current) => current.map((candidate) => (
          candidate.id === asset.id ? resolvedAsset : candidate
        )));
      }
      dispatch(editorActions.addClip(clip));
      seek(timelineStart);
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'The media could not be added to the timeline.' });
    }
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
    setAssets((current) => (
      current.some((candidate) => candidate.id === asset.id)
        ? current
        : [asset, ...current]
    ));
    setLibraryOpen(false);
    setStatus({
      type: 'success',
      text: `${asset.name || 'Media'} added to the media pool. Click it when you want to add it to the timeline.`,
    });
  }, [libraryMode]);

  const removeAssetFromMediaPool = useCallback((asset) => {
    const isUsedOnTimeline = projectRef.current.tracks.some((track) => (
      track.clips.some((clip) => (
        clip.mediaId === asset.id
        || (asset.mediaId && clip.mediaId === asset.mediaId)
        || clip.sourceUrl === asset.url
      ))
    ));

    setAssets((current) => current.filter((candidate) => candidate.id !== asset.id));
    if (!isUsedOnTimeline) revokeAssetUrl(asset);
    setStatus({
      type: 'success',
      text: `${asset.name || 'Video'} removed from the media pool.`,
    });
  }, []);

  const addPromoAssetToTimeline = useCallback(async (asset) => {
    try {
      const hydratedAsset = Number(asset.duration || 0) > 0
        ? asset
        : await createLibraryAsset(asset);
      setPromoAssets((current) => current.map((item) => (
        item.id === asset.id ? hydratedAsset : item
      )));
      await addAssetToTimeline(hydratedAsset);
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'The promo video could not be added.' });
    }
  }, [addAssetToTimeline]);

  const addText = useCallback((text) => {
    const videoTrack = getPrimaryTrackByType(project, 'video');
    const firstVideoClip = sortClipsByTimeline(videoTrack?.clips || [])[0] || null;
    const timelineStart = firstVideoClip
      ? Number(firstVideoClip.timelineStart || 0)
      : currentTime;
    const availableDuration = Math.max(0.1, project.output.maxDuration - timelineStart);
    const duration = firstVideoClip
      ? Math.min(Number(firstVideoClip.duration || 0), availableDuration)
      : Math.min(3, availableDuration);
    if (duration < 0.1) return;
    const bulkTextScale = project.output.width / PREVIEW_FRAME_WIDTH;
    dispatch(editorActions.addClip(createTextClip({
      name: text,
      text,
      timelineStart,
      duration,
      style: {
        fontFamily: 'Outfit',
        fontWeight: '600',
        fontSize: DEFAULT_TEXT_SETTINGS.fontSize * bulkTextScale,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: DEFAULT_TEXT_SETTINGS.strokeWidth * bulkTextScale,
        backgroundColor: 'transparent',
        backgroundType: 'None',
        textAlign: 'center',
        lineHeight: 1.3,
      },
      transform: { x: 0.5, y: 0.25, scale: 1, rotation: 0, opacity: 1 },
    })));
  }, [currentTime, project]);

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
    if (bulkQueueState.running || exportState.exporting || savingResult || extractingAudioClipId) {
      setStatus({
        type: 'error',
        text: 'Finish or cancel the active export, upload, or audio extraction before leaving the editor.',
      });
      return;
    }
    const destination = isBulkProject ? 'Bulk Video Builder' : 'Media Library';
    if (!window.confirm(`Leave the video editor and go back to ${destination}? Your current changes will be saved.`)) {
      return;
    }
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
    } else {
      try {
        const snapshot = serializeProject(projectRef.current);
        localStorage.setItem(DRAFT_STORAGE_KEY, snapshot);
        savedProjectRef.current = snapshot;
      } catch {
        setStatus({
          type: 'error',
          text: 'This browser could not save the project before leaving the editor.',
        });
        return;
      }
    }
    navigate(isBulkProject ? '/media/bulk-builder' : '/media', { replace: true });
  }, [
    bulkQueueState.running,
    bulkRowId,
    exportState.exporting,
    extractingAudioClipId,
    isBulkProject,
    navigate,
    savingResult,
  ]);

  const openBulkVideoBuilder = useCallback(() => {
    if (bulkQueueState.running || exportState.exporting || savingResult || extractingAudioClipId) {
      setStatus({
        type: 'error',
        text: 'Finish or cancel the active export, upload, or audio extraction before opening the Bulk Video Builder.',
      });
      return;
    }
    if (!saveProject()) return;
    navigate('/media/bulk-builder');
  }, [
    bulkQueueState.running,
    exportState.exporting,
    extractingAudioClipId,
    navigate,
    saveProject,
    savingResult,
  ]);

  const openBulkQueueRow = useCallback((nextRowId) => {
    if (!isBulkProject || !nextRowId || String(nextRowId) === String(bulkRowId)) return;
    if (bulkQueueState.running || savingResult || exportState.exporting || extractingAudioClipId) {
      setStatus({
        type: 'error',
        text: 'Wait for the current export, upload, or audio extraction to finish before switching rows.',
      });
      return;
    }
    try {
      const currentProject = projectRef.current;
      const snapshot = serializeProject(currentProject);
      if (snapshot !== bulkSyncedProjectRef.current) {
        const savedSnapshot = persistProjectToBulkRow(currentProject, bulkRowId, {
          clearResult: true,
        });
        bulkSyncedProjectRef.current = savedSnapshot;
        savedProjectRef.current = savedSnapshot;
      }
      const rows = getBulkRows();
      if (!rows.some((row) => String(row.id) === String(nextRowId))) {
        throw new Error('That Bulk Planning Board row no longer exists.');
      }
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('mode', 'bulk');
      nextParams.set('rowId', String(nextRowId));
      setSelectedBulkRowIds((current) => (
        current.some((rowId) => String(rowId) === String(nextRowId))
          ? current
          : [...current, nextRowId]
      ));
      navigate(`/media/editor?${nextParams.toString()}`, { replace: true });
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Could not open that bulk project.' });
    }
  }, [
    bulkQueueState.running,
    bulkRowId,
    exportState.exporting,
    extractingAudioClipId,
    isBulkProject,
    navigate,
    savingResult,
    searchParams,
  ]);

  const openExportDialog = useCallback(() => {
    if (bulkQueueState.running) {
      setStatus({ type: 'error', text: 'Stop or finish the Bulk Queue before exporting this project separately.' });
      return;
    }
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = '';
    }
    setExportState((current) => createEmptyExportState({
      open: true,
      format: current.format,
    }));
  }, [bulkQueueState.running]);

  const handleExport = useCallback(async (requestedFormat = 'video') => {
    if (bulkQueueState.running) {
      setExportState((current) => ({
        ...current,
        open: true,
        exporting: false,
        error: 'Stop or finish the Bulk Queue before starting another export.',
      }));
      return;
    }
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
        exportProjectWithBestAvailableEngine,
        loadBrowserFFmpeg,
      } = await import('./export/index.js');
      const ffmpeg = ffmpegRef.current || await loadBrowserFFmpeg({ signal: controller.signal });
      ffmpegRef.current = ffmpeg;
      const exportProject = format === 'audio'
        ? exportProjectAudioToMp3InBrowser
        : exportProjectWithBestAvailableEngine;
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
        message: result.engine === 'webcodecs'
          ? 'Hardware-accelerated export complete.'
          : 'Export complete.',
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
      if (exportAbortRef.current === controller) exportAbortRef.current = null;
    }
  }, [bulkQueueState.running, project, setPlaying]);

  const saveResultToLibrary = useCallback(async (folderId = 'root') => {
    if (!resultUrlRef.current) return false;
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
      formData.append('folderId', folderId && folderId !== 'root' ? String(folderId) : 'null');
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
      return true;
    } catch (error) {
      setExportState((current) => ({ ...current, error: error.message || 'Save failed.' }));
      return false;
    } finally {
      setSavingResult(false);
    }
  }, [bulkRowId, exportState.format, exportState.resultFileName, exportState.resultMimeType, isBulkProject, project, token]);

  const loadExportFolders = useCallback(async () => {
    setExportState((current) => ({
      ...current,
      foldersLoading: true,
      folderError: '',
      error: '',
    }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Unable to load Media Library folders.');
      const payload = await response.json();
      const folders = Array.isArray(payload) ? payload : (payload.folders || []);
      setExportState((current) => ({
        ...current,
        folders,
        foldersLoading: false,
      }));
    } catch (error) {
      setExportState((current) => ({
        ...current,
        folders: [],
        foldersLoading: false,
        folderError: error.message || 'Unable to load Media Library folders.',
      }));
    }
  }, [token]);

  const loadBulkExportFolders = useCallback(async () => {
    setBulkExportDialog((current) => ({
      ...current,
      foldersLoading: true,
      folderError: '',
    }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Unable to load Media Library folders.');
      const payload = await response.json();
      const folders = Array.isArray(payload) ? payload : (payload.folders || []);
      setBulkExportDialog((current) => ({
        ...current,
        folders,
        foldersLoading: false,
      }));
    } catch (error) {
      setBulkExportDialog((current) => ({
        ...current,
        folders: [],
        foldersLoading: false,
        folderError: error.message || 'Unable to load Media Library folders.',
      }));
    }
  }, [token]);

  const openBulkExportDialog = useCallback(async (requestedRowIds = null) => {
    if (!isBulkProject || bulkExportQueue.isRunning) return;
    if (exportState.exporting || savingResult || extractingAudioClipId) {
      setStatus({
        type: 'error',
        text: 'Finish the current export, upload, or audio extraction before starting Bulk Queue.',
      });
      return;
    }

    try {
      const currentSnapshot = serializeProject(projectRef.current);
      if (currentSnapshot !== bulkSyncedProjectRef.current) {
        const savedSnapshot = persistProjectToBulkRow(projectRef.current, bulkRowId, {
          clearResult: true,
        });
        bulkSyncedProjectRef.current = savedSnapshot;
        savedProjectRef.current = savedSnapshot;
      }

      const requestedKeys = Array.isArray(requestedRowIds)
        ? new Set(requestedRowIds.map(String).filter(Boolean))
        : null;
      const rowIds = bulkQueueRows
        .filter((row) => {
          const rowId = String(row.id);
          if (requestedKeys ? !requestedKeys.has(rowId) : row.status === 'done') return false;
          const rowProject = rowId === String(bulkRowId)
            ? projectRef.current
            : row.editorProject;
          return rowProject && calculateProjectDuration(rowProject) > 0;
        })
        .map((row) => String(row.id));

      if (rowIds.length === 0) {
        setStatus({
          type: 'error',
          text: requestedKeys
            ? 'The chosen videos are not ready to export.'
            : 'There are no pending bulk videos ready to export.',
        });
        return;
      }

      bulkExportQueue.reset();
      setBulkExportDialog(createEmptyBulkExportDialog({
        open: true,
        rowIds,
        phase: 'rendering',
      }));
      void loadBulkExportFolders();
      setPlaying(false);
      const summary = await bulkExportQueue.render(rowIds);
      setBulkExportDialog((current) => ({
        ...current,
        phase: summary.succeeded.length > 0 ? 'ready-to-save' : 'complete',
      }));
    } catch (error) {
      setBulkExportDialog((current) => ({ ...current, phase: 'complete' }));
      setStatus({ type: 'error', text: error.message || 'The bulk videos could not be rendered.' });
    }
  }, [
    bulkExportQueue,
    bulkQueueRows,
    bulkRowId,
    exportState.exporting,
    extractingAudioClipId,
    isBulkProject,
    loadBulkExportFolders,
    savingResult,
    setPlaying,
  ]);

  const startBulkExportDialogQueue = useCallback(async (targetRowId = null) => {
    const savingOne = Boolean(targetRowId);
    const requestedRowIds = savingOne ? [String(targetRowId)] : bulkExportDialog.rowIds;
    if (!savingOne) {
      setBulkExportDialog((current) => ({ ...current, phase: 'saving' }));
    }
    try {
      const summary = await bulkExportQueue.saveRendered(requestedRowIds, {
        uploadOptions: {
          folderId: bulkExportDialog.folderId,
        },
      });
      const completed = summary.succeeded.length;
      const failed = summary.failed.length;
      if (!savingOne) {
        setBulkExportDialog((current) => ({ ...current, phase: 'complete' }));
      }
      if (failed > 0) {
        setStatus({
          type: 'error',
          text: `${completed} video${completed === 1 ? '' : 's'} saved; ${failed} failed.`,
        });
      } else if (savingOne) {
        setStatus({ type: 'success', text: 'Video saved successfully to your Media Library!' });
      }
    } catch (error) {
      if (!savingOne) {
        setBulkExportDialog((current) => ({ ...current, phase: 'complete' }));
      }
      setStatus({ type: 'error', text: error.message || 'The rendered videos could not be saved.' });
    }
  }, [bulkExportDialog.folderId, bulkExportDialog.rowIds, bulkExportQueue]);

  const generateBulkExportCaptions = useCallback(async () => {
    const renderedRows = bulkExportDialogRows.filter((row) => Boolean(row.renderedVideoUrl));
    if (renderedRows.length === 0 || bulkExportDialog.generatingCaptions) return;

    setBulkExportDialog((current) => ({ ...current, generatingCaptions: true }));
    setStatus(null);
    try {
      for (const row of renderedRows) {
        const response = await fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ videoName: row.caption || 'couple video' }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Failed to generate one or more captions.');
        }
        const payload = await response.json();
        await updateStoredBulkRowById(row.id, (current) => ({
          ...current,
          generatedCaption: payload.caption || '',
        }), { source: 'editor-v2-bulk-captions' });
      }
      setStatus({
        type: 'success',
        text: `Captions generated successfully for ${renderedRows.length} video${renderedRows.length === 1 ? '' : 's'}!`,
      });
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Failed to generate captions.' });
    } finally {
      setBulkExportDialog((current) => ({ ...current, generatingCaptions: false }));
    }
  }, [bulkExportDialog.generatingCaptions, bulkExportDialogRows, token]);

  const closeBulkExportDialog = useCallback(() => {
    if (bulkExportQueue.isRunning) return;
    setBulkExportDialog(createEmptyBulkExportDialog());
    bulkExportQueue.reset();
  }, [bulkExportQueue]);

  return (
    <div className="flex h-[100dvh] min-w-[1080px] flex-col overflow-hidden bg-[#090a0d] text-[#f5f7fa] [color-scheme:dark]">
      <EditorToolbar
        projectName={project.name}
        output={project.output}
        canUndo={canUndo(state)}
        canRedo={canRedo(state)}
        isExporting={exportState.exporting || bulkQueueState.running}
        isBulkProject={isBulkProject}
        onProjectNameChange={(name) => dispatch(editorActions.renameProject(name))}
        onUndo={() => dispatch(editorActions.undo())}
        onRedo={() => dispatch(editorActions.redo())}
        onOpenProjectSettings={() => setProjectSettingsOpen(true)}
        onPreview={() => setPlaying(!isPlaying)}
        onExport={openExportDialog}
        onSaveProject={saveProject}
        onOpenBulkBuilder={openBulkVideoBuilder}
        onBack={handleBack}
      />

      <div
        ref={editorLayoutRef}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_clamp(340px,26vw,420px)] overflow-hidden"
        style={{
          gridTemplateRows: `minmax(${WORKSPACE_MIN_HEIGHT}px, 1fr) ${timelineHeight}px`,
        }}
      >
        <MediaPanel
          key={isBulkProject ? 'bulk-editor-media' : 'single-editor-media'}
          assets={assets}
          audioPoolLoading={audioPoolLoading}
          audioPoolError={audioPoolError}
          promoAssets={promoAssets}
          promoFolderName={promoFolderName}
          promoLoading={promoLoading}
          promoError={promoError}
          onFilesSelected={handleFilesSelected}
          onOpenLibrary={(mode) => {
            setLibraryMode(mode);
            setLibraryOpen(true);
          }}
          onAddAsset={addAssetToTimeline}
          onRemoveAsset={removeAssetFromMediaPool}
          onAddPromoAsset={addPromoAssetToTimeline}
          onAddText={addText}
          bulkQueue={isBulkProject ? {
            initiallyOpen: searchParams.get('panel') === 'bulk',
            rows: bulkQueueRows,
            currentRowId: bulkRowId,
            selectedRowIds: selectedBulkRowIds,
            queueState: bulkQueueState,
            disabled: bulkExportQueue.isRunning
              || exportState.exporting
              || savingResult
              || Boolean(extractingAudioClipId),
            onSelectionChange: setSelectedBulkRowIds,
            onOpenRow: openBulkQueueRow,
            onExportCurrent: () => openBulkExportDialog([bulkRowId]),
            onExportSelected: () => openBulkExportDialog(selectedBulkRowIds),
            onExportAll: () => openBulkExportDialog(),
            onRetryFailed: () => openBulkExportDialog(
              bulkQueueRows.filter((row) => row.status === 'error').map((row) => row.id),
            ),
            onCancel: bulkExportQueue.cancel,
          } : null}
        />
        <InspectorPanel
          selectedClip={selectedClip}
          maxDuration={project.output.maxDuration}
          onUpdateClip={updateSelectedClip}
          onSetPlaybackRate={setSelectedClipPlaybackRate}
          onExtractAudio={extractSelectedVideoAudio}
          onGenerateText={() => {
            if (!selectedClip || selectedClip.type !== 'text') return;
            setTextAiSuggestions([]);
            setTextAiVibe('');
            setTextAiDrawerClipId(selectedClip.id);
          }}
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
        onLoadFolders={loadExportFolders}
        onFolderChange={(folderId) => setExportState((current) => ({
          ...current,
          folderId,
          error: '',
        }))}
        selectedFolderId={exportState.folderId}
        folders={exportState.folders}
        foldersLoading={exportState.foldersLoading}
        folderError={exportState.folderError}
        onSaveToLibrary={saveResultToLibrary}
      />

      {textAiTargetClip?.type === 'text' && (
        <CaptionDrawer
          targetRowId={textAiTargetClip.id}
          token={token}
          currentCaption={textAiTargetClip.text || ''}
          suggestions={textAiSuggestions}
          onSuggestionsChange={setTextAiSuggestions}
          vibe={textAiVibe}
          onVibeChange={setTextAiVibe}
          onApply={(text) => dispatch(editorActions.updateClip(textAiTargetClip.id, { text }))}
          onClose={() => setTextAiDrawerClipId(null)}
          title="Generate Text with AI"
          manualLabel="Type your text"
          manualPlaceholder="Enter text for this clip"
          applyLabel="Apply Text"
          mountToViewport
          side="left"
        />
      )}

      <BulkExportDialog
        open={bulkExportDialog.open}
        rows={bulkExportDialogRows}
        folders={bulkExportDialog.folders}
        foldersLoading={bulkExportDialog.foldersLoading}
        folderError={bulkExportDialog.folderError}
        selectedFolderId={bulkExportDialog.folderId}
        generatingCaptions={bulkExportDialog.generatingCaptions}
        queueState={bulkQueueState}
        phase={bulkExportDialog.phase}
        onFolderChange={(folderId) => setBulkExportDialog((current) => ({
          ...current,
          folderId,
        }))}
        onGenerateCaptions={generateBulkExportCaptions}
        onStart={startBulkExportDialogQueue}
        onCancel={bulkExportQueue.cancel}
        onClose={closeBulkExportDialog}
      />
    </div>
  );
};

export default VideoEditorV2;
