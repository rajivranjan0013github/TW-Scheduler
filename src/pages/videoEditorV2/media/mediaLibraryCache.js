import { API_BASE_URL } from '../../videoEditor/videoEditorConstants';

export const MEDIA_LIBRARY_STALE_TIME = 5 * 60 * 1000;
export const MEDIA_LIBRARY_GC_TIME = 60 * 60 * 1000;

const LAST_FOLDER_PREFIX = 'tw-editor-media-last-folder';
const LAST_FOLDER_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const requestHeaders = (token) => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

const readJson = async (response, fallbackMessage) => {
  if (!response.ok) {
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
  media: (campaignId, folderId, page, limit) => (
    page !== undefined
      ? ['media-library', 'media', campaignId || '', folderId || 'root', page, limit || 50]
      : ['media-library', 'media', campaignId || '', folderId || 'root']
  ),
};

export const fetchMediaLibraryFolders = async ({ token, campaignId, signal }) => {
  const params = new URLSearchParams();
  if (campaignId) params.set('campaignId', campaignId);
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/api/media/folders${query ? `?${query}` : ''}`,
    { headers: requestHeaders(token), signal },
  );
  const payload = await readJson(response, 'Unable to load Media Library folders.');
  return Array.isArray(payload) ? payload : [];
};

export const fetchMediaLibraryFolder = async ({
  token,
  campaignId,
  folderId = 'root',
  signal,
}) => {
  const params = new URLSearchParams({ folderId: folderId || 'root' });
  if (campaignId) params.set('campaignId', campaignId);
  const response = await fetch(`${API_BASE_URL}/api/media?${params.toString()}`, {
    headers: requestHeaders(token),
    signal,
  });
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
