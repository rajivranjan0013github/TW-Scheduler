/**
 * Generates a JPEG thumbnail Blob from a video File or Blob in the browser.
 * @param {File|Blob} videoFile 
 * @param {Object} options
 * @param {number} [options.seekTime=0.5]
 * @param {number} [options.maxWidth=480]
 * @param {number} [options.quality=0.85]
 * @returns {Promise<Blob|null>}
 */
export const generateVideoThumbnailBlob = (videoFile, { seekTime = 0.5, maxWidth = 480, quality = 0.85 } = {}) => {
  return new Promise((resolve) => {
    if (!videoFile || !videoFile.type || !videoFile.type.startsWith('video/')) {
      return resolve(null);
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    let isResolved = false;
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(null);
      }
    }, 8000); // 8s timeout safeguard

    video.onloadedmetadata = () => {
      // Choose seek time within video duration
      const duration = video.duration || 1;
      const targetTime = Math.min(seekTime, Math.max(0, duration / 2));
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeout);

      try {
        const width = video.videoWidth || 480;
        const height = video.videoHeight || 270;
        const aspect = width / height;

        const targetWidth = Math.min(maxWidth, width);
        const targetHeight = Math.round(targetWidth / aspect);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return resolve(null);
        }

        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      }
    };
  });
};
