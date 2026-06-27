import { useState, useEffect, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Plus, Check, Clock, AlertCircle, Folder, Users, Save } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';

const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('https://pub-') || url.includes('r2.cloudflarestorage.com')) {
    return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

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
  const [posts, setPosts] = useState([]);
  const canvasRef = useRef(null);
  const [portPositions, setPortPositions] = useState({});

  // Composer data
  const [showComposer, setShowComposer] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [folders, setFolders] = useState([]);
  const [channels, setChannels] = useState([]);

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
  const [postType, setPostType] = useState('reels');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState('private');
  const [youtubeTags, setYoutubeTags] = useState('');
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);

  const [bulkInterval, setBulkInterval] = useState('2');
  const [activeFolderId, setActiveFolderId] = useState('root');

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
  const isBulk = selectedMedia.length > 1;
  const activeFolderName = activeFolderId === 'root'
    ? 'Campaign Library'
    : folders.find(folder => folder._id === activeFolderId)?.name || 'Selected Folder';
  const folderOptions = useMemo(() => [
    { _id: 'root', name: 'Campaign Library' },
    ...folders,
  ], [folders]);
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
  const schedulePlan = useMemo(() => {
    const baseDate = scheduleTime ? new Date(scheduleTime) : null;
    const hasValidDate = baseDate && !Number.isNaN(baseDate.getTime());
    const intervalMs = (parseFloat(bulkInterval) || 2) * 60 * 60 * 1000;
    const rows = [];

    if (isBulk) {
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
      rows.push({
        channel: selectedChannelObjects.length === 1
          ? selectedChannelObjects[0]
          : { name: `${selectedChannelObjects.length} portals`, platform: 'multi' },
        mediaItem: selectedMediaItems[0],
        caption: getPlannedCaption(selectedMediaItems[0]),
        scheduledAt: hasValidDate ? baseDate : null,
      });
    }

    return rows
      .sort((a, b) => {
        const aTime = a.scheduledAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduledAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .map((row, index) => ({ ...row, index: index + 1 }));
  }, [bulkInterval, caption, captionDrafts, isBulk, scheduleTime, selectedChannelObjects, selectedChannels.length, selectedMediaItems]);
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
    setSelectedMedia((current) => (
      current.filter(mediaId => {
        const item = mediaList.find(media => media._id === mediaId);
        if (!item || !isMediaAvailableForChannels(item, selectedChannels)) return false;
        if (activeFolderId === 'root') return !item.folderId;
        const itemFolderId = item.folderId?._id || item.folderId;
        return itemFolderId === activeFolderId;
      })
    ));
  }, [selectedChannels, mediaList, activeFolderId]);

  useEffect(() => {
    if (selectedChannels.length === 0) {
      setSelectedMedia([]);
      return;
    }

    setSelectedMedia(availableMediaList.map(item => item._id));
  }, [availableMediaList, selectedChannels.length]);

  const fetchPosts = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('tw_token')}` };
      const accountResponse = await fetch(`${API_BASE_URL}/api/accounts${withCampaignScope()}`, { headers });
      const accounts = accountResponse.ok ? await accountResponse.json() : [];
      const scopedAccountIds = selectedAccounts.length > 0 ? selectedAccounts : accounts.map(account => account._id);
      const response = await fetch(`${API_BASE_URL}/api/scheduler${withCampaignScope()}`, { headers });
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter(p => {
          const accId = p.socialAccountIds?.[0]?._id || p.socialAccountIds?.[0];
          return scopedAccountIds.includes(accId);
        });
        setPosts(filtered);
      }
    } catch (error) {
      console.error('Failed to load scheduled posts:', error);
    }
  };

  const fetchComposerData = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const accResponse = await fetch(`${API_BASE_URL}/api/accounts${withCampaignScope()}`, { headers });
      const accData = await accResponse.json();
      setChannels(
        selectedAccounts.length > 0
          ? accData.filter(account => selectedAccounts.includes(account._id))
          : accData
      );

      const medResponse = await fetch(`${API_BASE_URL}/api/media${withCampaignScope()}`, { headers });
      const medData = await medResponse.json();
      setMediaList(medData);

      const folderResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, { headers });
      if (folderResponse.ok) {
        const folderData = await folderResponse.json();
        setFolders(folderData);
      }
    } catch (error) {
      console.error('Failed to fetch composer data:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled post?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${postId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Failed to delete scheduled post:', error);
      setPosts(posts.filter(p => p._id !== postId));
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
    if (selectedMedia.length === 0) {
      alert('Select at least one media asset');
      return;
    }
    const unavailableMedia = selectedMedia.some((mediaId) => {
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
      const captionsSaved = await saveDirtyCaptionDrafts();
      if (!captionsSaved) return;

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
      if (isBulk) {
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
        setShowComposer(false);
        setSelectedChannels([]);
        setSelectedMedia([]);
        setCaption('');
        setScheduleTime('');
        setScheduleMode('auto');
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

  return (
    <div className="py-4 px-0 bg-[#f5f5f7] h-screen text-[#1d1d1f] font-sans flex flex-col overflow-hidden">

      {/* Page Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#e5e5ea] px-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Scheduled Queue</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Review and manage the publication sequence of your posts</p>
        </div>

        {!isViewer && (
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Schedule Queue</span>
          </button>
        )}
      </div>

      {/* In-page Composer */}
      {showComposer && (
        <section className="flex-1 min-h-0 mt-3 mx-3 mb-4 bg-white border border-[#d8e0f4] py-3 px-3 rounded-xl text-black shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#e5e5ea] pb-3 flex-shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-[#0b1645] tracking-tight m-0">Folder Driven Scheduling Flow</h3>
              <p className="m-0 mt-1 text-[10px] text-[#536079]">Folder and asset count drive the mode. Captions belong to individual media assets.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="px-3 py-1.5 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs font-semibold border border-[#e5e5ea] transition-all"
            >
              Hide Composer
            </button>
          </div>

          <form onSubmit={handleComposeSubmit} className="flex-1 min-h-0 overflow-y-auto py-4 pr-1 space-y-4">


            <section className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1.25fr_1.15fr] gap-4">
              <div className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
                <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2">
                  <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">1. Select Accounts</h4>
                </div>
                <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto">
                  {channels.map(chan => {
                    const isSelected = selectedChannels.includes(chan._id);
                    return (
                      <button
                        key={chan._id}
                        type="button"
                        onClick={() => toggleChannel(chan._id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${isSelected
                            ? 'border-[#4f46e5] bg-[#eef2ff] text-[#0b1645]'
                            : 'border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#b8c4e8]'
                          }`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${isSelected ? 'bg-[#2563eb] border-[#2563eb]' : 'border-[#c7c7cc]'}`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <img src={chan.avatarUrl} crossOrigin="anonymous" className="w-6 h-6 rounded-full object-cover border border-black/10" alt="" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{chan.name}</span>
                          <span className="block truncate text-[10px] capitalize text-[#6b7280]">{chan.platform}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-[#e5e5ea] px-3 py-2 text-[10px] font-semibold text-[#536079]">{selectedChannels.length} account{selectedChannels.length === 1 ? '' : 's'} selected</div>
              </div>

              <div className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
                <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2">
                  <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">2. Select / Switch Folder</h4>
                </div>
                <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto">
                  {folderOptions.map(folder => {
                    const count = getFolderAssetCount(folder._id);
                    const isActive = activeFolderId === folder._id;
                    return (
                      <button
                        key={folder._id}
                        type="button"
                        onClick={() => setActiveFolderId(folder._id)}
                        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${isActive
                            ? 'border-[#2563eb] bg-[#eff6ff] text-[#0b1645]'
                            : 'border-[#e5e5ea] bg-white hover:border-[#b8c4e8]'
                          }`}
                      >
                        <Folder className={`h-4 w-4 ${isActive ? 'text-[#2563eb]' : 'text-[#6b7280]'}`} />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{folder.name}</span>
                        <span className="text-[10px] text-[#536079]">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-[#e5e5ea] px-3 py-2 text-[10px] font-semibold text-[#536079]">Selected folder: {activeFolderName}</div>
              </div>

              <div className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
                <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2 flex items-center justify-between">
                  <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">3. Select Matching Assets</h4>
                  <span className="text-[10px] font-semibold text-[#15803d]">{selectedMedia.length}/{availableMediaList.length} selected</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[308px] overflow-y-auto pr-1">
                    {selectedChannels.length > 0 && availableMediaList.map(item => {
                      const isSelected = selectedMedia.includes(item._id);
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => toggleMedia(item._id)}
                          className={`block w-full rounded-lg border overflow-hidden p-0 text-left transition-all ${isSelected
                              ? 'border-[#2563eb] bg-white ring-1 ring-[#2563eb]/30'
                              : 'border-[#d8e0f4] bg-[#f8fafc] opacity-65 hover:opacity-95 hover:border-[#9aaee8]'
                            }`}
                        >
                          <div className="relative aspect-video overflow-hidden bg-[#eef2ff]">
                            <MediaPreview item={item} />
                            <span className={`absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${isSelected ? 'bg-[#2563eb] text-white' : 'bg-white/90 text-[#536079] border border-[#d8e0f4]'}`}>
                              {isSelected ? <Check className="h-3 w-3" /> : ''}
                            </span>
                          </div>
                          <div className="bg-white px-2 py-1.5">
                            <p className="m-0 truncate text-[10px] font-semibold text-[#1d1d1f]" title={getMediaLabel(item)}>{getMediaLabel(item)}</p>
                            
                          </div>
                        </button>
                      );
                    })}
                    {selectedChannels.length === 0 && (
                      <div className="col-span-full h-32 rounded-lg border border-dashed border-[#d8e0f4] bg-[#f8fafc] flex items-center justify-center text-xs text-[#6b7280] text-center p-4">
                        Select accounts to reveal matching assets.
                      </div>
                    )}
                    {selectedChannels.length > 0 && availableMediaList.length === 0 && (
                      <div className="col-span-full h-32 rounded-lg border border-dashed border-[#d8e0f4] bg-[#f8fafc] flex items-center justify-center text-xs text-[#6b7280] text-center p-4">
                        No matching assets in this folder.
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-[#e5e5ea] px-3 py-2 text-[10px] font-semibold text-[#536079]">Click assets to include or remove them from this schedule.</div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
                  <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2">
                    <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">4. Choose Handler Mode</h4>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {['auto', 'manual', 'hybrid'].map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setScheduleMode(mode)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${scheduleMode === mode
                              ? 'bg-[#0b1645] text-white border-[#0b1645]'
                              : 'bg-white text-[#536079] border-[#d8e0f4] hover:text-[#0b1645]'
                            }`}
                        >
                          {getScheduleModeLabel(mode)}
                        </button>
                      ))}
                    </div>
                    <p className="m-0 text-[10px] leading-relaxed text-[#536079]">{getScheduleModeSummary(scheduleMode)}</p>
                  </div>
                </div>

                <div className={`rounded-lg border bg-white overflow-hidden ${isPureManualMode ? 'border-[#f4d7a1]' : isBulk ? 'border-[#bdd0f4]' : 'border-[#bfe4ca]'}`}>
                  <div className={`${isPureManualMode ? 'bg-[#fffaf0]' : isBulk ? 'bg-[#f8fbff]' : 'bg-[#f8fff9]'} border-b border-[#e5e5ea] px-3 py-2`}>
                    <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">
                      {isPureManualMode ? '5. Manual Posting' : isBulk ? '5B. Set Start Time & Interval' : '5A. Set Post Time'}
                    </h4>
                  </div>
                  <div className="p-3 space-y-3">
                    {isPureManualMode ? (
                      <div className="rounded-lg border border-[#f4d7a1] bg-[#fffaf0] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[#7a4b00]">
                        No date or time needed. This creates a creator-ready task for manual download, share, and posting.
                      </div>
                    ) : (
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#536079] mb-1">{isBulk ? 'Start Time' : 'Post Time'}</span>
                        <input
                          type="datetime-local"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full rounded-lg border border-[#d8e0f4] bg-white px-3 py-2 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                        />
                      </label>
                    )}
                    {isBulk && !isPureManualMode && (
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#536079] mb-1">Interval</span>
                        <select
                          value={bulkInterval}
                          onChange={(e) => setBulkInterval(e.target.value)}
                          className="w-full rounded-lg border border-[#d8e0f4] bg-white px-3 py-2 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                        >
                          <option value="1">Every 1 hour</option>
                          <option value="2">Every 2 hours</option>
                          <option value="4">Every 4 hours</option>
                          <option value="12">Every 12 hours</option>
                          <option value="24">Every 1 day</option>
                        </select>
                      </label>
                    )}
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#536079] mb-1">Post Format</span>
                      <div className={`grid ${hasYoutubeSelected ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5`}>
                        {(hasYoutubeSelected ? ['video', 'short'] : ['reels', 'post', 'story']).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPostType(t)}
                            className={`py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${postType === t
                                ? 'bg-[#0b1645] text-white border-[#0b1645]'
                                : 'bg-white text-[#536079] border-[#d8e0f4] hover:text-[#0b1645]'
                              }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {shouldUseYoutubePublishing && (
                  <div className="rounded-lg border border-[#f1c6c6] bg-white overflow-hidden">
                    <div className="bg-[#fff8f8] border-b border-[#f1c6c6] px-3 py-2">
                      <h4 className="m-0 text-[11px] font-bold text-[#991b1b]">YouTube Upload Options</h4>
                    </div>
                    <div className="p-3 space-y-2">
                      <input
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        maxLength={100}
                        placeholder="YouTube video title"
                        className="w-full bg-white border border-[#f1c6c6] px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 text-xs text-black"
                      />
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <input
                          value={youtubeTags}
                          onChange={(e) => setYoutubeTags(e.target.value)}
                          placeholder="Tags"
                          className="w-full bg-white border border-[#f1c6c6] px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 text-xs text-black"
                        />
                        <select
                          value={youtubePrivacy}
                          onChange={(e) => setYoutubePrivacy(e.target.value)}
                          className="w-full bg-white border border-[#f1c6c6] px-2 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 text-xs text-black"
                        >
                          <option value="private">Private</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="public">Public</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-black">
                        <input
                          type="checkbox"
                          checked={youtubeMadeForKids}
                          onChange={(e) => setYoutubeMadeForKids(e.target.checked)}
                          className="rounded"
                        />
                        <span>This video is Made for Kids</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
              <div className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
                <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2 flex items-center justify-between">
                  <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">Media & Caption Management</h4>
                  <span className="text-[10px] font-semibold text-[#536079]">Per-asset captions</span>
                </div>
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto">
                  {selectedMediaItems.map(item => {
                    const draft = getAssetCaptionDraft(item);
                    const isDirty = captionDrafts[item._id] !== undefined && captionDrafts[item._id] !== (item.caption || '');
                    return (
                      <div key={item._id} className="rounded-lg border border-[#d8e0f4] bg-white p-2">
                        <div className="flex gap-2">
                          <div className="h-16 w-20 overflow-hidden rounded-md border border-[#e5e5ea] bg-[#f5f5f7] flex-shrink-0">
                            <MediaPreview item={item} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-xs font-semibold text-[#0b1645]" title={getMediaLabel(item)}>{getMediaLabel(item)}</p>
                            <p className={`m-0 mt-1 text-[9px] font-semibold ${draft.trim() ? 'text-[#15803d]' : 'text-[#b45309]'}`}>{draft.trim() ? 'Caption saved' : 'No caption'}</p>
                          </div>
                        </div>
                        <textarea
                          value={draft}
                          onChange={(e) => setCaptionDrafts((current) => ({
                            ...current,
                            [item._id]: e.target.value,
                          }))}
                          placeholder="Caption for this asset..."
                          className="mt-2 h-20 w-full rounded-lg border border-[#d8e0f4] bg-[#f8fafc] p-2 text-[10px] leading-relaxed text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2563eb] resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => saveMediaCaption(item, draft)}
                          disabled={!isDirty || savingCaptionId === item._id}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-[10px] font-semibold text-white transition-all hover:bg-[#4338ca] disabled:bg-[#e5e7eb] disabled:text-[#9ca3af]"
                        >
                          <Save className="h-3 w-3" />
                          <span>{savingCaptionId === item._id ? 'Saving...' : 'Save Caption'}</span>
                        </button>
                      </div>
                    );
                  })}
                  {selectedMediaItems.length === 0 && (
                    <div className="md:col-span-2 rounded-lg border border-dashed border-[#d8e0f4] bg-[#f8fafc] p-6 text-center text-xs text-[#6b7280]">
                      Matching assets will appear here after selecting accounts and a folder.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
                <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2">
                  <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">Composer Fallback Caption</h4>
                </div>
                <div className="p-3">
                  <textarea
                    placeholder="Default caption for assets without a saved caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="h-32 w-full rounded-lg border border-[#d8e0f4] bg-white p-3 text-xs text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2563eb] resize-none"
                  />
                  <p className="m-0 mt-2 text-[10px] leading-relaxed text-[#536079]">Used only when an asset has no saved caption. YouTube descriptions follow the same caption source.</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d8e0f4] bg-white overflow-hidden">
              <div className="bg-[#fbfaff] border-b border-[#e5e5ea] px-3 py-2 flex items-center justify-between">
                <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">6. Review & Confirm</h4>
                <span className="text-[10px] font-semibold text-[#536079]">{schedulePlan.length} post{schedulePlan.length === 1 ? '' : 's'} will be scheduled</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-[10px]">
                  <thead className="bg-[#f8fafc] text-[#0b1645]">
                    <tr>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">#</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Asset</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Account</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Handler</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Caption Source</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">{isPureManualMode ? 'Manual Status' : 'Scheduled Time'}</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Caption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedulePlan.map(row => (
                      <tr key={`${row.channel?._id || 'multi'}-${row.mediaItem?._id}-${row.index}`} className="border-b border-[#f0f2f7] last:border-b-0">
                        <td className="px-3 py-2 font-semibold text-[#0b1645]">{row.index}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-10 overflow-hidden rounded border border-[#e5e5ea] bg-[#f5f5f7] flex-shrink-0">
                              <MediaPreview item={row.mediaItem} />
                            </div>
                            <span className="truncate font-semibold text-[#1d1d1f]">{getMediaLabel(row.mediaItem)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[#536079]">{row.channel?.name || 'Selected portal'}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full border border-[#d8e0f4] bg-[#f8fafc] px-2 py-1 font-semibold text-[#0b1645]">
                            {getScheduleModeLabel(scheduleMode)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#536079]">{getCaptionSource(row.mediaItem)}</td>
                        <td className="px-3 py-2 text-[#536079]">{getScheduleTimingLabel(row.scheduledAt)}</td>
                        <td className="px-3 py-2 max-w-[240px] truncate text-[#536079]" title={row.caption}>{row.caption || 'No caption drafted'}</td>
                      </tr>
                    ))}
                    {schedulePlan.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-3 py-8 text-center text-xs text-[#6b7280]">
                          {isPureManualMode ? 'Select accounts and media to create manual tasks.' : 'Select accounts, a folder, and a time to preview the schedule.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-[#e5e5ea] bg-[#fbfaff] px-3 py-3">
                <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-[#536079]">
                  <span>{selectedChannels.length} account{selectedChannels.length === 1 ? '' : 's'}</span>
                  <span>{activeFolderName}</span>
                  <span>{getScheduleModeLabel(scheduleMode)} handler</span>
                  <span>{isBulk ? `${selectedMedia.length} asset sequence` : 'single asset post'}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="px-3.5 py-2 bg-white hover:bg-[#f5f5f7] rounded-lg text-xs font-semibold border border-[#d8e0f4] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                  >
                    {isPureManualMode
                      ? manualTaskButtonLabel
                      : schedulePlan.length > 0
                      ? `Schedule ${schedulePlan.length} Post${schedulePlan.length === 1 ? '' : 's'}`
                      : 'Schedule Posts'}
                  </button>
                </div>
              </div>
            </section>
          </form>
        </section>
      )}

      {/* Schedule Overview — Visual Row Board */}
      {!showComposer && (() => {
        const now = new Date();

        // 1. Group posts by account
        const accountMap = {};
        posts.forEach(post => {
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
            const scheduled = accPosts.filter(p => ['scheduled', 'manual_ready', 'downloaded', 'publishing'].includes(p.status));
            const published = accPosts.filter(p => ['published', 'published_auto', 'posted_manual'].includes(p.status));
            const failed = accPosts.filter(p => p.status === 'failed');
            const total = accPosts.length;
            const done = published.length;
            const left = scheduled.length;
            const hasUpcoming = scheduled.some(p => new Date(p.scheduledAt) >= now);
            const isActive = hasUpcoming && left > 0;

            const nextPost = scheduled
              .filter(p => new Date(p.scheduledAt) >= now)
              .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];

            return { accId, channel, total, done, left, failed: failed.length, isActive, nextPost };
          })
          .sort((a, b) => (a.channel?.name || '').localeCompare(b.channel?.name || ''));

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
          const size = 48;
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

            {posts.length === 0 ? (
              <div className="max-w-4xl mx-auto border border-dashed border-slate-200 p-16 rounded-2xl text-center text-slate-500 bg-white flex flex-col items-center gap-3 mt-8 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-slate-400" />
                </div>
                <span className="font-semibold text-slate-700 text-sm">No active schedule flows</span>
                <span className="text-slate-400 text-xs">Create a new schedule queue to establish a flow</span>
              </div>
            ) : (
              <div ref={canvasRef} className="max-w-5xl mx-auto pt-6 space-y-6 relative" style={{ minHeight: '600px' }}>
               

                {/* SVG Connections Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {accountSummaries.map((summary) => {
                    const { accId } = summary;
                    const theme = getPlatformTheme(summary.channel?.platform);

                    // Connection 1: Channel Out to Folder In
                    const fromPort1 = `acc-port-out-${accId}`;
                    const toPort1 = `folder-port-in-${accId}`;
                    const fromPos1 = portPositions[fromPort1];
                    const toPos1 = portPositions[toPort1];

                    // Connection 2: Folder Out to Stats In
                    const fromPort2 = `folder-port-out-${accId}`;
                    const toPort2 = `stats-port-in-${accId}`;
                    const fromPos2 = portPositions[fromPort2];
                    const toPos2 = portPositions[toPort2];

                    const path1 = fromPos1 && toPos1 && typeof fromPos1.x === 'number' && typeof fromPos1.y === 'number' && typeof toPos1.x === 'number' && typeof toPos1.y === 'number'
                      ? `M ${fromPos1.x} ${fromPos1.y} C ${fromPos1.x + Math.abs(toPos1.x - fromPos1.x) * 0.4} ${fromPos1.y}, ${toPos1.x - Math.abs(toPos1.x - fromPos1.x) * 0.4} ${toPos1.y}, ${toPos1.x} ${toPos1.y}`
                      : null;

                    const path2 = fromPos2 && toPos2 && typeof fromPos2.x === 'number' && typeof fromPos2.y === 'number' && typeof toPos2.x === 'number' && typeof toPos2.y === 'number'
                      ? `M ${fromPos2.x} ${fromPos2.y} C ${fromPos2.x + Math.abs(toPos2.x - fromPos2.x) * 0.4} ${fromPos2.y}, ${toPos2.x - Math.abs(toPos2.x - fromPos2.x) * 0.4} ${toPos2.y}, ${toPos2.x} ${toPos2.y}`
                      : null;

                    return (
                      <g key={accId} className="opacity-80">
                        {path1 && (
                          <>
                            <path
                              d={path1}
                              fill="none"
                              stroke={theme.accent}
                              strokeWidth="4"
                              className="opacity-15 blur-[2px]"
                            />
                            <path
                              d={path1}
                              fill="none"
                              stroke={summary.isActive ? theme.accent : '#94a3b8'}
                              strokeWidth={summary.isActive ? "2.5" : "1.5"}
                              strokeDasharray={summary.isActive ? "6, 4" : "4, 4"}
                              style={summary.isActive ? { animation: 'dash 25s linear infinite' } : {}}
                            />
                          </>
                        )}
                        {path2 && (
                          <>
                            <path
                              d={path2}
                              fill="none"
                              stroke={theme.accent}
                              strokeWidth="4"
                              className="opacity-15 blur-[2px]"
                            />
                            <path
                              d={path2}
                              fill="none"
                              stroke={summary.isActive ? theme.accent : '#94a3b8'}
                              strokeWidth={summary.isActive ? "2.5" : "1.5"}
                              strokeDasharray={summary.isActive ? "6, 4" : "4, 4"}
                              style={summary.isActive ? { animation: 'dash 25s linear infinite' } : {}}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>

                <div className="space-y-12 relative z-10">
                  {accountSummaries.map((summary) => {
                    const { accId, channel, total, done, left, failed: failedCount, isActive, nextPost } = summary;
                    const theme = getPlatformTheme(channel?.platform);
                    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

                    // Find folders used by this channel's scheduled posts
                    const usedFolderMap = {};
                    const channelPosts = accountMap[accId] || [];
                    channelPosts.forEach(post => {
                      (post.mediaIds || []).forEach(m => {
                        const folder = m?.folderId;
                        const fId = folder?._id || folder || 'root';
                        if (!usedFolderMap[fId]) {
                          if (fId === 'root') {
                            usedFolderMap[fId] = {
                              id: 'root',
                              name: 'Campaign Library',
                              filesLeft: mediaList.filter(media => !media.folderId).length
                            };
                          } else {
                            const folderObj = folders.find(f => f._id === fId);
                            const mediaCount = mediaList.filter(media => (media.folderId?._id || media.folderId) === fId).length;
                            usedFolderMap[fId] = {
                              id: fId,
                              name: folderObj?.name || 'Campaign Folder',
                              filesLeft: mediaCount
                            };
                          }
                        }
                      });
                    });
                    const channelFolders = Object.values(usedFolderMap);

                    return (
                      <div
                        key={accId}
                        className="flex flex-col md:flex-row items-center md:justify-between gap-8 md:gap-4 relative"
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
                              <h4 className="text-xs font-bold text-slate-800 m-0 truncate">{channel?.name || 'Account'}</h4>
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

                        {/* Folders Node */}
                        <div className="relative flex-shrink-0 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl px-4 py-3 shadow-sm hover:shadow hover:border-indigo-400 hover:scale-[1.02] transition-all duration-300 w-full md:w-[260px]">
                          {/* Incoming Port Left */}
                          <div
                            data-port-id={`folder-port-in-${accId}`}
                            className="hidden md:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                          />
                          {/* Outgoing Port Right */}
                          <div
                            data-port-id={`folder-port-out-${accId}`}
                            className="hidden md:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                          />
                          <div className="flex flex-col gap-1.5">
                            <div className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">Content Sources</div>
                            {channelFolders.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">No folder content queued</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {channelFolders.map(folder => (
                                  <div
                                    key={folder.id}
                                    className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-0.5 flex items-center gap-1 shadow-sm"
                                  >
                                    <Folder className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                                    <span className="text-[9px] font-bold text-indigo-950 truncate max-w-[100px]">{folder.name}</span>
                                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded-full font-extrabold">{folder.filesLeft}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Stats Node */}
                        <div className="relative flex-shrink-0 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:shadow hover:border-indigo-400 hover:scale-[1.02] transition-all duration-300 w-full md:w-[280px]">
                          {/* Incoming Port Left */}
                          <div
                            data-port-id={`stats-port-in-${accId}`}
                            className="hidden md:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm transition-transform hover:scale-125 cursor-crosshair z-30"
                          />
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-100 rounded-xl p-1.5 text-center">
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
                                <p className="m-0 mt-1.5 text-[8px] text-slate-500 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-slate-400" /> {getScheduleModeLabel(nextPost.scheduleMode)} - {getPostStatusLabel(nextPost)} - {new Date(nextPost.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
