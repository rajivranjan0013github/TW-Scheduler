import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchFile } from '@ffmpeg/util';
import { Download, Folder, Layers, Loader2, UploadCloud, X, ChevronRight, ChevronDown, Search, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OUTPUT_WIDTH, OUTPUT_HEIGHT, OUTPUT_FPS, API_BASE_URL } from './videoEditor/videoEditorConstants';
import { useFFmpeg } from './videoEditor/useFFmpeg';
import { usePreviewAudio } from './videoEditor/usePreviewAudio';
import { useVideoPreview } from './videoEditor/useVideoPreview';
import { useTextOverlay } from './videoEditor/useTextOverlay';
import { VideoUploadPanel } from './videoEditor/VideoUploadPanel';
import { VideoPreview } from './videoEditor/VideoPreview';
import { ExportPanel } from './videoEditor/ExportPanel';
import { TextSettingsPanel } from './videoEditor/TextSettingsPanel';
import { AudioDialog } from './videoEditor/AudioDialog';
import { VideoLibraryPickerDialog } from './videoEditor/VideoLibraryPickerDialog';
import { TextGeneratorDialog } from './videoEditor/TextGeneratorDialog';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { getMediaUrl } from '../utils/mediaUrls';
import {
  DEFAULT_DRAG_POS,
  normalizeBulkRowsFromStorage,
  sanitizeBulkRowForStorage,
} from './bulkBuilder/useBulkRows';
import {
  readBulkRowsSnapshot,
  subscribeToBulkRows,
  writeBulkRowsSnapshot,
} from './bulkBuilder/bulkProjectStore';
import {
  bulkRowToProject,
  deserializeProject,
  hydrateBulkProjectDurations,
  projectToBulkRow,
  serializeProject,
  syncBulkRowContent,
} from './videoEditorV2/project';

const getUploadedMediaSummary = (media) => ({
  resultMediaId: media?._id || media?.id || media?.mediaId || '',
  resultMediaUrl: media?.url || '',
  resultMediaName: media?.name || media?.filename || '',
});

const getBulkResultUrl = (row) => row.resultVideoUrl || getMediaUrl(row.resultMediaUrl);
const V2_DRAFT_STORAGE_KEY = 'tw_video_editor_v2_draft';
const LEGACY_TIMELINE_PROJECT_KEY = 'tw_legacy_editor_timeline_project_id';

const getMediaIdentity = (media) => (
  media
    ? `${media.sourceType || ''}:${media._id || media.id || media.mediaId || media.url || media.name || ''}`
    : ''
);

const getAudioIdentity = getMediaIdentity;

const getRowLoadSignature = (row) => JSON.stringify({
  id: row?.id || '',
  video1: getMediaIdentity(row?.video1),
  video1Url: row?.video1Url || '',
  video2: getMediaIdentity(row?.video2),
  video2Url: row?.video2Url || '',
  audio: getAudioIdentity(row?.audio),
  caption: row?.caption || '',
  textSettings: row?.textSettings || {},
  dragPos: row?.dragPos || {},
});

const normalizeDragPosForCompare = (dragPos) => ({
  x: Math.round(Number(dragPos?.x ?? DEFAULT_DRAG_POS.x) * 100) / 100,
  y: Math.round(Number(dragPos?.y ?? DEFAULT_DRAG_POS.y) * 100) / 100,
});

const getTextSettingsSignature = (settings) => JSON.stringify({
  fontFamily: settings?.fontFamily || '',
  fontWeight: settings?.fontWeight || '',
  fontSize: Number(settings?.fontSize || 0),
  fontColor: settings?.fontColor || '',
  strokeWidth: Number(settings?.strokeWidth || 0),
  strokeColor: settings?.strokeColor || '',
  bgType: settings?.bgType || '',
  bgColor: settings?.bgColor || '',
});

const getStoredBulkRows = (options) => normalizeBulkRowsFromStorage(
  readBulkRowsSnapshot(),
  options,
);

const persistVisibleBulkRows = (visibleRows, rowId = '') => {
  const rowsToPersist = rowId
    ? visibleRows.filter((row) => String(row.id) === String(rowId))
    : visibleRows;
  const updates = new Map(rowsToPersist.map((row) => [String(row.id), row]));
  const storedRows = getStoredBulkRows();
  const storedIds = new Set(storedRows.map((row) => String(row.id)));
  const mergedRows = storedRows.map((row) => (
    updates.has(String(row.id)) ? updates.get(String(row.id)) : row
  ));
  rowsToPersist.forEach((row) => {
    if (!storedIds.has(String(row.id))) mergedRows.push(row);
  });
  const sanitizedRows = mergedRows.map(sanitizeBulkRowForStorage);
  writeBulkRowsSnapshot(sanitizedRows, { source: 'legacy-bulk-queue', rowId });
  return sanitizedRows;
};

const hydrateBulkRowWithDurations = (row, videoDurations, isDualVideo) => {
  if (!row?.editorProject) {
    return { row, project: null, changed: false };
  }
  const currentSnapshot = serializeProject(row.editorProject);
  const project = hydrateBulkProjectDurations(row.editorProject, videoDurations);
  const nextSnapshot = serializeProject(project);
  if (nextSnapshot === currentSnapshot) {
    return { row, project, changed: false };
  }
  return {
    row: sanitizeBulkRowForStorage(projectToBulkRow(project, row, {
      isDualVideo,
      clearResult: false,
    })),
    project,
    changed: true,
  };
};

const assertCanonicalProjectUnchanged = (result) => {
  if (!result?.rowId || !result.projectSnapshot) return;
  const latestRow = getStoredBulkRows().find((row) => (
    String(row.id) === String(result.rowId)
  ));
  if (!latestRow?.editorProject) {
    throw new Error('This bulk row was removed while it was exporting.');
  }
  if (serializeProject(latestRow.editorProject) !== result.projectSnapshot) {
    throw new Error('This row changed while it was exporting. Export it again so the result matches the latest timeline.');
  }
};

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const getFolderParentId = (folder) => normalizeFolderId(folder.parentFolderId) || 'root';

export const VideoEditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const isBulkMode = searchParams.get('mode') === 'bulk';
  const [linkedTimelineProject, setLinkedTimelineProject] = useState(() => {
    if (isBulkMode) return null;
    try {
      const projectId = sessionStorage.getItem(LEGACY_TIMELINE_PROJECT_KEY);
      const serializedProject = localStorage.getItem(V2_DRAFT_STORAGE_KEY);
      if (!projectId || !serializedProject) return null;
      const project = deserializeProject(serializedProject);
      return String(project.id) === String(projectId) ? project : null;
    } catch {
      return null;
    }
  });

  // Video file state
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const [video1Url, setVideo1Url] = useState('');
  const [video2Url, setVideo2Url] = useState('');
  const [videoPickerSlot, setVideoPickerSlot] = useState(null);
  const [isDualVideo, setIsDualVideo] = useState(() => {
    try {
      const saved = localStorage.getItem('tw_bulk_builder_dual_video');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const toggleDualVideo = useCallback((val) => {
    setIsDualVideo(val);
    try {
      localStorage.setItem('tw_bulk_builder_dual_video', String(val));
    } catch { /* ignore */ }
  }, []);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultVideoUrl, setResultVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '' }
  const [showTextGenerator, setShowTextGenerator] = useState(false);
  const [singleGeneratedCaption, setSingleGeneratedCaption] = useState('');
  const [singleGeneratingCaption, setSingleGeneratingCaption] = useState(false);
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderPickerRowId, setFolderPickerRowId] = useState(null);
  const [folderPickerMode, setFolderPickerMode] = useState('single');
  const [selectedSaveFolderId, setSelectedSaveFolderId] = useState('root');
  const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
  const [bulkSavingRowId, setBulkSavingRowId] = useState(null);
  const [folderPickerError, setFolderPickerError] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [uploadQueue, setUploadQueue] = useState(null);

  const toggleFolderExpanded = useCallback((folderId) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Bulk Queue State
  const [bulkRows, setBulkRows] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [pendingSingleExportRowId, setPendingSingleExportRowId] = useState(null);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);

  const showTooltip = useCallback((e, text) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setHoveredTooltip(null);
  }, []);

  useEffect(() => {
    if (hoveredTooltip) {
      const handleScroll = () => setHoveredTooltip(null);
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('wheel', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('wheel', handleScroll);
      };
    }
  }, [hoveredTooltip]);

  // Object URL tracking
  const objectUrlsRef = useRef({ video1: '', video2: '', result: '' });
  const bulkResultUrlsRef = useRef([]);
  const activeBulkRunRef = useRef(null);
  const loadedBulkRowSignatureRef = useRef('');
  const isLoadingBulkRowRef = useRef(false);

  // --- Hooks ---
  const {
    ffmpegRef,
    ffmpegLoaded,
    ffmpegLoading,
    engineError,
    hasAudioStream,
    removeIfExists,
    ffmpegLogHandlerRef,
    ffmpegLogLinesRef,
  } = useFFmpeg();

  const audio = usePreviewAudio();
  const { playPreviewAudio, selectedAudio } = audio;
  const playSelectedPreviewAudio = useCallback(
    (startTime) => playPreviewAudio(startTime, selectedAudio),
    [playPreviewAudio, selectedAudio]
  );

  const preview = useVideoPreview({
    stopPreviewAudio: audio.stopPreviewAudio,
    playPreviewAudio: playSelectedPreviewAudio,
    selectedAudio,
  });

  const overlay = useTextOverlay();

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    const bulkUrls = bulkResultUrlsRef.current;
    return () => {
      Object.values(urls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      bulkUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // --- Video file handlers ---
  const handleSelectLibraryVideo = useCallback((selectedVideo) => {
    if (videoPickerSlot === 1) {
      if (objectUrlsRef.current.video1) {
        URL.revokeObjectURL(objectUrlsRef.current.video1);
        objectUrlsRef.current.video1 = '';
      }
      setVideo1(selectedVideo);
      setVideo1Url(selectedVideo.url);
      preview.setActiveVideo(1);
    } else if (videoPickerSlot === 2) {
      if (objectUrlsRef.current.video2) {
        URL.revokeObjectURL(objectUrlsRef.current.video2);
        objectUrlsRef.current.video2 = '';
      }
      setVideo2(selectedVideo);
      setVideo2Url(selectedVideo.url);
    }

    preview.resetPlayback();
    setVideoPickerSlot(null);
  }, [preview, videoPickerSlot]);

  // --- Audio dialog wrappers ---
  const handleSelectAudioTrack = useCallback((track) => {
    audio.selectAudioTrack(track, preview.isPlaying, preview.previewCurrentTime);
  }, [audio, preview.isPlaying, preview.previewCurrentTime]);

  const handleAudioUpload = useCallback((e) => {
    const res = audio.handleAudioUpload(e, preview.isPlaying, preview.previewCurrentTime);
    if (res && res.error) {
      setStatusMessage({ type: 'error', text: res.error });
    }
  }, [audio, preview.isPlaying, preview.previewCurrentTime]);

  // --- Process video (coordinates across hooks) ---
  const processVideo = useCallback(async () => {
    const stateBulkRow = isBulkMode && currentQueueIndex >= 0
      ? bulkRows[currentQueueIndex]
      : null;
    let activeBulkRow = stateBulkRow;
    if (stateBulkRow?.id) {
      try {
        activeBulkRow = getStoredBulkRows().find((row) => (
          String(row.id) === String(stateBulkRow.id)
        )) || stateBulkRow;
      } catch (error) {
        console.error('Failed to read the latest canonical bulk project:', error);
      }
    }
    let advancedBulkProject = activeBulkRow?.editorProject;

    if (advancedBulkProject) {
      const videoDurations = preview.videoDurationsRef.current;
      const activeVideo1Url = activeBulkRow.video1Url || activeBulkRow.video1?.url || '';
      const activeVideo2Url = activeBulkRow.video2Url || activeBulkRow.video2?.url || '';
      const hydration = hydrateBulkRowWithDurations(
        activeBulkRow,
        {
          video1: !activeVideo1Url || activeVideo1Url === video1Url
            ? (videoDurations.input1 || preview.video1Ref.current?.duration || 0)
            : 0,
          video2: !activeVideo2Url || activeVideo2Url === video2Url
            ? (videoDurations.input2 || preview.video2Ref.current?.duration || 0)
            : 0,
        },
        isDualVideo,
      );
      advancedBulkProject = hydration.project;
      if (hydration.changed) {
        activeBulkRow = hydration.row;
        setBulkRows((current) => current.map((row) => (
          String(row.id) === String(activeBulkRow.id) ? activeBulkRow : row
        )));
        persistVisibleBulkRows([activeBulkRow], activeBulkRow.id);
      }
    }

    if (advancedBulkProject) {
      if (!ffmpegLoaded) {
        setStatusMessage({ type: 'error', text: 'Video processing engine is still loading. Please wait a moment.' });
        return;
      }

      try {
        setProcessing(true);
        setStatusMessage(null);
        setProgressMsg('Preparing timeline project...');
        const { exportProjectInBrowser } = await import('./videoEditorV2/export/index.js');
        const result = await exportProjectInBrowser({
          project: advancedBulkProject,
          ffmpeg: ffmpegRef.current,
          onProgress: ({ message }) => setProgressMsg(message || 'Rendering timeline project...'),
        });
        const nextResultUrl = URL.createObjectURL(result.blob);
        bulkResultUrlsRef.current.push(nextResultUrl);
        setResultVideoUrl(nextResultUrl);
        setProgressMsg('');
        return {
          blob: result.blob,
          url: nextResultUrl,
          rowId: activeBulkRow?.id || '',
          projectSnapshot: serializeProject(advancedBulkProject),
        };
      } catch (err) {
        console.error('Error processing timeline project client-side:', err);
        setStatusMessage({ type: 'error', text: `Processing error: ${err.message || 'Please verify the project media.'}` });
        setProgressMsg('');
        throw err;
      } finally {
        setProcessing(false);
      }
    }

    if (!video1 || (isDualVideo && !video2)) {
      setStatusMessage({ type: 'error', text: isDualVideo ? 'Please select both video files before merging.' : 'Please select a video file before exporting.' });
      return;
    }
    if (!ffmpegLoaded) {
      setStatusMessage({ type: 'error', text: 'Video processing engine is still loading. Please wait a moment.' });
      return;
    }

    const ffmpeg = ffmpegRef.current;
    const selectedAudio = audio.selectedAudio;

    try {
      setProcessing(true);
      setStatusMessage(null);
      if (!isBulkMode) {
        setSingleGeneratedCaption('');
      }
      setProgressMsg('Initializing processing engine...');
      await Promise.all([
        removeIfExists('input1.mp4'),
        removeIfExists('input2.mp4'),
        removeIfExists('selected_audio'),
        removeIfExists('text_overlay.png'),
        removeIfExists('selected_font.ttf'),
        removeIfExists('text.txt'),
        removeIfExists('output.mp4'),
      ]);

      setProgressMsg('Reading video files...');
      const readPromises = [fetchFile(video1.file || video1.url || video1)];
      if (isDualVideo && video2) {
        readPromises.push(fetchFile(video2.file || video2.url || video2));
      }
      const [v1Data, v2Data] = await Promise.all(readPromises);

      await ffmpeg.writeFile('input1.mp4', v1Data);
      if (isDualVideo && video2) {
        await ffmpeg.writeFile('input2.mp4', v2Data);
      }

      const selectedAudioUrl = selectedAudio?.sourceType === 'library' ? selectedAudio.url : '';
      if ((selectedAudio?.sourceType === 'upload' && selectedAudio.file) || selectedAudioUrl) {
        setProgressMsg('Loading selected audio...');
        await ffmpeg.writeFile('selected_audio', await fetchFile(selectedAudio.file || selectedAudioUrl));
      }

      setProgressMsg('Checking audio streams...');
      const checkAudioPromises = [hasAudioStream('input1.mp4')];
      if (isDualVideo && video2) {
        checkAudioPromises.push(hasAudioStream('input2.mp4'));
      } else {
        checkAudioPromises.push(Promise.resolve(false));
      }
      const [video1HasAudio, video2HasAudio] = await Promise.all(checkAudioPromises);

      setProgressMsg('Calculating text position...');
      const containerRect = overlay.containerRef.current?.getBoundingClientRect();
      if (!containerRect?.width || !containerRect?.height) {
        throw new Error('Preview is not ready yet. Please wait for the videos to appear before exporting.');
      }

      setProgressMsg('Rendering text overlay...');
      await ffmpeg.writeFile('text_overlay.png', await overlay.createTextOverlayPng(containerRect));

      setProgressMsg('Processing video and rendering text (this may take a minute)...');
      ffmpegLogLinesRef.current = [];

      if (ffmpegLogHandlerRef.current) {
        ffmpeg.off?.('log', ffmpegLogHandlerRef.current);
      }

      ffmpegLogHandlerRef.current = ({ message }) => {
        ffmpegLogLinesRef.current = [...ffmpegLogLinesRef.current.slice(-24), message];
        if (message.includes('frame=')) {
          setProgressMsg(`Processing: ${message.substring(message.indexOf('frame='))}`);
        }
      };
      ffmpeg.on('log', ffmpegLogHandlerRef.current);

      const videoDurations = preview.videoDurationsRef.current;
      const input1Duration = Number.isFinite(videoDurations.input1) && videoDurations.input1 > 0
        ? videoDurations.input1
        : preview.video1Ref.current?.duration || 0;
      const input2Duration = isDualVideo && video2
        ? (Number.isFinite(videoDurations.input2) && videoDurations.input2 > 0
          ? videoDurations.input2
          : preview.video2Ref.current?.duration || 0)
        : 0;
      const audio0Filter = video1HasAudio
        ? '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a0];'
        : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(input1Duration, 0.1)},asetpts=PTS-STARTPTS[a0];`;
      const audio1Filter = video2HasAudio
        ? '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a1];'
        : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(input2Duration, 0.1)},asetpts=PTS-STARTPTS[a1];`;
      const totalVideoDuration = input1Duration + input2Duration;
      if (!Number.isFinite(totalVideoDuration) || totalVideoDuration <= 0.25) {
        throw new Error('Video durations are not ready yet. Please wait for the video to load, then export again.');
      }
      const hasFileAudio = selectedAudio?.sourceType === 'upload' && selectedAudio.file;
      const hasLibraryAudio = selectedAudio?.sourceType === 'library' && selectedAudio.url;
      const hasGeneratedAudio = selectedAudio?.sourceType === 'generated';
      const hasSelectedAudioInput = Boolean(hasFileAudio || hasLibraryAudio);
      const selectedAudioInputArgs = hasSelectedAudioInput ? ['-stream_loop', '-1', '-i', 'selected_audio'] : [];

      let textOverlayIndex;
      let selectedAudioInputIndex;
      let ffmpegExecArgs;

      if (isDualVideo && video2) {
        textOverlayIndex = 2;
        selectedAudioInputIndex = 3;
        ffmpegExecArgs = [
          '-y',
          '-i', 'input1.mp4',
          '-i', 'input2.mp4',
          '-i', 'text_overlay.png',
          ...selectedAudioInputArgs,
        ];
      } else {
        textOverlayIndex = 1;
        selectedAudioInputIndex = 2;
        ffmpegExecArgs = [
          '-y',
          '-i', 'input1.mp4',
          '-i', 'text_overlay.png',
          ...selectedAudioInputArgs,
        ];
      }

      const selectedAudioFilter = hasGeneratedAudio
        ? `sine=frequency=${selectedAudio.frequency || 180}:duration=${totalVideoDuration},volume=0.16,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[outa]`
        : hasSelectedAudioInput
          ? `[${selectedAudioInputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS,atrim=0:${totalVideoDuration},asetpts=PTS-STARTPTS[outa]`
          : '';
      const hasReplacementAudio = Boolean(selectedAudioFilter);
      const outputAudioMap = hasReplacementAudio ? '[outa]' : '[a]';

      let filterComplex = '';
      if (isDualVideo && video2) {
        const baseVideoFilters =
          `[0:v]setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS}[v0];` +
          `[1:v]setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS}[v1];` +
          `[v0][${textOverlayIndex}:v]overlay=0:0:format=auto[v0text];`;

        filterComplex = hasReplacementAudio
          ? baseVideoFilters +
          `[v0text][v1]concat=n=2:v=1:a=0[outv];` +
          selectedAudioFilter
          : baseVideoFilters +
          audio0Filter +
          audio1Filter +
          `[v0text][a0][v1][a1]concat=n=2:v=1:a=1[outv][a]`;
      } else {
        const baseVideoFilters =
          `[0:v]setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS}[v0];` +
          `[v0][${textOverlayIndex}:v]overlay=0:0:format=auto[outv];`;

        filterComplex = hasReplacementAudio
          ? baseVideoFilters + selectedAudioFilter
          : baseVideoFilters +
          (video1HasAudio
            ? `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a];`
            : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(input1Duration, 0.1)},asetpts=PTS-STARTPTS[a];`);
      }

      const exitCode = await ffmpeg.exec([
        ...ffmpegExecArgs,
        '-filter_complex',
        filterComplex,
        '-map', '[outv]',
        '-map', outputAudioMap,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-r', String(OUTPUT_FPS),
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-shortest',
        'output.mp4'
      ]);

      if (exitCode !== 0) {
        const usefulLogLine = [...ffmpegLogLinesRef.current]
          .reverse()
          .find((line) => (
            /error|invalid|failed|unable|not found|unconnected|cannot/i.test(line) &&
            !line.includes('deprecated pixel format')
          ));
        throw new Error(usefulLogLine || 'FFmpeg export failed. Please verify the selected files are valid video/audio formats.');
      }

      setProgressMsg('Verifying exported audio...');
      const outputHasAudio = await hasAudioStream('output.mp4');
      if (!outputHasAudio) {
        throw new Error('Export finished without an audio stream. Please check the selected audio file and try again.');
      }

      setProgressMsg('Finalizing export...');
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });

      if (!isBulkMode && objectUrlsRef.current.result) URL.revokeObjectURL(objectUrlsRef.current.result);
      const nextResultUrl = URL.createObjectURL(blob);
      if (isBulkMode) {
        bulkResultUrlsRef.current.push(nextResultUrl);
      } else {
        objectUrlsRef.current.result = nextResultUrl;
      }
      setResultVideoUrl(nextResultUrl);
      setProgressMsg('');
      return { blob, url: nextResultUrl };
    } catch (err) {
      console.error('Error processing video client-side:', err);
      setStatusMessage({ type: 'error', text: `Processing error: ${err.message || 'Please verify file formats.'}` });
      setProgressMsg('');
      throw err;
    } finally {
      if (ffmpegLogHandlerRef.current) {
        ffmpegRef.current.off?.('log', ffmpegLogHandlerRef.current);
        ffmpegLogHandlerRef.current = null;
      }
      setProcessing(false);
    }
  }, [video1, video2, video1Url, video2Url, ffmpegLoaded, ffmpegRef, audio.selectedAudio, hasAudioStream, removeIfExists, overlay, preview.video1Ref, preview.video2Ref, preview.videoDurationsRef, ffmpegLogHandlerRef, ffmpegLogLinesRef, isBulkMode, isDualVideo, currentQueueIndex, bulkRows]);

  const handleGenerateSingleCaption = useCallback(async () => {
    if (!resultVideoUrl) return;

    try {
      setSingleGeneratingCaption(true);
      setStatusMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoName: overlay.text || video1?.name || video2?.name || 'couple video',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate caption.');
      }

      const data = await response.json();
      setSingleGeneratedCaption(data.caption || '');
      setStatusMessage({ type: 'success', text: 'Caption generated successfully.' });
    } catch (err) {
      console.error('Error generating single video caption:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate caption.' });
    } finally {
      setSingleGeneratingCaption(false);
    }
  }, [resultVideoUrl, token, overlay.text, video1, video2]);

  const updateBulkRowData = useCallback((rowId, partialData) => {
    setBulkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...partialData } : r))
    );
    try {
      const saved = getStoredBulkRows();
      const updated = saved.map((r) => (r.id === rowId ? sanitizeBulkRowForStorage({ ...r, ...partialData }) : r));
      writeBulkRowsSnapshot(updated, { source: 'legacy-bulk-queue', rowId });
    } catch (err) {
      console.error('Failed to update row data in localStorage:', err);
    }
  }, []);

  const loadMediaFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFolderPickerError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Unable to load folders.');
      const data = await response.json();
      setFolders(Array.isArray(data) ? data : []);
    } catch (err) {
      setFolderPickerError(err.message || 'Unable to load folders.');
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  }, [token]);

  const openBulkSaveFolderPicker = useCallback((rowId) => {
    setFolderPickerRowId(rowId);
    setFolderPickerMode('single');
    setSelectedSaveFolderId('root');
    setExpandedFolderIds(new Set());
    setFolderSearch('');
    void loadMediaFolders();
  }, [loadMediaFolders]);

  const openBulkSaveAllFolderPicker = useCallback(() => {
    setFolderPickerRowId('all');
    setFolderPickerMode('all');
    setSelectedSaveFolderId('root');
    setExpandedFolderIds(new Set());
    setFolderSearch('');
    void loadMediaFolders();
  }, [loadMediaFolders]);

  const openSingleSaveFolderPicker = useCallback(() => {
    setFolderPickerRowId('single-editor');
    setFolderPickerMode('single-editor');
    setSelectedSaveFolderId('root');
    setExpandedFolderIds(new Set());
    setFolderSearch('');
    void loadMediaFolders();
  }, [loadMediaFolders]);

  const renderFolderTree = (parentId = 'root', depth = 0) => {
    const levelFolders = folders
      .filter((f) => getFolderParentId(f) === parentId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
    if (levelFolders.length === 0) return null;

    return (
      <div className="space-y-1">
        {levelFolders.map((folder) => {
          const hasSubfolders = folders.some((f) => getFolderParentId(f) === folder._id);
          const isExpanded = expandedFolderIds.has(folder._id);
          const isSelected = selectedSaveFolderId === folder._id;

          return (
            <div key={folder._id} className="flex flex-col">
              <div
                style={{ paddingLeft: `${depth * 16}px` }}
                className={`flex items-center justify-between rounded-xl px-2 py-1.5 transition-colors border ${isSelected
                    ? 'bg-[#ff5500]/10 border-[#ff5500]/25'
                    : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {hasSubfolders ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolderExpanded(folder._id);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-black/5 hover:text-gray-600 transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <div className="w-5 h-5 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedSaveFolderId(folder._id)}
                    className={`flex flex-1 items-center gap-2 text-left text-xs font-bold ${isSelected ? 'text-[#ff5500]' : 'text-gray-700'
                      }`}
                  >
                    <Folder className={`h-4 w-4 ${isSelected ? 'text-[#ff5500]' : 'text-gray-400'}`} />
                    <span className="truncate">{folder.name}</span>
                  </button>
                </div>
              </div>
              {hasSubfolders && isExpanded && (
                <div className="mt-1">
                  {renderFolderTree(folder._id, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const uploadVideoBlobToFolder = useCallback(async (blob, folderId, filename = `merged_${Date.now()}.mp4`, caption = '') => {
    const file = new File([blob], filename, { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', folderId === 'root' ? 'null' : folderId);
    formData.append('tags', 'editor,merged');
    formData.append('campaignId', getActiveCampaignId());
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save to server library.');
    }
    return await response.json();
  }, [token]);

  const saveOneBulkRowToMediaLibrary = useCallback(async (row) => {
    const resultUrl = getBulkResultUrl(row);
    if (!row || !resultUrl) {
      throw new Error('Generated video is not available yet.');
    }

    setBulkSavingRowId(row.id);
    let responseBlob;
    try {
      responseBlob = await fetch(resultUrl);
    } catch {
      throw new Error('This generated video is no longer available in memory. Please export again, then save to Media Library.');
    }
    if (!responseBlob.ok) {
      throw new Error('This generated video is no longer available in memory. Please export again, then save to Media Library.');
    }
    const blob = await responseBlob.blob();
    const uploadedMedia = await uploadVideoBlobToFolder(
      blob,
      selectedSaveFolderId,
      row.resultMediaName || `bulk_video_${Date.now()}.mp4`,
      row.generatedCaption || ''
    );
    const uploadedSummary = getUploadedMediaSummary(uploadedMedia);
    updateBulkRowData(row.id, {
      status: 'done',
      ...uploadedSummary,
      resultVideoUrl: resultUrl,
      generatedCaption: row.generatedCaption || '',
    });
  }, [selectedSaveFolderId, uploadVideoBlobToFolder, updateBulkRowData]);

  // --- Save to media library (uses auth token from context) ---
  const saveToMediaLibrary = useCallback(async () => {
    if (!resultVideoUrl) return;

    try {
      setSaving(true);
      setStatusMessage(null);

      const responseBlob = await fetch(resultVideoUrl);
      const blob = await responseBlob.blob();

      const uploadedMedia = await uploadVideoBlobToFolder(blob, selectedSaveFolderId, `merged_${Date.now()}.mp4`, singleGeneratedCaption);
      const uploadedSummary = getUploadedMediaSummary(uploadedMedia);
      setStatusMessage({ type: 'success', text: 'Video saved successfully to your Media Library!' });

      if (isBulkMode && currentQueueIndex >= 0 && currentQueueIndex < bulkRows.length) {
        const activeRow = bulkRows[currentQueueIndex];
        updateBulkRowData(activeRow.id, {
          status: 'done',
          ...uploadedSummary,
        });
      } else {
        setTimeout(() => navigate('/media'), 1500);
      }
    } catch (err) {
      console.error('Error saving merged video:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to upload file to the server library.' });
    } finally {
      setSaving(false);
    }
  }, [resultVideoUrl, uploadVideoBlobToFolder, selectedSaveFolderId, singleGeneratedCaption, navigate, isBulkMode, currentQueueIndex, bulkRows, updateBulkRowData]);

  const saveBulkSelectionToMediaLibrary = useCallback(async () => {
    if (!folderPickerRowId) return;

    try {
      setFolderPickerError('');

      if (folderPickerMode === 'all') {
        const rowsToSave = bulkRows.filter((row) => row.status === 'done' && getBulkResultUrl(row));
        if (rowsToSave.length === 0) {
          throw new Error('No generated videos are available to save.');
        }
        setUploadQueue({
          active: true,
          items: rowsToSave.map((row, index) => ({
            id: row.id,
            name: row.resultMediaName || `Video ${index + 1}`,
            status: 'pending',
          })),
        });
        for (let index = 0; index < rowsToSave.length; index += 1) {
          const row = rowsToSave[index];
          setUploadQueue((queue) => ({
            ...queue,
            items: queue.items.map((item) => (
              item.id === row.id ? { ...item, status: 'uploading' } : item
            )),
          }));
          try {
            await saveOneBulkRowToMediaLibrary(row);
            setUploadQueue((queue) => ({
              ...queue,
              items: queue.items.map((item) => (
                item.id === row.id ? { ...item, status: 'success' } : item
              )),
            }));
          } catch (error) {
            setUploadQueue((queue) => ({
              ...queue,
              active: false,
              items: queue.items.map((item) => (
                item.id === row.id ? { ...item, status: 'error', error: error.message } : item
              )),
            }));
            throw error;
          }
        }
        setUploadQueue((queue) => ({ ...queue, active: false }));
        setStatusMessage({ type: 'success', text: `${rowsToSave.length} videos saved successfully to your Media Library!` });
      } else if (folderPickerMode === 'single-editor') {
        await saveToMediaLibrary();
      } else {
        const row = bulkRows.find((item) => item.id === folderPickerRowId);
        await saveOneBulkRowToMediaLibrary(row);
        setStatusMessage({ type: 'success', text: 'Video saved successfully to your Media Library!' });
      }

      setFolderPickerRowId(null);
      setUploadQueue(null);
    } catch (err) {
      setFolderPickerError(err.message || 'Failed to save video.');
    } finally {
      setBulkSavingRowId(null);
    }
  }, [bulkRows, folderPickerMode, folderPickerRowId, saveOneBulkRowToMediaLibrary, saveToMediaLibrary]);

  const startBulkQueue = useCallback(() => {
    activeBulkRunRef.current = null;
    const hasVideo = (r) => r.video1 && (!isDualVideo || r.video2);
    const queueRows = bulkRows.map((row) => (
      hasVideo(row) && ['processing', 'saving', 'error'].includes(row.status)
        ? { ...row, status: 'ready' }
        : row
    ));
    const firstPendingIdx = queueRows.findIndex((row) => hasVideo(row) && row.status !== 'done');
    if (firstPendingIdx < 0) {
      const firstReadyIdx = queueRows.findIndex((row) => hasVideo(row));
      if (firstReadyIdx < 0) {
        setStatusMessage({ type: 'error', text: 'No ready bulk rows found. Add required video assets before exporting.' });
        return;
      }

      const resetRows = queueRows.map((row) => (
        hasVideo(row)
          ? {
            ...row,
            status: 'ready',
            resultMediaId: '',
            resultMediaUrl: '',
            resultMediaName: '',
            resultVideoUrl: '',
          }
          : row
      ));
      setBulkRows(resetRows);
      try {
        persistVisibleBulkRows(resetRows);
      } catch (err) {
        console.error('Failed to reset bulk rows for re-export:', err);
      }
      setResultVideoUrl('');
      setCurrentQueueIndex(firstReadyIdx);
      setIsQueueRunning(true);
      setStatusMessage(null);
      return;
    }
    setBulkRows(queueRows);
    try {
      persistVisibleBulkRows(queueRows);
    } catch (err) {
      console.error('Failed to normalize bulk rows for export:', err);
    }
    setResultVideoUrl('');
    setCurrentQueueIndex(firstPendingIdx);
    setIsQueueRunning(true);
    setStatusMessage(null);
  }, [bulkRows, isDualVideo]);

  const handleGenerateAllCaptions = useCallback(async () => {
    setGeneratingCaptions(true);
    setStatusMessage(null);
    try {
      const doneRows = bulkRows.filter((r) => r.status === 'done');
      if (doneRows.length === 0) {
        throw new Error('No completed bulk videos found to generate captions for.');
      }
      for (const row of doneRows) {
        const response = await fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ videoName: row.caption || 'couple video' }),
        });
        if (!response.ok) {
          throw new Error('Failed to generate one or more captions.');
        }
        const data = await response.json();
        updateBulkRowData(row.id, { generatedCaption: data.caption });
      }
      setStatusMessage({ type: 'success', text: 'Captions generated successfully for all videos!' });
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate captions.' });
    } finally {
      setGeneratingCaptions(false);
    }
  }, [bulkRows, token, updateBulkRowData]);

  const handleClearEditor = useCallback(() => {
    setVideo1(null);
    setVideo2(null);
    setVideo1Url('');
    setVideo2Url('');
    setResultVideoUrl('');
    setSingleGeneratedCaption('');
    setStatusMessage(null);
    audio.clearSelectedAudio();
    overlay.setText('');
    preview.resetPlayback();
    preview.setActiveVideo(1);
    preview.resetDurations();
    loadedBulkRowSignatureRef.current = '';
  }, [audio, overlay, preview]);

  // --- Bulk Builder Queue Logic ---

  // Load bulk builder rows from localStorage on mount
  useEffect(() => {
    if (isBulkMode) {
      try {
        const saved = getStoredBulkRows({ resetTransientStatus: true });
        // Load all ready rows
        const readyRows = saved.filter((r) => r.video1 && (!isDualVideo || r.video2));
        setBulkRows(readyRows);
        if (readyRows.length > 0) {
          // Set active to first non-done row, or default to index 0
          const firstPending = readyRows.findIndex((r) => r.status !== 'done');
          setCurrentQueueIndex(firstPending >= 0 ? firstPending : 0);
        }
      } catch (err) {
        console.error('Error loading bulk rows:', err);
      }
    }
  }, [isBulkMode, isDualVideo]);

  useEffect(() => {
    if (!isBulkMode || isQueueRunning) return undefined;
    return subscribeToBulkRows(({ source }) => {
      if (source === 'legacy-bulk-queue') return;
      const activeRowId = bulkRows[currentQueueIndex]?.id;
      const nextRows = getStoredBulkRows().filter((row) => (
        row.video1 && (!isDualVideo || row.video2)
      ));
      setBulkRows(nextRows);
      if (nextRows.length === 0) {
        setCurrentQueueIndex(-1);
        return;
      }
      const nextActiveIndex = nextRows.findIndex((row) => (
        String(row.id) === String(activeRowId || '')
      ));
      setCurrentQueueIndex(nextActiveIndex >= 0 ? nextActiveIndex : 0);
    });
  }, [bulkRows, currentQueueIndex, isBulkMode, isDualVideo, isQueueRunning]);

  // Sync active row data to editor states when active index changes
  useEffect(() => {
    if (currentQueueIndex >= 0 && currentQueueIndex < bulkRows.length) {
      const row = bulkRows[currentQueueIndex];
      const rowSignature = getRowLoadSignature(row);
      if (loadedBulkRowSignatureRef.current === rowSignature) {
        return;
      }
      loadedBulkRowSignatureRef.current = rowSignature;
      isLoadingBulkRowRef.current = true;

      // Save durations before reset — if a video URL stays the same between
      // rows its <video> element won't remount (same React key) so
      // loadedmetadata won't re-fire.  We must restore its known duration
      // after the reset so the total-time HUD remains correct.
      const prevDurations = { ...preview.videoDurationsRef.current };
      const v1UrlChanged = row.video1Url !== video1Url;
      const v2UrlChanged = row.video2Url !== video2Url;

      preview.resetDurations();

      setVideo1(row.video1);
      setVideo1Url(row.video1Url);
      setVideo2(row.video2);
      setVideo2Url(row.video2Url);

      // Restore durations for videos whose URL didn't change
      if (!v1UrlChanged && prevDurations.input1 > 0) {
        preview.setVideoDuration('input1', prevDurations.input1);
      }
      if (!v2UrlChanged && prevDurations.input2 > 0) {
        preview.setVideoDuration('input2', prevDurations.input2);
      }

      audio.selectAudioTrack(row.audio, false, 0);
      overlay.setText(row.caption);
      overlay.setFontFamily(row.textSettings.fontFamily);
      overlay.setFontWeight(row.textSettings.fontWeight);
      overlay.setFontSize(row.textSettings.fontSize);
      overlay.setFontColor(row.textSettings.fontColor);
      overlay.setStrokeWidth(row.textSettings.strokeWidth);
      overlay.setStrokeColor(row.textSettings.strokeColor);
      overlay.setBgType(row.textSettings.bgType);
      overlay.setBgColor(row.textSettings.bgColor);
      overlay.setDragPos({ ...DEFAULT_DRAG_POS, ...(row.dragPos || {}) });
      setResultVideoUrl(row.resultVideoUrl || getMediaUrl(row.resultMediaUrl) || '');
      setStatusMessage(null);
      preview.setActiveVideo(1);
      preview.resetPlayback();
      window.setTimeout(() => {
        isLoadingBulkRowRef.current = false;
      }, 0);
    }
  }, [currentQueueIndex, bulkRows]);

  // Keep manual edits made in the editor attached to the active bulk row.
  // Without this, starting/restarting the queue can reload the old row snapshot
  // and export stale caption text, style, audio, or placement.
  useEffect(() => {
    if (!isBulkMode || isQueueRunning || isLoadingBulkRowRef.current) return;
    if (currentQueueIndex < 0 || currentQueueIndex >= bulkRows.length) return;

    const activeRow = bulkRows[currentQueueIndex];
    if (!activeRow?.id) return;

    const nextTextSettings = {
      fontFamily: overlay.fontFamily,
      fontWeight: overlay.fontWeight,
      fontSize: overlay.fontSize,
      fontColor: overlay.fontColor,
      strokeWidth: overlay.strokeWidth,
      strokeColor: overlay.strokeColor,
      bgType: overlay.bgType,
      bgColor: overlay.bgColor,
    };
    const nextDragPos = normalizeDragPosForCompare(overlay.dragPos);
    const currentDragPos = normalizeDragPosForCompare(activeRow.dragPos);
    const captionChanged = (activeRow.caption || '') !== (overlay.text || '');
    const settingsChanged = getTextSettingsSignature(activeRow.textSettings) !== getTextSettingsSignature(nextTextSettings);
    const dragChanged = currentDragPos.x !== nextDragPos.x || currentDragPos.y !== nextDragPos.y;
    const audioChanged = getAudioIdentity(activeRow.audio) !== getAudioIdentity(audio.selectedAudio);
    const video1Changed = (
      getMediaIdentity(activeRow.video1) !== getMediaIdentity(video1)
      || (activeRow.video1Url || '') !== (video1Url || '')
    );
    const video2Changed = (
      getMediaIdentity(activeRow.video2) !== getMediaIdentity(video2)
      || (activeRow.video2Url || '') !== (video2Url || '')
    );

    if (
      !captionChanged
      && !settingsChanged
      && !dragChanged
      && !audioChanged
      && !video1Changed
      && !video2Changed
    ) return;

    const contentPatch = {};
    if (captionChanged) contentPatch.caption = overlay.text || '';
    if (settingsChanged) contentPatch.textSettings = nextTextSettings;
    if (dragChanged) contentPatch.dragPos = nextDragPos;
    if (audioChanged) contentPatch.audio = audio.selectedAudio;
    if (video1Changed) {
      contentPatch.video1 = video1;
      contentPatch.video1Url = video1Url || '';
    }
    if (video2Changed) {
      contentPatch.video2 = video2;
      contentPatch.video2Url = video2Url || '';
    }

    const synchronizedRow = sanitizeBulkRowForStorage(syncBulkRowContent(
      activeRow,
      contentPatch,
      { isDualVideo, clearResult: true },
    ));
    loadedBulkRowSignatureRef.current = getRowLoadSignature(synchronizedRow);

    const updatedRows = bulkRows.map((row, idx) => {
      if (idx !== currentQueueIndex) return row;
      return synchronizedRow;
    });

    setBulkRows(updatedRows);
    try {
      persistVisibleBulkRows(updatedRows, activeRow.id);
    } catch (err) {
      console.error('Failed to sync active bulk row edits:', err);
    }
    setResultVideoUrl('');
  }, [
    isBulkMode,
    isQueueRunning,
    currentQueueIndex,
    bulkRows,
    overlay.text,
    overlay.fontFamily,
    overlay.fontWeight,
    overlay.fontSize,
    overlay.fontColor,
    overlay.strokeWidth,
    overlay.strokeColor,
    overlay.bgType,
    overlay.bgColor,
    overlay.dragPos,
    audio.selectedAudio,
    video1,
    video2,
    video1Url,
    video2Url,
    isDualVideo,
  ]);

  // Replace temporary canonical timeline estimates as soon as the legacy
  // preview has read the real media metadata. This is a metadata correction,
  // so a previously valid exported result remains attached to the row.
  useEffect(() => {
    if (!isBulkMode || currentQueueIndex < 0 || currentQueueIndex >= bulkRows.length) return;
    const activeRow = bulkRows[currentQueueIndex];
    if (!activeRow?.editorProject) return;

    const videoDurations = preview.videoDurationsRef.current;
    const input1Duration = videoDurations.input1 || preview.video1Ref.current?.duration || 0;
    const input2Duration = videoDurations.input2 || preview.video2Ref.current?.duration || 0;
    if (input1Duration <= 0 && input2Duration <= 0) return;

    const hydration = hydrateBulkRowWithDurations(
      activeRow,
      { video1: input1Duration, video2: input2Duration },
      isDualVideo,
    );
    if (!hydration.changed) return;

    loadedBulkRowSignatureRef.current = getRowLoadSignature(hydration.row);
    const updatedRows = bulkRows.map((row, index) => (
      index === currentQueueIndex ? hydration.row : row
    ));
    setBulkRows(updatedRows);
    try {
      persistVisibleBulkRows(updatedRows, activeRow.id);
    } catch (error) {
      console.error('Failed to save resolved bulk video durations:', error);
    }
  }, [
    bulkRows,
    currentQueueIndex,
    isBulkMode,
    isDualVideo,
    preview.previewTotalTime,
    preview.video1Ref,
    preview.video2Ref,
    preview.videoDurationsRef,
  ]);

  // Automated single-row export effect
  useEffect(() => {
    if (!pendingSingleExportRowId) return;

    const idx = bulkRows.findIndex((r) => r.id === pendingSingleExportRowId);
    if (idx < 0) {
      setPendingSingleExportRowId(null);
      return;
    }

    if (idx !== currentQueueIndex) {
      setCurrentQueueIndex(idx);
      return;
    }

    const row = bulkRows[idx];
    if (row.status === 'processing' || row.status === 'saving') {
      return;
    }

    // Wait for current row's video durations to be resolved (> 0)
    const videoDurations = preview.videoDurationsRef.current;
    const input1Duration = videoDurations.input1 || preview.video1Ref.current?.duration || 0;
    const input2Duration = isDualVideo && row.video2Url ? (videoDurations.input2 || preview.video2Ref.current?.duration || 0) : 0;
    if (input1Duration > 0 && (!isDualVideo || !row.video2Url || input2Duration > 0)) {
      if (videoDurations.input1 !== input1Duration) {
        preview.setVideoDuration('input1', input1Duration);
      }
      if (isDualVideo && row.video2Url && videoDurations.input2 !== input2Duration) {
        preview.setVideoDuration('input2', input2Duration);
      }
    } else {
      setProgressMsg('Loading video assets...');
      return;
    }

    if (video1Url !== row.video1Url || video2Url !== row.video2Url) {
      setProgressMsg('Loading row into editor...');
      return;
    }

    if (getAudioIdentity(audio.selectedAudio) !== getAudioIdentity(row.audio)) {
      setProgressMsg('Loading row audio...');
      return;
    }

    if (processing) return;

    // Reset pending trigger
    setPendingSingleExportRowId(null);

    // Export single row
    const runExport = async () => {
      try {
        updateBulkRowData(row.id, { status: 'processing' });
        const result = await processVideo();
        if (!result?.blob) {
          throw new Error('Video export did not produce an output file.');
        }
        assertCanonicalProjectUnchanged(result);
        setBulkRows((prev) =>
          prev.map((r) => (
            r.id === row.id
              ? {
                ...r,
                status: 'done',
                resultVideoUrl: result.url,
                resultMediaId: '',
                resultMediaUrl: '',
                resultMediaName: `bulk_video_${idx + 1}.mp4`,
              }
              : r
          ))
        );
        try {
          const saved = getStoredBulkRows();
          const updated = saved.map((r) => (
            r.id === row.id
              ? {
                ...r,
                status: 'done',
                resultVideoUrl: result.url,
                resultMediaId: '',
                resultMediaUrl: '',
                resultMediaName: `bulk_video_${idx + 1}.mp4`,
              }
              : r
          ));
          writeBulkRowsSnapshot(updated.map(sanitizeBulkRowForStorage), {
            source: 'legacy-bulk-queue',
            rowId: row.id,
          });
        } catch (err) {
          console.error('Failed to save bulk row update in localStorage:', err);
        }
        setStatusMessage({ type: 'success', text: `Successfully exported video #${idx + 1}!` });
      } catch (err) {
        console.error(err);
        updateBulkRowData(row.id, { status: 'error' });
        setStatusMessage({ type: 'error', text: err.message || `Failed to export video #${idx + 1}.` });
      }
    };
    void runExport();
  }, [
    pendingSingleExportRowId,
    currentQueueIndex,
    bulkRows,
    video1Url,
    video2Url,
    audio.selectedAudio,
    processing,
    processVideo,
    updateBulkRowData,
    preview,
    isDualVideo,
  ]);

  // Automated queue runner effect
  useEffect(() => {
    if (!isQueueRunning) return;

    if (currentQueueIndex < 0 || currentQueueIndex >= bulkRows.length) {
      setIsQueueRunning(false);
      return;
    }

    const row = bulkRows[currentQueueIndex];

    if (activeBulkRunRef.current === row.id) {
      return;
    }

    if (row.status === 'processing' || row.status === 'saving') {
      return;
    }

    // If this row is already done, look for the next pending row to advance
    if (row.status === 'done') {
      const nextPendingIdx = bulkRows.findIndex((r, idx) => idx > currentQueueIndex && r.status !== 'done');
      if (nextPendingIdx >= 0) {
        setCurrentQueueIndex(nextPendingIdx);
      } else {
        // Fallback: check if there are pending rows from the beginning
        const firstPendingIdx = bulkRows.findIndex((r) => r.status !== 'done');
        if (firstPendingIdx >= 0) {
          setCurrentQueueIndex(firstPendingIdx);
        } else {
          setIsQueueRunning(false);
          setStatusMessage({ type: 'success', text: 'All videos in the queue have been generated locally.' });
        }
      }
      return;
    }

    // Wait for current row's video durations to be resolved (> 0)
    const videoDurations = preview.videoDurationsRef.current;
    const input1Duration = videoDurations.input1 || preview.video1Ref.current?.duration || 0;
    const input2Duration = isDualVideo && row.video2Url ? (videoDurations.input2 || preview.video2Ref.current?.duration || 0) : 0;
    if (input1Duration > 0 && (!isDualVideo || !row.video2Url || input2Duration > 0)) {
      if (videoDurations.input1 !== input1Duration) {
        preview.setVideoDuration('input1', input1Duration);
      }
      if (isDualVideo && row.video2Url && videoDurations.input2 !== input2Duration) {
        preview.setVideoDuration('input2', input2Duration);
      }
    } else {
      setProgressMsg('Loading video assets...');
      return;
    }

    if (video1Url !== row.video1Url || video2Url !== row.video2Url) {
      setProgressMsg('Loading row into editor...');
      return;
    }

    if (getAudioIdentity(audio.selectedAudio) !== getAudioIdentity(row.audio)) {
      setProgressMsg('Loading row audio...');
      return;
    }

    // If already processing, wait
    if (processing) return;

    activeBulkRunRef.current = row.id;

    const runQueueItem = async () => {
      try {
        updateBulkRowData(row.id, { status: 'processing' });

        // Run processVideo client-side
        const result = await processVideo();
        if (!result?.blob) {
          throw new Error('Video export did not produce an output file.');
        }
        assertCanonicalProjectUnchanged(result);

        setBulkRows((prev) =>
          prev.map((r) => (
            r.id === row.id
              ? {
                ...r,
                status: 'done',
                resultVideoUrl: result.url,
                resultMediaId: '',
                resultMediaUrl: '',
                resultMediaName: `bulk_video_${currentQueueIndex + 1}.mp4`,
              }
              : r
          ))
        );
        try {
          const saved = getStoredBulkRows();
          const resetSaved = saved.map((r) => (
            r.id === row.id
              ? {
                ...r,
                status: 'ready',
                resultMediaId: '',
                resultMediaUrl: '',
                resultMediaName: '',
                resultVideoUrl: '',
              }
              : r
          ));
          writeBulkRowsSnapshot(resetSaved.map(sanitizeBulkRowForStorage), {
            source: 'legacy-bulk-queue',
            rowId: row.id,
          });
        } catch (err) {
          console.error('Failed to clear transient bulk result from localStorage:', err);
        }
        setResultVideoUrl(result.url);

        activeBulkRunRef.current = null;

        // Find the next pending row. Use the row id guard because bulkRows is
        // the effect snapshot from before the current row was marked done.
        const nextPendingIdx = bulkRows.findIndex((r, idx) => (
          idx > currentQueueIndex &&
          r.id !== row.id &&
          r.status !== 'done'
        ));
        if (nextPendingIdx >= 0) {
          setCurrentQueueIndex(nextPendingIdx);
        } else {
          const firstPendingIdx = bulkRows.findIndex((r, idx) => (
            idx !== currentQueueIndex &&
            r.id !== row.id &&
            r.status !== 'done'
          ));
          if (firstPendingIdx >= 0) {
            setCurrentQueueIndex(firstPendingIdx);
          } else {
            setIsQueueRunning(false);
            setStatusMessage({ type: 'success', text: 'All videos in the queue have been generated locally.' });
          }
        }
      } catch (err) {
        activeBulkRunRef.current = null;
        console.error('Queue processing error:', err);
        updateBulkRowData(row.id, { status: 'error' });
        setBulkRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: 'error' } : r))
        );
        setIsQueueRunning(false);
        setStatusMessage({
          type: 'error',
          text: `Queue stopped due to error on Row #${currentQueueIndex + 1}: ${err.message || 'Please verify file formats.'}`
        });
      }
    };

    runQueueItem();
  }, [
    isQueueRunning,
    currentQueueIndex,
    bulkRows,
    preview.previewTotalTime,
    video1Url,
    video2Url,
    audio.selectedAudio,
    processing,
    processVideo,
    updateBulkRowData,
    isDualVideo,
  ]);



  // --- Computed values ---
  const clampedDragPos = overlay.computeClampedDragPos();
  const overlayTextWidth = overlay.computeOverlayTextWidth();
  const overlayTextHeight = overlay.computeOverlayTextHeight();
  const previewFontFamily = overlay.getPreviewFontFamily();
  const pendingBulkCount = bulkRows.filter((row) => row.video1 && (!isDualVideo || row.video2) && row.status !== 'done').length;
  const readyBulkCount = bulkRows.filter((row) => row.video1 && (!isDualVideo || row.video2)).length;
  const doneBulkRows = bulkRows.filter((row) => row.status === 'done' && (row.resultMediaUrl || row.resultVideoUrl));
  const activeBulkRow = currentQueueIndex >= 0 && currentQueueIndex < bulkRows.length
    ? bulkRows[currentQueueIndex]
    : null;
  const openCurrentClipsInTimeline = () => {
    const videoDurations = {
      video1: preview.videoDurationsRef.current.input1 || preview.video1Ref.current?.duration || 0,
      video2: preview.videoDurationsRef.current.input2 || preview.video2Ref.current?.duration || 0,
    };
    const contentPatch = {
      video1,
      video1Url,
      video2: isDualVideo ? video2 : null,
      video2Url: isDualVideo ? video2Url : '',
      audio: audio.selectedAudio,
      caption: overlay.text || '',
      textSettings: {
        fontFamily: overlay.fontFamily,
        fontWeight: overlay.fontWeight,
        fontSize: overlay.fontSize,
        fontColor: overlay.fontColor,
        strokeWidth: overlay.strokeWidth,
        strokeColor: overlay.strokeColor,
        bgType: overlay.bgType,
        bgColor: overlay.bgColor,
      },
      dragPos: normalizeDragPosForCompare(overlay.dragPos),
    };

    try {
      if (isBulkMode && activeBulkRow?.id) {
        const latestRows = getStoredBulkRows();
        const rowIndex = latestRows.findIndex((row) => (
          String(row.id) === String(activeBulkRow.id)
        ));
        if (rowIndex < 0) throw new Error('The active bulk row no longer exists.');
        latestRows[rowIndex] = sanitizeBulkRowForStorage(syncBulkRowContent(
          latestRows[rowIndex],
          contentPatch,
          { isDualVideo, videoDurations },
        ));
        writeBulkRowsSnapshot(latestRows, {
          source: 'legacy-bulk-queue',
          rowId: activeBulkRow.id,
        });
        navigate(`/media/editor-v2?mode=bulk&rowId=${encodeURIComponent(activeBulkRow.id)}&returnTo=legacy-editor`);
        return;
      }

      const hasTemporaryMedia = [video1Url, video2Url, audio.selectedAudio?.url]
        .some((url) => String(url || '').startsWith('blob:'));
      if (hasTemporaryMedia) {
        setStatusMessage({
          type: 'error',
          text: 'Upload these local clips to Media Library before opening them in Timeline Editor.',
        });
        return;
      }
      const project = linkedTimelineProject
        ? syncBulkRowContent(projectToBulkRow(linkedTimelineProject, {
          id: linkedTimelineProject.id,
          ...contentPatch,
        }, { isDualVideo, clearResult: false }), contentPatch, {
          isDualVideo,
          videoDurations,
          clearResult: false,
        }).editorProject
        : bulkRowToProject({
          id: 'legacy-single-editor-draft',
          ...contentPatch,
        }, {
          isDualVideo,
          videoDurations,
          name: 'Video editor project',
        });
      localStorage.setItem(V2_DRAFT_STORAGE_KEY, serializeProject(project));
      sessionStorage.setItem(LEGACY_TIMELINE_PROJECT_KEY, project.id);
      setLinkedTimelineProject(project);
      navigate('/media/editor-v2?returnTo=legacy-editor');
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'The clips could not be opened in Timeline Editor.',
      });
    }
  };
  const showBulkGeneratingCard = isBulkMode && Boolean(activeBulkRow) && isQueueRunning && activeBulkRow.status !== 'done';
  const showBulkOutputGallery = isBulkMode && (doneBulkRows.length > 0 || showBulkGeneratingCard);
  const canonicalPreviewProject = isBulkMode
    ? activeBulkRow?.editorProject || null
    : linkedTimelineProject;

  return (
    <div className="min-h-screen bg-[#f8f9fa] py-3 px-4 sm:px-6 flex flex-col items-center">
      {/* Header */}
      <div className="max-w-7xl w-full flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Video Editor</h2>
          {!isBulkMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCurrentClipsInTimeline}
                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 transition-all hover:bg-blue-100 active:scale-95 flex items-center gap-1 shadow-sm uppercase tracking-wider"
              >
                <Play className="h-3 w-3" />
                Timeline Editor
              </button>
              <button
                type="button"
                onClick={() => navigate('/media/bulk-builder')}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-all hover:bg-gray-50 active:scale-95 flex items-center gap-1 shadow-sm uppercase tracking-wider"
              >
                <Layers className="h-3 w-3 text-[#ff5500]" />
                Bulk Video Builder
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/media/editor')}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-600 transition-all hover:bg-gray-50 active:scale-95 flex items-center gap-1 shadow-sm uppercase tracking-wider"
            >
              <Layers className="h-3 w-3 text-[#0071e3]" />
              Single Video Editor
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={
              processing ||
              isQueueRunning ||
              !ffmpegLoaded ||
              Boolean(engineError) ||
              (isBulkMode ? readyBulkCount === 0 : !video1)
            }
            onClick={isBulkMode ? startBulkQueue : processVideo}
            className="rounded-lg bg-[#0071e3] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-blue-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing || isQueueRunning
              ? 'Exporting...'
              : isBulkMode
                ? pendingBulkCount > 0
                  ? `Export All (${pendingBulkCount})`
                  : `Export Again (${readyBulkCount})`
                : 'Export Video'}
          </button>

          <button
            type="button"
            onClick={handleClearEditor}
            className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-600 transition-all hover:bg-gray-50 active:scale-95 shadow-sm"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Left Column */}
        {isBulkMode ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 max-h-[580px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                📋 Bulk Queue ({bulkRows.filter(r => r.status === 'done').length}/{bulkRows.length})
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (isQueueRunning) {
                      activeBulkRunRef.current = null;
                      setBulkRows((prev) =>
                        prev.map((row) => (
                          ['processing', 'saving'].includes(row.status)
                            ? { ...row, status: row.video1 && (!isDualVideo || row.video2) ? 'ready' : 'draft' }
                            : row
                        ))
                      );
                      setIsQueueRunning(false);
                    } else {
                      startBulkQueue();
                    }
                  }}
                  disabled={readyBulkCount === 0}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 ${isQueueRunning
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                  {isQueueRunning ? 'Stop' : pendingBulkCount > 0 ? 'Start' : 'Again'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/media/bulk-builder')}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-[9px] font-bold text-gray-600 bg-white hover:bg-gray-50 transition-all uppercase tracking-wider"
                >
                  Builder
                </button>
              </div>
            </div>

            {/* Queue Progress Messages */}
            {processing && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-2.5">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                <span className="text-[10px] font-semibold text-blue-700 truncate">{progressMsg || 'Processing...'}</span>
              </div>
            )}

            {/* General Status Messages */}
            {statusMessage && (
              <div className={`p-2.5 rounded-xl border text-[10px] font-semibold ${statusMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                {statusMessage.text}
              </div>
            )}

            {/* Rows List */}
            <div className="max-h-[320px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
              {bulkRows.map((row, idx) => {
                const isActive = idx === currentQueueIndex;
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={isQueueRunning ? -1 : 0}
                    aria-disabled={isQueueRunning}
                    onClick={() => {
                      if (!isQueueRunning) setCurrentQueueIndex(idx);
                    }}
                    onKeyDown={(event) => {
                      if (isQueueRunning) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setCurrentQueueIndex(idx);
                      }
                    }}
                    className={`relative flex items-center justify-between p-2 transition-colors ${isQueueRunning
                        ? 'cursor-not-allowed opacity-80'
                        : 'cursor-pointer hover:bg-gray-50'
                      } ${isActive ? 'bg-slate-50' : 'bg-white'
                      }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-[#0071e3]" />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[9px] font-bold ${isActive ? 'text-[#0071e3]' : 'text-gray-400'}`}>#{idx + 1}</span>
                      <span className={`text-[11px] font-semibold truncate max-w-[110px] ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                        {row.caption || '(No caption)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isQueueRunning && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingSingleExportRowId(row.id);
                          }}
                          disabled={processing}
                          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-black/5 hover:text-[#0071e3] transition-colors disabled:opacity-50 shrink-0"
                          title="Export this video only"
                        >
                          <Play className="h-3 w-3 fill-current" />
                        </button>
                      )}
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${row.status === 'done' ? 'bg-green-50 text-green-600' :
                          row.status === 'processing' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                            row.status === 'saving' ? 'bg-purple-50 text-purple-600 animate-pulse' :
                              row.status === 'error' ? 'bg-red-50 text-red-600' :
                                'bg-gray-100 text-gray-500'
                        }`}>
                        {row.status === 'done' ? 'Done' :
                          row.status === 'processing' ? 'Proc' :
                            row.status === 'saving' ? 'Save' :
                              row.status === 'error' ? 'Err' :
                                'Pend'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <VideoUploadPanel
            video1={video1}
            video2={video2}
            onChooseVideo1={() => setVideoPickerSlot(1)}
            onChooseVideo2={() => setVideoPickerSlot(2)}
            text={overlay.text}
            onTextChange={overlay.setText}
            ffmpegLoaded={ffmpegLoaded}
            ffmpegLoading={ffmpegLoading}
            engineError={engineError}
            onOpenTextGenerator={() => setShowTextGenerator(true)}
            isDualVideo={isDualVideo}
            onToggleDualVideo={toggleDualVideo}
          />
        )}

        {/* Center Columns */}
        <div className="lg:col-span-2 space-y-4">
          <VideoPreview
            video1Url={video1Url}
            video2Url={video2Url}
            containerRef={overlay.containerRef}
            video1Ref={preview.video1Ref}
            video2Ref={preview.video2Ref}
            dragRef={overlay.dragRef}
            overlayTextRef={overlay.overlayTextRef}
            activeVideo={preview.activeVideo}
            isPlaying={preview.isPlaying}
            previewCurrentTime={preview.previewCurrentTime}
            previewTotalTime={preview.previewTotalTime}
            selectedAudio={audio.selectedAudio}
            onTogglePlay={preview.togglePlay}
            onVideo1Ended={preview.handleVideo1Ended}
            onVideo2Ended={preview.handleVideo2Ended}
            onLoadedMetadata={preview.handleLoadedMetadata}
            onDurationChange={preview.handleDurationChange}
            onTimeUpdate={preview.updatePreviewTime}
            text={overlay.text}
            onTextChange={overlay.setText}
            fontColor={overlay.fontColor}
            fontFamily={overlay.fontFamily}
            fontWeight={overlay.fontWeight}
            fontSize={overlay.fontSize}
            strokeWidth={overlay.strokeWidth}
            strokeColor={overlay.strokeColor}
            bgType={overlay.bgType}
            bgColor={overlay.bgColor}
            isEditingOverlay={overlay.isEditingOverlay}
            isDragging={overlay.isDraggingOverlay}
            onSetEditingOverlay={overlay.setIsEditingOverlay}
            clampedDragPos={clampedDragPos}
            overlayTextWidth={overlayTextWidth}
            overlayTextHeight={overlayTextHeight}
            previewFontFamily={previewFontFamily}
            onPointerDown={overlay.handlePointerDown}
            onPointerMove={overlay.handlePointerMove}
            onPointerUp={overlay.handlePointerUp}
            onOpenTimeline={openCurrentClipsInTimeline}
            isDualVideo={isDualVideo}
            canonicalProject={canonicalPreviewProject}
          />

          {!isBulkMode && (
            <ExportPanel
              processing={processing}
              progressMsg={progressMsg}
              resultVideoUrl={resultVideoUrl}
              saving={saving}
              statusMessage={statusMessage}
              generatedCaption={singleGeneratedCaption}
              generatingCaption={singleGeneratingCaption}
              onGenerateCaption={handleGenerateSingleCaption}
              onCaptionChange={setSingleGeneratedCaption}
              onSave={openSingleSaveFolderPicker}
            />
          )}
        </div>

        {/* Right Column */}
        <TextSettingsPanel
          selectedAudio={audio.selectedAudio}
          onOpenAudioDialog={audio.openAudioDialog}
          onClearAudio={audio.clearSelectedAudio}
          fontFamily={overlay.fontFamily}
          onFontFamilyChange={overlay.setFontFamily}
          fontWeight={overlay.fontWeight}
          onFontWeightChange={overlay.setFontWeight}
          fontSize={overlay.fontSize}
          onFontSizeChange={overlay.setFontSize}
          fontColor={overlay.fontColor}
          onFontColorChange={overlay.setFontColor}
          strokeWidth={overlay.strokeWidth}
          onStrokeWidthChange={overlay.setStrokeWidth}
          strokeColor={overlay.strokeColor}
          onStrokeColorChange={overlay.setStrokeColor}
          bgType={overlay.bgType}
          onBgTypeChange={overlay.setBgType}
          bgColor={overlay.bgColor}
          onBgColorChange={overlay.setBgColor}
        />

      </div>

      {showBulkOutputGallery && (
        <div className="mt-4 max-w-7xl w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Generated Bulk Videos</h4>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                {showBulkGeneratingCard
                  ? `Generating row ${currentQueueIndex + 1} of ${bulkRows.length}`
                  : `${doneBulkRows.length} generated locally`}
              </p>
            </div>
            {doneBulkRows.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAllCaptions}
                  disabled={generatingCaptions || Boolean(bulkSavingRowId)}
                  className="rounded-lg bg-orange-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingCaptions ? 'Generating Captions...' : 'Generate Captions'}
                </button>
                <button
                  type="button"
                  onClick={openBulkSaveAllFolderPicker}
                  disabled={Boolean(bulkSavingRowId) || generatingCaptions}
                  className="rounded-lg bg-[#0071e3] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkSavingRowId ? 'Saving...' : 'Add All to Media Library'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-6 gap-3">
            {showBulkGeneratingCard && (
              <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40">
                <div className="relative aspect-[9/16] overflow-hidden bg-black">
                  {video1Url ? (
                    <video
                      src={video1Url}
                      muted
                      preload="metadata"
                      className="h-full w-full object-contain opacity-40"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-950" />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 p-4 text-center text-white">
                    <div className="h-9 w-9 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider">
                        Generating Video
                      </p>
                      <p className="max-w-[180px] text-[10px] font-semibold leading-relaxed text-white/80">
                        {progressMsg || 'FFmpeg is preparing the video...'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-bold text-gray-800">
                      Video {currentQueueIndex + 1}
                    </p>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-bold uppercase text-blue-700">
                      FFmpeg
                    </span>
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed text-gray-500">
                    This video is being generated locally. It will appear here when finished.
                  </p>
                </div>
              </div>
            )}

            {doneBulkRows.map((row, idx) => {
              const resultUrl = getBulkResultUrl(row);
              return (
                <div
                  key={row.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  <div className="aspect-[9/16] bg-black">
                    <video
                      src={resultUrl}
                      controls
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-bold text-gray-800">
                        Video {idx + 1}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <a
                          href={resultUrl}
                          download={row.resultMediaName || `bulk_video_${idx + 1}.mp4`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-600 ring-1 ring-gray-200 transition-colors hover:bg-gray-100"
                          title="Download"
                          aria-label="Download video"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => openBulkSaveFolderPicker(row.id)}
                          disabled={bulkSavingRowId === row.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0071e3] text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={row.resultMediaUrl ? 'Save again to media library' : 'Add to media library'}
                          aria-label={row.resultMediaUrl ? 'Save again to media library' : 'Add to media library'}
                        >
                          {bulkSavingRowId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UploadCloud className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {row.generatedCaption && (
                      <p
                        className="text-[9px] font-medium text-gray-500 line-clamp-3 whitespace-pre-line border-t border-gray-100 pt-1.5 mt-1 cursor-help"
                        onMouseEnter={(e) => showTooltip(e, row.generatedCaption)}
                        onMouseLeave={hideTooltip}
                      >
                        📝 {row.generatedCaption}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {folderPickerRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl h-[520px] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Choose Save Folder</h3>
                <p className="mt-0.5 text-[11px] font-medium text-gray-500">
                  {folderPickerMode === 'all'
                    ? 'Select where all generated videos should be saved.'
                    : 'Select where this video should be saved.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!uploadQueue?.active) {
                    setFolderPickerRowId(null);
                    setUploadQueue(null);
                  }
                }}
                disabled={uploadQueue?.active}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 flex-grow">
              {folderPickerError && (
                <div className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                  {folderPickerError}
                </div>
              )}

              <label className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-400 focus-within:border-[#ff5500]/60">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  type="search"
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  placeholder="Search folders..."
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-gray-700 outline-none placeholder:text-gray-450"
                />
              </label>

              {foldersLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs font-semibold text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading folders...
                </div>
              ) : (
                <div className="space-y-2">
                  {folderSearch.trim() ? (
                    <div className="space-y-1">
                      {folders
                        .filter((f) => getFolderParentId(f) === 'root' && (f.name || '').toLowerCase().includes(folderSearch.trim().toLowerCase()))
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
                        .map((folder) => {
                          const isSelected = selectedSaveFolderId === folder._id;
                          return (
                            <button
                              key={folder._id}
                              type="button"
                              onClick={() => setSelectedSaveFolderId(folder._id)}
                              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold border transition-colors ${isSelected
                                  ? 'bg-[#ff5500]/10 border-[#ff5500]/25 text-[#ff5500]'
                                  : 'bg-gray-50 border-transparent text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                              <Folder className={`h-4 w-4 ${isSelected ? 'text-[#ff5500]' : 'text-gray-450'}`} />
                              <span className="truncate">{folder.name}</span>
                            </button>
                          );
                        })}
                      {folders.filter((f) => getFolderParentId(f) === 'root' && (f.name || '').toLowerCase().includes(folderSearch.trim().toLowerCase())).length === 0 && (
                        <div className="text-center py-4 text-xs text-gray-400 font-semibold">
                          No folders match "{folderSearch}"
                        </div>
                      )}
                    </div>
                  ) : (
                    renderFolderTree('root', 0)
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFolderPickerRowId(null);
                  setUploadQueue(null);
                }}
                disabled={uploadQueue?.active}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveBulkSelectionToMediaLibrary}
                disabled={foldersLoading || Boolean(bulkSavingRowId) || saving}
                className="rounded-xl bg-[#0071e3] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkSavingRowId || saving
                  ? 'Saving...'
                  : folderPickerMode === 'all'
                    ? 'Save All Here'
                    : 'Save Here'}
              </button>
            </div>

            {uploadQueue && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-6 backdrop-blur-sm">
                <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-center gap-3">
                    {uploadQueue.active ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#0071e3]" />
                    ) : uploadQueue.items.some((item) => item.status === 'error') ? (
                      <span className="text-lg text-red-600">!</span>
                    ) : (
                      <span className="text-lg text-green-600">✓</span>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-gray-950">
                        {uploadQueue.active ? 'Uploading videos' : 'Upload queue finished'}
                      </h4>
                      <p className="text-[11px] font-semibold text-gray-500">
                        {uploadQueue.items.filter((item) => item.status === 'success').length} of {uploadQueue.items.length} uploaded
                      </p>
                    </div>
                  </div>
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#0071e3] transition-all duration-300"
                      style={{ width: `${(uploadQueue.items.filter((item) => item.status === 'success').length / uploadQueue.items.length) * 100}%` }}
                    />
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {uploadQueue.items.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
                          {item.status === 'uploading' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0071e3]" /> : item.status === 'success' ? '✓' : item.status === 'error' ? '!' : index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-gray-800">{item.name}</p>
                          <p className={`text-[10px] font-semibold ${item.status === 'error' ? 'text-red-600' : item.status === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
                            {item.status === 'uploading' ? 'Uploading…' : item.status === 'success' ? 'Uploaded' : item.status === 'error' ? (item.error || 'Upload failed') : 'Waiting'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!uploadQueue.active && uploadQueue.items.some((item) => item.status === 'error') && (
                    <button
                      type="button"
                      onClick={() => setUploadQueue(null)}
                      className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-bold text-white"
                    >
                      Back to folder selection
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio Dialog */}
      {audio.showAudioDialog && (
        <AudioDialog
          audioDialogTab={audio.audioDialogTab}
          onTabChange={audio.setAudioDialogTab}
          selectedAudio={audio.selectedAudio}
          platformAudioTracks={audio.platformAudioTracks}
          platformAudioLoading={audio.platformAudioLoading}
          platformAudioError={audio.platformAudioError}
          myAudioTracks={audio.myAudioTracks}
          onSelectTrack={handleSelectAudioTrack}
          onUploadAudio={handleAudioUpload}
          onClearAudio={audio.clearSelectedAudio}
          onClose={() => audio.setShowAudioDialog(false)}
        />
      )}

      {videoPickerSlot && (
        <VideoLibraryPickerDialog
          slotLabel={videoPickerSlot === 1 ? 'First Video (Clip Starts)' : 'Second Video (Appended)'}
          token={token}
          onClose={() => setVideoPickerSlot(null)}
          onSelectVideo={handleSelectLibraryVideo}
        />
      )}

      {showTextGenerator && (
        <TextGeneratorDialog
          token={token}
          onClose={() => setShowTextGenerator(false)}
          onSelectText={overlay.setText}
        />
      )}

      {hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredTooltip.x}px`,
            top: `${hoveredTooltip.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="pointer-events-none z-[9999] max-w-[240px] w-max rounded-lg bg-gray-950/80 backdrop-blur-md px-2.5 py-1.5 text-left text-[10px] font-medium text-white shadow-xl whitespace-pre-wrap break-words border border-white/10"
        >
          {hoveredTooltip.text}
          <div className="absolute left-1/2 top-full h-1.5 w-1.5 -translate-x-1/2 -translate-y-[4px] rotate-45 bg-gray-950/80 backdrop-blur-md border-r border-b border-white/10" />
        </div>
      )}
    </div>
  );
};

export default VideoEditor;
