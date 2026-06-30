import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Folder, Loader2, Play, X, Search, Video } from 'lucide-react';
import { API_BASE_URL } from './videoEditorConstants';
import { getActiveCampaignId, withCampaignScope } from '../../utils/campaignScope';
import { getProxiedMediaUrl } from '../../utils/mediaUrls';

const proxiedMediaUrl = (url) => getProxiedMediaUrl(url, API_BASE_URL);
const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');

const naturalFileCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const getThumbnailUrl = (item) => {
  const url = item.thumbnailUrl || item.thumbnail || item.previewUrl || '';
  return url ? proxiedMediaUrl(url) : '';
};

const VideoPickerPreview = ({ item }) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailUrl = getThumbnailUrl(item);

  if (thumbnailUrl && !thumbnailFailed) {
    return (
      <img
        src={thumbnailUrl}
        alt={item.name || 'Video thumbnail'}
        loading="lazy"
        onError={() => setThumbnailFailed(true)}
        className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-900 px-3 text-center text-white/70">
      <Video className="h-8 w-8" />
      <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">No thumbnail</span>
    </div>
  );
};

const getFolderParentId = (folder) => normalizeFolderId(folder.parentFolderId) || 'root';

const buildFolderRows = (folders, parentId = 'root', depth = 0, query = '') => {
  const children = folders
    .filter((folder) => getFolderParentId(folder) === parentId)
    .sort((a, b) => naturalFileCollator.compare(a.name || '', b.name || ''));

  return children.flatMap((folder) => {
    const childRows = buildFolderRows(folders, folder._id, depth + 1, query);
    const matchesSearch = !query || (folder.name || '').toLowerCase().includes(query);
    return matchesSearch || childRows.length > 0
      ? [{ folder, depth }, ...childRows]
      : [];
  });
};

export const VideoLibraryPickerDialog = ({
  slotLabel,
  token,
  onClose,
  onSelectVideo,
}) => {
  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [media, setMedia] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  const [error, setError] = useState('');
  const [thumbnailMessage, setThumbnailMessage] = useState('');
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  const headers = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const filteredFolders = useMemo(() => {
    const query = folderSearchQuery.trim().toLowerCase();
    const rootFolders = folders
      .filter((folder) => getFolderParentId(folder) === 'root')
      .sort((a, b) => naturalFileCollator.compare(a.name || '', b.name || ''));
    if (!query) return rootFolders.map((folder) => ({ folder, depth: 0 }));
    return rootFolders
      .filter((folder) => (folder.name || '').toLowerCase().includes(query))
      .map((folder) => ({ folder, depth: 0 }));
  }, [folders, folderSearchQuery]);

  const activeChildFolders = useMemo(() => {
    if (!activeFolderId) return [];
    return folders
      .filter((folder) => getFolderParentId(folder) === activeFolderId)
      .sort((a, b) => naturalFileCollator.compare(a.name || '', b.name || ''));
  }, [activeFolderId, folders]);

  const breadcrumbPath = useMemo(() => {
    if (!activeFolderId) return [];
    const crumbs = [];
    let currentId = activeFolderId;
    const folderMap = new Map(folders.map((f) => [f._id, f]));
    const visited = new Set();
    while (currentId && currentId !== 'root' && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = folderMap.get(currentId);
      if (!folder) break;
      crumbs.unshift({ id: folder._id, name: folder.name || 'Untitled' });
      currentId = normalizeFolderId(folder.parentFolderId) || 'root';
    }
    crumbs.unshift({ id: 'root', name: 'Library Root' });
    return crumbs;
  }, [activeFolderId, folders]);

  useEffect(() => {
    const loadFolders = async () => {
      setLoadingFolders(true);
      setError('');

      try {
        const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, { headers });
        if (!response.ok) throw new Error('Unable to load folders.');

        const folderData = await response.json();
        setFolders(Array.isArray(folderData) ? folderData : []);
      } catch (err) {
        setError(err.message || 'Unable to load folders.');
      } finally {
        setLoadingFolders(false);
      }
    };

    void loadFolders();
  }, [headers]);

  const openFolder = useCallback(async (folderId, folderName) => {
    setActiveFolderId(folderId);
    setActiveFolderName(folderName);
    setLoadingMedia(true);
    setError('');
    setThumbnailMessage('');

    try {
      const params = new URLSearchParams();
      const campaignId = getActiveCampaignId();
      if (campaignId) params.set('campaignId', campaignId);
      params.set('folderId', folderId);
      const response = await fetch(`${API_BASE_URL}/api/media?${params.toString()}`, { headers });
      if (!response.ok) throw new Error('Unable to load folder content.');

      const mediaData = await response.json();
      const videoItems = Array.isArray(mediaData)
        ? mediaData.filter((item) => item.type === 'video' && item.url)
        : [];
      setMedia(videoItems);
    } catch (err) {
      setError(err.message || 'Unable to load folder content.');
      setMedia([]);
    } finally {
      setLoadingMedia(false);
    }
  }, [headers]);

  const mediaMissingThumbnails = useMemo(() => (
    media.some((item) => !getThumbnailUrl(item))
  ), [media]);

  const handleGenerateThumbnails = useCallback(async () => {
    if (!activeFolderId || generatingThumbnails) return;

    try {
      setGeneratingThumbnails(true);
      setError('');
      setThumbnailMessage('');

      const response = await fetch(`${API_BASE_URL}/api/media/thumbnails/backfill${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId: activeFolderId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Unable to generate thumbnails.');
      }

      await openFolder(activeFolderId, activeFolderName || 'Library Root');
      setThumbnailMessage(`${data.generated || 0} thumbnails generated.`);
    } catch (err) {
      setError(err.message || 'Unable to generate thumbnails.');
    } finally {
      setGeneratingThumbnails(false);
    }
  }, [activeFolderId, activeFolderName, generatingThumbnails, headers, openFolder]);

  const handleSelectVideo = useCallback((item) => {
    onSelectVideo({
      id: item._id,
      name: item.name || 'Library video',
      sourceType: 'library',
      url: proxiedMediaUrl(item.url),
      originalUrl: item.url,
    });
  }, [onSelectVideo]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex h-[78vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
          <div>
            <h3 className="text-sm font-bold text-gray-950">
              {slotLabel?.includes('First') ? 'Select First Video' : 'Select Second Video'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video picker"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_1fr]">
          <aside className="min-h-0 overflow-y-auto border-r border-gray-100 bg-gray-50 p-4 flex flex-col">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Folders</p>

            <div className="mb-3 relative">
              <input
                type="text"
                value={folderSearchQuery}
                onChange={(e) => setFolderSearchQuery(e.target.value)}
                placeholder="Search folders..."
                className="w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 py-1 text-[11px] font-semibold outline-none focus:border-[#ff5500] focus:ring-1 focus:ring-[#ff5500]/10 transition-all text-gray-950"
              />
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
            </div>

            {loadingFolders ? (
              <div className="flex items-center gap-2 rounded-lg bg-white p-3 text-xs font-semibold text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading folders...
              </div>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                <button
                  type="button"
                  onClick={() => openFolder('root', 'Library Root')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
                    activeFolderId === 'root' ? 'bg-[#ff5500] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  Library Root
                </button>

                {filteredFolders.map(({ folder, depth }) => (
                  <button
                    key={folder._id}
                    type="button"
                    onClick={() => openFolder(folder._id, folder.name)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
                      activeFolderId === folder._id ? 'bg-[#ff5500] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                    style={{ paddingLeft: `${12 + depth * 14}px` }}
                  >
                    <Folder className="h-4 w-4" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="min-h-0 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              {/* Breadcrumb path */}
              <div className="flex items-center gap-1 flex-wrap text-[11px] min-w-0">
                {breadcrumbPath.map((crumb, idx) => {
                  const isLast = idx === breadcrumbPath.length - 1;
                  return (
                    <span key={crumb.id} className="flex items-center gap-1">
                      {idx > 0 && <ChevronRight className="h-3 w-3 text-gray-300 flex-shrink-0" />}
                      {isLast ? (
                        <span className="font-bold text-gray-900">{crumb.name}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openFolder(crumb.id, crumb.name)}
                          className="font-semibold text-gray-500 hover:text-[#ff5500] transition-colors"
                        >
                          {crumb.name}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {activeFolderId && media.length > 0 && mediaMissingThumbnails && (
                  <button
                    type="button"
                    onClick={handleGenerateThumbnails}
                    disabled={generatingThumbnails}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingThumbnails ? 'Generating...' : 'Generate Thumbnails'}
                  </button>
                )}
                {activeFolderId && (
                  <span className="text-[11px] font-semibold text-gray-400">{media.length} videos</span>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {error}
              </div>
            )}
            {thumbnailMessage && (
              <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-3 text-xs font-semibold text-green-700">
                {thumbnailMessage}
              </div>
            )}

            {!activeFolderId ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400">
                Select a folder to view videos.
              </div>
            ) : loadingMedia ? (
              <div className="flex h-full min-h-[260px] items-center justify-center gap-2 rounded-xl border border-gray-100 text-sm font-semibold text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading videos...
              </div>
            ) : media.length === 0 && activeChildFolders.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400">
                No videos found in this folder.
              </div>
            ) : (
              <div className="space-y-5">
                {activeChildFolders.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {activeChildFolders.map((folder) => (
                      <button
                        key={folder._id}
                        type="button"
                        onClick={() => openFolder(folder._id, folder.name)}
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-bold text-gray-700 transition-colors hover:border-[#ff5500]/40 hover:bg-white"
                      >
                        <Folder className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {media.length === 0 ? (
                  <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400">
                    Open a child folder to view its videos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {media.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => handleSelectVideo(item)}
                        className="group relative overflow-hidden rounded-xl border border-gray-200 bg-black text-left shadow-sm transition-all hover:border-[#ff5500]/60 hover:shadow-md"
                      >
                        <div className="relative aspect-[9/16]">
                          <VideoPickerPreview item={item} />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/5 text-white opacity-90 transition-opacity group-hover:opacity-100">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
                              <Play className="h-4 w-4 fill-current" />
                            </span>
                          </span>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5">
                            <p className="truncate text-[10px] font-bold text-white shadow-sm" title={item.name}>
                              {item.name || 'Untitled video'}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
