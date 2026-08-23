const createId = () => globalThis.crypto?.randomUUID?.() || `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getMediaType = (file) => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  return null;
};

export const readTimedMediaMetadata = (url, type = 'video') => new Promise((resolve) => {
  if (!url) {
    resolve({ duration: 0, width: 0, height: 0 });
    return;
  }
  const element = document.createElement(type === 'audio' ? 'audio' : 'video');
  element.preload = 'metadata';
  let settled = false;
  const timeoutId = setTimeout(() => {
    if (!settled) {
      settled = true;
      cleanup();
      resolve({ duration: 0, width: 0, height: 0 });
    }
  }, 10000);

  const cleanup = () => {
    clearTimeout(timeoutId);
    element.removeAttribute('src');
    element.load?.();
  };

  element.onloadedmetadata = () => {
    if (settled) return;
    settled = true;
    const metadata = {
      duration: Number.isFinite(element.duration) ? element.duration : 0,
      width: type === 'video' ? (element.videoWidth || 0) : 0,
      height: type === 'video' ? (element.videoHeight || 0) : 0,
    };
    cleanup();
    resolve(metadata);
  };

  element.onerror = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve({ duration: 0, width: 0, height: 0 });
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
