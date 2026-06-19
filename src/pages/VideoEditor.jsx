import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Video, Play, Pause, AlertCircle, CheckCircle2, Music, Upload, X } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;
const OUTPUT_FPS = 30;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const FONT_FAMILY_CSS = {
  'TikTok Sans': 'Outfit, sans-serif',
  Roboto: 'Roboto, sans-serif',
  Impact: 'Anton, sans-serif',
  Arial: 'Arimo, sans-serif',
};

const CANVAS_FONT_FAMILY = {
  'TikTok Sans': 'Outfit',
  Roboto: 'Roboto',
  Impact: 'Anton',
  Arial: 'Arimo',
};

const FONT_WEIGHTS = ['Thin', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold'];

const WEIGHT_MAP = {
  Thin: '100',
  Light: '300',
  Regular: '400',
  Medium: '500',
  SemiBold: '600',
  Bold: '700',
};

const FONT_WIDTH_FACTORS = {
  'TikTok Sans': 0.58,
  Roboto: 0.56,
  Impact: 0.62,
  Arial: 0.54,
};

const MY_AUDIO_STORAGE_KEY = 'tw_video_editor_my_audio';

const PLATFORM_AUDIO_TRACKS = [
  {
    id: 'platform-bright-pulse',
    name: 'Bright Pulse',
    description: 'Clean upbeat bed',
    sourceType: 'generated',
    frequency: 220,
  },
  {
    id: 'platform-soft-drive',
    name: 'Soft Drive',
    description: 'Warm steady rhythm',
    sourceType: 'generated',
    frequency: 164,
  },
  {
    id: 'platform-focus-tone',
    name: 'Focus Tone',
    description: 'Minimal low ambience',
    sourceType: 'generated',
    frequency: 110,
  },
];

export const VideoEditor = () => {
  const navigate = useNavigate();

  // Selected videos
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const [video1Url, setVideo1Url] = useState('');
  const [video2Url, setVideo2Url] = useState('');

  // Editing controls (matching image requirements)
  const [text, setText] = useState("clinical students... we can officially\nbreathe on TW");
  const [fontFamily, setFontFamily] = useState('TikTok Sans');
  const [fontWeight, setFontWeight] = useState('Regular'); // 'Thin', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold'
  const [fontSize, setFontSize] = useState(15);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [bgType, setBgType] = useState('None'); // 'White', 'None', 'Snapchat'
  const [bgColor, setBgColor] = useState('#000000');
  const [dragPos, setDragPos] = useState({ x: 20, y: 220 }); // Centered default coordinates

  // Player state
  const [activeVideo, setActiveVideo] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewTotalTime, setPreviewTotalTime] = useState(0);
  // FFmpeg state
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultVideoUrl, setResultVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(292);
  const [previewHeight, setPreviewHeight] = useState(520);
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [audioDialogTab, setAudioDialogTab] = useState('platform');
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [myAudioTracks, setMyAudioTracks] = useState(() => {
    try {
      const savedTracks = JSON.parse(localStorage.getItem(MY_AUDIO_STORAGE_KEY) || '[]');
      return Array.isArray(savedTracks) ? savedTracks : [];
    } catch {
      return [];
    }
  });

  const containerRef = useRef(null);
  const video1Ref = useRef(null);
  const video2Ref = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());
  const videoDurationsRef = useRef({
    input1: 0,
    input2: 0,
  });
  const objectUrlsRef = useRef({
    video1: '',
    video2: '',
    result: '',
    audio: [],
  });
  const ffmpegLogHandlerRef = useRef(null);
  const ffmpegLogLinesRef = useRef([]);
  const dragRef = useRef(null);
  const overlayTextRef = useRef(null);
  const previewAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);

  // Drag state variables
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elemStart = useRef({ x: 0, y: 0 });

  async function loadFFmpeg() {
    try {
      setFfmpegLoading(true);
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const ffmpeg = ffmpegRef.current;
      
      // Load Core and WASM asynchronously from unpkg
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setFfmpegLoaded(true);
    } catch (err) {
      console.error('Failed to load FFmpeg.wasm:', err);
      setProgressMsg('Error loading video processing engine. Please reload the page.');
    } finally {
      setFfmpegLoading(false);
    }
  }

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    Promise.resolve().then(loadFFmpeg);
    return () => {
      Object.values(objectUrls).forEach((url) => {
        if (Array.isArray(url)) {
          url.forEach((itemUrl) => URL.revokeObjectURL(itemUrl));
        } else if (url) {
          URL.revokeObjectURL(url);
        }
      });
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch {
          // Oscillators throw if stop is called twice.
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const updatePreviewSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPreviewWidth(rect.width);
        setPreviewHeight(rect.height);
      }
    };

    updatePreviewSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updatePreviewSize);
      return () => window.removeEventListener('resize', updatePreviewSize);
    }

    const resizeObserver = new ResizeObserver(updatePreviewSize);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [video1Url, video2Url]);

  const handleVideo1Change = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (objectUrlsRef.current.video1) URL.revokeObjectURL(objectUrlsRef.current.video1);
      const nextUrl = URL.createObjectURL(file);
      objectUrlsRef.current.video1 = nextUrl;
      setVideo1(file);
      setVideo1Url(nextUrl);
      setActiveVideo(1);
      setIsPlaying(false);
      setPreviewCurrentTime(0);
      stopPreviewReplacementAudio();
    }
  };

  const handleVideo2Change = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (objectUrlsRef.current.video2) URL.revokeObjectURL(objectUrlsRef.current.video2);
      const nextUrl = URL.createObjectURL(file);
      objectUrlsRef.current.video2 = nextUrl;
      setVideo2(file);
      setVideo2Url(nextUrl);
      setIsPlaying(false);
      setPreviewCurrentTime(0);
      stopPreviewReplacementAudio();
    }
  };

  // Drag logic using React Pointer Events for mobile + desktop compatibility
  const handlePointerDown = (e) => {
    e.preventDefault();
    if (!containerRef.current || !dragRef.current) return;
    
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    elemStart.current = getClampedDragPos();
    
    dragRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current || !containerRef.current || !dragRef.current) return;
    e.preventDefault();

    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;

    const containerRect = containerRef.current.getBoundingClientRect();
    const dragRect = dragRef.current.getBoundingClientRect();

    let newX = elemStart.current.x + deltaX;
    let newY = elemStart.current.y + deltaY;

    // Boundaries check
    const maxX = Math.max(0, containerRect.width - dragRect.width);
    const maxY = Math.max(0, containerRect.height - dragRect.height);

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setDragPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (isDragging.current && dragRef.current) {
      isDragging.current = false;
      dragRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const stopPreviewReplacementAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }

    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch {
        // Oscillators throw if stop is called twice.
      }
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }

    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
  };

  const playPreviewReplacementAudio = async (startTime = previewCurrentTime, audioTrack = selectedAudio) => {
    stopPreviewReplacementAudio();
    if (!audioTrack) return;

    if (audioTrack.sourceType === 'upload' && audioTrack.url) {
      const audio = new Audio(audioTrack.url);
      audio.loop = true;
      audio.volume = 1;
      previewAudioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = startTime % audio.duration;
        }
      }, { once: true });

      await audio.play();
      return;
    }

    if (audioTrack.sourceType === 'generated') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = audioTrack.frequency || 180;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillatorRef.current = oscillator;
      gainRef.current = gain;
    }
  };

  // Dynamic preview play logic
  const togglePlay = async () => {
    if (isPlaying) {
      if (video1Ref.current) video1Ref.current.pause();
      if (video2Ref.current) video2Ref.current.pause();
      stopPreviewReplacementAudio();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      try {
        await playPreviewReplacementAudio();
      } catch (audioErr) {
        console.error('Failed to play selected preview audio:', audioErr);
      }
      if (activeVideo === 1) {
        if (video1Ref.current) video1Ref.current.play();
      } else {
        if (video2Ref.current) video2Ref.current.play();
      }
    }
  };

  const updatePreviewTime = () => {
    const clip1Duration = videoDurationsRef.current.input1 || 0;
    const clip1Current = video1Ref.current?.currentTime || 0;
    const clip2Current = video2Ref.current?.currentTime || 0;
    setPreviewCurrentTime(activeVideo === 1 ? clip1Current : clip1Duration + clip2Current);
  };

  const handleVideo1Ended = () => {
    setActiveVideo(2);
    setPreviewCurrentTime(videoDurationsRef.current.input1 || 0);
    setTimeout(() => {
      if (video2Ref.current && isPlaying) {
        video2Ref.current.currentTime = 0;
        video2Ref.current.play();
      }
    }, 50);
  };

  const handleVideo2Ended = () => {
    setActiveVideo(1);
    setPreviewCurrentTime(0);
    if (isPlaying && selectedAudio) {
      void playPreviewReplacementAudio(0);
    }
    setTimeout(() => {
      if (video1Ref.current && isPlaying) {
        video1Ref.current.currentTime = 0;
        video1Ref.current.play();
      }
    }, 50);
  };

  const handleLoadedMetadata = (inputKey, e) => {
    const duration = e.target.duration;
    videoDurationsRef.current[inputKey] = Number.isFinite(duration) && duration > 0 ? duration : 0;
    setPreviewTotalTime(videoDurationsRef.current.input1 + videoDurationsRef.current.input2);
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const hexToRgba = (hex, alpha) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const hexToCanvasRgba = (hex, alpha = 1) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const drawRoundRect = (ctx, x, y, width, height, radius) => {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  };

  const canvasToUint8Array = async (canvas) => {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render text overlay.');
    return new Uint8Array(await blob.arrayBuffer());
  };

  const createTextOverlayPng = async (containerRect) => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const scaleX = OUTPUT_WIDTH / containerRect.width;
    const scaleY = OUTPUT_HEIGHT / containerRect.height;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare text overlay.');

    const clampedDragPos = getClampedDragPos();
    const finalX = Math.round(clampedDragPos.x * scaleX);
    const finalY = Math.round(clampedDragPos.y * scaleY);
    const finalFontSize = Math.max(1, Math.round(fontSize * scaleY));
    const finalStrokeWidth = strokeWidth > 0 ? Math.max(1, strokeWidth * scaleY) : 0;
    const lineHeight = finalFontSize * 1.3;
    const textWidth = Math.round(getOverlayTextWidth() * scaleX);
    const lines = (text || ' ').split('\n');
    const horizontalPadding = bgType !== 'None' ? Math.round(10 * scaleX) : 0;
    const verticalPadding = bgType !== 'None' ? Math.round(4 * scaleY) : 0;
    const textBlockHeight = lineHeight * lines.length;
    const backgroundWidth = textWidth + horizontalPadding * 2;
    const backgroundHeight = textBlockHeight + verticalPadding * 2;

    if (bgType !== 'None') {
      ctx.fillStyle = bgType === 'Snapchat' ? hexToCanvasRgba(bgColor, 0.6) : bgColor;
      drawRoundRect(
        ctx,
        finalX,
        finalY,
        backgroundWidth,
        backgroundHeight,
        bgType === 'Snapchat' ? Math.round(6 * scaleY) : Math.round(4 * scaleY)
      );
      ctx.fill();
    }

    ctx.font = `${WEIGHT_MAP[fontWeight]} ${finalFontSize}px ${CANVAS_FONT_FAMILY[fontFamily] || 'Roboto'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const textX = finalX + horizontalPadding + textWidth / 2;
    const textY = finalY + verticalPadding;

    lines.forEach((line, index) => {
      const y = textY + index * lineHeight;
      if (finalStrokeWidth > 0) {
        ctx.lineWidth = finalStrokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(line || ' ', textX, y, textWidth);
      }
      ctx.fillStyle = fontColor;
      ctx.fillText(line || ' ', textX, y, textWidth);
    });

    return canvasToUint8Array(canvas);
  };

  const hasAudioStream = async (ffmpeg, inputName) => {
    const probeOutput = `probe_audio_${inputName}.null`;

    try {
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-map', '0:a:0',
        '-frames:a', '1',
        '-f', 'null',
        probeOutput,
      ]);
      return exitCode === 0;
    } catch {
      return false;
    }
  };

  const removeIfExists = async (ffmpeg, path) => {
    try {
      await ffmpeg.deleteFile(path);
    } catch {
      // FFmpeg's virtual filesystem throws when the file is absent.
    }
  };

  const getPreviewFontFamily = () => FONT_FAMILY_CSS[fontFamily] || FONT_FAMILY_CSS.Roboto;

  const getOverlayTextWidth = () => {
    const longestLineLength = Math.max(...(text || ' ').split('\n').map((line) => line.length), 1);
    const widthFactor = FONT_WIDTH_FACTORS[fontFamily] || FONT_WIDTH_FACTORS.Roboto;
    const estimatedWidth = Math.max(50, Math.ceil(longestLineLength * fontSize * widthFactor) + 8);
    return Math.min(estimatedWidth, Math.max(50, previewWidth - 16));
  };

  const getOverlayTextHeight = () => {
    const lineCount = Math.max((text || ' ').split('\n').length, 1);
    const textHeight = lineCount * fontSize * 1.3;
    const verticalPadding = bgType !== 'None' ? 8 : 0;
    return Math.ceil(textHeight + verticalPadding);
  };

  const getClampedDragPos = () => {
    const overlayWidth = getOverlayTextWidth() + (bgType !== 'None' ? 20 : 0);
    const overlayHeight = getOverlayTextHeight();
    const maxX = Math.max(0, previewWidth - overlayWidth);
    const maxY = Math.max(0, previewHeight - overlayHeight);

    return {
      x: Math.max(0, Math.min(dragPos.x, maxX)),
      y: Math.max(0, Math.min(dragPos.y, maxY)),
    };
  };

  const persistMyAudioTracks = (tracks) => {
    const tracksToStore = tracks.filter((track) => track.sourceType !== 'upload');
    localStorage.setItem(MY_AUDIO_STORAGE_KEY, JSON.stringify(tracksToStore));
  };

  const savePlatformAudioToMyAudio = (track) => {
    setMyAudioTracks((currentTracks) => {
      if (currentTracks.some((item) => item.id === track.id)) return currentTracks;

      const nextTracks = [
        {
          ...track,
          savedAt: new Date().toISOString(),
        },
        ...currentTracks,
      ];
      persistMyAudioTracks(nextTracks);
      return nextTracks;
    });
  };

  const selectAudioTrack = (track) => {
    setSelectedAudio(track);
    if (isPlaying) {
      void playPreviewReplacementAudio(previewCurrentTime, track).catch((audioErr) => {
        console.error('Failed to play selected preview audio:', audioErr);
      });
    }
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please upload an audio file.');
      e.target.value = '';
      return;
    }

    const audioUrl = URL.createObjectURL(file);
    objectUrlsRef.current.audio.push(audioUrl);

    const uploadedTrack = {
      id: `upload-${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      description: 'Uploaded audio',
      sourceType: 'upload',
      file,
      url: audioUrl,
      savedAt: file.lastModified ? new Date(file.lastModified).toISOString() : '',
    };

    setMyAudioTracks((currentTracks) => [uploadedTrack, ...currentTracks]);
    selectAudioTrack(uploadedTrack);
    e.target.value = '';
  };

  const clearSelectedAudio = () => {
    setSelectedAudio(null);
    stopPreviewReplacementAudio();
  };

  // Compile and merge videos with FFmpeg.wasm
  const processVideo = async () => {
    if (!video1 || !video2) {
      alert('Please select both video files before merging.');
      return;
    }
    if (!ffmpegLoaded) {
      alert('Video processing engine is still loading. Please wait a moment.');
      return;
    }

    const ffmpeg = ffmpegRef.current;

    try {
      setProcessing(true);
      setProgressMsg('Initializing processing engine...');
      await Promise.all([
        removeIfExists(ffmpeg, 'input1.mp4'),
        removeIfExists(ffmpeg, 'input2.mp4'),
        removeIfExists(ffmpeg, 'selected_audio'),
        removeIfExists(ffmpeg, 'text_overlay.png'),
        removeIfExists(ffmpeg, 'selected_font.ttf'),
        removeIfExists(ffmpeg, 'text.txt'),
        removeIfExists(ffmpeg, 'output.mp4'),
      ]);

      // 1. Fetch font file and write both videos/assets to WASM filesystem
      setProgressMsg('Reading video files...');
      const v1Data = await fetchFile(video1);
      const v2Data = await fetchFile(video2);

      await ffmpeg.writeFile('input1.mp4', v1Data);
      await ffmpeg.writeFile('input2.mp4', v2Data);

      if (selectedAudio?.sourceType === 'upload' && selectedAudio.file) {
        setProgressMsg('Loading selected audio...');
        await ffmpeg.writeFile('selected_audio', await fetchFile(selectedAudio.file));
      }

      setProgressMsg('Checking audio streams...');
      const [video1HasAudio, video2HasAudio] = await Promise.all([
        hasAudioStream(ffmpeg, 'input1.mp4'),
        hasAudioStream(ffmpeg, 'input2.mp4'),
      ]);

      // 2. Compute exact overlay location relative to video size (720x1280 output resolution)
      setProgressMsg('Calculating text position...');
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect?.width || !containerRect?.height) {
        throw new Error('Preview is not ready yet. Please wait for the videos to appear before exporting.');
      }

      setProgressMsg('Rendering text overlay...');
      await ffmpeg.writeFile('text_overlay.png', await createTextOverlayPng(containerRect));

      // 4. Setup sequential merge filter
      // Merges video sequences, letterboxing to a uniform 720x1280 resolution to avoid codec mismatches
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

      const audio0Filter = video1HasAudio
        ? '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a0];'
        : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(videoDurationsRef.current.input1, 0.1)},asetpts=PTS-STARTPTS[a0];`;
      const audio1Filter = video2HasAudio
        ? '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a1];'
        : `anullsrc=channel_layout=stereo:sample_rate=44100:d=${Math.max(videoDurationsRef.current.input2, 0.1)},asetpts=PTS-STARTPTS[a1];`;
      const totalVideoDuration = Math.max(
        videoDurationsRef.current.input1 + videoDurationsRef.current.input2,
        0.1
      );
      const hasUploadAudio = selectedAudio?.sourceType === 'upload' && selectedAudio.file;
      const hasGeneratedAudio = selectedAudio?.sourceType === 'generated';
      const selectedAudioInputArgs = hasUploadAudio ? ['-stream_loop', '-1', '-i', 'selected_audio'] : [];
      const selectedAudioInputIndex = 3;
      const selectedAudioFilter = hasGeneratedAudio
        ? `sine=frequency=${selectedAudio.frequency || 180}:duration=${totalVideoDuration},volume=0.16,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[outa]`
        : hasUploadAudio
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
      alert(`An error occurred during video processing: ${err.message || 'Please verify file formats.'}`);
      setProgressMsg('');
    } finally {
      if (ffmpegLogHandlerRef.current) {
        ffmpeg.off?.('log', ffmpegLogHandlerRef.current);
        ffmpegLogHandlerRef.current = null;
      }
      setProcessing(false);
    }
  };

  // Save the result file to database / media library
  const saveToMediaLibrary = async () => {
    if (!resultVideoUrl) return;

    try {
      setSaving(true);
      
      // Fetch blob data
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
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: formData,
      });

      if (response.ok) {
        alert('Video saved successfully to your Media Library!');
        navigate('/media');
      } else {
        const error = await response.json();
        alert(`Failed to save: ${error.message}`);
      }
    } catch (err) {
      console.error('Error saving merged video:', err);
      alert('Failed to upload file to the server library.');
    } finally {
      setSaving(false);
    }
  };

  const getWeightSliderValue = () => {
    return FONT_WEIGHTS.indexOf(fontWeight);
  };

  const handleWeightSliderChange = (e) => {
    const val = Number(e.target.value);
    setFontWeight(FONT_WEIGHTS[val]);
  };

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
        
        {/* Left Column: Input Settings Panel */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <Video className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Import Assets</h3>
          </div>

          {/* Video uploads */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">First Video (Clips Starts)</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideo1Change}
                className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-lg p-2"
              />
              {video1 && <p className="text-[10px] text-gray-500 mt-1 truncate">Selected: {video1.name}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Second Video (Appended)</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideo2Change}
                className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-lg p-2"
              />
              {video2 && <p className="text-[10px] text-gray-500 mt-1 truncate">Selected: {video2.name}</p>}
            </div>
          </div>

          {/* Text input area supporting newline wraps */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Overlay text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows="3"
              placeholder="Enter text..."
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:bg-white transition-all outline-none resize-none"
            />
          </div>

          {/* Controls button */}
          <div className="pt-4">
            {!ffmpegLoaded ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-normal">
                  {ffmpegLoading ? 'Downloading editor engine core (~30MB)...' : 'Initializing engine...'}
                </p>
              </div>
            ) : (
              <button
                disabled={processing || !video1 || !video2}
                onClick={processVideo}
                className="w-full py-3 bg-[#0071e3] text-white rounded-lg text-xs font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Merge & Add Text'}
              </button>
            )}
          </div>
        </div>

        {/* Center Columns: Preview and Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Draggable Preview Screen */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Placement Preview</h4>

            {(!video1Url || !video2Url) ? (
              <div className="aspect-[9/16] h-[520px] max-w-[292px] mx-auto rounded-xl bg-gray-150 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Video className="w-8 h-8" />
                <span className="text-xs">Import Video 1 & Video 2</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div 
                  ref={containerRef}
                  className="aspect-[9/16] h-[520px] max-w-[292px] mx-auto rounded-xl bg-black overflow-hidden relative select-none"
                >
                  {/* Video 1 playing */}
                  <video
                    ref={video1Ref}
                    src={video1Url}
                    onEnded={handleVideo1Ended}
                    onLoadedMetadata={(e) => handleLoadedMetadata('input1', e)}
                    onTimeUpdate={updatePreviewTime}
                    muted={Boolean(selectedAudio)}
                    className={`absolute inset-0 w-full h-full object-contain ${activeVideo === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  />
                  {/* Video 2 playing */}
                  <video
                    ref={video2Ref}
                    src={video2Url}
                    onEnded={handleVideo2Ended}
                    onLoadedMetadata={(e) => handleLoadedMetadata('input2', e)}
                    onTimeUpdate={updatePreviewTime}
                    muted={Boolean(selectedAudio)}
                    className={`absolute inset-0 w-full h-full object-contain ${activeVideo === 2 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  />

                  <div className="absolute left-3 top-3 z-20 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-sm">
                    {formatTime(previewCurrentTime)} / {formatTime(previewTotalTime)}
                  </div>

                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                    className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/75 active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 translate-x-[1px]" />
                    )}
                  </button>

                  {/* Interactively Draggable + Inline-Editable Text Overlay */}
                  <div
                    ref={dragRef}
                    onPointerDown={(e) => { if (!isEditingOverlay) handlePointerDown(e); }}
                    onPointerMove={(e) => { if (!isEditingOverlay) handlePointerMove(e); }}
                    onPointerUp={(e) => { if (!isEditingOverlay) handlePointerUp(e); }}
                    onDoubleClick={() => {
                      if (!isEditingOverlay) {
                        setIsEditingOverlay(true);
                        setTimeout(() => {
                          const ta = overlayTextRef.current;
                          if (ta) { ta.focus(); ta.selectionStart = ta.value.length; }
                        }, 10);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${getClampedDragPos().x}px`,
                      top: `${getClampedDragPos().y}px`,
                      cursor: isEditingOverlay ? 'text' : 'move',
                      touchAction: isEditingOverlay ? 'auto' : 'none',
                      padding: bgType !== 'None' ? '4px 10px' : '0px',
                      borderRadius: bgType === 'Snapchat' ? '6px' : bgType === 'White' ? '4px' : '0px',
                      backgroundColor: bgType === 'White' ? bgColor : bgType === 'Snapchat' ? hexToRgba(bgColor, 0.6) : 'transparent',
                      outline: isEditingOverlay ? '1.5px dashed rgba(255,255,255,0.55)' : 'none',
                      opacity: activeVideo === 1 ? 1 : 0,
                      pointerEvents: activeVideo === 1 ? 'auto' : 'none',
                    }}
                  >
                    <textarea
                      ref={overlayTextRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onBlur={() => setIsEditingOverlay(false)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { setIsEditingOverlay(false); overlayTextRef.current?.blur(); } }}
                      readOnly={!isEditingOverlay}
                      rows={Math.max(text.split('\n').length, 1)}
                      style={{
                        display: 'block',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        overflow: 'hidden',
                        color: fontColor,
                        fontFamily: getPreviewFontFamily(),
                        fontWeight: WEIGHT_MAP[fontWeight],
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.3,
                        textAlign: 'center',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        padding: 0,
                        margin: 0,
                        width: `${getOverlayTextWidth()}px`,
                        height: `${getOverlayTextHeight() - (bgType !== 'None' ? 8 : 0)}px`,
                        minWidth: '50px',
                        WebkitTextStrokeWidth: strokeWidth > 0 ? `${strokeWidth}px` : '0px',
                        WebkitTextStrokeColor: strokeColor,
                        paintOrder: 'stroke fill',
                        pointerEvents: isEditingOverlay ? 'auto' : 'none',
                        userSelect: isEditingOverlay ? 'auto' : 'none',
                        caretColor: isEditingOverlay ? '#ffffff' : 'transparent',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export & Save Section */}
          {(processing || resultVideoUrl || progressMsg) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Export Output</h4>

              {processing && (
                <div className="py-6 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                  <p className="text-xs font-semibold text-gray-700 animate-pulse">{progressMsg}</p>
                </div>
              )}

              {resultVideoUrl && !processing && (
                <div className="space-y-4">
                  <div className="flex gap-2 items-center text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span className="text-xs font-semibold">Video processed successfully!</span>
                  </div>

                  <div className="aspect-[9/16] h-[520px] max-w-[292px] mx-auto rounded-xl bg-black overflow-hidden relative">
                    <video src={resultVideoUrl} controls className="w-full h-full object-contain" />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <a
                      href={resultVideoUrl}
                      download="merged_video.mp4"
                      className="flex-1 py-2.5 bg-gray-100 text-center text-xs font-semibold text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-150 transition-colors"
                    >
                      Download MP4 File
                    </a>
                    
                    <button
                      disabled={saving}
                      onClick={saveToMediaLibrary}
                      className="flex-1 py-2.5 bg-[#0071e3] text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save to Media Library'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Custom Text Settings Panel (matching screenshot) */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm select-none">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-black">Audio</label>
              <button
                type="button"
                onClick={() => setShowAudioDialog(true)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-3 text-left text-xs font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.99]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                  <span className="truncate">{selectedAudio ? selectedAudio.name : 'Swap audio'}</span>
                </span>
                <span className="text-[10px] font-bold uppercase text-gray-400">Choose</span>
              </button>
              {selectedAudio && (
                <button
                  type="button"
                  onClick={clearSelectedAudio}
                  className="text-[10px] font-semibold text-gray-500 underline hover:text-black"
                >
                  Use original video audio
                </button>
              )}
            </div>
            
            {/* Font Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-black">Font</label>
              <div className="relative">
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full text-xs font-medium border border-gray-200 rounded-xl p-3 bg-white outline-none cursor-pointer appearance-none"
                >
                  <option value="TikTok Sans">TikTok Sans</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Impact">Impact</option>
                  <option value="Arial">Arial</option>
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Font Weight Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-black">
                <span>Weight: {fontWeight}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={getWeightSliderValue()}
                onChange={handleWeightSliderChange}
                className="w-full accent-[#ff5500] bg-gray-100 rounded-lg cursor-pointer h-1.5 appearance-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${(getWeightSliderValue() / 5) * 100}%, #f3f4f6 ${(getWeightSliderValue() / 5) * 100}%, #f3f4f6 100%)`
                }}
              />
            </div>

            {/* Font Size Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-black">
                <span>Size: {fontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[#ff5500] bg-gray-100 rounded-lg cursor-pointer h-1.5 appearance-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${((fontSize - 12) / 60) * 100}%, #f3f4f6 ${((fontSize - 12) / 60) * 100}%, #f3f4f6 100%)`
                }}
              />
            </div>

            {/* Text Color Picker and Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-black">Color</label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={fontColor.toLowerCase()}
                    onChange={(e) => setFontColor(e.target.value.toUpperCase())}
                    className="absolute inset-[-4px] w-[50px] h-[50px] border-0 p-0 cursor-pointer"
                  />
                  <div className="absolute inset-0 border border-white rounded-lg pointer-events-none"></div>
                </div>
                <input
                  type="text"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value.toUpperCase())}
                  className="w-full text-xs font-semibold bg-gray-100 border border-transparent rounded-xl p-3 outline-none uppercase tracking-wide text-gray-700"
                />
              </div>
            </div>

            {/* Stroke Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-black">
                <span>Stroke: {strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-[#ff5500] bg-gray-100 rounded-lg cursor-pointer h-1.5 appearance-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${(strokeWidth / 10) * 100}%, #f3f4f6 ${(strokeWidth / 10) * 100}%, #f3f4f6 100%)`
                }}
              />
            </div>

            {/* Stroke Color Picker and Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-black">Stroke Color</label>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={strokeColor.toLowerCase()}
                    onChange={(e) => setStrokeColor(e.target.value.toUpperCase())}
                    className="absolute inset-[-4px] w-[50px] h-[50px] border-0 p-0 cursor-pointer"
                  />
                  <div className="absolute inset-0 border border-white rounded-lg pointer-events-none"></div>
                </div>
                <input
                  type="text"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value.toUpperCase())}
                  className="w-full text-xs font-semibold bg-gray-100 border border-transparent rounded-xl p-3 outline-none uppercase tracking-wide text-gray-700"
                />
              </div>
            </div>

            {/* Background pill options */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-black">Background</label>
              <div className="flex gap-2.5">
                {['White', 'None', 'Snapchat'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setBgType(type);
                      if (type === 'White') setBgColor('#FFFFFF');
                      else if (type === 'Snapchat') setBgColor('#000000');
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-full border transition-all ${
                      bgType === type
                        ? 'bg-[#ff5500] border-[#ff5500] text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Background Color details (visible if not None) */}
              <div className={`pt-1.5 transition-all duration-200 ${bgType === 'None' ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer">
                    <input
                      type="color"
                      disabled={bgType === 'None'}
                      value={bgColor.toLowerCase()}
                      onChange={(e) => setBgColor(e.target.value.toUpperCase())}
                      className="absolute inset-[-4px] w-[50px] h-[50px] border-0 p-0 cursor-pointer"
                    />
                    <div className="absolute inset-0 border border-white rounded-lg pointer-events-none"></div>
                  </div>
                  <input
                    type="text"
                    disabled={bgType === 'None'}
                    value={bgType === 'None' ? 'None' : bgColor}
                    onChange={(e) => setBgColor(e.target.value.toUpperCase())}
                    className="w-full text-xs font-semibold bg-gray-100 border border-transparent rounded-xl p-3 outline-none uppercase tracking-wide text-gray-700"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {showAudioDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Swap Audio</h3>
                <p className="mt-0.5 text-[11px] text-gray-500">Replace the merged video audio track.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAudioDialog(false)}
                aria-label="Close audio dialog"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex border-b border-gray-100 px-4 pt-3">
              {[
                ['platform', 'Platform Audio'],
                ['my', 'My Audio'],
              ].map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setAudioDialogTab(tabId)}
                  className={`border-b-2 px-3 pb-2 text-xs font-bold transition-colors ${
                    audioDialogTab === tabId
                      ? 'border-[#ff5500] text-black'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {audioDialogTab === 'platform' ? (
                <div className="space-y-3">
                  {PLATFORM_AUDIO_TRACKS.map((track) => {
                    const isSelected = selectedAudio?.id === track.id;
                    const isSaved = myAudioTracks.some((item) => item.id === track.id);

                    return (
                      <div
                        key={track.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isSelected ? 'border-[#ff5500] bg-orange-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                              <p className="truncate text-xs font-bold text-gray-900">{track.name}</p>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">{track.description}</p>
                          </div>

                          <div className="flex flex-shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => selectAudioTrack(track)}
                              className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                isSelected
                                  ? 'bg-[#ff5500] text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Use'}
                            </button>
                            <button
                              type="button"
                              onClick={() => savePlatformAudioToMyAudio(track)}
                              disabled={isSaved}
                              className="rounded-md border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-45"
                            >
                              {isSaved ? 'Saved' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-100">
                    <Upload className="h-4 w-4" />
                    <span>Upload audio to My Audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                  </label>

                  {myAudioTracks.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 p-4 text-center text-xs text-gray-400">
                      No audio saved yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myAudioTracks.map((track) => {
                        const isSelected = selectedAudio?.id === track.id;

                        return (
                          <div
                            key={track.id}
                            className={`rounded-lg border p-3 transition-colors ${
                              isSelected ? 'border-[#ff5500] bg-orange-50' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                                  <p className="truncate text-xs font-bold text-gray-900">{track.name}</p>
                                </div>
                                <p className="mt-1 text-[11px] text-gray-500">{track.description || 'Saved audio'}</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => selectAudioTrack(track)}
                                className={`flex-shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                  isSelected
                                    ? 'bg-[#ff5500] text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {isSelected ? 'Selected' : 'Use'}
                              </button>
                            </div>

                            {track.url && (
                              <audio src={track.url} controls className="mt-3 h-8 w-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={clearSelectedAudio}
                className="text-xs font-semibold text-gray-500 underline hover:text-black"
              >
                Use original audio
              </button>
              <button
                type="button"
                onClick={() => setShowAudioDialog(false)}
                className="rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoEditor;
