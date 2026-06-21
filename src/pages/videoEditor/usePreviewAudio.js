import { useState, useRef, useCallback, useEffect } from 'react';
import {
  API_BASE_URL,
  MY_AUDIO_STORAGE_KEY,
  PLATFORM_AUDIO_FOLDER_ID,
} from './videoEditorConstants';
import { getActiveCampaignId } from '../../utils/campaignScope';

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm)$/i;

const isAudioMediaItem = (item) => {
  const searchable = `${item.name || ''} ${item.url || ''}`;
  return (
    item.type === 'audio' ||
    item.mimeType?.startsWith?.('audio/') ||
    item.mimetype?.startsWith?.('audio/') ||
    AUDIO_EXTENSION_PATTERN.test(searchable)
  );
};

const mediaItemToAudioTrack = (item) => {
  const proxiedUrl = `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(item.url)}`;

  return {
    id: `platform-${item._id}`,
    mediaId: item._id,
    name: item.name || 'Platform audio',
    description: item.caption || (item.tags?.length ? item.tags.join(', ') : 'Platform audio'),
    sourceType: 'library',
    url: proxiedUrl,
    originalUrl: item.url,
    savedAt: item.createdAt || '',
  };
};

/**
 * Manages audio selection, preview playback (Web Audio API oscillator or
 * uploaded file), "My Audio" persistence, and upload handling.
 */
export const usePreviewAudio = () => {
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [audioDialogTab, setAudioDialogTab] = useState('platform');
  const [platformAudioTracks, setPlatformAudioTracks] = useState([]);
  const [platformAudioLoading, setPlatformAudioLoading] = useState(false);
  const [platformAudioError, setPlatformAudioError] = useState('');
  const [myAudioTracks, setMyAudioTracks] = useState(() => {
    try {
      const savedTracks = JSON.parse(localStorage.getItem(MY_AUDIO_STORAGE_KEY) || '[]');
      return Array.isArray(savedTracks) ? savedTracks : [];
    } catch {
      return [];
    }
  });

  const previewAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);
  const audioObjectUrlsRef = useRef([]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = audioObjectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const stopPreviewAudio = useCallback(() => {
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
  }, []);

  const fetchPlatformAudioTracks = useCallback(async () => {
    setPlatformAudioLoading(true);
    setPlatformAudioError('');

    try {
      const token = localStorage.getItem('tw_token');
      const params = new URLSearchParams();
      const campaignId = getActiveCampaignId();
      if (campaignId) params.set('campaignId', campaignId);
      params.set('folderId', PLATFORM_AUDIO_FOLDER_ID);
      const response = await fetch(`${API_BASE_URL}/api/media?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Unable to load platform audio.');
      }

      const mediaItems = await response.json();
      const items = Array.isArray(mediaItems) ? mediaItems.filter((item) => item.url) : [];
      const audioItems = items.filter(isAudioMediaItem);
      const tracks = (audioItems.length > 0 ? audioItems : items).map(mediaItemToAudioTrack);
      setPlatformAudioTracks(tracks);
    } catch (error) {
      setPlatformAudioError(error.message || 'Unable to load platform audio.');
      setPlatformAudioTracks([]);
    } finally {
      setPlatformAudioLoading(false);
    }
  }, []);

  const openAudioDialog = useCallback(() => {
    setShowAudioDialog(true);
    setAudioDialogTab('platform');
    void fetchPlatformAudioTracks();
  }, [fetchPlatformAudioTracks]);

  const handleAudioDialogTabChange = useCallback((tab) => {
    setAudioDialogTab(tab);
    if (tab === 'platform') {
      void fetchPlatformAudioTracks();
    }
  }, [fetchPlatformAudioTracks]);

  const playPreviewAudio = useCallback(async (startTime = 0, audioTrack = null) => {
    // Callers can pass an explicit track; otherwise fall back to selectedAudio.
    // We read selectedAudio via the ref-free closure here, but callers can
    // override by passing audioTrack.
    const track = audioTrack;
    stopPreviewAudio();
    if (!track) return;

    if ((track.sourceType === 'upload' || track.sourceType === 'library') && track.url) {
      const audio = new Audio(track.url);
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

    if (track.sourceType === 'generated') {
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
      oscillator.frequency.value = track.frequency || 180;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillatorRef.current = oscillator;
      gainRef.current = gain;
    }
  }, [stopPreviewAudio]);

  const persistMyAudioTracks = useCallback((tracks) => {
    const tracksToStore = tracks.filter((track) => track.sourceType !== 'upload');
    localStorage.setItem(MY_AUDIO_STORAGE_KEY, JSON.stringify(tracksToStore));
  }, []);

  const savePlatformAudioToMyAudio = useCallback((track) => {
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
  }, [persistMyAudioTracks]);

  const selectAudioTrack = useCallback((track, isPlaying, previewCurrentTime) => {
    setSelectedAudio(track);
    if (isPlaying) {
      void playPreviewAudio(previewCurrentTime, track).catch((audioErr) => {
        console.error('Failed to play selected preview audio:', audioErr);
      });
    }
  }, [playPreviewAudio]);

  const clearSelectedAudio = useCallback(() => {
    setSelectedAudio(null);
    stopPreviewAudio();
  }, [stopPreviewAudio]);

  const handleAudioUpload = useCallback((e, isPlaying, previewCurrentTime) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      e.target.value = '';
      return 'Please upload an audio file.';
    }

    const audioUrl = URL.createObjectURL(file);
    audioObjectUrlsRef.current.push(audioUrl);

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
    selectAudioTrack(uploadedTrack, isPlaying, previewCurrentTime);
    e.target.value = '';
    return null;
  }, [selectAudioTrack]);

  return {
    selectedAudio,
    showAudioDialog,
    setShowAudioDialog,
    openAudioDialog,
    audioDialogTab,
    setAudioDialogTab: handleAudioDialogTabChange,
    platformAudioTracks,
    platformAudioLoading,
    platformAudioError,
    refreshPlatformAudioTracks: fetchPlatformAudioTracks,
    myAudioTracks,
    stopPreviewAudio,
    playPreviewAudio,
    selectAudioTrack,
    clearSelectedAudio,
    savePlatformAudioToMyAudio,
    handleAudioUpload,
  };
};
