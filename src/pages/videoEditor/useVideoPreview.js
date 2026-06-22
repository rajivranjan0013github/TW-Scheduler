import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Manages dual-video sequential preview playback.
 * Fixes the stale-closure bug by using isPlayingRef for setTimeout callbacks.
 */
export const useVideoPreview = ({ stopPreviewAudio, playPreviewAudio, selectedAudio }) => {
  const [activeVideo, setActiveVideo] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewTotalTime, setPreviewTotalTime] = useState(0);

  const video1Ref = useRef(null);
  const video2Ref = useRef(null);
  const videoDurationsRef = useRef({ input1: 0, input2: 0 });

  // Keep a ref in sync with isPlaying to avoid stale closures in setTimeout
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const updatePreviewTime = useCallback(() => {
    const clip1Duration = videoDurationsRef.current.input1 || 0;
    const clip1Current = video1Ref.current?.currentTime || 0;
    const clip2Current = video2Ref.current?.currentTime || 0;
    setPreviewCurrentTime(activeVideo === 1 ? clip1Current : clip1Duration + clip2Current);
  }, [activeVideo]);

  const handleLoadedMetadata = useCallback((inputKey, e) => {
    const duration = e.target.duration;
    videoDurationsRef.current[inputKey] = Number.isFinite(duration) && duration > 0 ? duration : 0;
    setPreviewTotalTime(videoDurationsRef.current.input1 + videoDurationsRef.current.input2);
  }, []);

  const handleVideo1Ended = useCallback(() => {
    setActiveVideo(2);
    setPreviewCurrentTime(videoDurationsRef.current.input1 || 0);
    setTimeout(() => {
      if (video2Ref.current && isPlayingRef.current) {
        video2Ref.current.currentTime = 0;
        video2Ref.current.play();
      }
    }, 50);
  }, []);

  const handleVideo2Ended = useCallback(() => {
    setActiveVideo(1);
    setPreviewCurrentTime(0);
    if (isPlayingRef.current && selectedAudio) {
      void playPreviewAudio(0);
    }
    setTimeout(() => {
      if (video1Ref.current && isPlayingRef.current) {
        video1Ref.current.currentTime = 0;
        video1Ref.current.play();
      }
    }, 50);
  }, [selectedAudio, playPreviewAudio]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      if (video1Ref.current) video1Ref.current.pause();
      if (video2Ref.current) video2Ref.current.pause();
      stopPreviewAudio();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      try {
        await playPreviewAudio();
      } catch (audioErr) {
        console.error('Failed to play selected preview audio:', audioErr);
      }
      if (activeVideo === 1) {
        if (video1Ref.current) video1Ref.current.play();
      } else {
        if (video2Ref.current) video2Ref.current.play();
      }
    }
  }, [isPlaying, activeVideo, stopPreviewAudio, playPreviewAudio]);

  const resetPlayback = useCallback(() => {
    setIsPlaying(false);
    setPreviewCurrentTime(0);
    stopPreviewAudio();
  }, [stopPreviewAudio]);

  const resetDurations = useCallback(() => {
    videoDurationsRef.current = { input1: 0, input2: 0 };
    setPreviewTotalTime(0);
  }, []);

  return {
    activeVideo,
    setActiveVideo,
    isPlaying,
    previewCurrentTime,
    previewTotalTime,
    video1Ref,
    video2Ref,
    videoDurationsRef,
    togglePlay,
    updatePreviewTime,
    handleLoadedMetadata,
    handleVideo1Ended,
    handleVideo2Ended,
    resetPlayback,
    resetDurations,
  };
};
