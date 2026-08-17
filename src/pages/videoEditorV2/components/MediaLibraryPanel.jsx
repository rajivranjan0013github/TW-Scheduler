import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Folder,
  Loader2,
  Pause,
  Play,
  Search,
} from 'lucide-react';
import { getActiveCampaignId } from '../../../utils/campaignScope';
import { getMediaUrl } from '../../../utils/mediaUrls';
import LoadingVideoPreview from '../../../components/LoadingVideoPreview';
import { API_BASE_URL } from '../../videoEditor/videoEditorConstants';
import {
  fetchMediaLibraryFolder,
  fetchMediaLibraryFolders,
  MEDIA_LIBRARY_GC_TIME,
  MEDIA_LIBRARY_STALE_TIME,
  mediaLibraryKeys,
  readLastMediaFolder,
  saveLastMediaFolder,
} from '../media/mediaLibraryCache';

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const getFolderParentId = (folder) => normalizeFolderId(folder.parentFolderId) || 'root';
const mediaUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });
const proxiedMediaUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL, proxy: true });
const AUDIO_PROGRESS_RADIUS = 22;
const AUDIO_PROGRESS_CIRCUMFERENCE = 2 * Math.PI * AUDIO_PROGRESS_RADIUS;

const naturalFileCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const formatDuration = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return `${Math.round(seconds)}s`;
};

const formatAudioDuration = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const wholeSeconds = Math.round(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

const MediaThumbnail = ({ item }) => {
  const [detectedDuration, setDetectedDuration] = useState(() => (
    Number(item.duration || item.metadata?.duration || 0)
  ));
  const videoRef = useRef(null);

  const startVideoPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {});
  };

  const stopVideoPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  if (item.type === 'image') {
    return (
      <img
        src={mediaUrl(item.url)}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover object-[center_40%] transition duration-200 group-hover:scale-[1.03]"
      />
    );
  }

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={startVideoPreview}
      onMouseLeave={stopVideoPreview}
    >
      <LoadingVideoPreview
        ref={videoRef}
        src={mediaUrl(item.url)}
        className="h-full w-full"
        videoClassName="h-full w-full object-cover opacity-90 transition duration-200 group-hover:scale-[1.03] group-hover:opacity-100"
        loadingLabel=""
        waitForLoadedData
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        poster={item.thumbnailUrl ? mediaUrl(item.thumbnailUrl) : undefined}
        onLoadedMetadata={(event) => {
          const duration = Number(event.currentTarget.duration);
          if (Number.isFinite(duration) && duration > 0) setDetectedDuration(duration);
        }}
        onEnded={() => {
          if (videoRef.current) videoRef.current.currentTime = 0;
        }}
      />
      {detectedDuration > 0 && (
        <span className="absolute bottom-1.5 left-1.5 z-[2] rounded bg-black/45 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-white shadow-sm">
          {formatDuration(detectedDuration)}
        </span>
      )}
    </div>
  );
};

const AudioLibraryRow = ({
  item,
  disabled,
  onAdd,
  onPreviewStart,
  onPreviewStop,
}) => {
  const audioRef = useRef(null);
  const previewRequestedRef = useRef(false);
  const itemId = String(item._id || item.id || item.url);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [usingProxy, setUsingProxy] = useState(false);
  const [detectedDuration, setDetectedDuration] = useState(() => (
    Number(item.duration || item.metadata?.duration || 0)
  ));

  const progress = detectedDuration > 0
    ? Math.min(1, Math.max(0, currentTime / detectedDuration))
    : 0;

  const stopPreview = () => {
    const audio = audioRef.current;
    previewRequestedRef.current = false;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    onPreviewStop(itemId);
  };

  const playPreview = (audio) => {
    previewRequestedRef.current = true;
    onPreviewStart(itemId, stopPreview);
    if (audio.ended || (audio.duration && audio.currentTime >= audio.duration)) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
    void audio.play().catch(() => {
      setIsPlaying(false);
      if (!usingProxy) {
        setUsingProxy(true);
        return;
      }
      previewRequestedRef.current = false;
    });
  };

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      stopPreview();
      return;
    }
    playPreview(audio);
  };

  useEffect(() => () => {
    onPreviewStop(itemId);
  }, [itemId, onPreviewStop]);

  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-xl px-1.5 py-2.5 transition hover:bg-white/[0.05]">
      <button
        type="button"
        onClick={togglePreview}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[#f5f7fa] transition hover:bg-white/[0.12] hover:text-white"
        aria-label={`${isPlaying ? 'Pause' : 'Play'} ${item.name || 'audio'}`}
        title={`${isPlaying ? 'Pause' : 'Play'} audio preview`}
      >
        <svg
          viewBox="0 0 48 48"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            r={AUDIO_PROGRESS_RADIUS}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="24"
            r={AUDIO_PROGRESS_RADIUS}
            fill="none"
            stroke="#ff5a1f"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeDasharray: AUDIO_PROGRESS_CIRCUMFERENCE,
              strokeDashoffset: AUDIO_PROGRESS_CIRCUMFERENCE * (1 - progress),
              transition: 'stroke-dashoffset 120ms linear',
            }}
          />
        </svg>
        {isPlaying ? (
          <Pause className="relative z-[1] h-4 w-4 fill-current" />
        ) : (
          <Play className="relative z-[1] ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onAdd(item)}
        disabled={disabled}
        className="min-w-0 flex-1 py-1 text-left disabled:cursor-wait disabled:opacity-60"
        title={`Add ${item.name || 'audio'} to the timeline`}
      >
        <span className="block truncate text-[11px] font-semibold text-[#f0f2f5]">
          {item.name || 'Untitled audio'}
        </span>
        <span className="mt-1 block text-[9px] font-medium text-[#8b929d]">
          Audio • {formatAudioDuration(detectedDuration)}
        </span>
      </button>

      <audio
        ref={audioRef}
        src={usingProxy ? proxiedMediaUrl(item.url) : mediaUrl(item.url)}
        preload="metadata"
        className="hidden"
        onCanPlay={(event) => {
          if (previewRequestedRef.current && event.currentTarget.paused) {
            playPreview(event.currentTarget);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onLoadedMetadata={(event) => {
          const duration = Number(event.currentTarget.duration);
          if (Number.isFinite(duration) && duration > 0) setDetectedDuration(duration);
        }}
        onError={() => {
          setIsPlaying(false);
          if (!usingProxy) {
            setUsingProxy(true);
            return;
          }
          stopPreview();
        }}
        onEnded={() => {
          if (audioRef.current) audioRef.current.currentTime = 0;
          previewRequestedRef.current = false;
          setCurrentTime(0);
          setIsPlaying(false);
          onPreviewStop(itemId);
        }}
      />
    </div>
  );
};

const FolderPreview = ({ summary }) => {
  const preview = summary?.preview;
  const previewSource = preview?.thumbnailUrl || preview?.url;
  const [useProxy, setUseProxy] = useState(false);

  return (
    <span className="relative block h-[66px] w-[82px] shrink-0" aria-hidden="true">
      <span className="absolute left-1 top-0 h-4 w-9 rounded-t-lg bg-[#323740]" />
      <span className="absolute inset-x-0 bottom-0 top-2 overflow-hidden rounded-xl border border-white/10 bg-[#282c33] shadow-sm">
        <span className="absolute inset-x-1.5 bottom-0 top-3 overflow-hidden rounded-t-lg bg-[#282c33]">
          {previewSource ? (
            preview?.type === 'video' && !preview?.thumbnailUrl ? (
              <LoadingVideoPreview
                src={mediaUrl(preview.url)}
                className="relative z-[1] mx-auto h-full w-3/4 overflow-hidden rounded-t-lg"
                videoClassName="h-full w-full object-cover"
                loadingLabel=""
                waitForLoadedData
                muted
                playsInline
                preload="auto"
                crossOrigin="anonymous"
              />
            ) : (
              <img
                src={useProxy ? proxiedMediaUrl(previewSource) : mediaUrl(previewSource)}
                alt=""
                loading="lazy"
                className="relative z-[1] mx-auto h-full w-3/4 rounded-t-lg object-cover object-[center_40%]"
                onError={() => setUseProxy(true)}
              />
            )
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[#666d78]">
              <Folder className="h-6 w-6" />
            </span>
          )}
        </span>
      </span>
    </span>
  );
};

export const MediaLibraryPanel = ({
  token,
  initialMediaType = 'all',
  onSelect,
}) => {
  const campaignId = getActiveCampaignId();
  const queryClient = useQueryClient();
  const [activeFolderId, setActiveFolderId] = useState(() => readLastMediaFolder(campaignId));
  const mediaType = initialMediaType === 'audio' ? 'audio' : 'all';
  const [search, setSearch] = useState('');
  const [selectingId, setSelectingId] = useState('');
  const activeAudioPreviewRef = useRef(null);

  const handleAudioPreviewStart = useCallback((itemId, stop) => {
    const activePreview = activeAudioPreviewRef.current;
    if (activePreview && activePreview.itemId !== itemId) {
      activePreview.stop();
    }
    activeAudioPreviewRef.current = { itemId, stop };
  }, []);

  const handleAudioPreviewStop = useCallback((itemId) => {
    if (activeAudioPreviewRef.current?.itemId === itemId) {
      activeAudioPreviewRef.current = null;
    }
  }, []);

  const foldersQuery = useQuery({
    queryKey: mediaLibraryKeys.folders(campaignId),
    queryFn: ({ signal }) => fetchMediaLibraryFolders({ token, campaignId, signal }),
    staleTime: MEDIA_LIBRARY_STALE_TIME,
    gcTime: MEDIA_LIBRARY_GC_TIME,
    enabled: Boolean(token),
  });

  const mediaQuery = useQuery({
    queryKey: mediaLibraryKeys.media(campaignId, activeFolderId),
    queryFn: ({ signal }) => fetchMediaLibraryFolder({
      token,
      campaignId,
      folderId: activeFolderId,
      signal,
    }),
    staleTime: MEDIA_LIBRARY_STALE_TIME,
    gcTime: MEDIA_LIBRARY_GC_TIME,
    enabled: Boolean(token),
  });

  const folders = useMemo(() => foldersQuery.data || [], [foldersQuery.data]);
  const media = useMemo(() => mediaQuery.data || [], [mediaQuery.data]);
  const loadingFolders = foldersQuery.isPending && !foldersQuery.data;
  const loadingMedia = mediaQuery.isPending && !mediaQuery.data;
  const error = foldersQuery.error?.message || mediaQuery.error?.message || '';

  const openFolder = useCallback((folderId) => {
    const normalizedFolderId = normalizeFolderId(folderId) || 'root';
    setActiveFolderId(normalizedFolderId);
    saveLastMediaFolder(campaignId, normalizedFolderId);
  }, [campaignId]);

  const prefetchFolder = useCallback((folderId) => {
    const normalizedFolderId = normalizeFolderId(folderId) || 'root';
    void queryClient.prefetchQuery({
      queryKey: mediaLibraryKeys.media(campaignId, normalizedFolderId),
      queryFn: ({ signal }) => fetchMediaLibraryFolder({
        token,
        campaignId,
        folderId: normalizedFolderId,
        signal,
      }),
      staleTime: MEDIA_LIBRARY_STALE_TIME,
      gcTime: MEDIA_LIBRARY_GC_TIME,
    });
  }, [campaignId, queryClient, token]);

  const childFolders = useMemo(() => folders
    .filter((folder) => getFolderParentId(folder) === activeFolderId)
    .sort((a, b) => naturalFileCollator.compare(a.name || '', b.name || '')), [activeFolderId, folders]);

  const breadcrumbPath = useMemo(() => {
    if (activeFolderId === 'root') return [];
    const folderMap = new Map(folders.map((folder) => [normalizeFolderId(folder._id), folder]));
    const branch = [];
    const visited = new Set();
    let currentId = activeFolderId;

    while (currentId && currentId !== 'root' && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = folderMap.get(currentId);
      if (!folder) break;
      branch.unshift({
        id: normalizeFolderId(folder._id),
        name: folder.name || 'Untitled',
      });
      currentId = getFolderParentId(folder);
    }

    return branch;
  }, [activeFolderId, folders]);

  const filteredMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    return media.filter((item) => {
      if (mediaType !== 'all' && item.type !== mediaType) return false;
      if (!query) return true;
      const searchableText = [
        item.name,
        ...(Array.isArray(item.tags) ? item.tags : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchableText.includes(query);
    });
  }, [media, mediaType, search]);

  const visualMedia = useMemo(
    () => filteredMedia.filter((item) => item.type !== 'audio'),
    [filteredMedia],
  );
  const audioMedia = useMemo(
    () => filteredMedia.filter((item) => item.type === 'audio'),
    [filteredMedia],
  );

  const handleSelect = async (item) => {
    const itemId = String(item._id || item.id || item.url);
    setSelectingId(itemId);
    try {
      await onSelect({
        id: item._id || item.id,
        mediaId: item._id || item.id,
        name: item.name || `Library ${item.type || 'media'}`,
        sourceType: 'library',
        type: item.type || 'video',
        url: mediaUrl(item.url),
        originalUrl: item.url,
        thumbnailUrl: item.thumbnailUrl ? mediaUrl(item.thumbnailUrl) : '',
        duration: item.duration || item.metadata?.duration || 0,
        width: item.width || item.metadata?.width || 0,
        height: item.height || item.metadata?.height || 0,
        mimeType: item.mimeType || item.mimetype || '',
      });
    } finally {
      setSelectingId('');
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#111318]" aria-label="Media Library">
      <div className="shrink-0 space-y-2.5 border-b border-white/10 p-3">
        <label className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#171a20] px-2.5 focus-within:border-[#ff5500]/60">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#727985]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search names and tags"
            className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-[#e6e8ec] outline-none placeholder:text-[#666d78]"
          />
        </label>

        {breadcrumbPath.length > 0 && (
          <nav
            className="flex min-w-0 items-center gap-1 overflow-x-auto text-[9px]"
            aria-label="Folder breadcrumb"
          >
            <button
              type="button"
              onClick={() => openFolder('root')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#7e8692] transition hover:bg-white/10 hover:text-[#ff6a1a]"
              aria-label="Open library root"
              title="Library root"
            >
              <Folder className="h-3.5 w-3.5" />
            </button>
            {breadcrumbPath.map((crumb, index) => {
              const isLast = index === breadcrumbPath.length - 1;
              return (
                <span key={crumb.id} className="flex shrink-0 items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-[#4f5560]" />
                  {isLast ? (
                    <span className="max-w-36 truncate font-bold text-[#d7dbe2]">{crumb.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openFolder(crumb.id)}
                      className="max-w-28 truncate font-semibold text-[#7e8692] transition hover:text-[#ff6a1a]"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}

      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error && (
          <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-[10px] font-semibold text-red-300">
            {error}
          </div>
        )}

        {loadingFolders || loadingMedia ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-[10px] font-bold text-[#a6abb4]">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff5500]" />
            Loading Media Library…
          </div>
        ) : (
          <>
            {childFolders.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-1 gap-2">
                  {childFolders.map((folder) => (
                    <button
                      key={normalizeFolderId(folder._id)}
                      type="button"
                      onClick={() => openFolder(folder._id)}
                      onMouseEnter={() => prefetchFolder(folder._id)}
                      onFocus={() => prefetchFolder(folder._id)}
                      className="group flex min-w-0 items-center gap-4 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.05]"
                    >
                      <FolderPreview summary={{ preview: folder.coverMedia || folder.previewMedia }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-bold text-[#f0f2f5]">
                          {folder.name || 'Untitled'}
                        </span>
                        <span className="mt-1 block text-[9px] font-medium text-[#8b929d]">
                          {Number(folder.itemCount || 0)} items
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#666d78]">Files</p>
              <span className="text-[8px] font-semibold tabular-nums text-[#666d78]">{filteredMedia.length} items</span>
            </div>

            {filteredMedia.length > 0 ? (
              <div className="space-y-3">
                {visualMedia.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {visualMedia.map((item) => {
                      const itemId = String(item._id || item.id || item.url);
                      return (
                        <button
                          key={itemId}
                          type="button"
                          onClick={() => handleSelect(item)}
                          disabled={Boolean(selectingId)}
                          className="group min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#171a20] text-left transition hover:border-[#ff5500]/60 hover:bg-[#1d2027] disabled:cursor-wait disabled:opacity-60"
                          title={`Add ${item.name || item.type || 'media'} to the timeline`}
                        >
                          <span className="relative block aspect-[9/16] overflow-hidden bg-[#0b0c0f]">
                            <MediaThumbnail item={item} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {audioMedia.length > 0 && (
                  <div className="space-y-1">
                    {audioMedia.map((item) => (
                      <AudioLibraryRow
                        key={String(item._id || item.id || item.url)}
                        item={item}
                        disabled={Boolean(selectingId)}
                        onAdd={handleSelect}
                        onPreviewStart={handleAudioPreviewStart}
                        onPreviewStop={handleAudioPreviewStop}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center">
                <p className="text-[10px] font-bold text-[#a6abb4]">No matching files</p>
                <p className="mt-1 text-[9px] font-medium text-[#666d78]">
                  {search ? 'Try another search or file type.' : 'Open another folder or change the file type.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
