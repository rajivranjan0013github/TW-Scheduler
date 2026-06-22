import { useState, useEffect, useMemo, useCallback } from 'react';
import { Folder, Loader2, X, Music, CheckSquare, Square, Check, Layers } from 'lucide-react';
import { API_BASE_URL, PLATFORM_AUDIO_FOLDER_ID } from '../videoEditor/videoEditorConstants';
import { getActiveCampaignId, withCampaignScope } from '../../utils/campaignScope';

const proxiedMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

export const BulkAssetPickerDialog = ({
  token,
  onClose,
  onConfirm,
}) => {
  const [activeTab, setActiveTab] = useState('video1'); // 'video1' | 'video2' | 'audio'

  // Folder & Media state for videos
  const [folders, setFolders] = useState([]);
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
        if (list.length > 0) {
          // Default to root folder
          openFolder('root', 'Library Root');
        }
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
          url: proxiedMediaUrl(item.url),
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
      url: proxiedMediaUrl(item.url),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50/50">
          <div>
            <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#ff5500]" />
              Add Videos &amp; Create Temp Library
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 font-medium">
              Pick First Videos to generate rows, and Second Videos/Music to build your Temporary Library
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-150 hover:text-gray-950"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 px-6 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('video1')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'video1'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            1. First Video ({selectedVideo1.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video2')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'video2'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            2. Second Video ({selectedVideo2.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'audio'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            3. Music ({selectedAudio.length})
          </button>
        </div>

        {/* Main Area */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr] bg-white">
          {/* Left Sidebar (Only for video tabs) */}
          {activeTab !== 'audio' ? (
            <aside className="min-h-0 overflow-y-auto border-r border-gray-100 bg-gray-50/50 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Folders</p>
              {loadingFolders ? (
                <div className="flex items-center gap-2 rounded-lg bg-white p-3 text-xs font-semibold text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => openFolder('root', 'Library Root')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      activeFolderId === 'root' ? 'bg-[#ff5500] text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                    <Folder className="h-4 w-4" />
                    Library Root
                  </button>

                  {folders.map((folder) => (
                    <button
                      key={folder._id}
                      type="button"
                      onClick={() => openFolder(folder._id, folder.name)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                        activeFolderId === folder._id ? 'bg-[#ff5500] text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-100'
                      }`}
                    >
                      <Folder className="h-4 w-4" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          ) : (
            <aside className="min-h-0 border-r border-gray-100 bg-gray-50/50 p-4">
              <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl">
                <Music className="w-5 h-5 text-[#ff5500] mb-2" />
                <p className="text-[11px] font-bold text-gray-700 uppercase">Music Catalog</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                  Select background tracks to add to your temporary quick-selection library.
                </p>
              </div>
            </aside>
          )}

          {/* Right Main Grid */}
          <main className="min-h-0 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {error}
              </div>
            )}

            {activeTab !== 'audio' ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {activeFolderName || 'Choose a folder'}
                  </h4>
                  {activeFolderId && (
                    <span className="text-[11px] font-semibold text-gray-400">{media.length} videos</span>
                  )}
                </div>

                {!activeFolderId ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400">
                    Select a folder to view videos.
                  </div>
                ) : loadingMedia ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center gap-2 rounded-xl border border-gray-100 text-sm font-semibold text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading videos...
                  </div>
                ) : media.length === 0 ? (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400">
                    No videos found in this folder.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {media.map((item) => {
                      const selected = isVideoSelected(item, activeTab);
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => handleToggleVideo(item, activeTab)}
                          className={`overflow-hidden rounded-xl border text-left shadow-sm transition-all hover:shadow-md relative flex flex-col ${
                            selected ? 'border-[#ff5500] ring-2 ring-[#ff5500]/20' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="relative aspect-[9/16] bg-gray-100">
                            <video
                              src={proxiedMediaUrl(item.url)}
                              className="h-full w-full object-cover"
                              muted
                              preload="metadata"
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
                          </div>
                          <div className="p-3 bg-white border-t border-gray-50">
                            <p className="truncate text-[10px] font-bold text-gray-900" title={item.name}>
                              {item.name || 'Untitled video'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              // Audio Tab
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Platform Music Tracks</h4>
                  {loadingAudio ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
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
                                ? 'border-[#ff5500] bg-orange-50/10 text-[#ff5500]'
                                : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Music className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-[#ff5500]' : 'text-gray-400'}`} />
                              <span className="truncate">{item.name}</span>
                            </span>
                            {selected ? (
                              <CheckSquare className="w-4 h-4 text-[#ff5500] flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {myAudioTracks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">My Uploaded Tracks</h4>
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
                                ? 'border-[#ff5500] bg-orange-50/10 text-[#ff5500]'
                                : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Music className={`h-4 w-4 flex-shrink-0 ${selected ? 'text-[#ff5500]' : 'text-gray-400'}`} />
                              <span className="truncate">{item.name}</span>
                            </span>
                            {selected ? (
                              <CheckSquare className="w-4 h-4 text-[#ff5500] flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
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
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
            <span>Selected First Videos: <strong className="text-gray-900">{selectedVideo1.length}</strong></span>
            <span>Selected Second Videos: <strong className="text-gray-900">{selectedVideo2.length}</strong></span>
            <span>Selected Music: <strong className="text-gray-900">{selectedAudio.length}</strong></span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-600 uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedVideo1.length === 0}
              className="px-4 py-2 bg-[#ff5500] hover:bg-orange-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider shadow-sm"
            >
              Confirm &amp; Create Rows
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
