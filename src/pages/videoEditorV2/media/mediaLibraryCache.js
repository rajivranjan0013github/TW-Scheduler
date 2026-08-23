import { API_BASE_URL } from '../../videoEditor/videoEditorConstants';

export const MEDIA_LIBRARY_STALE_TIME = 5 * 60 * 1000;
export const MEDIA_LIBRARY_GC_TIME = 60 * 60 * 1000;

const LAST_FOLDER_PREFIX = 'tw-editor-media-last-folder';
const LAST_FOLDER_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const requestHeaders = (token) => {
  const effectiveToken = token
    || (typeof window !== 'undefined' ? (localStorage.getItem('tw_token') || localStorage.getItem('token')) : null);
  return effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {};
};

const readJson = async (response, fallbackMessage) => {
  if (!response.ok) {
    if (response.status === 404 || response.status === 401 || response.status === 403) {
      return [];
    }
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || fallbackMessage);
  }
  return response.json();
};

export const mediaLibraryKeys = {
  root: ['media-library'],
  allFolders: ['media-library', 'folders'],
  folders: (campaignId) => ['media-library', 'folders', campaignId || ''],
  allMedia: ['media-library', 'media'],
  media: (campaignId, folderId, optionOrPage = false, limit = 50) => {
    if (typeof optionOrPage === 'boolean') {
      return ['media-library', 'media', campaignId || '', folderId || 'root', optionOrPage];
    }
    if (typeof optionOrPage === 'number') {
      return ['media-library', 'media', campaignId || '', folderId || 'root', optionOrPage, limit || 50];
    }
    return ['media-library', 'media', campaignId || '', folderId || 'root'];
  },
};

export const fetchMediaLibraryFolders = async ({ token, campaignId, signal }) => {
  const params = new URLSearchParams();
  if (campaignId) params.set('campaignId', campaignId);
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/api/media/folders${query ? `?${query}` : ''}`,
    { headers: requestHeaders(token), signal },
  );
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return [];
  }
  const payload = await readJson(response, 'Unable to load Media Library folders.');
  return Array.isArray(payload) ? payload : [];
};

export const fetchMediaLibraryFolder = async ({
  token,
  campaignId,
  folderId = 'root',
  includeSubfolders = false,
  signal,
}) => {
  const params = new URLSearchParams();
  if (folderId && folderId !== 'all') {
    params.set('folderId', folderId);
  }
  if (includeSubfolders) {
    params.set('includeSubfolders', 'true');
  }
  if (campaignId) params.set('campaignId', campaignId);
  const response = await fetch(`${API_BASE_URL}/api/media?${params.toString()}`, {
    headers: requestHeaders(token),
    signal,
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return [];
  }
  const payload = await readJson(response, 'Unable to load Media Library files.');
  return Array.isArray(payload)
    ? payload.filter((item) => ['video', 'image', 'audio'].includes(item.type) && item.url)
    : [];
};

const lastFolderKey = (campaignId) => `${LAST_FOLDER_PREFIX}:${campaignId || 'default'}`;

export const readLastMediaFolder = (campaignId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(lastFolderKey(campaignId)) || 'null');
    if (!saved?.folderId || Date.now() - Number(saved.savedAt || 0) > LAST_FOLDER_MAX_AGE) {
      return 'root';
    }
    return String(saved.folderId);
  } catch {
    return 'root';
  }
};

export const saveLastMediaFolder = (campaignId, folderId) => {
  try {
    localStorage.setItem(lastFolderKey(campaignId), JSON.stringify({
      folderId: folderId || 'root',
      savedAt: Date.now(),
    }));
  } catch {
    // Folder navigation still works when browser storage is unavailable.
  }
};
