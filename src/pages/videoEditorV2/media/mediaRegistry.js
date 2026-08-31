import { getMediaUrl } from '../../../utils/mediaUrls';
import { API_BASE_URL } from '../../videoEditor/videoEditorConstants';

const createId = () => globalThis.crypto?.randomUUID?.() || `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getMediaType = (file) => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  return null;
};

let audioCtxSingleton = null;
const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtxSingleton || audioCtxSingleton.state === 'closed') {
    audioCtxSingleton = new AudioContextClass();
  }
  return audioCtxSingleton;
};

export const readAudioDurationViaWebAudio = async (url) => {
  if (!url || typeof window === 'undefined') return 0;
  const audioCtx = getAudioContext();
  if (!audioCtx) return 0;

  const tryDecode = async (fetchUrl) => {
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) return 0;
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) return 0;
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const duration = Number(audioBuffer?.duration);
      return Number.isFinite(duration) && duration > 0 ? duration : 0;
    } catch {
      return 0;
    }
  };

  let duration = await tryDecode(url);
  if (duration > 0) return duration;

  const proxyUrl = getMediaUrl(url, { proxy: true, apiBaseUrl: API_BASE_URL });
  if (proxyUrl && proxyUrl !== url) {
    duration = await tryDecode(proxyUrl);
    if (duration > 0) return duration;
  }

  return 0;
};

export const readTimedMediaMetadata = (url, type = 'video') => new Promise((resolve) => {
  if (!url) {
    resolve({ duration: 0, width: 0, height: 0 });
    return;
  }
  const element = document.createElement(type === 'audio' ? 'audio' : 'video');
  element.preload = 'metadata';
  element.crossOrigin = 'anonymous';
  let settled = false;

  const cleanup = () => {
    clearTimeout(timeoutId);
    element.removeAttribute('src');
    element.load?.();
  };

  const finishWithFallback = async () => {
    if (settled) return;
    settled = true;
    cleanup();

    if (type === 'audio') {
      const webAudioDuration = await readAudioDurationViaWebAudio(url);
      if (webAudioDuration > 0) {
        resolve({ duration: webAudioDuration, width: 0, height: 0 });
        return;
      }
    }
    resolve({ duration: 0, width: 0, height: 0 });
  };

  const timeoutId = setTimeout(() => {
    void finishWithFallback();
  }, 6000);

  const handleLoaded = () => {
    if (settled) return;
    const dur = Number(element.duration);
    if (Number.isFinite(dur) && dur > 0) {
      settled = true;
      const metadata = {
        duration: dur,
        width: type === 'video' ? (element.videoWidth || 0) : 0,
        height: type === 'video' ? (element.videoHeight || 0) : 0,
      };
      cleanup();
      resolve(metadata);
    } else if (type === 'audio') {
      void finishWithFallback();
    }
  };

  element.onloadedmetadata = handleLoaded;
  element.ondurationchange = handleLoaded;
  element.oncanplay = handleLoaded;

  element.onerror = () => {
    void finishWithFallback();
  };

  element.src = url;
});

const readImageMetadata = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, duration: 5 });
  image.onerror = () => reject(new Error('Unable to read image metadata.'));
  image.src = url;
});

export const createAssetFromFile = async (file) => {
  const type = getMediaType(file);
  if (!type) throw new Error(`${file.name} is not a supported video, audio, or image file.`);
  const url = URL.createObjectURL(file);

  try {
    const metadata = type === 'image'
      ? await readImageMetadata(url)
      : await readTimedMediaMetadata(url, type);
    return {
      id: createId(),
      mediaId: '',
      sourceType: 'upload',
      type,
      name: file.name,
      url,
      file,
      mimeType: file.type,
      size: file.size,
      ...metadata,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

export const createLibraryAsset = async (item) => {
  const url = item.url || item.sourceUrl;
  const type = item.type || 'video';
  let metadata = {
    duration: Number(item.duration || 0),
    width: Number(item.width || 0),
    height: Number(item.height || 0),
  };

  if (!metadata.duration && ['video', 'audio'].includes(type)) {
    try {
      metadata = { ...metadata, ...await readTimedMediaMetadata(url, type) };
    } catch {
      // The exporter will validate unreadable remote sources again.
    }
  }

  if (type === 'audio' && (!metadata.duration || metadata.duration <= 0) && url) {
    try {
      const audioDuration = await readAudioDurationViaWebAudio(url);
      if (audioDuration > 0) {
        metadata.duration = audioDuration;
      }
    } catch {
      // Fallback handled downstream
    }
  }

  return {
    id: item.id || item.mediaId || createId(),
    mediaId: item.mediaId || item.id || '',
    sourceType: 'library',
    type,
    name: item.name || 'Library media',
    url,
    originalUrl: item.originalUrl || url,
    mimeType: item.mimeType || '',
    ...metadata,
  };
};

export const createGeneratedAudioAsset = ({ blob, fileName, duration }) => {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The extracted MP3 file is empty.');
  }
  const name = String(fileName || 'extracted-audio.mp3');
  const file = new File([blob], name, { type: 'audio/mpeg' });

  return {
    id: createId(),
    mediaId: '',
    sourceType: 'upload',
    type: 'audio',
    name,
    url: URL.createObjectURL(file),
    file,
    mimeType: 'audio/mpeg',
    size: file.size,
    duration: Math.max(0, Number(duration) || 0),
    width: 0,
    height: 0,
  };
};

export const revokeAssetUrl = (asset) => {
  if (asset?.sourceType === 'upload' && asset.url?.startsWith('blob:')) {
    URL.revokeObjectURL(asset.url);
  }
};
