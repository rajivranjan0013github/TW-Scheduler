import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Plus, Check, Clock, AlertCircle, Folder, Images, Users, Save, Trash2, ChevronLeft } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { getProxiedMediaUrl } from '../utils/mediaUrls';

const getProxyUrl = (url) => getProxiedMediaUrl(url, API_BASE_URL);

const naturalFolderCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const VideoThumbnail = ({ url, className }) => {
  const [poster, setPoster] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return undefined;

    let cancelled = false;
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    let timeoutId;

    const finishFailed = () => {
      if (!cancelled) setFailed(true);
    };

    const captureFrame = () => {
      if (cancelled || !video.videoWidth || !video.videoHeight) return;

      try {
        const width = 360;
        const height = Math.round((video.videoHeight / video.videoWidth) * width);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, width, height);
        setPoster(canvas.toDataURL('image/jpeg', 0.82));
        setFailed(false);
      } catch (error) {
        finishFailed();
      }
    };

    const seekIntoVideo = () => {
      if (cancelled) return;
      try {
        const seekTime = Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(0.5, Math.max(0.08, video.duration * 0.05))
          : 0.1;
        video.currentTime = seekTime;
      } catch (error) {
        captureFrame();
      }
    };

    setPoster('');
    setFailed(false);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadedmetadata', seekIntoVideo, { once: true });
    video.addEventListener('loadeddata', seekIntoVideo, { once: true });
    video.addEventListener('seeked', captureFrame, { once: true });
    video.addEventListener('error', finishFailed, { once: true });
    video.src = url;
    video.load();
    timeoutId = window.setTimeout(finishFailed, 7000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      video.removeAttribute('src');
      video.load();
    };
  }, [url]);

  if (poster) {
    return <img src={poster} className={className} alt="" />;
  }

  return (
    <div className={`${className} flex items-center justify-center bg-[#eef2ff] text-[9px] font-bold uppercase tracking-wider text-[#536079]`}>
      {failed ? 'Video' : 'Loading'}
    </div>
  );
};

const MediaPreview = ({ item, className = 'h-full w-full object-cover block' }) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnailUrl = getProxyUrl(item?.thumbnailUrl);
  const url = getProxyUrl(item?.url);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [thumbnailUrl]);

  if (!thumbnailUrl && !url) return null;

  if (thumbnailUrl && !thumbnailFailed) {
    return <img src={thumbnailUrl} className={className} alt="" onError={() => setThumbnailFailed(true)} />;
  }

  if (item?.type === 'video') {
    return <VideoThumbnail url={url} className={className} />;
  }

  return <img src={url} className={className} alt="" />;
};

const CalendarView = ({ selectedAccounts }) => {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [posts, setPosts] = useState([]);
  const canvasRef = useRef(null);
  const [portPositions, setPortPositions] = useState({});

  // Composer data
  const [showComposer, setShowComposer] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [folders, setFolders] = useState([]);
  const [channels, setChannels] = useState([]);
  const [queueError, setQueueError] = useState('');
  const [deletingAccountQueueIds, setDeletingAccountQueueIds] = useState([]);

  useEffect(() => {
    const updatePositions = () => {
      if (!canvasRef.current) return;
      const parentRect = canvasRef.current.getBoundingClientRect();
      const newPositions = {};
      const portElements = canvasRef.current.querySelectorAll('[data-port-id]');
      portElements.forEach(el => {
        const portId = el.getAttribute('data-port-id');
        const rect = el.getBoundingClientRect();
        newPositions[portId] = {
          x: rect.left - parentRect.left + rect.width / 2,
          y: rect.top - parentRect.top + rect.height / 2
        };
      });
      setPortPositions(newPositions);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    const timer = setTimeout(updatePositions, 150);
    return () => {
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timer);
    };
  }, [posts, folders, channels, showComposer]);

  // Post Composer form states
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [caption, setCaption] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleMode, setScheduleMode] = useState('auto');
  const [scheduleContentMode, setScheduleContentMode] = useState('assets');
  const [postType, setPostType] = useState('reels');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState('private');
  const [youtubeTags, setYoutubeTags] = useState('');
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);

  const [bulkInterval, setBulkInterval] = useState('2');
  const [activeFolderId, setActiveFolderId] = useState('root');
  const [selectedFolderId, setSelectedFolderId] = useState('root');
  const [selectedCarouselSets, setSelectedCarouselSets] = useState([]);

  const isViewer = user?.role === 'viewer';
  const selectedChannelObjects = channels.filter(chan => selectedChannels.includes(chan._id));
  const hasYoutubeSelected = selectedChannelObjects.some(chan => chan.platform === 'youtube');
  const isPureManualMode = scheduleMode === 'manual';
  const requiresScheduleTime = !isPureManualMode;
  const shouldUseYoutubePublishing = hasYoutubeSelected && !isPureManualMode;
  const getMediaAccountIds = (item) => (item?.socialAccountIds || []).map(account => account._id || account);
  const getFolderName = (folderId) => {
    if (!folderId) return 'Campaign Library';
    const id = folderId._id || folderId;
    return folders.find(folder => folder._id === id)?.name || 'Unknown folder';
  };
  const getAccountLabel = (account) => account?.username || account?.handle || account?.name || 'Account';
  const getMediaLabel = (item) => item?.name || 'Untitled media';
  const getMediaLocationLabel = (item) => getFolderName(item?.folderId);
  const getAssetCaptionDraft = (item) => (
    item ? (captionDrafts[item._id] ?? item.caption ?? '') : ''
  );
  const getPlannedCaption = (item) => getAssetCaptionDraft(item).trim() || caption.trim();
  const getCaptionSource = (item) => {
    if (getAssetCaptionDraft(item).trim()) return 'Saved on asset';
    if (caption.trim()) return 'Fallback composer';
    return 'No caption';
  };
  const formatScheduleDate = (value) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const formatScheduleTime = (value) => {
    if (!value) return '--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const getScheduleModeLabel = (mode) => {
    switch (mode) {
      case 'manual': return 'Manual';
      case 'hybrid': return 'Hybrid';
      default: return 'Auto';
    }
  };
  const getScheduleModeSummary = (mode) => {
    switch (mode) {
      case 'manual': return 'Creator downloads and posts. No auto publish job is queued.';
      case 'hybrid': return 'Auto publish is queued, but creator can post first and remove it from queue.';
      default: return 'Software publishes at the scheduled time.';
    }
  };
  const getPostStatusLabel = (post) => {
    switch (post?.status) {
      case 'manual_ready': return 'Manual Ready';
      case 'downloaded': return 'Downloaded';
      case 'posted_manual': return 'Posted Manually';
      case 'published_auto': return 'Published Auto';
      case 'published': return 'Published';
      case 'publishing': return 'Publishing';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return 'Scheduled';
    }
  };
  const isActiveQueuePost = (post) => (
    ['scheduled', 'manual_ready', 'downloaded', 'publishing'].includes(post?.status)
  );
  const getScheduleTimingLabel = (value) => {
    if (isPureManualMode) return 'Manual queue';
    return `${formatScheduleDate(value)} ${formatScheduleTime(value)}`;
  };
  const isMediaAvailableForChannels = (item, channelIds) => {
    return true;
  };
  const availableMediaList = useMemo(() => {
    return mediaList.filter(item => {
      // 1. Must match target channel
      const matchesChannel = isMediaAvailableForChannels(item, selectedChannels);
      if (!matchesChannel) return false;

      // 2. Must match selected folder
      if (activeFolderId === 'root') {
        return !item.folderId;
      }
      const itemFolderId = item.folderId?._id || item.folderId;
      return itemFolderId === activeFolderId;
    });
  }, [mediaList, selectedChannels, activeFolderId]);
  const isCarouselMode = scheduleContentMode === 'carousel';
  const isBulk = !isCarouselMode && selectedMedia.length > 1;
  const activeFolderName = selectedFolderId === 'root'
    ? 'Campaign Library'
    : folders.find(folder => folder._id === selectedFolderId)?.name || 'Selected Folder';
  const normalizeFolderId = useCallback((id) => {
    if (!id) return null;
    return typeof id === 'object' ? id._id : id;
  }, []);

  const currentLevelFolders = useMemo(() => {
    return folders
      .filter(f => {
        const pId = normalizeFolderId(f.parentFolderId) || 'root';
        return pId === activeFolderId;
      })
      .sort((a, b) => naturalFolderCollator.compare(a.name || '', b.name || ''));
  }, [folders, activeFolderId, normalizeFolderId]);

  const currentFolderObj = useMemo(() => {
    return folders.find(f => f._id === activeFolderId);
  }, [folders, activeFolderId]);

  const parentFolderIdOfActive = useMemo(() => {
    return currentFolderObj ? (normalizeFolderId(currentFolderObj.parentFolderId) || 'root') : 'root';
  }, [currentFolderObj, normalizeFolderId]);
  const getFolderAssetCount = (folderId) => mediaList.filter(item => {
    if (!isMediaAvailableForChannels(item, selectedChannels)) return false;
    if (folderId === 'root') return !item.folderId;
    const itemFolderId = item.folderId?._id || item.folderId;
    return itemFolderId === folderId;
  }).length;
  const selectedMediaItems = useMemo(
    () => selectedMedia
      .map(mediaId => mediaList.find(item => item._id === mediaId))
      .filter(Boolean),
    [mediaList, selectedMedia]
  );
  const mediaByFolderId = useMemo(() => {
    const map = new Map();
    mediaList.forEach((item) => {
      const folderId = item.folderId?._id || item.folderId || 'root';
      if (!map.has(folderId)) map.set(folderId, []);
      map.get(folderId).push(item);
    });
    return map;
  }, [mediaList]);
  const carouselSetFolders = useMemo(() => (
    folders
      .filter((folder) => folder.kind === 'carousel_set' && (folder.parentFolderId?._id || folder.parentFolderId || 'root') === activeFolderId)
      .sort((a, b) => naturalFolderCollator.compare(a.name || '', b.name || ''))
      .map((folder) => {
        const mediaItems = mediaByFolderId.get(folder._id) || [];
        const mediaById = new Map(mediaItems.map((item) => [String(item._id), item]));
        const orderedItems = (folder.carouselOrder || [])
          .map((mediaId) => mediaById.get(String(mediaId)))
          .filter(Boolean);
        const unorderedItems = mediaItems.filter((item) => !orderedItems.some((ordered) => ordered._id === item._id));
        return {
          ...folder,
          mediaItems: [...orderedItems, ...unorderedItems],
        };
      })
      .filter((folder) => folder.mediaItems.length > 0)
  ), [activeFolderId, folders, mediaByFolderId]);
  const selectedCarouselSetItems = useMemo(() => {
    return folders
      .filter((folder) => folder.kind === 'carousel_set' && selectedCarouselSets.includes(folder._id))
      .map((folder) => {
        const mediaItems = mediaByFolderId.get(folder._id) || [];
        const mediaById = new Map(mediaItems.map((item) => [String(item._id), item]));
        const orderedItems = (folder.carouselOrder || [])
          .map((mediaId) => mediaById.get(String(mediaId)))
          .filter(Boolean);
        const unorderedItems = mediaItems.filter((item) => !orderedItems.some((ordered) => ordered._id === item._id));
        return {
          ...folder,
          mediaItems: [...orderedItems, ...unorderedItems],
        };
      });
  }, [folders, selectedCarouselSets, mediaList, mediaByFolderId]);
  const folderById = useMemo(() => {
    return new Map(folders.map((folder) => [String(folder._id), folder]));
  }, [folders]);
  const getQueueDisplayFolder = (folderRef) => {
    const folderId = normalizeFolderId(folderRef);
    if (!folderId) return { id: 'root', name: 'Campaign Library' };

    const folder = folderById.get(String(folderId)) || (typeof folderRef === 'object' ? folderRef : null);
    if (!folder) return { id: String(folderId), name: 'Unknown folder' };

    if (folder.kind === 'carousel_set') {
      const parentId = normalizeFolderId(folder.parentFolderId);
      if (!parentId) return { id: 'root', name: 'Campaign Library' };
      const parentFolder = folderById.get(String(parentId));
      return {
        id: String(parentId),
        name: parentFolder?.name || 'Parent folder',
      };
    }

    return {
      id: String(folder._id || folderId),
      name: folder.name || 'Untitled folder',
    };
  };
  const getQueueSourceFolders = (queuePosts) => {
    const sourceMap = new Map();
    queuePosts.forEach((post) => {
      const carouselSetId = post.platformSpecifics?.type === 'carousel'
        ? post.platformSpecifics?.carouselSetId
        : null;
      if (carouselSetId) {
        const source = getQueueDisplayFolder(carouselSetId);
        sourceMap.set(source.id, source);
        return;
      }

      (post.mediaIds || []).forEach((mediaItem) => {
        const source = getQueueDisplayFolder(mediaItem?.folderId);
        sourceMap.set(source.id, source);
      });
    });
    return [...sourceMap.values()].sort((a, b) => naturalFolderCollator.compare(a.name || '', b.name || ''));
  };
  const getQueueSourceLabel = (queuePosts) => {
    const sourceFolders = getQueueSourceFolders(queuePosts);
    if (sourceFolders.length === 0) return 'No folder';
    if (sourceFolders.length === 1) return sourceFolders[0].name;
    return `${sourceFolders[0].name} +${sourceFolders.length - 1}`;
  };
  const schedulePlan = useMemo(() => {
    const baseDate = scheduleTime ? new Date(scheduleTime) : null;
    const hasValidDate = baseDate && !Number.isNaN(baseDate.getTime());
    const intervalMs = (parseFloat(bulkInterval) || 2) * 60 * 60 * 1000;
    const rows = [];

    if (isCarouselMode) {
      selectedChannelObjects.forEach((channel) => {
        selectedCarouselSetItems.forEach((set, setIndex) => {
          rows.push({
            channel,
            carouselSet: set,
            mediaItem: set.mediaItems[0],
            slidesCount: set.mediaItems.length,
            caption: (set.carouselCaption || '').trim() || caption.trim(),
            scheduledAt: hasValidDate ? new Date(baseDate.getTime() + (setIndex * intervalMs)) : null,
          });
        });
      });
    } else if (isBulk) {
      selectedChannelObjects.forEach((channel) => {
        selectedMediaItems.forEach((mediaItem, mediaIndex) => {
          rows.push({
            channel,
            mediaItem,
            caption: getPlannedCaption(mediaItem),
            scheduledAt: hasValidDate ? new Date(baseDate.getTime() + (mediaIndex * intervalMs)) : null,
          });
        });
      });
    } else if (selectedChannels.length > 0 && selectedMediaItems.length > 0) {
      selectedChannelObjects.forEach((channel) => {
        rows.push({
          channel,
          mediaItem: selectedMediaItems[0],
          caption: getPlannedCaption(selectedMediaItems[0]),
          scheduledAt: hasValidDate ? baseDate : null,
        });
      });
    }

    return rows
      .sort((a, b) => {
        const aTime = a.scheduledAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduledAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .map((row, index) => ({ ...row, index: index + 1 }));
  }, [bulkInterval, caption, captionDrafts, isBulk, isCarouselMode, scheduleTime, selectedCarouselSetItems, selectedChannelObjects, selectedChannels.length, selectedMediaItems]);
  const manualTaskButtonLabel = (() => {
    const count = schedulePlan.length || selectedMedia.length;
    return count > 0
      ? `Create ${count} Manual Task${count === 1 ? '' : 's'}`
      : 'Create Manual Tasks';
  })();
  useEffect(() => {
    fetchPosts();
    fetchComposerData();
  }, [selectedAccounts]);

  useEffect(() => {
    if (location.state?.preselectedMediaId && mediaList.length > 0) {
      setSelectedMedia([location.state.preselectedMediaId]);
      setShowComposer(true);

      const mediaItem = mediaList.find(m => m._id === location.state.preselectedMediaId);
      if (mediaItem) {
        const mediaFolderId = mediaItem.folderId?._id || mediaItem.folderId || 'root';
        setActiveFolderId(mediaFolderId);
        const mediaAccountIds = getMediaAccountIds(mediaItem);
        if (mediaAccountIds.length > 0) {
          setSelectedChannels(mediaAccountIds);
        }
        setPostType(mediaItem.type === 'video' ? 'reels' : 'post');
      }

      // Clear location state to prevent reopening modal on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state, mediaList]);

  const hasAutoSelected = useRef(false);

  useEffect(() => {
    if (showComposer) {
      if (!hasAutoSelected.current && channels.length > 0) {
        if (!location.state?.preselectedMediaId && selectedAccounts.length === 1) {
          const selectedId = selectedAccounts[0];
          const isValidChannel = channels.some(chan => chan._id === selectedId);
          if (isValidChannel) {
            setSelectedChannels([selectedId]);
          }
        }
        hasAutoSelected.current = true;
      }
    } else {
      hasAutoSelected.current = false;
      setActiveFolderId('root');
    }
  }, [showComposer, selectedAccounts, channels, location.state]);

  useEffect(() => {
    if (hasYoutubeSelected) {
      if (postType !== 'video' && postType !== 'short') {
        setPostType('video');
      }
    } else {
      if (postType !== 'reels' && postType !== 'post' && postType !== 'story') {
        setPostType('reels');
      }
    }
  }, [hasYoutubeSelected]);

  useEffect(() => {
    if (showComposer && !isCarouselMode) {
      if (selectedFolderId === 'root') {
        const rootAssets = mediaList.filter(item => !item.folderId).map(item => item._id);
        setSelectedMedia(rootAssets);
      } else {
        const folderAssets = mediaList.filter(item => {
          const itemFolderId = item.folderId?._id || item.folderId;
          return itemFolderId === selectedFolderId;
        }).map(item => item._id);
        setSelectedMedia(folderAssets);
      }
    }
  }, [showComposer, mediaList, selectedFolderId, isCarouselMode]);

  useEffect(() => {
    setSelectedCarouselSets((current) => (
      current.filter((setId) => carouselSetFolders.some((set) => set._id === setId))
    ));
  }, [carouselSetFolders]);

  useEffect(() => {
    if (selectedChannels.length === 0) {
      setSelectedMedia([]);
      setSelectedCarouselSets([]);
    }
  }, [selectedChannels.length]);

  const fetchPosts = async ({ force = false } = {}) => {
    try {
      setQueueError('');
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('tw_token')}` };
      const scope = withCampaignScope();
      const fetchJson = async (url) => {
        const response = await fetch(url, { headers });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || `Request failed: ${response.status}`);
        return data;
      };
      const fetchFreshJson = async (url) => {
        const response = await fetch(url, { headers, cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || `Request failed: ${response.status}`);
        return data;
      };
      const [accounts, data] = force
        ? await Promise.all([
          fetchFreshJson(`${API_BASE_URL}/api/accounts${scope}`),
          fetchFreshJson(`${API_BASE_URL}/api/scheduler${scope}`),
        ])
        : await Promise.all([
          queryClient.fetchQuery({
          queryKey: ['scheduler', 'accounts', scope],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/accounts${scope}`),
          staleTime: 2 * 60 * 1000,
          }),
          queryClient.fetchQuery({
          queryKey: ['scheduler', 'posts', scope],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/scheduler${scope}`),
          staleTime: 20 * 1000,
          }),
        ]);
      if (force) {
        queryClient.setQueryData(['scheduler', 'accounts', scope], accounts);
        queryClient.setQueryData(['scheduler', 'posts', scope], data);
      }
      const scopedAccountIds = selectedAccounts.length > 0 ? selectedAccounts : accounts.map(account => account._id);
      const filtered = data.filter(p => {
        const accId = p.socialAccountIds?.[0]?._id || p.socialAccountIds?.[0];
        return scopedAccountIds.includes(accId);
      });
      setPosts(filtered);
    } catch (error) {
      console.error('Failed to load scheduled posts:', error);
      setQueueError(error.message || 'Failed to load scheduled posts.');
    }
  };

  const fetchComposerData = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const scope = withCampaignScope();
      const fetchJson = async (url) => {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      };

      const [accData, medData, folderData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['scheduler', 'accounts', scope],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/accounts${scope}`),
          staleTime: 2 * 60 * 1000,
        }),
        queryClient.fetchQuery({
          queryKey: ['scheduler', 'media', scope],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/media${scope}`),
          staleTime: 60 * 1000,
        }),
        queryClient.fetchQuery({
          queryKey: ['scheduler', 'folders', scope],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/media/folders${scope}`),
          staleTime: 2 * 60 * 1000,
        }),
      ]);
      setChannels(
        selectedAccounts.length > 0
          ? accData.filter(account => selectedAccounts.includes(account._id))
          : accData
      );
      setMediaList(medData);
      setFolders(folderData);
    } catch (error) {
      console.error('Failed to fetch composer data:', error);
    }
  };

  const handleDeleteAccountQueue = async (accountId, accountLabel) => {
    const activePostIds = posts
      .filter((post) => (
        isActiveQueuePost(post)
        && (post.socialAccountIds || []).some((account) => String(account?._id || account) === String(accountId))
      ))
      .map((post) => post._id);
    if (activePostIds.length === 0 || deletingAccountQueueIds.includes(accountId)) return;

    if (!window.confirm(`Delete the schedule queue for ${accountLabel || 'this account'}? This will remove ${activePostIds.length} queued post${activePostIds.length === 1 ? '' : 's'} for this account only.`)) return;

    const previousPosts = posts;
    setQueueError('');
    setDeletingAccountQueueIds((current) => [...current, accountId]);
    setPosts((current) => current.filter((post) => !activePostIds.includes(post._id)));

    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/queue/account/${accountId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `Delete failed: ${response.status}`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      await fetchPosts({ force: true });
    } catch (error) {
      console.error('Failed to delete account schedule queue:', error);
      setPosts(previousPosts);
      setQueueError(error.message || 'Failed to delete account schedule queue.');
    } finally {
      setDeletingAccountQueueIds((current) => current.filter((id) => id !== accountId));
    }
  };

  const saveMediaCaption = async (item, nextCaption, { silent = false } = {}) => {
    if (!item) return null;
    setSavingCaptionId(item._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${item._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: JSON.stringify({ caption: nextCaption }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (!silent) {
          alert(`Caption save failed: ${error.message || 'Unable to update media caption'}`);
        }
        return null;
      }

      const updated = await response.json();
      setMediaList((current) => current.map(mediaItem => (
        mediaItem._id === updated._id ? updated : mediaItem
      )));
      setCaptionDrafts((current) => {
        const next = { ...current };
        delete next[updated._id];
        return next;
      });
      return updated;
    } catch (error) {
      console.error('Failed saving caption:', error);
      if (!silent) alert('Caption save failed.');
      return null;
    } finally {
      setSavingCaptionId(null);
    }
  };

  const saveDirtyCaptionDrafts = async () => {
    const dirtyItems = selectedMediaItems.filter(item => (
      captionDrafts[item._id] !== undefined && captionDrafts[item._id] !== (item.caption || '')
    ));

    for (const item of dirtyItems) {
      const updated = await saveMediaCaption(item, captionDrafts[item._id], { silent: true });
      if (!updated) {
        alert(`Could not save caption for ${getMediaLabel(item)}. Please try again before scheduling.`);
        return false;
      }
    }

    return true;
  };

  const handleComposeSubmit = async (e) => {
    e.preventDefault();

    if (selectedChannels.length === 0) {
      alert('Select at least one publishing channel');
      return;
    }
    if (isCarouselMode && selectedCarouselSets.length === 0) {
      alert('Select at least one carousel set');
      return;
    }
    if (isCarouselMode && selectedChannelObjects.some((channel) => channel.platform !== 'instagram')) {
      alert('Carousel Sets v1 supports Instagram accounts only.');
      return;
    }
    if (!isCarouselMode && selectedMedia.length === 0) {
      alert('Select at least one media asset');
      return;
    }
    const unavailableMedia = !isCarouselMode && selectedMedia.some((mediaId) => {
      const item = mediaList.find(media => media._id === mediaId);
      return !item || !isMediaAvailableForChannels(item, selectedChannels);
    });
    if (unavailableMedia) {
      alert('Selected media is restricted away from one or more selected publishing channels.');
      return;
    }
    if (requiresScheduleTime && !scheduleTime) {
      alert('Pick a scheduling date and time');
      return;
    }
    if (isCarouselMode && selectedCarouselSetItems.some((set) => set.mediaItems.length < 2 || set.mediaItems.length > 10)) {
      alert('Each Instagram carousel set must have 2 to 10 slides.');
      return;
    }
    if (shouldUseYoutubePublishing) {
      const hasVideo = selectedMedia.some(medId => mediaList.find(item => item._id === medId)?.type === 'video');
      if (!hasVideo) {
        alert('YouTube uploads require a video media asset');
        return;
      }
      if (!youtubeTitle.trim()) {
        alert('Add a YouTube title before scheduling');
        return;
      }
    }

    try {
      if (!isCarouselMode) {
        const captionsSaved = await saveDirtyCaptionDrafts();
        if (!captionsSaved) return;
      }

      const token = localStorage.getItem('tw_token');
      const effectiveScheduleDate = isPureManualMode ? new Date() : new Date(scheduleTime);
      const platformSpecifics = {
        type: postType,
        ...(shouldUseYoutubePublishing ? {
          youtube: {
            title: youtubeTitle.trim(),
            description: caption.trim(),
            privacyStatus: youtubePrivacy,
            tags: youtubeTags,
            categoryId: '22',
            selfDeclaredMadeForKids: youtubeMadeForKids,
          }
        } : {}),
      };
      const body = {
        campaignId: getActiveCampaignId(),
        socialAccountIds: selectedChannels,
        mediaIds: selectedMedia,
        caption: caption.trim(),
        scheduledAt: effectiveScheduleDate,
        scheduleMode,
        platformSpecifics
      };

      let url = `${API_BASE_URL}/api/scheduler`;
      if (isCarouselMode) {
        url = `${API_BASE_URL}/api/scheduler/carousels`;
        body.carouselSetIds = selectedCarouselSetItems.map((set) => set._id);
        body.startDate = effectiveScheduleDate;
        body.intervalHours = parseFloat(bulkInterval);
        body.platformSpecifics = { type: 'carousel' };
        delete body.mediaIds;
        delete body.scheduledAt;
      } else if (isBulk) {
        url = `${API_BASE_URL}/api/scheduler/bulk`;
        body.startDate = effectiveScheduleDate;
        body.intervalHours = parseFloat(bulkInterval);
        body.type = postType;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['scheduler'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        setShowComposer(false);
        setSelectedChannels([]);
        setSelectedMedia([]);
        setSelectedCarouselSets([]);
        setCaption('');
        setScheduleTime('');
        setScheduleMode('auto');
        setScheduleContentMode('assets');
        setYoutubeTitle('');
        setYoutubePrivacy('private');
        setYoutubeTags('');
        setYoutubeMadeForKids(false);
        fetchPosts();
      } else {
        const error = await response.json();
        alert(`Scheduling failed: ${error.message || 'Unable to save scheduled post'}`);
      }
    } catch (error) {
      console.error('Failed to save scheduled post:', error);
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'published': return 'bg-[#f5f5f7] text-gray-800 border border-[#e5e5ea]';
      case 'publishing': return 'bg-blue-50 text-blue-600 border border-blue-200';
      case 'failed': return 'bg-red-50 text-red-600 border border-red-200';
      default: return 'bg-blue-50 text-blue-600 border border-blue-200';
    }
  };

  const toggleChannel = (channelId) => {
    setSelectedChannels((current) => (
      current.includes(channelId)
        ? current.filter(id => id !== channelId)
        : [...current, channelId]
    ));
  };

  const toggleMedia = (mediaId) => {
    setSelectedMedia((current) => (
      current.includes(mediaId)
        ? current.filter(id => id !== mediaId)
        : [...current, mediaId]
    ));
  };

  const toggleCarouselSet = (setId) => {
    setSelectedCarouselSets((current) => (
      current.includes(setId)
        ? current.filter(id => id !== setId)
        : [...current, setId]
    ));
  };

  return (
    <div className="py-2 px-0 bg-[#f5f5f7] h-screen text-[#1d1d1f] font-sans flex flex-col overflow-hidden">

      {/* Page Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#e5e5ea] px-3 flex-shrink-0">
        <h2 className="text-sm font-bold text-black tracking-tight m-0">Scheduled Queue</h2>

        {!isViewer && (
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-1 bg-[#0071e3] hover:bg-[#147ce5] text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Schedule Queue</span>
          </button>
        )}
      </div>

      {queueError && (
        <div className="mx-2 mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{queueError}</span>
        </div>
      )}

      {showComposer && (
        <section className="flex-1 min-h-0 bg-white border-t border-[#d8e0f4] flex flex-col overflow-hidden">
          {/* Header Area */}
          <div className="flex items-center justify-between gap-4 border-b border-[#e5e5ea] px-4 py-2 flex-shrink-0">
            <div>
              <h3 className="text-xs font-bold text-[#0b1645] tracking-tight m-0">Streamlined Scheduling Flow</h3>
              <p className="m-0 mt-0.5 text-[9px] text-[#536079]">Multi-step scheduling flow for social media. Select channels, content, customize mode & post.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="px-2.5 py-1 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-md text-xs font-semibold border border-[#e5e5ea] transition-all"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleComposeSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Step Indicator Wizard Bar */}
            <div className="flex items-center justify-center py-2 px-8 border-b border-[#f3f4f6] bg-[#fbfbfb] flex-shrink-0">
              <div className="flex items-center w-full max-w-4xl justify-between relative">
                {/* Connecting Lines */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#e5e7eb] -translate-y-1/2 z-0" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-[#bfdbfe] -translate-y-1/2 z-0 transition-all duration-300"
                  style={{
                    width: selectedChannels.length > 0
                      ? (selectedMedia.length > 0 || selectedCarouselSets.length > 0)
                        ? (isPureManualMode || scheduleTime)
                          ? '100%'
                          : '66.6%'
                        : '33.3%'
                      : '0%'
                  }}
                />

                {/* Steps */}
                {[
                  {
                    step: 1,
                    label: '1. Select Channels',
                    active: selectedChannels.length > 0,
                  },
                  {
                    step: 2,
                    label: '2. Source Content',
                    active: selectedChannels.length > 0 && (selectedMedia.length > 0 || selectedCarouselSets.length > 0),
                  },
                  {
                    step: 3,
                    label: '3. Post Settings',
                    active: selectedChannels.length > 0 && (selectedMedia.length > 0 || selectedCarouselSets.length > 0) && (isPureManualMode || scheduleTime),
                  },
                  {
                    step: 4,
                    label: '4. Review & Schedule',
                    active: selectedChannels.length > 0 && (selectedMedia.length > 0 || selectedCarouselSets.length > 0) && (isPureManualMode || scheduleTime) && schedulePlan.length > 0,
                  },
                ].map((s, idx) => (
                  <div key={s.step} className="flex flex-col items-center z-10 relative">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border shadow-sm ${
                        s.active
                          ? 'bg-[#e0f2fe] border-[#38bdf8] text-[#0369a1]'
                          : 'bg-white border-[#e5e7eb] text-[#6b7280]'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Column Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-2.5 p-2.5 overflow-hidden">
              
              <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm flex flex-col overflow-hidden h-full">
                <div className="p-2 space-y-1 flex-1 overflow-y-auto">
                  {channels.map(chan => {
                    const isSelected = selectedChannels.includes(chan._id);
                    return (
                      <button
                        key={chan._id}
                        type="button"
                        onClick={() => toggleChannel(chan._id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                          isSelected
                            ? 'border-[#2563eb] bg-[#f0f7ff] text-[#0f172a] shadow-sm'
                            : 'border-[#e5e7eb] bg-white text-[#334155] hover:border-[#cbd5e1]'
                        }`}
                      >
                        {chan.avatarUrl ? (
                          <img src={chan.avatarUrl} crossOrigin="anonymous" className="w-7 h-7 rounded-full object-cover border border-black/5" alt="" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-[#6b7280]">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold leading-tight">{getAccountLabel(chan)}</span>
                          <span className="block truncate text-[9px] capitalize text-[#6b7280] leading-none mt-0.5">{chan.platform}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-[#e5e7eb] bg-[#f8fafc] px-3 py-1.5 text-[10px] font-semibold text-[#64748b]">
                  {selectedChannels.length} channel{selectedChannels.length === 1 ? '' : 's'} selected
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm flex flex-col overflow-hidden h-full">
                {/* Full-width Nested Content Source List with Back Navigation */}
                <div className="flex-shrink-0 border-b border-[#e5e7eb]">
                  {activeFolderId !== 'root' ? (
                    <div className="bg-[#f8fafc] px-3 py-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const parentId = parentFolderIdOfActive;
                          setActiveFolderId(parentId);
                          setSelectedFolderId(parentId);
                          setSelectedCarouselSets([]);
                          setScheduleContentMode('assets');
                          if (parentId === 'root') {
                            const rootAssets = mediaList.filter(item => !item.folderId).map(item => item._id);
                            setSelectedMedia(rootAssets);
                          } else {
                            const folderAssets = mediaList.filter(item => {
                              const itemFolderId = item.folderId?._id || item.folderId;
                              return itemFolderId === parentId;
                            }).map(item => item._id);
                            setSelectedMedia(folderAssets);
                          }
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      >
                        <ChevronLeft className="w-3 h-3 stroke-[2.5px]" />
                        <span>Back</span>
                      </button>
                      <span className="text-[10px] font-bold text-slate-300">/</span>
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">{currentFolderObj?.name}</span>
                    </div>
                  ) : (
                    <div className="bg-[#f8fafc] px-3 py-2">
                      <span className="text-[10px] font-bold text-slate-700">Campaign Library</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  
                  {/* Folders & Sets List */}
                  <div className="w-full flex-1 overflow-y-auto p-2 space-y-1 bg-[#fafafa]">
                    {currentLevelFolders.map(folder => {
                      const isCarousel = folder.kind === 'carousel_set';
                      
                      // Active state calculation:
                      // - For folders: active if selectedFolderId matches (and not in carousel mode)
                      // - For carousel sets: active if selectedCarouselSets contains its ID
                      const isActive = isCarousel 
                        ? selectedCarouselSets.includes(folder._id)
                        : (selectedFolderId === folder._id && !isCarouselMode);

                      const count = getFolderAssetCount(folder._id);
                      const slideCount = isCarousel 
                        ? ((folder.carouselOrder || []).length || mediaList.filter(m => (m.folderId?._id || m.folderId) === folder._id).length)
                        : 0;

                      return (
                        <button
                          key={folder._id}
                          type="button"
                          onClick={() => {
                            if (isCarousel) {
                              setScheduleContentMode('carousel');
                              const parentId = normalizeFolderId(folder.parentFolderId) || 'root';
                              setActiveFolderId(parentId);
                              setSelectedFolderId(folder._id);
                              setSelectedCarouselSets([folder._id]);
                              setSelectedMedia([]);
                            } else {
                              // Check if this regular folder contains any carousel sets
                              const childCarouselSets = folders.filter(f => 
                                f.kind === 'carousel_set' && 
                                (normalizeFolderId(f.parentFolderId) || 'root') === folder._id
                              );
                              
                              if (childCarouselSets.length > 0) {
                                // It's a Carousel holding folder! Switch to carousel mode, enter it and pre-select all sets
                                setScheduleContentMode('carousel');
                                setActiveFolderId(folder._id);
                                setSelectedFolderId(folder._id);
                                setSelectedCarouselSets(childCarouselSets.map(c => c._id));
                                setSelectedMedia([]);
                              } else {
                                // Standard campaign folder with regular assets - select it but do not enter it!
                                setScheduleContentMode('assets');
                                setSelectedFolderId(folder._id);
                                setSelectedCarouselSets([]);
                                const folderAssets = mediaList.filter(item => {
                                  const itemFolderId = item.folderId?._id || item.folderId;
                                  return itemFolderId === folder._id;
                                }).map(item => item._id);
                                setSelectedMedia(folderAssets);
                              }
                            }
                          }}
                          className={`w-full h-8 flex items-center justify-between rounded-lg px-2 text-left transition-all flex-shrink-0 ${
                            isActive
                              ? isCarousel
                                ? 'bg-purple-50 border border-purple-200 text-purple-950 font-bold shadow-sm'
                                : 'bg-[#f0f7ff] border border-blue-200 text-blue-950 font-bold shadow-sm'
                              : 'text-slate-600 hover:bg-[#f1f5f9] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isCarousel ? (
                              <Images className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-purple-600' : 'text-purple-400'}`} />
                            ) : (
                              <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                            )}
                            <span className="truncate text-xs font-semibold leading-none">{folder.name}</span>
                          </div>

                          <div className="flex-shrink-0 ml-2">
                            {isCarousel ? (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                isActive ? 'bg-purple-200 text-purple-800' : 'bg-purple-50 text-purple-600 border border-purple-100'
                              }`}>
                                {slideCount} slides
                              </span>
                            ) : (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {count} assets
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {currentLevelFolders.length === 0 && (
                      <div className="h-32 flex items-center justify-center text-[10px] text-slate-400 text-center p-4">
                        Empty folder
                      </div>
                    )}
                  </div>

                </div>
                <div className="border-t border-[#e5e7eb] bg-[#f8fafc] px-3 py-1.5 text-[10px] font-semibold text-[#64748b] truncate">
                  {isCarouselMode 
                    ? `Carousel Set: ${folders.find(f => f._id === selectedCarouselSets[0])?.name || 'None'}` 
                    : `Campaign Folder: ${activeFolderName}`}
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm flex flex-col overflow-hidden h-full">
                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {/* Mode Card Toggles */}
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Post Mode</span>
                    <div className="space-y-1">
                      {['auto', 'manual', 'hybrid'].map(mode => {
                        const isActive = scheduleMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setScheduleMode(mode)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                              isActive
                                ? 'border-[#2563eb] bg-[#f0f7ff] text-[#0f172a]'
                                : 'border-[#e2e8f0] bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                              isActive ? 'border-[#2563eb]' : 'border-slate-300'
                            }`}>
                              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />}
                            </span>
                            <span className="text-xs font-semibold">{getScheduleModeLabel(mode)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date & Time Picker */}
                  {!isPureManualMode && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {isBulk || isCarouselMode ? 'Start Time' : 'Post Time'}
                      </span>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb] focus:border-[#2563eb]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Interval selector */}
                  {(isBulk || isCarouselMode) && !isPureManualMode && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Post Interval</span>
                      <select
                        value={bulkInterval}
                        onChange={(e) => setBulkInterval(e.target.value)}
                        className="w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                      >
                        <option value="1">Every 1 hour</option>
                        <option value="2">Every 2 hours</option>
                        <option value="4">Every 4 hours</option>
                        <option value="12">Every 12 hours</option>
                        <option value="24">Every 1 day</option>
                      </select>
                    </div>
                  )}

                  {/* Format selector */}
                  {!isCarouselMode && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Format</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(hasYoutubeSelected ? ['video', 'short'] : ['reels', 'post', 'story']).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPostType(t)}
                            className={`py-1 rounded-md text-[10px] font-semibold capitalize border transition-all ${
                              postType === t
                                ? 'bg-[#0f172a] text-white border-[#0f172a]'
                                : 'bg-white text-slate-500 border-[#e2e8f0] hover:text-[#0f172a]'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Youtube specific options */}
                  {shouldUseYoutubePublishing && (
                    <div className="border border-red-100 bg-red-50/50 rounded-lg p-2.5 space-y-2">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-red-600">YouTube Specifics</span>
                      <input
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        placeholder="Video Title"
                        className="w-full bg-white border border-[#e2e8f0] px-2 py-1 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <input
                        value={youtubeTags}
                        onChange={(e) => setYoutubeTags(e.target.value)}
                        placeholder="Tags (tag1, tag2)"
                        className="w-full bg-white border border-[#e2e8f0] px-2 py-1 rounded text-[11px] focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Textarea Fallback Caption */}
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fallback Caption</span>
                    <textarea
                      placeholder="Enter caption..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full h-20 rounded-lg border border-[#e2e8f0] p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563eb] resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm flex flex-col overflow-hidden h-full">
                {/* Summarized stats block */}
                <div className="p-3 border-b border-[#f1f5f9] bg-[#f8fafc] space-y-1 flex-shrink-0">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Selected Channels:</span>
                    <span className="font-bold text-[#0f172a]">{selectedChannels.length}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Selected Content:</span>
                    <span className="font-bold text-[#0f172a]">
                      {isCarouselMode ? selectedCarouselSets.length : selectedMedia.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Post Mode:</span>
                    <span className="font-bold text-[#0f172a] capitalize">{scheduleMode}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Schedule Time:</span>
                    <span className="font-bold text-blue-600 truncate max-w-[140px]" title={scheduleTime}>
                      {isPureManualMode ? 'Manual queue' : scheduleTime ? new Date(scheduleTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not set'}
                    </span>
                  </div>
                </div>

                {/* Scrollable list of planned posts inside column 4 */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Planned Sequence ({schedulePlan.length})</span>
                  {schedulePlan.map((row) => (
                    <div
                      key={`${row.channel?._id || 'multi'}-${row.carouselSet?._id || row.mediaItem?._id}-${row.index}`}
                      className="bg-white border border-[#e2e8f0] rounded-lg p-2 flex gap-2 items-center shadow-sm relative"
                    >
                      <div className="h-8 w-10 overflow-hidden rounded border border-[#e2e8f0] bg-slate-100 flex-shrink-0">
                        <MediaPreview item={row.mediaItem} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-800 truncate">
                            {row.carouselSet ? row.carouselSet.name : getMediaLabel(row.mediaItem)}
                          </span>
                          <span className="text-[8px] font-semibold text-slate-400 flex-shrink-0">
                            #{row.index}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-slate-500">
                          <span className="font-medium truncate max-w-[70px]">{getAccountLabel(row.channel)}</span>
                          <span>•</span>
                          <span className="font-semibold text-blue-600">
                            {row.scheduledAt ? new Date(row.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Manual'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {schedulePlan.length === 0 && (
                    <div className="h-32 flex items-center justify-center text-[10px] text-slate-400 text-center p-4 border border-dashed border-slate-300 rounded-lg">
                      {isPureManualMode ? 'Select accounts and content to preview.' : 'Select accounts, folder and schedule time.'}
                    </div>
                  )}
                </div>

                {/* Big scheduling button */}
                <div className="p-3 border-t border-[#e5e7eb] flex-shrink-0">
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>
                      {isPureManualMode
                        ? 'Create Manual Tasks'
                        : `Schedule ${schedulePlan.length} Post${schedulePlan.length === 1 ? '' : 's'}`}
                    </span>
                  </button>
                </div>
              </div>

            </div>
          </form>
        </section>
      )}

      {/* Schedule Overview — Visual Row Board */}
      {!showComposer && (() => {
        const now = new Date();
        const activeQueuePosts = posts.filter(isActiveQueuePost);

        // 1. Group active queued posts by account
        const accountMap = {};
        activeQueuePosts.forEach(post => {
          const accountIds = (post.socialAccountIds || []).map(a => a._id || a);
          accountIds.forEach(accId => {
            if (!accountMap[accId]) accountMap[accId] = [];
            accountMap[accId].push(post);
          });
        });

        // 2. Build Account Summaries (Destinations)
        const accountSummaries = Object.entries(accountMap)
          .map(([accId, accPosts]) => {
            const channel = channels.find(c => c._id === accId);
            const scheduled = accPosts.filter(isActiveQueuePost);
            const failed = accPosts.filter(p => p.status === 'failed');
            const total = scheduled.length;
            const done = 0;
            const left = scheduled.length;
            const hasUpcoming = scheduled.some(p => new Date(p.scheduledAt) >= now);
            const isActive = hasUpcoming && left > 0;

            const queuePosts = scheduled.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
            const nextPost = queuePosts.find(p => new Date(p.scheduledAt) >= now) || queuePosts[0];
            const sourceLabel = getQueueSourceLabel(queuePosts);

            return { accId, channel, total, done, left, failed: failed.length, isActive, nextPost, sourceLabel };
          })
          .sort((a, b) => getAccountLabel(a.channel).localeCompare(getAccountLabel(b.channel)));

        const getPlatformTheme = (platform) => {
          switch (platform) {
            case 'instagram': return { accent: '#e1306c', bg: '#fdf2f8', border: '#fbcfe8' };
            case 'youtube': return { accent: '#ff0000', bg: '#fef2f2', border: '#fecaca' };
            case 'twitter': case 'x': return { accent: '#1da1f2', bg: '#f0f9ff', border: '#bae6fd' };
            case 'facebook': return { accent: '#1877f2', bg: '#eff6ff', border: '#bfdbfe' };
            case 'tiktok': return { accent: '#00f2fe', bg: '#f0fdfa', border: '#ccfbf1' };
            default: return { accent: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
          }
        };

        // Simple Solid Circular Progress
        const CircularProgress = ({ done, total, themeColor }) => {
          const size = 42;
          const stroke = 4;
          const radius = (size - stroke) / 2;
          const circumference = 2 * Math.PI * radius;
          const pct = total > 0 ? (done / total) : 0;
          const strokeDashoffset = circumference - pct * circumference;

          return (
            <svg width={size} height={size} className="transform -rotate-90">
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke="#e5e7eb" strokeWidth={stroke}
              />
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke={themeColor} strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          );
        };

        return (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 bg-slate-50 relative bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px]">
            {/* Inject keyframes style for moving cable animation */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes dash {
                to {
                  stroke-dashoffset: -1000;
                }
              }
            `}} />

            {activeQueuePosts.length === 0 ? (
              <div className="max-w-4xl mx-auto border border-dashed border-slate-200 p-16 rounded-2xl text-center text-slate-500 bg-white flex flex-col items-center gap-3 mt-8 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-slate-400" />
                </div>
                <span className="font-semibold text-slate-700 text-sm">No active schedule flows</span>
                <span className="text-slate-400 text-xs">Create a new schedule queue to establish a flow</span>
              </div>
            ) : (
              <div ref={canvasRef} className="w-full max-w-none pt-6 space-y-6 relative" style={{ minHeight: '600px' }}>
               

                 {/* SVG Connections Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {accountSummaries.map((summary) => {
                    const { accId } = summary;
                    const theme = getPlatformTheme(summary.channel?.platform);

                    // Connection 1: Channel Out to Source In
                    const fromPort1 = `acc-port-out-${accId}`;
                    const toPort1 = `source-port-in-${accId}`;
                    const fromPos1 = portPositions[fromPort1];
                    const toPos1 = portPositions[toPort1];

                    const path1 = fromPos1 && toPos1 && typeof fromPos1.x === 'number' && typeof fromPos1.y === 'number' && typeof toPos1.x === 'number' && typeof toPos1.y === 'number'
                      ? `M ${fromPos1.x} ${fromPos1.y} C ${fromPos1.x + Math.abs(toPos1.x - fromPos1.x) * 0.4} ${fromPos1.y}, ${toPos1.x - Math.abs(toPos1.x - fromPos1.x) * 0.4} ${toPos1.y}, ${toPos1.x} ${toPos1.y}`
                      : null;

                    // Connection 2: Source Out to Stats In
                    const fromPort2 = `source-port-out-${accId}`;
                    const toPort2 = `stats-port-in-${accId}`;
                    const fromPos2 = portPositions[fromPort2];
                    const toPos2 = portPositions[toPort2];

                    const path2 = fromPos2 && toPos2 && typeof fromPos2.x === 'number' && typeof fromPos2.y === 'number' && typeof toPos2.x === 'number' && typeof toPos2.y === 'number'
                      ? `M ${fromPos2.x} ${fromPos2.y} C ${fromPos2.x + Math.abs(toPos2.x - fromPos2.x) * 0.4} ${fromPos2.y}, ${toPos2.x - Math.abs(toPos2.x - fromPos2.x) * 0.4} ${toPos2.y}, ${toPos2.x} ${toPos2.y}`
                      : null;

                    return (
                      <g key={accId} className="opacity-80">
                        {[path1, path2].filter(Boolean).map((path, index) => (
                          <g key={`path-${accId}-${index}`}>
                            <path
                              d={path}
                              fill="none"
                              stroke={theme.accent}
                              strokeWidth="4"
                              className="opacity-15 blur-[2px]"
                            />
                            <path
                              d={path}
                              fill="none"
                              stroke={summary.isActive ? theme.accent : '#94a3b8'}
                              strokeWidth={summary.isActive ? "2.5" : "1.5"}
                              strokeDasharray={summary.isActive ? "6, 4" : "4, 4"}
                              style={summary.isActive ? { animation: 'dash 25s linear infinite' } : {}}
                            />
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </svg>

                <div className="space-y-12 relative z-10">
                  {accountSummaries.map((summary) => {
                    const { accId, channel, total, done, left, failed: failedCount, isActive, nextPost, sourceLabel } = summary;
                    const theme = getPlatformTheme(channel?.platform);
                    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                    const deletingAccountQueue = deletingAccountQueueIds.includes(accId);

                    return (
                      <div
                        key={accId}
                        className="flex flex-col md:flex-row items-center md:justify-between gap-8 md:gap-6 relative"
                      >
                        {/* Channel Node */}
                        <div className="relative flex-shrink-0 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl px-4 py-3 shadow-sm hover:shadow hover:border-indigo-400 hover:scale-[1.02] transition-all duration-300 w-full md:w-[220px]">
                          {/* Outgoing Connection Port Dot */}
                          <div
                            data-port-id={`acc-port-out-${accId}`}
                            className="hidden md:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                            style={{ backgroundColor: theme.accent }}
                          />
                          <div className="flex items-center gap-3">
                            {channel?.avatarUrl ? (
                              <img
                                src={channel.avatarUrl}
                                crossOrigin="anonymous"
                                className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                alt=""
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                <Users className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-800 m-0 truncate">{getAccountLabel(channel)}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: theme.accent }}
                                >
                                  {channel?.platform || 'unknown'}
                                </span>
                                {isActive && (
                                  <span className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-500 uppercase tracking-wider">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Source Folder Node */}
                        <div className="relative flex-shrink-0 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl px-4 py-3 shadow-sm hover:shadow hover:border-indigo-400 hover:scale-[1.02] transition-all duration-300 w-full md:w-[220px]">
                          <div
                            data-port-id={`source-port-in-${accId}`}
                            className="hidden md:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                          />
                          <div
                            data-port-id={`source-port-out-${accId}`}
                            className="hidden md:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                            style={{ backgroundColor: theme.accent }}
                          />
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                              <Folder className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-800 m-0 truncate" title={sourceLabel}>{sourceLabel}</h4>
                              <p className="m-0 mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">Source folder</p>
                            </div>
                          </div>
                        </div>

                        {/* Stats Node */}
                        <div className="relative flex-shrink-0 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl px-3.5 py-3 shadow-sm hover:shadow hover:border-indigo-400 hover:scale-[1.02] transition-all duration-300 w-full md:w-[320px]">
                          {/* Incoming Port Left */}
                          <div
                            data-port-id={`stats-port-in-${accId}`}
                            className="hidden md:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteAccountQueue(accId, getAccountLabel(channel))}
                            disabled={deletingAccountQueue}
                            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title={`Delete ${left} queued post${left === 1 ? '' : 's'} for this account`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex items-center justify-between gap-3 pr-6">
                            <div className="min-w-0 flex-1">
                              <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-center">
                                <div>
                                  <p className="m-0 text-xs font-bold text-indigo-600">{left}</p>
                                  <p className="m-0 text-[7px] font-bold uppercase text-slate-400">Left</p>
                                </div>
                                <div>
                                  <p className="m-0 text-xs font-bold text-emerald-600">{done}</p>
                                  <p className="m-0 text-[7px] font-bold uppercase text-slate-400">Done</p>
                                </div>
                                <div>
                                  <p className="m-0 text-xs font-bold text-rose-600">{failedCount}</p>
                                  <p className="m-0 text-[7px] font-bold uppercase text-slate-400">Fail</p>
                                </div>
                              </div>
                              
                              {/* Next Post Foot */}
                              {nextPost && (
                                <p className="m-0 mt-1.5 flex min-w-0 items-center gap-1 text-[8px] text-slate-500">
                                  <Clock className="h-2.5 w-2.5 flex-shrink-0 text-slate-400" />
                                  <span className="truncate">
                                    {deletingAccountQueue ? 'Deleting queue' : `${getScheduleModeLabel(nextPost.scheduleMode)} - ${getPostStatusLabel(nextPost)} - ${new Date(nextPost.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                  </span>
                                </p>
                              )}
                            </div>

                            <div className="flex-shrink-0 flex items-center justify-center relative">
                              <CircularProgress done={done} total={total} themeColor={theme.accent} />
                              <span className="absolute text-[8px] font-extrabold text-slate-800">{progress}%</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}



    </div>
  );
};
export default CalendarView;
