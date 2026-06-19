import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Plus, Check, Trash2, Clock, AlertCircle, Folder } from 'lucide-react';

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
  
  const [bulkInterval, setBulkInterval] = useState('2');
  const [activeFolderId, setActiveFolderId] = useState('root');

  const isViewer = user?.role === 'viewer';
  const selectedChannelObjects = channels.filter(chan => selectedChannels.includes(chan._id));
  const hasYoutubeSelected = selectedChannelObjects.some(chan => chan.platform === 'youtube');
  const getMediaAccountIds = (item) => (item?.socialAccountIds || []).map(account => account._id || account);
  const getFolderName = (folderId) => {
    if (!folderId) return 'Library Root';
    const id = folderId._id || folderId;
    return folders.find(folder => folder._id === id)?.name || 'Unknown folder';
  };
  const getMediaLabel = (item) => item?.name || 'Untitled media';
  const getMediaLocationLabel = (item) => getFolderName(item?.folderId);
  const getPlannedCaption = (item) => item?.caption?.trim() || caption.trim();
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
    if (channelIds.length === 0) return true;
    const mediaAccountIds = getMediaAccountIds(item);
    return channelIds.every(channelId => mediaAccountIds.includes(channelId));
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
  const isBulk = availableMediaList.length > 1;
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
  }, [bulkInterval, caption, isBulk, scheduleTime, selectedChannelObjects, selectedChannels.length, selectedMediaItems]);
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
        return item && isMediaAvailableForChannels(item, selectedChannels);
      })
    ));
  }, [selectedChannels, mediaList]);

  useEffect(() => {
    if (selectedChannels.length === 0) {
      setSelectedMedia([]);
      return;
    }

    const folderMediaIds = availableMediaList.map(item => item._id);
    setSelectedMedia((current) => {
      if (
        current.length === folderMediaIds.length &&
        current.every((mediaId, index) => mediaId === folderMediaIds[index])
      ) {
        return current;
      }
      return folderMediaIds;
    });
  }, [availableMediaList, selectedChannels.length]);

  const fetchPosts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/scheduler', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const filtered = data.filter(p => {
          const accId = p.socialAccountIds?.[0]?._id || p.socialAccountIds?.[0];
          return selectedAccounts.includes(accId);
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

      const accResponse = await fetch('http://localhost:5001/api/accounts', { headers });
      const accData = await accResponse.json();
      setChannels(accData);

      const medResponse = await fetch('http://localhost:5001/api/media', { headers });
      const medData = await medResponse.json();
      setMediaList(medData);

      const folderResponse = await fetch('http://localhost:5001/api/media/folders', { headers });
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
      const response = await fetch(`http://localhost:5001/api/scheduler/${postId}`, {
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

  const handleComposeSubmit = async (e) => {
    e.preventDefault();

    if (selectedChannels.length === 0) {
      alert('Select at least one social account');
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
      alert('Selected media is not available for one or more selected social accounts.');
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
      const token = localStorage.getItem('tw_token');
      const platformSpecifics = {
        type: postType,
        ...(hasYoutubeSelected ? {
          youtube: {
            title: youtubeTitle.trim(),
            description: caption || selectedMediaItems[0]?.caption || '',
            privacyStatus: youtubePrivacy,
            tags: youtubeTags,
            categoryId: '22',
            selfDeclaredMadeForKids: youtubeMadeForKids,
          }
        } : {}),
      };
      const body = {
        socialAccountIds: selectedChannels,
        mediaIds: selectedMedia,
        caption: caption || selectedMediaItems[0]?.caption || '',
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

  const selectMediaItem = (medId) => {
    if (!availableMediaList.some(item => item._id === medId)) return;
    setSelectedMedia(availableMediaList.map(item => item._id));
  };

  const handleRemoveMedia = (mediaId) => {
    setSelectedMedia((current) => current.filter(id => id !== mediaId));
  };

  const toggleChannel = (channelId) => {
    setSelectedChannels((current) => (
      current.includes(channelId)
        ? current.filter(id => id !== channelId)
        : [...current, channelId]
    ));
  };

  return (
    <div className="py-4 px-0 bg-[#f5f5f7] h-[calc(100vh-4rem)] text-[#1d1d1f] font-sans flex flex-col overflow-hidden">
      
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
            <span>New Scheduled Post</span>
          </button>
        )}
      </div>

      {/* In-page Composer */}
      {showComposer && (
        <section className="flex-1 min-h-0 mt-3 mx-3 mb-4 bg-white border border-[#e5e5ea] py-3 px-3 rounded-xl text-black shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#e5e5ea] pb-2 flex-shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider m-0">Schedule Content</h3>
              <p className="m-0 mt-1 text-[10px] text-gray-500">Pick portals, pick files, confirm the exact posting order.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="px-3 py-1.5 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs font-semibold border border-[#e5e5ea] transition-all"
            >
              Hide Composer
            </button>
          </div>

          <form onSubmit={handleComposeSubmit} className="flex-1 min-h-0 pt-3 grid grid-cols-[280px_minmax(0,1fr)_340px] gap-3 overflow-hidden">
            {/* Column 1: Setup Details */}
            <section className="min-h-0 rounded-xl border border-[#e5e5ea] p-3 flex flex-col gap-3 overflow-hidden bg-white">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#e5e5ea]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0071e3] text-white text-[10px] font-bold">1</span>
                Setup Details
              </h3>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                {/* Portals */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Target Portals</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {channels.map(chan => {
                      const isSelected = selectedChannels.includes(chan._id);
                      return (
                        <button
                          key={chan._id}
                          type="button"
                          onClick={() => toggleChannel(chan._id)}
                          className={`flex items-center gap-2.5 rounded-xl border p-2 text-left text-xs transition-all duration-150 ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-[#f5f5f7] border-[#e5e5ea] text-[#1d1d1f] hover:text-black hover:bg-gray-100 hover:border-gray-300'
                          }`}
                        >
                          <img src={chan.avatarUrl} className="w-5 h-5 rounded-full object-cover border border-black/10" alt="" />
                          <span className="min-w-0 flex-1 truncate font-medium">{chan.name}</span>
                          <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/5 text-[#8e8e93] border border-black/10">
                            {chan.platform}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Format */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Post Format</label>
                  <div className={`grid ${hasYoutubeSelected ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5`}>
                    {(hasYoutubeSelected ? ['video', 'short'] : ['reels', 'post', 'story']).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPostType(t)}
                        className={`py-1.5 rounded-xl text-xs font-semibold capitalize transition-all border ${
                          postType === t 
                            ? 'bg-black text-white border-black font-semibold shadow-sm' 
                            : 'bg-[#f5f5f7] text-[#8e8e93] border-[#e5e5ea] hover:text-black hover:bg-gray-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Configuration */}
                <div className="space-y-3 pt-2 border-t border-[#e5e5ea]">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    {isBulk ? 'Start time' : 'Post time'}
                    <input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="mt-1.5 w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                    />
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`py-1.5 border rounded-xl text-xs font-semibold text-center ${
                        isBulk
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-[#f5f5f7] border-[#e5e5ea] text-gray-500'
                      }`}
                    >
                      {isBulk ? 'Bulk Mode' : 'Single Post'}
                    </div>
                    <select
                      value={bulkInterval}
                      onChange={(e) => setBulkInterval(e.target.value)}
                      disabled={!isBulk}
                      className={`border border-[#e5e5ea] px-2 py-1.5 rounded-xl text-xs focus:outline-none transition-all ${isBulk ? 'bg-[#f5f5f7] text-black' : 'bg-[#f5f5f7] text-gray-300'}`}
                    >
                      <option value="1">1h gap</option>
                      <option value="2">2h gap</option>
                      <option value="4">4h gap</option>
                      <option value="12">12h gap</option>
                      <option value="24">24h gap</option>
                    </select>
                  </div>
                </div>

                {/* Caption */}
                <div className="pt-2 border-t border-[#e5e5ea]">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Fallback Caption</label>
                  <textarea
                    placeholder="Used only when an asset has no saved caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="h-24 w-full bg-[#f5f5f7] border border-[#e5e5ea] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Column 2: Choose Folder & Media */}
            <section className="min-h-0 rounded-xl border border-[#e5e5ea] p-3 flex flex-col gap-3 overflow-hidden bg-white">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#e5e5ea]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0071e3] text-white text-[10px] font-bold">2</span>
                Browse Media
              </h3>

              {/* Campaign Folders Tab Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#e5e5ea] min-h-[38px] scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setActiveFolderId('root')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1 border ${
                    activeFolderId === 'root'
                      ? 'bg-black text-white border-black'
                      : 'bg-[#f5f5f7] text-[#8e8e93] border-[#e5e5ea] hover:text-black hover:bg-[#e5e5ea]'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Root Library</span>
                </button>
                {folders.map(folder => (
                  <button
                    key={folder._id}
                    type="button"
                    onClick={() => setActiveFolderId(folder._id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1 border ${
                      activeFolderId === folder._id
                        ? 'bg-black text-white border-black'
                        : 'bg-[#f5f5f7] text-[#8e8e93] border-[#e5e5ea] hover:text-black hover:bg-[#e5e5ea]'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>{folder.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold px-1">
                <span>{selectedChannels.length === 0 ? 'Select a portal first' : `${availableMediaList.length} assets available`}</span>
                <span>{isBulk ? 'Auto bulk' : 'Auto single'}</span>
              </div>

              {/* Grid of Files */}
              <div className="min-h-0 flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 pr-1 content-start">
                {selectedChannels.length > 0 && availableMediaList.map(item => {
                  const isSelected = selectedMedia.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      onClick={() => selectMediaItem(item._id)}
                      type="button"
                      className={`group relative aspect-square rounded-xl overflow-hidden border transition-all duration-150 flex flex-col bg-gray-50 ${
                        isSelected
                          ? 'border-[#0071e3] ring-2 ring-[#0071e3]/30 scale-[0.98]'
                          : 'border-[#e5e5ea] hover:border-gray-400'
                      }`}
                    >
                      {item.type === 'video' ? (
                        <video src={item.url} className="h-full w-full object-cover" />
                      ) : (
                        <img src={item.url} className="h-full w-full object-cover" alt="" />
                      )}
                      
                      {/* Name Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-left opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="m-0 truncate text-[9px] font-semibold text-white">{getMediaLabel(item)}</p>
                        <p className="m-0 text-[8px] text-gray-300 capitalize">{item.type}</p>
                      </div>

                      {/* Selected Badge */}
                      {isSelected ? (
                        <div className="absolute top-2 right-2 rounded-full bg-[#0071e3] p-1 text-white shadow-md">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      ) : (
                        <div className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
                {selectedChannels.length === 0 && (
                  <div className="col-span-full h-32 rounded-xl border border-dashed border-[#e5e5ea] bg-gray-50 flex items-center justify-center text-xs text-gray-400 text-center p-4">
                    Please select a target portal to browse matching media files.
                  </div>
                )}
                {selectedChannels.length > 0 && availableMediaList.length === 0 && (
                  <div className="col-span-full h-32 rounded-xl border border-dashed border-[#e5e5ea] bg-gray-50 flex items-center justify-center text-xs text-gray-400 text-center p-4">
                    No files matching target format and channels in this folder.
                  </div>
                )}
              </div>
            </section>

            {/* Column 3: Posting Timeline & Review */}
            <section className="min-h-0 rounded-xl border border-[#e5e5ea] p-3 flex flex-col gap-3 overflow-hidden bg-white">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#e5e5ea]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0071e3] text-white text-[10px] font-bold">3</span>
                Posting Timeline
              </h3>

              {/* Timeline Container */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {schedulePlan.length > 0 ? (
                  <div className="relative border-l border-dashed border-gray-300 ml-3 pl-5 space-y-4 py-2">
                    {schedulePlan.map((row) => (
                      <div key={`${row.channel?._id || 'multi'}-${row.mediaItem?._id}-${row.index}`} className="relative">
                        {/* Dot */}
                        <span className="absolute -left-[30px] top-3.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white text-[9px] font-semibold text-black shadow-sm">
                          {row.index}
                        </span>

                        {/* Post Card */}
                        <div className="bg-white border border-[#e5e5ea] rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-sm hover:border-gray-400 transition-all">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="h-10 w-12 overflow-hidden rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] flex-shrink-0">
                              {row.mediaItem?.type === 'video' ? (
                                <video src={row.mediaItem?.url} className="h-full w-full object-cover" />
                              ) : (
                                <img src={row.mediaItem?.url} className="h-full w-full object-cover" alt="" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="m-0 truncate text-xs font-semibold text-black leading-tight" title={getMediaLabel(row.mediaItem)}>
                                {getMediaLabel(row.mediaItem)}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <img src={row.channel?.avatarUrl} className="w-3.5 h-3.5 rounded-full object-cover border border-black/10" alt="" />
                                <span className="text-[10px] text-gray-500 truncate">{row.channel?.name || 'Selected portal'}</span>
                              </div>
                              <p className="m-0 mt-1 truncate text-[10px] text-gray-500" title={row.caption}>
                                {row.caption || 'No caption drafted'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 bg-[#0071e3]/10 text-[#0071e3] px-2 py-0.5 rounded-full text-[9px] font-semibold">
                                <Clock className="w-2.5 h-2.5" />
                                {formatScheduleDate(row.scheduledAt)} {formatScheduleTime(row.scheduledAt)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedia(row.mediaItem?._id)}
                              className="p-1 hover:bg-[#f5f5f7] rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full rounded-xl border border-dashed border-[#e5e5ea] bg-gray-50 p-4 text-center text-xs text-gray-400 flex items-center justify-center">
                    Your scheduled sequence timeline will appear here once channels and media are selected.
                  </div>
                )}
              </div>

              {/* YouTube Metadata Sub-Form */}
              {hasYoutubeSelected && (
                <div className="grid grid-cols-1 gap-2 border-t border-[#e5e5ea] pt-3">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-red-500">YouTube Upload Options</p>
                  <input
                    value={youtubeTitle}
                    onChange={(e) => setYoutubeTitle(e.target.value)}
                    maxLength={100}
                    placeholder="YouTube video title"
                    className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-xs text-black"
                  />
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <input
                      value={youtubeTags}
                      onChange={(e) => setYoutubeTags(e.target.value)}
                      placeholder="Tags (comma separated)"
                      className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-xs text-black"
                    />
                    <select
                      value={youtubePrivacy}
                      onChange={(e) => setYoutubePrivacy(e.target.value)}
                      className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-2 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-xs text-black"
                    >
                      <option value="private">Private</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-black px-1">
                    <input
                      type="checkbox"
                      checked={youtubeMadeForKids}
                      onChange={(e) => setYoutubeMadeForKids(e.target.checked)}
                      className="rounded"
                    />
                    <span>This video is Made for Kids</span>
                  </label>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 border-t border-[#e5e5ea] pt-3">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="px-3.5 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-xl text-xs font-semibold border border-[#e5e5ea] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  {schedulePlan.length > 0
                    ? `Schedule ${schedulePlan.length} Post${schedulePlan.length === 1 ? '' : 's'}`
                    : 'Schedule Posts'}
                </button>
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
                      firstMedia.type === 'video' ? (
                        <video src={firstMedia.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={firstMedia.url} className="w-full h-full object-cover" alt="" />
                      )
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
