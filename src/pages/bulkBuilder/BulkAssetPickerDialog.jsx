import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, Folder, Loader2, X, Music, CheckSquare, Square, Check, Layers, Search } from 'lucide-react';
import { API_BASE_URL, PLATFORM_AUDIO_FOLDER_ID } from '../videoEditor/videoEditorConstants';
import { getActiveCampaignId, withCampaignScope } from '../../utils/campaignScope';
import { getMediaUrl } from '../../utils/mediaUrls';
import LoadingVideoPreview from '../../components/LoadingVideoPreview';

const mediaUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const getFolderParentId = (folder) => normalizeFolderId(folder.parentFolderId) || 'root';

const naturalFileCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export const BulkAssetPickerDialog = ({
  token,
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState('video1'); // 'video1' | 'video2' | 'audio'

  // Folder & Media state for videos
  const [folders, setFolders] = useState([]);
  const [folderSearch, setFolderSearch] = useState('');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [media, setMedia] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState('');

  // Audio state
  const [audioTracks, setAudioTracks] = useState([]);
  const [myAudioTracks, setMyAudioTracks] = useState([]);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Multi-select state
  const [selectedVideo1, setSelectedVideo1] = useState([]);
  const [selectedVideo2, setSelectedVideo2] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState([]);

  const headers = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token]);

  const filteredFolders = useMemo(() => {
    const query = folderSearch.trim().toLowerCase();
    const rootFolders = folders
      .filter((folder) => getFolderParentId(folder) === 'root')
      .sort((a, b) => naturalFileCollator.compare(a.name || '', b.name || ''));
    if (!query) return rootFolders;
    return rootFolders.filter((folder) => (folder.name || '').toLowerCase().includes(query));
  }, [folderSearch, folders]);

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
      if (!response.ok) throw new Error('Unable to load content.');
      const mediaData = await response.json();
      const videoItems = Array.isArray(mediaData)
        ? mediaData.filter((item) => item.type === 'video' && item.url)
        : [];
      setMedia(videoItems);
    } catch (err) {
      setError(err.message || 'Unable to load folder contents.');
      setMedia([]);
    } finally {
      setLoadingMedia(false);
    }
  }, [headers]);

  // Load folders for video library
  useEffect(() => {
    const loadFolders = async () => {
      setLoadingFolders(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, { headers });
        if (!response.ok) throw new Error('Unable to load folders.');
        const folderData = await response.json();
        const list = Array.isArray(folderData) ? folderData : [];
        setFolders(list);
        openFolder('root', 'Library Root');
      } catch (err) {
        setError(err.message || 'Unable to load folders.');
      } finally {
        setLoadingFolders(false);
      }
    };
    void loadFolders();
  }, [headers, openFolder]);

  // Load platform audio
  useEffect(() => {
    const loadAudio = async () => {
      setLoadingAudio(true);
      try {
        const params = new URLSearchParams();
        const campaignId = getActiveCampaignId();
        if (campaignId) params.set('campaignId', campaignId);
        params.set('folderId', PLATFORM_AUDIO_FOLDER_ID);
        const response = await fetch(`${API_BASE_URL}/api/media?${params.toString()}`, { headers });
        if (!response.ok) throw new Error('Unable to load audio tracks.');
        const items = await response.json();
        const list = Array.isArray(items) ? items.filter((i) => i.url) : [];
        const tracks = list.map((item) => ({
          id: `platform-${item._id}`,
          mediaId: item._id,
          name: item.name || 'Platform audio',
          sourceType: 'library',
          url: mediaUrl(item.url),
          originalUrl: item.url,
        }));
        setAudioTracks(tracks);

        // Load my audio tracks from localStorage
        const savedTracks = JSON.parse(localStorage.getItem('tw_video_editor_my_audio') || '[]');
        setMyAudioTracks(Array.isArray(savedTracks) ? savedTracks : []);
      } catch (err) {
        console.error('Error loading audio:', err);
      } finally {
        setLoadingAudio(false);
      }
    };
    void loadAudio();
  }, [headers]);

  // Handle toggling items
  const handleToggleVideo = (item, slot) => {
    const videoObj = {
      id: item._id,
      name: item.name || 'Library video',
      sourceType: 'library',
      url: mediaUrl(item.url),
      originalUrl: item.url,
    };

    if (slot === 'video1') {
      setSelectedVideo1((prev) => {
        const exists = prev.some((v) => v.id === item._id);
        if (exists) return prev.filter((v) => v.id !== item._id);
        return [...prev, videoObj];
      });
    } else {
      setSelectedVideo2((prev) => {
        const exists = prev.some((v) => v.id === item._id);
        if (exists) return prev.filter((v) => v.id !== item._id);
        return [...prev, videoObj];
      });
    }
  };

  const handleSelectAllVideosInFolder = () => {
    const slot = activeTab;
    const videoObjs = media.map((item) => ({
      id: item._id,
      name: item.name || 'Library video',
      sourceType: 'library',
      url: mediaUrl(item.url),
      originalUrl: item.url,
    }));

    if (slot === 'video1') {
      setSelectedVideo1((prev) => {
        const merged = [...prev];
        videoObjs.forEach((video) => {
          if (!merged.some((item) => item.id === video.id)) merged.push(video);
        });
        return merged;
      });
    } else {
      setSelectedVideo2((prev) => {
        const merged = [...prev];
        videoObjs.forEach((video) => {
          if (!merged.some((item) => item.id === video.id)) merged.push(video);
        });
        return merged;
      });
    }
  };

  const handleToggleAudio = (item) => {
    setSelectedAudio((prev) => {
      const exists = prev.some((a) => a.id === item.id);
      if (exists) return prev.filter((a) => a.id !== item.id);
      return [...prev, item];
    });
  };

  const handleConfirm = () => {
    onConfirm({
      video1List: selectedVideo1,
      video2List: selectedVideo2,
      musicList: selectedAudio,
    });
  };

  const isVideoSelected = (item, slot) => {
    const list = slot === 'video1' ? selectedVideo1 : selectedVideo2;
    return list.some((v) => v.id === item._id);
  };

  const isAudioSelected = (item) => {
    return selectedAudio.some((a) => a.id === item.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#18181b] border border-[#2d2d30] shadow-2xl text-[#e0e0e5]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d2d30] px-4 py-2.5 bg-[#121214]">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5" style={{ color: '#ffffff' }}>
              <Layers className="w-4 h-4 text-[#ff5500]" />
              Add Videos &amp; Music
            </h3>
            <p className="mt-0.5 text-[10px] text-gray-400 font-medium" style={{ color: '#a1a1aa' }}>
              Pick First Videos to create rows, or add First Videos, Second Videos, and Music to your temporary quick library.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-[#27272a] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#2d2d30] px-4 bg-[#18181b]">
          <button
            type="button"
            onClick={() => setActiveTab('video1')}
            className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'video1'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            1. First Video ({selectedVideo1.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video2')}
            className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'video2'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            2. Second Video ({selectedVideo2.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'audio'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            3. Music ({selectedAudio.length})
          </button>
        </div>

        {/* Main Area */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr] bg-[#18181b]">
          {/* Left Sidebar (Only for video tabs) */}
          {activeTab !== 'audio' ? (
            <aside className="min-h-0 overflow-y-auto border-r border-[#2d2d30] bg-[#121214] p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Folders</p>
              <label className="mb-3 flex items-center gap-2 rounded-lg border border-[#2d2d30] bg-[#18181b] px-3 py-2 text-gray-400 focus-within:border-[#ff5500]/60">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  type="search"
                  value={folderSearch}
                  onChange={(event) => setFolderSearch(event.target.value)}
                  placeholder="Search folders"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-gray-600"
                />
              </label>
              {loadingFolders ? (
                <div className="flex items-center gap-2 rounded-lg bg-[#27272a] p-3 text-xs font-semibold text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => openFolder('root', 'Library Root')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      activeFolderId === 'root' ? 'bg-[#ff5500] text-white shadow-sm' : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46] hover:text-white border border-[#2d2d30]'
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
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                        activeFolderId === folder._id ? 'bg-[#ff5500] text-white shadow-sm' : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46] hover:text-white border border-[#2d2d30]'
                      }`}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                  {folderSearch.trim() && filteredFolders.length === 0 && (
                    <div className="rounded-lg border border-dashed border-[#2d2d30] px-3 py-4 text-center text-[11px] font-semibold text-gray-500">
                      No folders found.
                    </div>
                  )}
                </div>
              )}
            </aside>
          ) : (
            <aside className="min-h-0 border-r border-[#2d2d30] bg-[#121214] p-4">
              <div className="p-3 bg-orange-955/20 border border-orange-900/40 rounded-xl text-orange-400">
                <Music className="w-5 h-5 text-orange-500 mb-2" />
                <p className="text-[11px] font-bold uppercase">Music Catalog</p>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Select background tracks to add to your temporary quick-selection library.
                </p>
              </div>
            </aside>
          )}

          {/* Right Main Grid */}
          <main className="min-h-0 overflow-y-auto p-6 bg-[#18181b]">
            {error && (
              <div className="mb-4 rounded-lg border border-red-950/40 bg-red-950/20 p-3 text-xs font-semibold text-red-400">
                {error}
              </div>
            )}

            {activeTab !== 'audio' ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  {/* Breadcrumb path */}
                  <div className="flex items-center gap-1 flex-wrap text-[11px] min-w-0">
                    {breadcrumbPath.map((crumb, idx) => {
                      const isLast = idx === breadcrumbPath.length - 1;
                      return (
                        <span key={crumb.id} className="flex items-center gap-1">
                          {idx > 0 && <ChevronRight className="h-3 w-3 text-gray-600 flex-shrink-0" />}
                          {isLast ? (
                            <span className="font-bold text-white">{crumb.name}</span>
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
                    {activeFolderId && (
                      <>
                        <span className="text-[11px] font-semibold text-gray-500">{media.length} videos</span>
                        {media.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectAllVideosInFolder}
                            className="rounded-lg border border-[#2d2d30] bg-[#27272a] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#3f3f46] active:scale-95"
                          >
                            Select All
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {!activeFolderId ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-[#2d2d30] text-sm font-semibold text-gray-500">
                    Select a folder to view videos.
                  </div>
                ) : loadingMedia ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center gap-2 rounded-xl border border-[#2d2d30] text-sm font-semibold text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading videos...
                  </div>
                ) : media.length === 0 && activeChildFolders.length === 0 ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-[#2d2d30] text-sm font-semibold text-gray-500">
                    No videos found in this folder.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {activeChildFolders.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {activeChildFolders.map((folder) => (
                          <button
                            key={folder._id}
                            type="button"
                            onClick={() => openFolder(folder._id, folder.name)}
                            className="flex items-center gap-2 rounded-xl border border-[#2d2d30] bg-[#27272a] px-3 py-3 text-left text-xs font-bold text-gray-300 transition-colors hover:border-[#ff5500]/40 hover:bg-[#3f3f46] hover:text-white"
                          >
                            <Folder className="h-4 w-4 text-gray-500" />
                            <span className="truncate">{folder.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                  {media.length === 0 ? (
                    <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[#2d2d30] text-sm font-semibold text-gray-500">
                      Open a child folder to view its videos.
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {media.map((item) => {
                      const selected = isVideoSelected(item, activeTab);
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => handleToggleVideo(item, activeTab)}
                          className={`overflow-hidden rounded-xl border text-left shadow-sm transition-all hover:shadow-md relative ${
                            selected ? 'border-[#ff5500] ring-2 ring-[#ff5500]/20' : 'border-[#2d2d30] hover:border-[#3a3a3c]'
                          }`}
                        >
                          <div className="relative aspect-[9/16] bg-zinc-900">
                            <LoadingVideoPreview
                              src={mediaUrl(item.url)}
                              className="absolute inset-0"
                              videoClassName="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              crossOrigin="anonymous"
                              onMouseEnter={(e) => {
                                e.currentTarget.muted = false;
                                e.currentTarget.play().catch((err) => {
                                  console.warn('Autoplay with audio blocked by browser policy:', err);
                                });
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
                            />
                            {/* Checkbox badge */}
                            <div className="absolute top-2.5 right-2.5 z-10">
                              {selected ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff5500] text-white">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40 border border-white text-white">
                                </div>
                              )}
                            </div>
                            {/* Bottom Title Overlay */}
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-[2px] rounded text-[8px] font-bold text-gray-300 truncate px-1 py-0.5 text-center z-10" title={item.name}>
                              {item.name || 'Untitled video'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  )}
                  </div>
                )}
              </>
            ) : (
              // Audio Tab
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3" style={{ color: '#71717a' }}>Platform Music Tracks</h4>
                  {loadingAudio ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading tracks...
                    </div>
                  ) : audioTracks.length === 0 ? (
                    <div className="text-xs text-gray-400 font-medium">No tracks found.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {audioTracks.map((item) => {
                        const selected = isAudioSelected(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleToggleAudio(item)}
                            className={`flex items-center justify-between rounded-xl border p-3.5 text-left text-xs font-semibold transition-all hover:shadow-sm ${
                              selected
                                ? 'border-[#ff5500] bg-[#ff5500]/10 text-[#ff5500]'
                                : 'border-[#2d2d30] bg-[#121214] text-white hover:border-[#3a3a3c]'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Music className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-[#ff5500]' : 'text-gray-500'}`} />
                              <span className="truncate">{item.name}</span>
                            </span>
                            {selected ? (
                              <CheckSquare className="w-4 h-4 text-[#ff5500] flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {myAudioTracks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3" style={{ color: '#71717a' }}>My Uploaded Tracks</h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {myAudioTracks.map((item) => {
                        const selected = isAudioSelected(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleToggleAudio(item)}
                            className={`flex items-center justify-between rounded-xl border p-3.5 text-left text-xs font-semibold transition-all hover:shadow-sm ${
                              selected
                                ? 'border-[#ff5500] bg-[#ff5500]/10 text-[#ff5500]'
                                : 'border-[#2d2d30] bg-[#121214] text-white hover:border-[#3a3a3c]'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Music className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-[#ff5500]' : 'text-gray-500'}`} />
                              <span className="truncate">{item.name}</span>
                            </span>
                            {selected ? (
                              <CheckSquare className="w-4 h-4 text-[#ff5500] flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Footer Summary & Confirm */}
        <div className="border-t border-[#2d2d30] px-4 py-2.5 bg-[#121214] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-400">
            <span>Selected First Videos: <strong className="text-white">{selectedVideo1.length}</strong></span>
            <span>Selected Second Videos: <strong className="text-white">{selectedVideo2.length}</strong></span>
            <span>Selected Music: <strong className="text-white">{selectedAudio.length}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[#2d2d30] bg-[#27272a] hover:bg-[#3f3f46] text-gray-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedVideo1.length === 0 && selectedVideo2.length === 0 && selectedAudio.length === 0}
              className="px-3 py-1.5 bg-[#ff5500] hover:bg-orange-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider shadow-sm"
            >
              Confirm &amp; Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
