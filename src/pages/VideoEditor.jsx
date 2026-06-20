import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchFile } from '@ffmpeg/util';
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

export const VideoEditor = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  // Video file state
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const [video1Url, setVideo1Url] = useState('');
  const [video2Url, setVideo2Url] = useState('');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultVideoUrl, setResultVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // Object URL tracking
  const objectUrlsRef = useRef({ video1: '', video2: '', result: '' });

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
    return () => {
      Object.values(urls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // --- Video file handlers ---
  const handleVideo1Change = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (objectUrlsRef.current.video1) URL.revokeObjectURL(objectUrlsRef.current.video1);
      const nextUrl = URL.createObjectURL(file);
      objectUrlsRef.current.video1 = nextUrl;
      setVideo1(file);
      setVideo1Url(nextUrl);
      preview.setActiveVideo(1);
      preview.resetPlayback();
    }
  }, [preview]);

  const handleVideo2Change = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (objectUrlsRef.current.video2) URL.revokeObjectURL(objectUrlsRef.current.video2);
      const nextUrl = URL.createObjectURL(file);
      objectUrlsRef.current.video2 = nextUrl;
      setVideo2(file);
      setVideo2Url(nextUrl);
      preview.resetPlayback();
    }
  }, [preview]);

  // --- Audio dialog wrappers ---
  const handleSelectAudioTrack = useCallback((track) => {
    audio.selectAudioTrack(track, preview.isPlaying, preview.previewCurrentTime);
  }, [audio, preview.isPlaying, preview.previewCurrentTime]);

  const handleAudioUpload = useCallback((e) => {
    const errorMsg = audio.handleAudioUpload(e, preview.isPlaying, preview.previewCurrentTime);
    if (errorMsg) {
      setStatusMessage({ type: 'error', text: errorMsg });
    }
  }, [audio, preview.isPlaying, preview.previewCurrentTime]);

  // --- Process video (coordinates across hooks) ---
  const processVideo = useCallback(async () => {
    if (!video1 || !video2) {
      setStatusMessage({ type: 'error', text: 'Please select both video files before merging.' });
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
      const [v1Data, v2Data] = await Promise.all([fetchFile(video1), fetchFile(video2)]);

      await ffmpeg.writeFile('input1.mp4', v1Data);
      await ffmpeg.writeFile('input2.mp4', v2Data);

      const selectedAudioUrl = selectedAudio?.sourceType === 'library' ? selectedAudio.url : '';
      if ((selectedAudio?.sourceType === 'upload' && selectedAudio.file) || selectedAudioUrl) {
        setProgressMsg('Loading selected audio...');
        await ffmpeg.writeFile('selected_audio', await fetchFile(selectedAudio.file || selectedAudioUrl));
      }

      setProgressMsg('Checking audio streams...');
      const [video1HasAudio, video2HasAudio] = await Promise.all([
        hasAudioStream('input1.mp4'),
        hasAudioStream('input2.mp4'),
      ]);

      setProgressMsg('Calculating text position...');
      const containerRect = overlay.containerRef.current?.getBoundingClientRect();
      if (!containerRect?.width || !containerRect?.height) {
        throw new Error('Preview is not ready yet. Please wait for the videos to appear before exporting.');
      }

      setProgressMsg('Rendering text overlay...');
      await ffmpeg.writeFile('text_overlay.png', await overlay.createTextOverlayPng(containerRect));

      setProgressMsg('Merging videos and rendering text (this may take a minute)...');
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
      const audio0Filter = video1HasAudio
        ? '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a0];'
        : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(videoDurations.input1, 0.1)},asetpts=PTS-STARTPTS[a0];`;
      const audio1Filter = video2HasAudio
        ? '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a1];'
        : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(videoDurations.input2, 0.1)},asetpts=PTS-STARTPTS[a1];`;
      const totalVideoDuration = Math.max(videoDurations.input1 + videoDurations.input2, 0.1);
      const hasFileAudio = selectedAudio?.sourceType === 'upload' && selectedAudio.file;
      const hasLibraryAudio = selectedAudio?.sourceType === 'library' && selectedAudio.url;
      const hasGeneratedAudio = selectedAudio?.sourceType === 'generated';
      const hasSelectedAudioInput = Boolean(hasFileAudio || hasLibraryAudio);
      const selectedAudioInputArgs = hasSelectedAudioInput ? ['-stream_loop', '-1', '-i', 'selected_audio'] : [];
      const selectedAudioInputIndex = 3;
      const selectedAudioFilter = hasGeneratedAudio
        ? `sine=frequency=${selectedAudio.frequency || 180}:duration=${totalVideoDuration},volume=0.16,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[outa]`
        : hasSelectedAudioInput
          ? `[${selectedAudioInputIndex}:a]atrim=0:${totalVideoDuration},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[outa]`
          : '';
      const hasReplacementAudio = Boolean(selectedAudioFilter);
      const outputAudioMap = hasReplacementAudio ? '[outa]' : '[a]';
      const baseVideoFilters =
        `[0:v]setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS}[v0];` +
        `[1:v]setpts=PTS-STARTPTS,scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${OUTPUT_FPS}[v1];` +
        `[v0][2:v]overlay=0:0:format=auto[v0text];`;
      const filterComplex = hasReplacementAudio
        ? baseVideoFilters +
          `[v0text][v1]concat=n=2:v=1:a=0[outv];` +
          selectedAudioFilter
        : baseVideoFilters +
          audio0Filter +
          audio1Filter +
          `[v0text][a0][v1][a1]concat=n=2:v=1:a=1[outv][a]`;

      const exitCode = await ffmpeg.exec([
        '-y',
        '-i', 'input1.mp4',
        '-i', 'input2.mp4',
        '-i', 'text_overlay.png',
        ...selectedAudioInputArgs,
        '-filter_complex',
        filterComplex,
        '-map', '[outv]',
        '-map', outputAudioMap,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-r', String(OUTPUT_FPS),
        '-pix_fmt', 'yuv420p',
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

      setProgressMsg('Finalizing export...');
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });

      if (objectUrlsRef.current.result) URL.revokeObjectURL(objectUrlsRef.current.result);
      const nextResultUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.result = nextResultUrl;
      setResultVideoUrl(nextResultUrl);
      setProgressMsg('');
    } catch (err) {
      console.error('Error processing video client-side:', err);
      setStatusMessage({ type: 'error', text: `Processing error: ${err.message || 'Please verify file formats.'}` });
      setProgressMsg('');
    } finally {
      if (ffmpegLogHandlerRef.current) {
        ffmpegRef.current.off?.('log', ffmpegLogHandlerRef.current);
        ffmpegLogHandlerRef.current = null;
      }
      setProcessing(false);
    }
  }, [video1, video2, ffmpegLoaded, ffmpegRef, audio.selectedAudio, hasAudioStream, removeIfExists, overlay, preview.videoDurationsRef, ffmpegLogHandlerRef, ffmpegLogLinesRef]);

  // --- Save to media library (uses auth token from context) ---
  const saveToMediaLibrary = useCallback(async () => {
    if (!resultVideoUrl) return;

    try {
      setSaving(true);
      setStatusMessage(null);

      const responseBlob = await fetch(resultVideoUrl);
      const blob = await responseBlob.blob();

      const file = new File([blob], `merged_${Date.now()}.mp4`, { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', 'null');
      formData.append('tags', 'editor,merged');

      const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        setStatusMessage({ type: 'success', text: 'Video saved successfully to your Media Library!' });
        setTimeout(() => navigate('/media'), 1500);
      } else {
        const error = await response.json();
        setStatusMessage({ type: 'error', text: `Failed to save: ${error.message}` });
      }
    } catch (err) {
      console.error('Error saving merged video:', err);
      setStatusMessage({ type: 'error', text: 'Failed to upload file to the server library.' });
    } finally {
      setSaving(false);
    }
  }, [resultVideoUrl, token, navigate]);

  // --- Computed values ---
  const clampedDragPos = overlay.computeClampedDragPos();
  const overlayTextWidth = overlay.computeOverlayTextWidth();
  const overlayTextHeight = overlay.computeOverlayTextHeight();
  const previewFontFamily = overlay.getPreviewFontFamily();

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-6 flex flex-col items-center">
      {/* Header */}
      <div className="max-w-7xl w-full flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/media')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library</span>
        </button>
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Video Clip Merger</h2>
        <div className="w-20"></div>
      </div>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Column */}
        <VideoUploadPanel
          video1={video1}
          video2={video2}
          onVideo1Change={handleVideo1Change}
          onVideo2Change={handleVideo2Change}
          text={overlay.text}
          onTextChange={overlay.setText}
          ffmpegLoaded={ffmpegLoaded}
          ffmpegLoading={ffmpegLoading}
          engineError={engineError}
          processing={processing}
          onProcess={processVideo}
        />

        {/* Center Columns */}
        <div className="lg:col-span-2 space-y-6">
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
          />

          <ExportPanel
            processing={processing}
            progressMsg={progressMsg}
            resultVideoUrl={resultVideoUrl}
            saving={saving}
            statusMessage={statusMessage}
            onSave={saveToMediaLibrary}
          />
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
          onSavePlatformTrack={audio.savePlatformAudioToMyAudio}
          onRefreshPlatformAudio={audio.refreshPlatformAudioTracks}
          onUploadAudio={handleAudioUpload}
          onClearAudio={audio.clearSelectedAudio}
          onClose={() => audio.setShowAudioDialog(false)}
        />
      )}
    </div>
  );
};

export default VideoEditor;
