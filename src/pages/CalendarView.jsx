import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Plus, Clock, AlertCircle, Folder, Images, Users, ChevronLeft, X } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { getMediaUrl } from '../utils/mediaUrls';
import LoadingVideoPreview from '../components/LoadingVideoPreview';
import PlatformIcon from '../components/PlatformIcon';
import AccountQueueEditor from '../components/AccountQueueEditor';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

const naturalFolderCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const MediaPreview = ({ item, className = 'h-full w-full object-cover block' }) => {
  const url = getAssetUrl(item?.url);

  if (!url) return null;

  if (item?.type === 'video') {
    return (
      <LoadingVideoPreview
        src={url}
        videoClassName={className}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return <img src={url} className={className} alt="" />;
};

const CalendarView = ({ selectedAccounts }) => {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [posts, setPosts] = useState([]);

  // Composer data
  const [showComposer, setShowComposer] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [folders, setFolders] = useState([]);
  const [channels, setChannels] = useState([]);
  const [queueError, setQueueError] = useState('');
  const [deletingAccountQueueIds, setDeletingAccountQueueIds] = useState([]);
  const today = new Date();
  const toInputDate = (date) => {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    const day = String(safeDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [calendarMode, setCalendarMode] = useState('week');
  const [calendarRangeStart, setCalendarRangeStart] = useState(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    return toInputDate(start);
  });
  const [calendarRangeEnd, setCalendarRangeEnd] = useState(() => {
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    return toInputDate(end);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toInputDate(today));
  const [selectedCalendarAccountIds, setSelectedCalendarAccountIds] = useState([]);
  const [selectedCalendarStatus, setSelectedCalendarStatus] = useState('all');
  const [activeTooltipDay, setActiveTooltipDay] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [showCalendarAccountMenu, setShowCalendarAccountMenu] = useState(false);
  const [showQueueEditor, setShowQueueEditor] = useState(false);
  const [queueEditorPosts, setQueueEditorPosts] = useState([]);
  const [loadingQueueEditor, setLoadingQueueEditor] = useState(false);
  const [queueEditDrafts, setQueueEditDrafts] = useState({});
  const [savingQueuePostIds, setSavingQueuePostIds] = useState([]);
  const [deletingQueuePostIds, setDeletingQueuePostIds] = useState([]);
  const calendarAccountMenuRef = useRef(null);

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
  const [deselectedPlanRows, setDeselectedPlanRows] = useState([]);

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
  const getPlanRowKey = useCallback((row) => [
    row?.channel?._id || 'channel',
    row?.carouselSet?._id || row?.mediaItem?._id || 'content',
  ].join(':'), []);
  const isChannelVerified = (channel) => (
    channel?.isVerified === true
    || channel?.status === 'verified'
    || (!getActiveCampaignId() && channel?.isConnected !== false)
  );
  const isManualAssignedChannel = (channel) => Boolean(
    channel?.assignedHandlerEmail || channel?.assignedHandlerUserId
  );
  const canUseChannelForMode = (channel) => Boolean(channel?._id) && (
    isChannelVerified(channel) || isManualAssignedChannel(channel)
  );
  const normalizeSchedulingChannel = (channel) => {
    const activeCampaignId = getActiveCampaignId();
    const socialAccountId = channel.socialAccountId || channel.matchedAccountId || null;
    const schedulingId = socialAccountId || channel._id;
    const verified = channel.isVerified !== undefined
      ? Boolean(channel.isVerified)
      : channel.isConnected !== false;

    return {
      ...channel,
      _id: String(schedulingId || channel._id),
      campaignChannelId: activeCampaignId ? String(channel._id) : channel.campaignChannelId,
      socialAccountId,
      isVerified: verified,
      isConnected: channel.isConnected !== undefined ? channel.isConnected : verified,
      status: channel.status || (verified ? 'verified' : 'disconnected'),
    };
  };
  const getMediaAccountIds = (item) => (item?.socialAccountIds || []).map(account => account._id || account);
  const getFolderName = (folderId) => {
    if (!folderId) return 'Campaign Library';
    const id = folderId._id || folderId;
    return folders.find(folder => folder._id === id)?.name || 'Unknown folder';
  };
  const getAccountLabel = (account) => account?.username || account?.handle || account?.name || 'Account';
  const getAccountAvatarUrl = (account) => (
    account?.avatarUrl
    || account?.profilePictureUrl
    || account?.profile_picture_url
    || account?.picture
    || ''
  );
  const AccountAvatar = ({ account, sizeClass = 'h-5 w-5', textClass = 'text-[9px]' }) => {
    const label = getAccountLabel(account);
    const avatarUrl = getAccountAvatarUrl(account);
    return (
      <span className={`${sizeClass} inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#eef2ff] ${textClass} font-black uppercase text-[#4f46e5]`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            crossOrigin="anonymous"
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          label.charAt(0)
        )}
      </span>
    );
  };
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
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  const toDateTimeLocalValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
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
      case 'paused': return 'Paused';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return 'Scheduled';
    }
  };
  const isActiveQueuePost = (post) => (
    ['scheduled', 'manual_ready', 'downloaded', 'publishing', 'paused'].includes(post?.status)
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
      .map((row, index) => ({ ...row, index: index + 1, planKey: getPlanRowKey(row) }));
  }, [bulkInterval, caption, captionDrafts, getPlanRowKey, isBulk, isCarouselMode, scheduleTime, selectedCarouselSetItems, selectedChannelObjects, selectedChannels.length, selectedMediaItems]);
  const activeSchedulePlan = useMemo(() => {
    const baseDate = scheduleTime ? new Date(scheduleTime) : null;
    const hasValidDate = baseDate && !Number.isNaN(baseDate.getTime());
    const intervalMs = (parseFloat(bulkInterval) || 2) * 60 * 60 * 1000;

    return schedulePlan
      .filter((row) => !deselectedPlanRows.includes(row.planKey))
      .map((row, activeIndex) => ({
        ...row,
        activeIndex: activeIndex + 1,
        effectiveScheduledAt: hasValidDate
          ? new Date(baseDate.getTime() + (activeIndex * intervalMs))
          : row.scheduledAt,
      }));
  }, [bulkInterval, deselectedPlanRows, schedulePlan, scheduleTime]);
  const activeSchedulePlanByKey = useMemo(() => (
    new Map(activeSchedulePlan.map((row) => [row.planKey, row]))
  ), [activeSchedulePlan]);
  const hasDeselectedPlanRows = activeSchedulePlan.length !== schedulePlan.length;
  const activeScheduleTimeLabel = useMemo(() => {
    if (isPureManualMode) return 'Manual queue';
    const datedRows = activeSchedulePlan.filter((row) => row.effectiveScheduledAt);
    if (datedRows.length === 0) return 'Pick time';

    const firstTime = datedRows[0].effectiveScheduledAt;
    const formatTime = (date) => date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return formatTime(firstTime);
  }, [activeSchedulePlan, isPureManualMode]);
  useEffect(() => {
    setDeselectedPlanRows((current) => {
      const visibleKeys = new Set(schedulePlan.map((row) => row.planKey));
      const next = current.filter((key) => visibleKeys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [schedulePlan]);
  const togglePlanRow = (planKey) => {
    setDeselectedPlanRows((current) => (
      current.includes(planKey)
        ? current.filter((key) => key !== planKey)
        : [...current, planKey]
    ));
  };
  const manualTaskButtonLabel = (() => {
    const count = schedulePlan.length > 0 ? activeSchedulePlan.length : selectedMedia.length;
    return count > 0
      ? `Create ${count} Manual Task${count === 1 ? '' : 's'}`
      : 'Create Manual Tasks';
  })();
  useEffect(() => {
    if (!showComposer) {
      setDeselectedPlanRows([]);
    }
  }, [showComposer]);
  useEffect(() => {
    fetchPosts();
  }, [selectedAccounts, calendarRangeStart, calendarRangeEnd]);

  useEffect(() => {
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
      const rangeStartDate = parseInputDate(calendarRangeStart);
      const rangeEndDate = parseInputDate(calendarRangeEnd);
      if (rangeEndDate) rangeEndDate.setHours(23, 59, 59, 999);
      const schedulerRangeParams = new URLSearchParams();
      if (rangeStartDate) schedulerRangeParams.set('from', rangeStartDate.toISOString());
      if (rangeEndDate) schedulerRangeParams.set('to', rangeEndDate.toISOString());
      const schedulerScope = withCampaignScope(schedulerRangeParams.toString());
      const activeCampaignId = getActiveCampaignId();
      const accountsEndpoint = activeCampaignId
        ? `${API_BASE_URL}/api/accounts/publishing-channels${scope}`
        : `${API_BASE_URL}/api/accounts${scope}`;
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
          fetchFreshJson(accountsEndpoint),
          fetchFreshJson(`${API_BASE_URL}/api/scheduler${schedulerScope}`),
        ])
        : await Promise.all([
          queryClient.fetchQuery({
          queryKey: ['scheduler', 'accounts', activeCampaignId ? 'publishing-channels' : 'connected', scope],
          queryFn: () => fetchJson(accountsEndpoint),
          staleTime: 2 * 60 * 1000,
          }),
          queryClient.fetchQuery({
          queryKey: ['scheduler', 'posts', schedulerScope],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/scheduler${schedulerScope}`),
          staleTime: 20 * 1000,
          }),
        ]);
      if (force) {
        queryClient.setQueryData(['scheduler', 'accounts', activeCampaignId ? 'publishing-channels' : 'connected', scope], accounts);
        queryClient.setQueryData(['scheduler', 'posts', schedulerScope], data);
      }
      const normalizedAccountIds = accounts
        .map(normalizeSchedulingChannel)
        .map(account => account._id);
      const scopedAccountIds = activeCampaignId || selectedAccounts.length === 0
        ? normalizedAccountIds
        : selectedAccounts;
      const filtered = data.filter(p => {
        const accId = p.socialAccountIds?.[0]?._id || p.socialAccountIds?.[0];
        const channelId = p.campaignChannelIds?.[0]?._id || p.campaignChannelIds?.[0];
        return scopedAccountIds.includes(accId) || scopedAccountIds.includes(channelId);
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

      const activeCampaignId = getActiveCampaignId();
      const accountsEndpoint = activeCampaignId
        ? `${API_BASE_URL}/api/accounts/publishing-channels${scope}`
        : `${API_BASE_URL}/api/accounts${scope}`;

      const [accData, medData, folderData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['scheduler', 'accounts', activeCampaignId ? 'publishing-channels' : 'connected', scope],
          queryFn: () => fetchJson(accountsEndpoint),
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
      const normalizedChannels = accData.map(normalizeSchedulingChannel);
      setChannels(
        !activeCampaignId && selectedAccounts.length > 0
          ? normalizedChannels.filter(account => selectedAccounts.includes(account._id))
          : normalizedChannels.filter((channel) => !activeCampaignId || canUseChannelForMode(channel))
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
    if (schedulePlan.length > 0 && activeSchedulePlan.length === 0) {
      alert('Select at least one planned post');
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
        socialAccountIds: selectedChannelObjects
          .map((channel) => channel.socialAccountId)
          .filter(Boolean),
        campaignChannelIds: selectedChannelObjects
          .map((channel) => channel.campaignChannelId)
          .filter(Boolean),
        channelTargets: selectedChannelObjects.map((channel) => ({
          socialAccountId: channel.socialAccountId || null,
          campaignChannelId: channel.campaignChannelId || null,
        })),
        mediaIds: selectedMedia,
        caption: caption.trim(),
        scheduledAt: effectiveScheduleDate,
        scheduleMode,
        platformSpecifics
      };

      let url = `${API_BASE_URL}/api/scheduler`;
      let requestBodies = [body];
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

      if (hasDeselectedPlanRows) {
        url = `${API_BASE_URL}/api/scheduler`;
        requestBodies = activeSchedulePlan.map((row) => {
          const rowMediaIds = row.carouselSet
            ? row.carouselSet.mediaItems.map((item) => item._id).filter(Boolean)
            : [row.mediaItem?._id].filter(Boolean);
          const rowCaption = row.caption || caption.trim();
          const rowPlatformSpecifics = row.carouselSet
            ? {
                type: 'carousel',
                carouselSetId: row.carouselSet._id,
                carouselSetName: row.carouselSet.name,
                carouselOrder: rowMediaIds,
              }
            : {
                ...platformSpecifics,
                ...(shouldUseYoutubePublishing ? {
                  youtube: {
                    ...platformSpecifics.youtube,
                    description: rowCaption,
                  },
                } : {}),
              };

          return {
            campaignId: getActiveCampaignId(),
            socialAccountIds: row.channel?.socialAccountId ? [row.channel.socialAccountId] : [],
            campaignChannelIds: row.channel?.campaignChannelId ? [row.channel.campaignChannelId] : [],
            channelTargets: [{
              socialAccountId: row.channel?.socialAccountId || null,
              campaignChannelId: row.channel?.campaignChannelId || null,
            }],
            mediaIds: rowMediaIds,
            caption: rowCaption,
            scheduledAt: isPureManualMode ? effectiveScheduleDate : row.effectiveScheduledAt,
            scheduleMode,
            platformSpecifics: rowPlatformSpecifics,
          };
        });
      }

      let response;
      for (const requestBody of requestBodies) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) break;
      }

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['scheduler'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        setShowComposer(false);
        setSelectedChannels([]);
        setSelectedMedia([]);
        setSelectedCarouselSets([]);
        setDeselectedPlanRows([]);
        setCaption('');
        setScheduleTime('');
        setScheduleMode('auto');
        setScheduleContentMode('assets');
        setYoutubeTitle('');
        setYoutubePrivacy('private');
        setYoutubeTags('');
        setYoutubeMadeForKids(false);
        await fetchPosts({ force: true });
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
    const channel = channels.find((chan) => chan._id === channelId);
    if (!channel || !canUseChannelForMode(channel)) return;
    if (!isChannelVerified(channel) && scheduleMode !== 'manual') {
      setScheduleMode('manual');
    }

    setSelectedChannels((current) => (
      current.includes(channelId)
        ? current.filter(id => id !== channelId)
        : [...current, channelId]
    ));
  };

  const handleScheduleModeChange = (mode) => {
    setScheduleMode(mode);
    if (mode !== 'manual') {
      setSelectedChannels((current) => (
        current.filter((channelId) => {
          const channel = channels.find((chan) => chan._id === channelId);
          return channel && isChannelVerified(channel);
        })
      ));
    }
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

  const parseInputDate = (value) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const getDateKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return toInputDate(date);
  };

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const startOfWeek = (date) => addDays(date, -date.getDay());
  const endOfWeek = (date) => addDays(date, 6 - date.getDay());

  const setCalendarPreset = (mode) => {
    const base = parseInputDate(selectedCalendarDate) || new Date();
    setCalendarMode(mode);
    if (mode === 'week') {
      setCalendarRangeStart(toInputDate(startOfWeek(base)));
      setCalendarRangeEnd(toInputDate(endOfWeek(base)));
      return;
    }
    setCalendarRangeStart(toInputDate(new Date(base.getFullYear(), base.getMonth(), 1)));
    setCalendarRangeEnd(toInputDate(new Date(base.getFullYear(), base.getMonth() + 1, 0)));
  };

  const moveCalendarRange = (direction) => {
    const start = parseInputDate(calendarRangeStart) || new Date();
    const end = parseInputDate(calendarRangeEnd) || start;
    if (calendarMode === 'week') {
      const nextStart = addDays(start, direction * 7);
      const nextEnd = addDays(end, direction * 7);
      setCalendarRangeStart(toInputDate(nextStart));
      setCalendarRangeEnd(toInputDate(nextEnd));
      setSelectedCalendarDate(toInputDate(nextStart));
      return;
    }
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + direction, 1);
    setCalendarRangeStart(toInputDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)));
    setCalendarRangeEnd(toInputDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)));
    setSelectedCalendarDate(toInputDate(nextMonth));
  };

  const getPostStatusGroup = (post) => {
    switch (post?.status) {
      case 'manual_ready':
      case 'downloaded':
        return 'manual';
      case 'published_auto':
      case 'published':
      case 'posted_manual':
        return 'done';
      case 'failed':
        return 'failed';
      case 'paused':
      case 'cancelled':
        return 'cancelled';
      default:
        return 'scheduled';
    }
  };

  const getStatusChipClasses = (group) => {
    switch (group) {
      case 'manual':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'done':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'cancelled':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const findChannelForRef = (ref) => {
    const refId = String(ref?._id || ref || '');
    const socialAccountId = String(ref?.socialAccountId?._id || ref?.socialAccountId || '');
    return channels.find((channel) => (
      String(channel._id) === refId
      || String(channel.socialAccountId || '') === refId
      || String(channel.campaignChannelId || '') === refId
      || (socialAccountId && (
        String(channel._id) === socialAccountId
        || String(channel.socialAccountId || '') === socialAccountId
      ))
    ));
  };

  const getPostAccountRefs = (post) => {
    const refs = new Map();
    const addRef = (key, channel, fallback) => {
      if (!key || refs.has(key)) return;
      refs.set(key, {
        id: key,
        channel: channel || fallback || null,
      });
    };

    (post?.socialAccountIds || []).forEach((account) => {
      const key = String(account?._id || account);
      addRef(key, findChannelForRef(account), account);
    });

    (post?.campaignChannelIds || []).forEach((channelRef) => {
      const key = String(channelRef?.socialAccountId?._id || channelRef?.socialAccountId || channelRef?.matchedAccountId || channelRef?._id || channelRef);
      addRef(key, findChannelForRef(channelRef), channelRef);
    });

    if (refs.size === 0) {
      addRef('unknown', null, { username: 'Unknown account', platform: 'unknown' });
    }

    return [...refs.values()];
  };

  const getPostMediaLabel = (post) => {
    const firstMedia = post?.mediaIds?.[0];
    if (post?.platformSpecifics?.type === 'carousel') {
      const setId = post.platformSpecifics?.carouselSetId;
      const setFolder = setId ? folderById.get(String(setId)) : null;
      return setFolder?.name || firstMedia?.name || 'Carousel set';
    }
    return firstMedia?.name || 'Scheduled media';
  };

  const normalizedCalendarPosts = useMemo(() => {
    const rangeStart = parseInputDate(calendarRangeStart);
    const rangeEnd = parseInputDate(calendarRangeEnd);
    if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);
    const selectedAccountSet = new Set(selectedCalendarAccountIds.map(String));

    return posts
      .map((post) => {
        const scheduledDate = new Date(post.scheduledAt);
        const accountRefs = getPostAccountRefs(post);
        const statusGroup = getPostStatusGroup(post);
        return {
          post,
          accountRefs,
          statusGroup,
          scheduledDate,
          dateKey: getDateKey(scheduledDate),
          timeLabel: formatScheduleTime(post.scheduledAt),
          mediaItem: post.mediaIds?.[0],
          mediaLabel: getPostMediaLabel(post),
        };
      })
      .filter((item) => {
        if (!item.dateKey || Number.isNaN(item.scheduledDate.getTime())) return false;
        if (rangeStart && item.scheduledDate < rangeStart) return false;
        if (rangeEnd && item.scheduledDate > rangeEnd) return false;
        if (selectedCalendarStatus !== 'all' && item.statusGroup !== selectedCalendarStatus) return false;
        if (selectedAccountSet.size > 0 && !item.accountRefs.some((ref) => selectedAccountSet.has(String(ref.id)))) return false;
        return true;
      })
      .sort((a, b) => a.scheduledDate - b.scheduledDate);
  }, [calendarRangeEnd, calendarRangeStart, folderById, posts, selectedCalendarAccountIds, selectedCalendarStatus, channels]);

  const calendarStats = useMemo(() => {
    const stats = {
      total: normalizedCalendarPosts.length,
      scheduled: 0,
      manual: 0,
      done: 0,
      failed: 0,
    };
    normalizedCalendarPosts.forEach((item) => {
      if (stats[item.statusGroup] !== undefined) stats[item.statusGroup] += 1;
    });
    return stats;
  }, [normalizedCalendarPosts]);

  const calendarPostsByDate = useMemo(() => {
    const map = new Map();
    normalizedCalendarPosts.forEach((item) => {
      if (!map.has(item.dateKey)) map.set(item.dateKey, []);
      map.get(item.dateKey).push(item);
    });
    return map;
  }, [normalizedCalendarPosts]);

  const calendarDays = useMemo(() => {
    const start = parseInputDate(calendarRangeStart) || new Date();
    const end = parseInputDate(calendarRangeEnd) || start;
    const paddedStart = startOfWeek(start);
    const paddedEnd = endOfWeek(end);
    const days = [];
    for (let cursor = paddedStart; cursor <= paddedEnd; cursor = addDays(cursor, 1)) {
      const date = new Date(cursor);
      const key = toInputDate(date);
      days.push({
        date,
        key,
        inRange: date >= start && date <= end,
        isToday: key === toInputDate(new Date()),
        isSelected: key === selectedCalendarDate,
        posts: calendarPostsByDate.get(key) || [],
      });
    }
    return days;
  }, [calendarPostsByDate, calendarRangeEnd, calendarRangeStart, selectedCalendarDate]);

  const selectedDayPosts = calendarPostsByDate.get(selectedCalendarDate) || [];
  const selectedDayGroups = useMemo(() => {
    const groups = new Map();
    selectedDayPosts.forEach((item) => {
      item.accountRefs.forEach((ref) => {
        const key = String(ref.id);
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            channel: ref.channel,
            posts: [],
          });
        }
        groups.get(key).posts.push(item);
      });
    });
    return [...groups.values()].sort((a, b) => getAccountLabel(a.channel).localeCompare(getAccountLabel(b.channel)));
  }, [selectedDayPosts]);

  const accountFilterOptions = useMemo(() => {
    const optionsById = new Map();
    channels.forEach((channel) => {
      const id = String(channel._id);
      if (!id || optionsById.has(id)) return;
      optionsById.set(id, {
        id,
        label: getAccountLabel(channel),
        platform: channel.platform || 'unknown',
        channel,
      });
    });
    return [...optionsById.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [channels]);
  const queueEditorAccountId = selectedCalendarAccountIds.length === 1 ? String(selectedCalendarAccountIds[0]) : '';
  const queueEditorAccount = useMemo(() => (
    accountFilterOptions.find((option) => String(option.id) === queueEditorAccountId) || null
  ), [accountFilterOptions, queueEditorAccountId]);
  const queueEditorItems = useMemo(() => {
    if (!queueEditorAccountId) return [];
    return queueEditorPosts
      .map((post) => {
        const scheduledDate = new Date(post.scheduledAt);
        const accountRefs = getPostAccountRefs(post);
        const statusGroup = getPostStatusGroup(post);
        return {
          post,
          accountRefs,
          statusGroup,
          scheduledDate,
          mediaItem: post.mediaIds?.[0],
          mediaLabel: getPostMediaLabel(post),
        };
      })
      .filter((item) => {
        if (Number.isNaN(item.scheduledDate.getTime())) return false;
        return item.accountRefs.some((ref) => String(ref.id) === queueEditorAccountId);
      })
      .sort((a, b) => a.scheduledDate - b.scheduledDate)
      .map((item, index) => ({ ...item, queueIndex: index + 1 }));
  }, [queueEditorPosts, queueEditorAccountId, channels, folderById]);

  const fetchQueueEditorPosts = useCallback(async (accountId) => {
    if (!accountId) {
      setQueueEditorPosts([]);
      return;
    }

    setLoadingQueueEditor(true);
    setQueueError('');
    try {
      const params = new URLSearchParams();
      params.set('from', new Date().toISOString());
      params.set('accountIds', accountId);
      params.set('statuses', 'scheduled,manual_ready,downloaded,publishing,paused');
      const response = await fetch(`${API_BASE_URL}/api/scheduler${withCampaignScope(params.toString())}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`,
        },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `Queue load failed: ${response.status}`);
      }
      setQueueEditorPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load account queue:', error);
      setQueueEditorPosts([]);
      setQueueError(error.message || 'Failed to load account queue.');
    } finally {
      setLoadingQueueEditor(false);
    }
  }, []);

  const openQueueEditor = () => {
    if (!queueEditorAccountId) return;
    setShowQueueEditor(true);
    fetchQueueEditorPosts(queueEditorAccountId);
  };

  const toggleCalendarAccount = (accountId) => {
    setSelectedCalendarAccountIds((current) => (
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
    ));
  };

  useEffect(() => {
    if (!showQueueEditor) return;
    setQueueEditDrafts((current) => {
      const next = {};
      queueEditorItems.forEach((item) => {
        const postId = item.post._id;
        next[postId] = current[postId] || {
          scheduledAt: toDateTimeLocalValue(item.post.scheduledAt),
          caption: item.post.caption || '',
          status: item.post.status || 'scheduled',
        };
      });
      return next;
    });
  }, [showQueueEditor, queueEditorItems]);

  useEffect(() => {
    if (selectedCalendarAccountIds.length !== 1) {
      setShowQueueEditor(false);
    }
  }, [selectedCalendarAccountIds.length]);

  const updateQueueDraft = (postId, updates) => {
    setQueueEditDrafts((current) => ({
      ...current,
      [postId]: {
        ...(current[postId] || {}),
        ...updates,
      },
    }));
  };

  const buildQueueUpdatePayload = (item, overrides = {}) => {
    const postId = item?.post?._id;
    const draft = queueEditDrafts[postId] || {};
    return {
      scheduledAt: overrides.scheduledAt || (draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : item.post.scheduledAt),
      caption: overrides.caption ?? draft.caption ?? '',
      status: overrides.status || draft.status || item.post.status || 'scheduled',
    };
  };

  const saveQueuePostUpdate = async (item, payload) => {
    const postId = item?.post?._id;
    const response = await fetch(`${API_BASE_URL}/api/scheduler/${postId}${withCampaignScope()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('tw_token')}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `Update failed: ${response.status}`);
    }
    return data;
  };

  const invalidateQueueRelatedQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const mergeQueuePostPatch = (post, patch = {}) => ({
    ...post,
    ...patch,
    mediaIds: patch.mediaIds || post.mediaIds,
    socialAccountIds: patch.socialAccountIds || post.socialAccountIds,
    campaignChannelIds: patch.campaignChannelIds || post.campaignChannelIds,
    platformSpecifics: patch.platformSpecifics || post.platformSpecifics,
  });

  const patchQueuePostInState = (postId, patch) => {
    setQueueEditorPosts((current) => (
      current.map((post) => (
        String(post._id) === String(postId)
          ? mergeQueuePostPatch(post, patch)
          : post
      ))
    ));
    setPosts((current) => (
      current.map((post) => (
        String(post._id) === String(postId)
          ? mergeQueuePostPatch(post, patch)
          : post
      ))
    ));
  };

  const patchQueueDraft = (postId, payload) => {
    setQueueEditDrafts((current) => ({
      ...current,
      [postId]: {
        ...(current[postId] || {}),
        scheduledAt: toDateTimeLocalValue(payload.scheduledAt),
        caption: payload.caption ?? '',
        status: payload.status || 'scheduled',
      },
    }));
  };

  const handleSaveQueuePost = async (item) => {
    const postId = item?.post?._id;
    if (!postId || savingQueuePostIds.includes(postId)) return;
    const payload = buildQueueUpdatePayload(item);
    const previousQueueEditorPosts = queueEditorPosts;
    const previousPosts = posts;
    const previousDrafts = queueEditDrafts;

    setQueueError('');
    setSavingQueuePostIds((current) => [...current, postId]);
    patchQueuePostInState(postId, payload);
    patchQueueDraft(postId, payload);
    try {
      const savedPost = await saveQueuePostUpdate(item, payload);
      if (savedPost?._id) {
        patchQueuePostInState(postId, savedPost);
        patchQueueDraft(postId, savedPost);
      }
      invalidateQueueRelatedQueries();
    } catch (error) {
      console.error('Failed to update queue post:', error);
      setQueueEditorPosts(previousQueueEditorPosts);
      setPosts(previousPosts);
      setQueueEditDrafts(previousDrafts);
      setQueueError(error.message || 'Failed to update queue post.');
    } finally {
      setSavingQueuePostIds((current) => current.filter((id) => id !== postId));
    }
  };

  const handleBulkUpdateQueuePosts = async (items, updates = {}) => {
    const selectedItems = (items || []).filter((item) => item?.post?._id);
    if (selectedItems.length === 0) return;

    const selectedIds = selectedItems.map((item) => item.post._id);
    const itemPayloads = selectedItems.map((item) => {
      const overrides = {};
      if (updates.status) {
        overrides.status = updates.status;
      }
      return { item, payload: buildQueueUpdatePayload(item, overrides) };
    });
    const previousQueueEditorPosts = queueEditorPosts;
    const previousPosts = posts;
    const previousDrafts = queueEditDrafts;

    setQueueError('');
    setSavingQueuePostIds((current) => [...new Set([...current, ...selectedIds])]);
    itemPayloads.forEach(({ item, payload }) => {
      patchQueuePostInState(item.post._id, payload);
      patchQueueDraft(item.post._id, payload);
    });
    try {
      const savedPosts = await Promise.all(
        itemPayloads.map(({ item, payload }) => saveQueuePostUpdate(item, payload))
      );
      savedPosts.forEach((savedPost) => {
        if (!savedPost?._id) return;
        patchQueuePostInState(savedPost._id, savedPost);
        patchQueueDraft(savedPost._id, savedPost);
      });
      invalidateQueueRelatedQueries();
    } catch (error) {
      console.error('Failed to bulk update queue posts:', error);
      setQueueEditorPosts(previousQueueEditorPosts);
      setPosts(previousPosts);
      setQueueEditDrafts(previousDrafts);
      setQueueError(error.message || 'Failed to update selected queue posts.');
    } finally {
      setSavingQueuePostIds((current) => current.filter((id) => !selectedIds.includes(id)));
    }
  };

  const handleBulkSaveQueueCaptions = async (items, captionsByPostId = {}) => {
    const selectedItems = (items || []).filter((item) => {
      const postId = item?.post?._id;
      return postId && Object.prototype.hasOwnProperty.call(captionsByPostId, postId);
    });
    if (selectedItems.length === 0) return;

    const selectedIds = selectedItems.map((item) => item.post._id);
    const itemPayloads = selectedItems.map((item) => {
      const postId = item.post._id;
      return {
        item,
        payload: buildQueueUpdatePayload(item, { caption: captionsByPostId[postId] ?? '' }),
      };
    });
    const previousQueueEditorPosts = queueEditorPosts;
    const previousPosts = posts;
    const previousDrafts = queueEditDrafts;

    setQueueError('');
    setSavingQueuePostIds((current) => [...new Set([...current, ...selectedIds])]);
    itemPayloads.forEach(({ item, payload }) => {
      patchQueuePostInState(item.post._id, payload);
      patchQueueDraft(item.post._id, payload);
    });
    try {
      const savedPosts = await Promise.all(
        itemPayloads.map(({ item, payload }) => saveQueuePostUpdate(item, payload))
      );
      savedPosts.forEach((savedPost) => {
        if (!savedPost?._id) return;
        patchQueuePostInState(savedPost._id, savedPost);
        patchQueueDraft(savedPost._id, savedPost);
      });
      invalidateQueueRelatedQueries();
    } catch (error) {
      console.error('Failed to save queue captions:', error);
      setQueueEditorPosts(previousQueueEditorPosts);
      setPosts(previousPosts);
      setQueueEditDrafts(previousDrafts);
      setQueueError(error.message || 'Failed to save selected captions.');
    } finally {
      setSavingQueuePostIds((current) => current.filter((id) => !selectedIds.includes(id)));
    }
  };

  const handleDeleteQueuePost = async (item) => {
    const postId = item?.post?._id;
    if (!postId || deletingQueuePostIds.includes(postId)) return;
    if (!window.confirm(`Remove "${item.mediaLabel || 'this post'}" from the queue?`)) return;

    const previousPosts = posts;
    const previousQueueEditorPosts = queueEditorPosts;
    setQueueError('');
    setDeletingQueuePostIds((current) => [...current, postId]);
    setPosts((current) => current.filter((post) => post._id !== postId));
    setQueueEditorPosts((current) => current.filter((post) => post._id !== postId));
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${postId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `Delete failed: ${response.status}`);
      }
      invalidateQueueRelatedQueries();
    } catch (error) {
      console.error('Failed to delete queue post:', error);
      setPosts(previousPosts);
      setQueueEditorPosts(previousQueueEditorPosts);
      setQueueError(error.message || 'Failed to delete queue post.');
    } finally {
      setDeletingQueuePostIds((current) => current.filter((id) => id !== postId));
    }
  };
  useEffect(() => {
    if (!showCalendarAccountMenu) return undefined;

    const handlePointerDown = (event) => {
      if (calendarAccountMenuRef.current?.contains(event.target)) return;
      setShowCalendarAccountMenu(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCalendarAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCalendarAccountMenu]);

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
                    const isVerified = isChannelVerified(chan);
                    const canSelect = canUseChannelForMode(chan);
                    return (
                      <button
                        key={chan._id}
                        type="button"
                        onClick={() => toggleChannel(chan._id)}
                        disabled={!canSelect}
                        className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                          isSelected
                            ? 'border-[#2563eb] bg-[#f0f7ff] text-[#0f172a] shadow-sm'
                            : canSelect
                              ? 'border-[#e5e7eb] bg-white text-[#334155] hover:border-[#cbd5e1]'
                              : 'border-[#e5e7eb] bg-[#f8fafc] text-[#94a3b8] opacity-80 cursor-not-allowed'
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
                          <span className="mt-0.5 flex items-center leading-none">
                            <PlatformIcon platform={chan.platform} className="h-3.5 w-3.5" />
                          </span>
                        </div>
                        {!isVerified && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                            isPureManualMode && canSelect
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            Manual
                          </span>
                        )}
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
                            onClick={() => handleScheduleModeChange(mode)}
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
                        <option value="6">Every 6 hours</option>
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
                    <span className="text-slate-500 font-medium">Selected Posts:</span>
                    <span className="font-bold text-[#0f172a]">
                      {schedulePlan.length > 0 ? `${activeSchedulePlan.length}/${schedulePlan.length}` : 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Post Mode:</span>
                    <span className="font-bold text-[#0f172a] capitalize">{scheduleMode}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Schedule Time:</span>
                    <span className="font-bold text-blue-600 truncate max-w-[160px]" title={activeScheduleTimeLabel}>
                      {activeScheduleTimeLabel}
                    </span>
                  </div>
                </div>

                {/* Scrollable list of planned posts inside column 4 */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50">
                  <div className="flex items-center justify-between px-1">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Planned Sequence ({activeSchedulePlan.length}/{schedulePlan.length})</span>
                    {hasDeselectedPlanRows && (
                      <button
                        type="button"
                        onClick={() => setDeselectedPlanRows([])}
                        className="text-[9px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Select all
                      </button>
                    )}
                  </div>
                  {schedulePlan.map((row) => {
                    const isRowSelected = !deselectedPlanRows.includes(row.planKey);
                    const activeRow = activeSchedulePlanByKey.get(row.planKey);
                    const visibleScheduledAt = activeRow?.effectiveScheduledAt || row.scheduledAt;
                    return (
                      <button
                        type="button"
                        key={row.planKey}
                        onClick={() => togglePlanRow(row.planKey)}
                        aria-pressed={isRowSelected}
                        className={`w-full text-left rounded-lg p-2 flex gap-2 items-center shadow-sm relative transition-all ${
                          isRowSelected
                            ? 'bg-white border border-blue-200 ring-1 ring-blue-100'
                            : 'bg-slate-100 border border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="h-8 w-10 overflow-hidden rounded border border-[#e2e8f0] bg-slate-100 flex-shrink-0">
                          <MediaPreview item={row.mediaItem} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-center gap-1">
                            <span className={`text-[10px] font-bold truncate ${isRowSelected ? 'text-slate-800' : 'text-slate-500 line-through'}`}>
                              {row.carouselSet ? row.carouselSet.name : getMediaLabel(row.mediaItem)}
                            </span>
                            <span className={`text-[8px] font-semibold flex-shrink-0 ${isRowSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                              #{row.index}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-slate-500">
                            <span className="font-medium truncate max-w-[70px]">{getAccountLabel(row.channel)}</span>
                            <span>•</span>
                            <span className={`font-semibold ${isRowSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                              {isRowSelected ? (visibleScheduledAt ? formatScheduleTime(visibleScheduledAt) : 'Manual') : 'Skipped'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

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
                    disabled={schedulePlan.length > 0 && activeSchedulePlan.length === 0}
                    className="w-full py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>
                      {isPureManualMode
                        ? manualTaskButtonLabel
                        : `Schedule ${activeSchedulePlan.length} Post${activeSchedulePlan.length === 1 ? '' : 's'}`}
                    </span>
                  </button>
                </div>
              </div>

            </div>
          </form>
        </section>
      )}

      {showQueueEditor && (
        <AccountQueueEditor
          account={queueEditorAccount}
          items={queueEditorItems}
          drafts={queueEditDrafts}
          loading={loadingQueueEditor}
          savingPostIds={savingQueuePostIds}
          deletingPostIds={deletingQueuePostIds}
          onBulkSave={handleBulkUpdateQueuePosts}
          onBulkCaptionSave={handleBulkSaveQueueCaptions}
          onClose={() => setShowQueueEditor(false)}
          getStatusLabel={getPostStatusLabel}
        />
      )}

      {/* Schedule Overview — Calendar */}
      {!showComposer && !showQueueEditor && (
        <section className="flex-1 min-h-0 bg-white flex flex-col overflow-hidden">
          {/* Clean Filter Bar */}
          <div className="border-b border-[#e8eaed] bg-white px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="m-0 text-base font-bold text-[#1a1a2e] tracking-tight">Scheduler Calendar</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveCalendarRange(-1)}
                    className="h-7 w-7 rounded-md border border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa] flex items-center justify-center transition-colors"
                    title="Previous range"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1.5 h-8 rounded-lg border border-[#dadce0] bg-white px-3 text-[12px] font-medium text-[#3c4043]">
                    <svg className="h-3.5 w-3.5 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <span>
                      {(() => {
                        const s = parseInputDate(calendarRangeStart);
                        const e = parseInputDate(calendarRangeEnd);
                        if (!s || !e) return 'Select range';
                        return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
                      })()}
                    </span>
                    <ChevronLeft className="h-3 w-3 -rotate-90 text-[#80868b]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => moveCalendarRange(1)}
                    className="h-7 w-7 rounded-md border border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa] flex items-center justify-center transition-colors"
                    title="Next range"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
                  </button>
                </div>
		                <div ref={calendarAccountMenuRef} className="relative group">
	                  <button
	                    type="button"
	                    onClick={() => setShowCalendarAccountMenu((open) => !open)}
	                    className="flex items-center gap-1.5 h-8 rounded-lg border border-[#dadce0] bg-white px-3 text-[12px] font-medium text-[#3c4043] hover:bg-[#f8f9fa] transition-colors"
	                  >
	                    <svg className="h-3.5 w-3.5 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
	                    <span>{selectedCalendarAccountIds.length === 0 ? 'All accounts' : `${selectedCalendarAccountIds.length} account${selectedCalendarAccountIds.length === 1 ? '' : 's'}`}</span>
	                    <ChevronLeft className="h-3 w-3 -rotate-90 text-[#80868b]" />
	                  </button>
	                  {showCalendarAccountMenu && (
                    <div className="absolute left-0 top-9 z-[9999] w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-lg">
	                      <button
	                        type="button"
	                        onClick={() => setSelectedCalendarAccountIds([])}
	                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-semibold hover:bg-[#f8f9fa] ${
	                          selectedCalendarAccountIds.length === 0 ? 'text-[#1a73e8]' : 'text-[#3c4043]'
	                        }`}
	                      >
	                        <span>All accounts</span>
	                        {selectedCalendarAccountIds.length === 0 && <span className="text-[10px]">Selected</span>}
	                      </button>
	                      <div className="max-h-64 overflow-y-auto border-t border-[#f1f3f4] py-1">
	                        {accountFilterOptions.map((option) => {
	                          const selected = selectedCalendarAccountIds.includes(option.id);
	                          return (
	                            <button
	                              key={option.id}
	                              type="button"
	                              onClick={() => toggleCalendarAccount(option.id)}
	                              className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f8f9fa] ${
	                                selected ? 'text-[#1a73e8]' : 'text-[#3c4043]'
	                              }`}
	                            >
	                              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
	                                selected ? 'border-[#1a73e8] bg-[#1a73e8]' : 'border-[#dadce0] bg-white'
	                              }`}>
	                                {selected && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
	                              </span>
	                              <PlatformIcon platform={option.platform} className="h-5 w-5 flex-shrink-0" showFallback={true} />
	                              <AccountAvatar account={option.channel} sizeClass="h-6 w-6" textClass="text-[9px]" />
	                              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">@{option.label}</span>
	                              <span className="flex-shrink-0 text-[9px] font-bold uppercase text-[#80868b]">{option.platform}</span>
	                            </button>
	                          );
	                        })}
	                        {accountFilterOptions.length === 0 && (
	                          <div className="px-3 py-3 text-[12px] font-medium text-[#80868b]">
	                            No campaign accounts
	                          </div>
	                        )}
	                      </div>
	                    </div>
	                  )}
	                </div>
                <div className="flex items-center gap-1.5 h-8 rounded-lg border border-[#dadce0] bg-white px-3">
                  <svg className="h-3.5 w-3.5 text-[#5f6368]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  <select
                    value={selectedCalendarStatus}
                    onChange={(e) => setSelectedCalendarStatus(e.target.value)}
                    className="border-0 bg-transparent text-[12px] font-medium text-[#3c4043] outline-none cursor-pointer appearance-none pr-4"
                  >
                    <option value="all">All statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="manual">Manual Ready</option>
                    <option value="done">Published</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Paused / Cancelled</option>
                  </select>
                  <ChevronLeft className="h-3 w-3 -rotate-90 text-[#80868b] -ml-3" />
                </div>
                {queueEditorAccountId && (
                  <button
                    type="button"
                    onClick={openQueueEditor}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-[#1a73e8] bg-[#eff6ff] px-3 text-[12px] font-semibold text-[#1a73e8] transition-colors hover:bg-[#dbeafe]"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Edit Queue</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center rounded-lg border border-[#dadce0] overflow-hidden">
                  {['month', 'week'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCalendarPreset(mode)}
                      className={`h-8 px-4 text-[12px] font-semibold capitalize transition-colors ${
                        calendarMode === mode
                          ? 'bg-[#1a73e8] text-white'
                          : 'bg-white text-[#3c4043] hover:bg-[#f8f9fa]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {!isViewer && (
                  <button
                    onClick={() => setShowComposer(true)}
                    className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 h-8 rounded-lg text-[12px] font-semibold transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Schedule</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Calendar Grid + Sidebar */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Calendar Grid */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-r border-[#e8eaed] relative">
              {activeTooltipDay && (
                <button
                  type="button"
                  aria-label="Close schedule tooltip"
                  className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                  onClick={() => setActiveTooltipDay(null)}
                />
              )}
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-[#e8eaed] bg-white flex-shrink-0">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="px-3 py-2 text-[11px] font-semibold text-[#70757a] text-center border-r border-[#e8eaed] last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Cells */}
              <div className={`flex-1 min-h-0 grid grid-cols-7 overflow-y-auto ${
                calendarMode === 'week' ? 'auto-rows-fr' : 'auto-rows-[160px]'
              }`}>
                {calendarDays.map((day) => {
                  const previewLimit = calendarMode === 'week' ? day.posts.length : 4;
                  const visibleDayPosts = day.posts.slice(0, previewLimit);
                  const moreCount = Math.max(day.posts.length - visibleDayPosts.length, 0);
                  const isTooltipOpen = activeTooltipDay === day.key;

                  const getStatusRowStyle = (group) => {
                    switch (group) {
                      case 'manual': return 'bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]';
                      case 'done': return 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]';
                      case 'failed': return 'bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]';
                      case 'cancelled': return 'bg-[#f9fafb] text-[#6b7280] border border-[#e5e7eb]';
                      default: return 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]';
                    }
                  };

                  return (
	                    <div
	                      key={day.key}
	                      onClick={() => setSelectedCalendarDate(day.key)}
	                      className={`relative border-b border-r border-[#e8eaed] p-1 text-left transition-colors flex flex-col cursor-pointer ${
		                        calendarMode === 'week' ? 'min-h-full' : 'min-h-[160px]'
		                      } ${
	                        isTooltipOpen ? 'z-[9999] overflow-visible shadow-md' : 'z-0 overflow-hidden'
	                      } ${
	                        day.isSelected
	                          ? 'bg-[#e8f0fe]'
                          : day.inRange
                            ? 'bg-white hover:bg-[#f8f9fa]'
                            : 'bg-[#f8f9fa]'
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedCalendarDate(day.key);
                        }
                      }}
                    >
                      {/* Date Number + Post Count */}
	                      <div className="mb-0.5 flex items-center justify-between">
	                        <span className={`inline-flex items-center justify-center h-5 min-w-5 rounded-full text-[11px] font-bold ${
                          day.isToday
                            ? 'bg-[#1a73e8] text-white'
                            : day.inRange
                              ? 'text-[#202124]'
                              : 'text-[#bdc1c6]'
                        }`}>
                          {day.date.getDate()}
                        </span>
                        <div className="flex items-center gap-1">
                          {moreCount > 0 ? (
                            <button
                              type="button"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                setSelectedCalendarDate(day.key);
	                                if (isTooltipOpen) {
	                                  setActiveTooltipDay(null);
	                                  return;
	                                }
	                                const rect = e.currentTarget.getBoundingClientRect();
	                                const tooltipWidth = 360;
	                                const margin = 12;
	                                const alignRight = rect.left + tooltipWidth > window.innerWidth - margin;
	                                setTooltipPosition({
	                                  top: Math.min(rect.bottom + 8, window.innerHeight - margin),
	                                  left: alignRight
	                                    ? Math.max(margin, rect.right - tooltipWidth)
	                                    : Math.min(rect.left, window.innerWidth - tooltipWidth - margin),
	                                });
	                                setActiveTooltipDay(day.key);
	                              }}
		                              className="rounded-full bg-blue-50 px-1 py-0 text-[9px] font-black text-blue-700 hover:bg-blue-100"
	                            >
                              +{moreCount} more
                            </button>
                          ) : day.posts.length > 0 ? (
	                            <span className="text-[9px] font-bold text-[#5f6368] bg-[#f1f3f4] rounded-full px-1 py-0">
                              {day.posts.length}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Post Entries — compact preview */}
	                      <div className="min-h-0 space-y-1 overflow-hidden flex-1">
                        {visibleDayPosts.map((item) => {
                          const primaryChannel = item.accountRefs[0]?.channel;
                          return (
	                            <div
	                              key={`${item.post._id}-${item.accountRefs[0]?.id || 'account'}`}
		                              className={`flex h-7 min-w-0 items-center gap-1 rounded-md px-1 shadow-sm ${getStatusRowStyle(item.statusGroup)}`}
	                            >
	                              <PlatformIcon platform={primaryChannel?.platform} className="h-5 w-5 flex-shrink-0" showFallback={true} />
	                              <AccountAvatar account={primaryChannel} sizeClass="h-5 w-5" textClass="text-[8px]" />
	                              <span className="truncate text-[11px] font-bold">{item.timeLabel}</span>
	                            </div>
                          );
	                        })}
	                      </div>
		                      {isTooltipOpen && (
		                        <div
		                          onClick={(e) => e.stopPropagation()}
		                          onWheel={(e) => e.stopPropagation()}
		                          className="fixed z-[9999] flex max-h-[460px] w-[360px] flex-col rounded-xl border border-[#dfe3ea] bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.2)]"
		                          style={{
		                            top: `${tooltipPosition.top}px`,
		                            left: `${tooltipPosition.left}px`,
		                          }}
		                        >
		                          <div className="mb-2 flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#eef1f5] pb-1.5">
	                            <div className="min-w-0">
	                              <p className="m-0 truncate text-[11px] font-black text-[#202124]">
	                                {day.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
	                              </p>
	                              <p className="m-0 text-[9px] font-semibold text-[#70757a]">
	                                {day.posts.length} scheduled item{day.posts.length === 1 ? '' : 's'}
	                              </p>
	                            </div>
	                            <button
	                              type="button"
	                              onClick={() => setActiveTooltipDay(null)}
	                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#70757a] hover:bg-[#f1f3f4] hover:text-[#202124]"
	                              title="Close"
	                            >
	                              <X className="h-3.5 w-3.5" />
	                            </button>
	                          </div>
		                          <div
		                            className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1"
		                            onWheel={(e) => e.stopPropagation()}
		                          >
	                            {day.posts.map((item) => {
	                              const primaryChannel = item.accountRefs[0]?.channel;
	                              return (
		                                <div
		                                  key={`tooltip-${item.post._id}-${item.accountRefs[0]?.id || 'account'}`}
		                                  className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 shadow-sm ${getStatusRowStyle(item.statusGroup)}`}
		                                >
		                                  <div className="flex shrink-0 items-center gap-1.5">
		                                    <PlatformIcon platform={primaryChannel?.platform} className="h-6 w-6 shrink-0" showFallback={true} />
		                                    <AccountAvatar account={primaryChannel} sizeClass="h-8 w-8" textClass="text-[11px]" />
		                                  </div>
		                                  <div className="min-w-0 flex-1">
		                                    <div className="flex min-w-0 items-center gap-1.5">
		                                      <span className="shrink-0 text-[12px] font-black">{item.timeLabel}</span>
		                                      <span className="truncate text-[11px] font-bold opacity-80">{getPostStatusLabel(item.post)}</span>
		                                    </div>
		                                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
		                                      <span className="truncate text-[11px] font-bold opacity-80">@{getAccountLabel(primaryChannel)}</span>
		                                    </div>
		                                    <p className="m-0 mt-0.5 truncate text-[10px] font-semibold opacity-70">{item.mediaLabel}</p>
		                                  </div>
		                                </div>
	                              );
	                            })}
	                          </div>
	                        </div>
	                      )}
	                    </div>
                  );
                })}
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-[#e8eaed] bg-white flex-shrink-0">
                {[
                  ['Scheduled', 'bg-[#1a73e8]'],
                  ['Manual Ready', 'bg-[#f59e0b]'],
                  ['Published', 'bg-[#34a853]'],
                  ['Failed', 'bg-[#ea4335]'],
                  ['Paused / Cancelled', 'bg-[#9aa0a6]'],
                ].map(([label, dotColor]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-[11px] font-medium text-[#5f6368]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar — Selected Date Detail */}
            <aside className="w-[260px] xl:w-[300px] min-h-0 flex flex-col overflow-hidden bg-white flex-shrink-0">
              {/* Sidebar Header */}
              <div className="border-b border-[#e8eaed] px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
                <div className="min-w-0 flex items-center gap-2">
                  <h3 className="m-0 text-[13px] font-bold text-[#1a1a2e] truncate">
                    {(() => {
                      const d = parseInputDate(selectedCalendarDate) || new Date();
                      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    })()}
                  </h3>
                  <span className="rounded-full border border-[#dadce0] bg-[#f8f9fa] px-1.5 py-0.5 text-[10px] font-semibold text-[#5f6368]">
                    {selectedDayPosts.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate('')}
                  className="h-6 w-6 rounded-full hover:bg-[#f1f3f4] flex items-center justify-center text-[#5f6368] transition-colors flex-shrink-0"
                  title="Close"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {selectedDayGroups.length === 0 && (
	                  <div className="h-32 flex flex-col items-center justify-center gap-1.5 text-center px-3">
	                    <Clock className="h-6 w-6 text-[#dadce0]" />
	                    <p className="m-0 text-[12px] font-semibold text-[#5f6368]">No posts</p>
	                  </div>
                )}

                {selectedDayGroups.map((group) => {
                  const activePostIds = group.posts
                    .filter((item) => (
                      isActiveQueuePost(item.post)
                      && (item.post.socialAccountIds || []).some((account) => String(account?._id || account) === String(group.id))
                    ))
                    .map((item) => item.post._id);
                  const deletingAccountQueue = deletingAccountQueueIds.includes(group.id);

                  return (
                    <div key={group.id} className="border-b border-[#e8eaed]">
                      {/* Account Header */}
	                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#f8f9fa]">
	                        <div className="min-w-0 flex items-center gap-2">
	                          <PlatformIcon platform={group.channel?.platform} className="h-5 w-5 flex-shrink-0" showFallback={true} />
	                          <AccountAvatar account={group.channel} sizeClass="h-8 w-8" textClass="text-[10px]" />
	                          <span className="text-[12px] font-semibold text-[#3c4043] truncate">@{getAccountLabel(group.channel)}</span>
	                        </div>
	                        <div className="flex items-center gap-1.5">
	                          <span className="text-[10px] font-semibold text-[#5f6368] bg-white border border-[#dadce0] rounded-full px-1.5 py-0.5">{group.posts.length}</span>
                          {activePostIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAccountQueue(group.id, getAccountLabel(group.channel))}
                              disabled={deletingAccountQueue}
                              className="text-[#5f6368] hover:text-[#ea4335] transition-colors"
                              title="Expand"
                            >
                              <ChevronLeft className="h-3.5 w-3.5 -rotate-90" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Posts List */}
                      <div className="divide-y divide-[#f1f3f4]">
                        {group.posts.map((item) => {
                          const getStatusDotBg = (statusGroup) => {
                            switch (statusGroup) {
                              case 'manual': return 'bg-[#f59e0b]';
                              case 'done': return 'bg-[#34a853]';
                              case 'failed': return 'bg-[#ea4335]';
                              case 'cancelled': return 'bg-[#9aa0a6]';
                              default: return 'bg-[#1a73e8]';
                            }
                          };

                          const getStatusPillStyle = (statusGroup) => {
                            switch (statusGroup) {
                              case 'manual': return 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]';
                              case 'done': return 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]';
                              case 'failed': return 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]';
                              case 'cancelled': return 'bg-[#f9fafb] text-[#6b7280] border-[#e5e7eb]';
                              default: return 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]';
                            }
                          };

                          return (
	                            <div key={`${group.id}-${item.post._id}`} className="flex items-center gap-2 px-3 py-2">
	                              {/* Media Thumbnail */}
	                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[#f1f3f4] relative">
	                                <MediaPreview item={item.mediaItem} />
	                              </div>
	                              {/* Post Info */}
	                              <div className="min-w-0 flex-1">
	                                <p className="m-0 text-[11px] font-semibold text-[#1a1a2e] truncate leading-tight">{item.mediaLabel}</p>
	                                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
	                                  <PlatformIcon platform={group.channel?.platform} className="h-4 w-4 flex-shrink-0" showFallback={true} />
	                                  <AccountAvatar account={group.channel} sizeClass="h-5 w-5" textClass="text-[8px]" />
	                                  <span className="truncate text-[11px] font-semibold text-[#5f6368]">@{getAccountLabel(group.channel)}</span>
	                                  <span className="text-[10px] font-semibold text-[#5f6368] flex-shrink-0">{item.timeLabel}</span>
	                                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border truncate ${getStatusPillStyle(item.statusGroup)}`}>
	                                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${getStatusDotBg(item.statusGroup)}`} />
	                                    {getPostStatusLabel(item.post)}
	                                  </span>
	                                </div>
	                              </div>
	                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full selected-day count */}
              {selectedDayPosts.length > 0 && (
	                <div className="border-t border-[#e8eaed] px-3 py-2 flex-shrink-0">
	                  <div className="flex h-7 items-center justify-center rounded-md border border-[#dadce0] bg-[#f8f9fa] text-[11px] font-semibold text-[#3c4043]">
	                    {selectedDayPosts.length} item{selectedDayPosts.length === 1 ? '' : 's'}
	                  </div>
	                </div>
              )}
            </aside>
          </div>
        </section>
      )}



    </div>
  );
};
export default CalendarView;
