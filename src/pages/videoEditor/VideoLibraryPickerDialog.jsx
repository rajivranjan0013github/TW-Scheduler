import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder, Loader2, Play, X, Search } from 'lucide-react';
import { API_BASE_URL } from './videoEditorConstants';
import { getActiveCampaignId, withCampaignScope } from '../../utils/campaignScope';

const proxiedMediaUrl = (url) => `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;

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
  const [error, setError] = useState('');
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  const headers = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const filteredFolders = useMemo(() => {
    if (!folderSearchQuery.trim()) return folders;
    const query = folderSearchQuery.toLowerCase();
    return folders.filter((f) => f.name?.toLowerCase().includes(query));
  }, [folders, folderSearchQuery]);

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

                {filteredFolders.map((folder) => (
                  <button
                    key={folder._id}
                    type="button"
                    onClick={() => openFolder(folder._id, folder.name)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
                      activeFolderId === folder._id ? 'bg-[#ff5500] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Folder className="h-4 w-4" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="min-h-0 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">
                {activeFolderName || 'Choose a folder'}
              </h4>
              {activeFolderId && (
                <span className="text-[11px] font-semibold text-gray-400">{media.length} videos</span>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {error}
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
            ) : media.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400">
                No videos found in this folder.
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
                      <video
                        src={proxiedMediaUrl(item.url)}
                        className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                        muted
                        preload="metadata"
                      />
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
          </main>
        </div>
      </div>
    </div>
  );
};
