import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Plus, Check, Trash2, Clock, AlertCircle, Folder, Users, Layers, CalendarDays, Save, FileText } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';

const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('https://pub-') || url.includes('r2.cloudflarestorage.com')) {
    return `http://localhost:5001/api/media/proxy?url=${encodeURIComponent(url)}`;
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

export const CalendarView = ({ selectedAccounts }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [posts, setPosts] = useState([]);

  // Composer data
  const [showComposer, setShowComposer] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [folders, setFolders] = useState([]);
  const [channels, setChannels] = useState([]);

  // Post Composer form states
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [caption, setCaption] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
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
      const accountResponse = await fetch(`http://localhost:5001/api/accounts${withCampaignScope()}`, { headers });
      const accounts = accountResponse.ok ? await accountResponse.json() : [];
      const scopedAccountIds = selectedAccounts.length > 0 ? selectedAccounts : accounts.map(account => account._id);
      const response = await fetch(`http://localhost:5001/api/scheduler${withCampaignScope()}`, { headers });
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

      const accResponse = await fetch(`http://localhost:5001/api/accounts${withCampaignScope()}`, { headers });
      const accData = await accResponse.json();
      setChannels(
        selectedAccounts.length > 0
          ? accData.filter(account => selectedAccounts.includes(account._id))
          : accData
      );

      const medResponse = await fetch(`http://localhost:5001/api/media${withCampaignScope()}`, { headers });
      const medData = await medResponse.json();
      setMediaList(medData);

      const folderResponse = await fetch(`http://localhost:5001/api/media/folders${withCampaignScope()}`, { headers });
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
      const response = await fetch(`http://localhost:5001/api/scheduler/${postId}${withCampaignScope()}`, {
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
      const response = await fetch(`http://localhost:5001/api/media/${item._id}${withCampaignScope()}`, {
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
    if (!scheduleTime) {
      alert('Pick a scheduling date and time');
      return;
    }
    if (hasYoutubeSelected) {
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
      const platformSpecifics = {
        type: postType,
        ...(hasYoutubeSelected ? {
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
        scheduledAt: new Date(scheduleTime),
        platformSpecifics
      };

      let url = 'http://localhost:5001/api/scheduler';

      if (isBulk) {
        url = 'http://localhost:5001/api/scheduler/bulk';
        body.startDate = new Date(scheduleTime);
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
                <div className={`rounded-lg border bg-white overflow-hidden ${isBulk ? 'border-[#bdd0f4]' : 'border-[#bfe4ca]'}`}>
                  <div className={`${isBulk ? 'bg-[#f8fbff]' : 'bg-[#f8fff9]'} border-b border-[#e5e5ea] px-3 py-2`}>
                    <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">{isBulk ? '4B. Set Start Time & Interval' : '4A. Set Post Time'}</h4>
                  </div>
                  <div className="p-3 space-y-3">
                    <label className="block">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#536079] mb-1">{isBulk ? 'Start Time' : 'Post Time'}</span>
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full rounded-lg border border-[#d8e0f4] bg-white px-3 py-2 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                      />
                    </label>
                    {isBulk && (
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

                {hasYoutubeSelected && (
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
                <h4 className="m-0 text-[11px] font-bold text-[#0b1645]">5. Review & Confirm</h4>
                <span className="text-[10px] font-semibold text-[#536079]">{schedulePlan.length} post{schedulePlan.length === 1 ? '' : 's'} will be scheduled</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-[10px]">
                  <thead className="bg-[#f8fafc] text-[#0b1645]">
                    <tr>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">#</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Asset</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Account</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Caption Source</th>
                      <th className="border-b border-[#e5e5ea] px-3 py-2 font-bold">Scheduled Time</th>
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
                        <td className="px-3 py-2 text-[#536079]">{getCaptionSource(row.mediaItem)}</td>
                        <td className="px-3 py-2 text-[#536079]">{formatScheduleDate(row.scheduledAt)} {formatScheduleTime(row.scheduledAt)}</td>
                        <td className="px-3 py-2 max-w-[240px] truncate text-[#536079]" title={row.caption}>{row.caption || 'No caption drafted'}</td>
                      </tr>
                    ))}
                    {schedulePlan.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-3 py-8 text-center text-xs text-[#6b7280]">Select accounts, a folder, and a time to preview the schedule.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-[#e5e5ea] bg-[#fbfaff] px-3 py-3">
                <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-[#536079]">
                  <span>{selectedChannels.length} account{selectedChannels.length === 1 ? '' : 's'}</span>
                  <span>{activeFolderName}</span>
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
                    {schedulePlan.length > 0
                      ? `Schedule ${schedulePlan.length} Post${schedulePlan.length === 1 ? '' : 's'}`
                      : 'Schedule Posts'}
                  </button>
                </div>
              </div>
            </section>
          </form>
        </section>
      )}

      {/* Queue Feed List */}
      {!showComposer && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
          <div className="max-w-4xl mx-auto space-y-3 pt-1">
            {posts.length === 0 ? (
              <div className="border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm flex flex-col items-center gap-2">
                <Clock className="w-8 h-8 text-gray-300 animate-pulse" />
                <span className="font-semibold text-gray-400">No scheduled posts in the queue.</span>
              </div>
            ) : (
              posts.map(post => {
                const firstMedia = post.mediaIds?.[0];
                const mediaCount = post.mediaIds?.length || 0;
                const postDate = new Date(post.scheduledAt);
                const isOverdue = postDate < new Date() && post.status === 'scheduled';

                return (
                  <div
                    key={post._id}
                    className="bg-white border border-[#e5e5ea] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-gray-400 transition-all duration-150 shadow-sm"
                  >
                    {/* Left: Execute Time Details */}
                    <div className="flex items-start gap-3 min-w-[200px]">
                      <div className="p-2 bg-[#f5f5f7] rounded-lg text-gray-500 flex-shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-black leading-tight">
                          {postDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 mt-1.5 text-[8px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                            <AlertCircle className="w-2 h-2" />
                            Overdue / Waiting
                          </span>
                        )}
                      </div>
                    </div>

                {/* Center: Media & Caption Card */}
                <div className="flex-1 flex items-center gap-4 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-[#f5f5f7] rounded-lg border border-[#e5e5ea] overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                    {firstMedia ? (
                      <MediaPreview item={firstMedia} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-gray-300">No media</span>
                    )}
                    {firstMedia && (
                      <div className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[7px] text-white uppercase font-bold">
                        {firstMedia.type}
                      </div>
                    )}
                  </div>

                      {/* Caption & Metadata */}
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-black truncate m-0" title={getMediaLabel(firstMedia)}>
                            {getMediaLabel(firstMedia)}
                            {mediaCount > 1 ? ` + ${mediaCount - 1} more` : ''}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5" title={getMediaLocationLabel(firstMedia)}>
                            Folder: {getMediaLocationLabel(firstMedia)}
                          </p>
                        </div>
                        <p className="text-xs text-[#1d1d1f] font-normal leading-relaxed truncate" title={post.caption}>
                          {post.caption || <span className="text-gray-300 italic">No caption drafted</span>}
                        </p>

                        {/* Badges row */}
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-[8px] uppercase tracking-wider bg-black/5 text-[#1d1d1f] border border-black/10 px-1.5 py-0.5 rounded font-bold">
                            {(post.platformSpecifics?.type || 'reels').toUpperCase()}
                          </span>

                      {/* Targeted Channels */}
                      <div className="flex items-center gap-1 pl-2 border-l border-[#e5e5ea]">
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mr-1">Channels:</span>
                        <div className="flex -space-x-1.5">
                          {post.socialAccountIds?.map((accId, accIdx) => {
                            const acc = channels.find(c => c._id === (accId._id || accId));
                            return acc ? (
                              <img 
                                key={accIdx}
                                src={acc.avatarUrl} 
                                crossOrigin="anonymous"
                                className="w-4 h-4 rounded-full object-cover border border-white" 
                                title={acc.name} 
                                alt="" 
                              />
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                    {/* Right: Status Pill & Delete Button */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusBadgeColor(post.status)}`}>
                        {post.status}
                      </span>

                      {!isViewer && (
                        <button
                          onClick={() => handleDeletePost(post._id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-[#f5f5f7] rounded-lg transition-all"
                          title="Cancel and Delete"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
};
export default CalendarView;
