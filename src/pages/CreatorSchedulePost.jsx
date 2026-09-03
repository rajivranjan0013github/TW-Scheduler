import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Video,
  Image as ImageIcon,
  X,
  Zap,
  Smartphone,
  Check,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import PlatformIcon from '../components/PlatformIcon';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';

const formatHandle = (raw = '') => {
  const clean = String(raw || '').replace(/^@+/, '');
  return clean ? `@${clean}` : '';
};

const normalizeChannelHandle = (raw = '') => (
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
);

const getChannelKey = (channel = {}) => {
  const platform = (channel.platform || '').toLowerCase();
  const handle = normalizeChannelHandle(channel.username || channel.handle || channel.requestedHandle || channel.name);
  return `${platform}:${handle}`;
};

const formatScheduledDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getMinDateTimeString = () => {
  const d = new Date(Date.now() - 60000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultDateTimeString = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const CreatorSchedulePost = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  // Form State
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState(getDefaultDateTimeString());
  const [dateError, setDateError] = useState('');
  const [postType, setPostType] = useState('reels');
  const [scheduleMode, setScheduleMode] = useState('auto');
  const [submittingStep, setSubmittingStep] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // 1. Fetch Creator Campaigns and Channels
  const creatorCampaignsQuery = useQuery({
    queryKey: ['creator', 'schedule', 'campaigns'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/accounts/creator/campaigns`, {
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to fetch campaigns.');
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // 2. Fetch Connected Social Accounts
  const accountsQuery = useQuery({
    queryKey: ['creator', 'schedule', 'accounts'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/accounts`, {
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to fetch accounts.');
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // Extract flattened list of usable publishing channels (strictly deduplicated)
  const availableChannels = useMemo(() => {
    const rawAccounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];
    const campaigns = Array.isArray(creatorCampaignsQuery.data) ? creatorCampaignsQuery.data : [];

    const list = [];
    const seenAccountIds = new Set();
    const seenChannelKeys = new Set();

    campaigns.forEach((camp) => {
      (camp.channels || []).forEach((ch) => {
        if (!ch) return;
        const channelKey = getChannelKey(ch);
        const socialId = ch.socialAccountId ? String(ch.socialAccountId) : null;
        const channelId = String(ch._id || '');

        if (socialId && seenAccountIds.has(socialId)) return;
        if (channelKey && seenChannelKeys.has(channelKey)) return;

        if (socialId) seenAccountIds.add(socialId);
        if (channelId) seenAccountIds.add(channelId);
        if (channelKey) seenChannelKeys.add(channelKey);

        list.push({
          _id: ch._id,
          campaignId: camp._id,
          campaignName: camp.name,
          campaignChannelId: ch._id,
          socialAccountId: ch.socialAccountId || ch.matchedAccountId || null,
          platform: ch.platform,
          name: ch.name || ch.displayName || ch.username || 'Channel',
          username: ch.username || ch.handle || ch.requestedHandle || '',
          avatarUrl: ch.avatarUrl || ch.profilePictureUrl || '',
          isConnected: ch.status === 'verified' || Boolean(ch.socialAccountId),
        });
      });
    });

    rawAccounts.forEach((acc) => {
      const accId = String(acc._id || '');
      const channelKey = getChannelKey(acc);

      if (accId && seenAccountIds.has(accId)) return;
      if (channelKey && seenChannelKeys.has(channelKey)) return;

      if (accId) seenAccountIds.add(accId);
      if (channelKey) seenChannelKeys.add(channelKey);

      list.push({
        _id: acc._id,
        campaignId: campaigns[0]?._id || null,
        campaignName: campaigns[0]?.name || '',
        campaignChannelId: null,
        socialAccountId: acc._id,
        platform: acc.platform,
        name: acc.name || acc.displayName || acc.username || 'Channel',
        username: acc.username || '',
        avatarUrl: acc.avatarUrl || acc.profilePictureUrl || '',
        isConnected: acc.isConnected !== false,
      });
    });

    return list;
  }, [creatorCampaignsQuery.data, accountsQuery.data]);

  // Effective selection logic (defaults to first channel if none explicitly selected)
  const effectiveSelectedIds = useMemo(() => {
    if (selectedChannelIds.length === 0 && availableChannels.length > 0) {
      return [availableChannels[0]._id];
    }
    return selectedChannelIds;
  }, [selectedChannelIds, availableChannels]);

  const selectedChannels = useMemo(() => {
    return availableChannels.filter((c) => effectiveSelectedIds.includes(c._id));
  }, [availableChannels, effectiveSelectedIds]);

  const activeChannel = selectedChannels[0] || availableChannels[0] || null;

  const toggleChannel = (channelId) => {
    setSelectedChannelIds((prev) => {
      const current = prev.length === 0 && availableChannels.length > 0
        ? [availableChannels[0]._id]
        : prev;
      if (current.includes(channelId)) {
        return current.filter((id) => id !== channelId);
      } else {
        return [...current, channelId];
      }
    });
  };

  const selectAllChannels = () => {
    if (effectiveSelectedIds.length === availableChannels.length) {
      setSelectedChannelIds([]);
    } else {
      setSelectedChannelIds(availableChannels.map((c) => c._id));
    }
  };

  // 3. Fetch Upcoming Scheduled Posts for this creator
  const scheduledPostsQuery = useQuery({
    queryKey: ['creator', 'scheduled-posts'],
    queryFn: async () => {
      const campaignId = activeChannel?.campaignId || availableChannels[0]?.campaignId;
      if (!campaignId) return [];
      const res = await fetch(`${API_BASE_URL}/api/scheduler?campaignId=${campaignId}`, {
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(activeChannel?.campaignId || availableChannels[0]?.campaignId),
    staleTime: 30 * 1000,
  });

  // Handle file selection from device
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 500 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'File size exceeds 500MB limit.' });
      return;
    }

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    const preview = URL.createObjectURL(selected);
    setFile(selected);
    setFilePreviewUrl(preview);
    setStatusMessage(null);

    if (selected.type.startsWith('video/')) {
      setPostType('reels');
    } else {
      setPostType('post');
    }
  };

  const handleClearFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFile(null);
    setFilePreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const applyQuickTime = (type) => {
    const d = new Date();
    if (type === 'now') {
      // Set to right now
    } else if (type === '1h') {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    } else if (type === 'tonight') {
      d.setHours(20, 0, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
    } else if (type === 'tomorrow_10am') {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (type === 'tomorrow_6pm') {
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setScheduledAt(`${year}-${month}-${day}T${hours}:${minutes}`);
    setDateError('');
  };

  const handleScheduledAtChange = (val) => {
    if (!val) {
      setScheduledAt('');
      setDateError('Please select a date and time.');
      return;
    }
    const selectedDate = new Date(val);
    const nowThreshold = new Date(Date.now() - 2 * 60 * 1000);
    if (selectedDate < nowThreshold) {
      setDateError('Scheduled date and time cannot be in the past. Please choose a future time.');
    } else {
      setDateError('');
    }
    setScheduledAt(val);
  };

  const handleScheduledAtBlur = () => {
    if (!scheduledAt) return;
    const selectedDate = new Date(scheduledAt);
    const nowThreshold = new Date(Date.now() - 2 * 60 * 1000);
    if (selectedDate < nowThreshold) {
      const minValid = getMinDateTimeString();
      setScheduledAt(minValid);
      setDateError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (selectedChannels.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one channel to publish to.' });
      return;
    }

    if (!file) {
      setStatusMessage({ type: 'error', text: 'Please upload a video or photo from your device.' });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    const nowThreshold = new Date(Date.now() - 2 * 60 * 1000);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate < nowThreshold) {
      setStatusMessage({ type: 'error', text: 'Scheduled date and time cannot be in the past. Please choose a future time.' });
      setDateError('Scheduled date and time cannot be in the past.');
      return;
    }

    try {
      setSubmittingStep('uploading');
      const token = localStorage.getItem('tw_token');

      // Group selected channels by campaignId
      const campaignGroups = new Map();
      selectedChannels.forEach((ch) => {
        const cId = ch.campaignId || availableChannels[0]?.campaignId;
        if (!campaignGroups.has(cId)) {
          campaignGroups.set(cId, []);
        }
        campaignGroups.get(cId).push(ch);
      });

      for (const [targetCampaignId, channelsInCampaign] of campaignGroups.entries()) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('campaignId', targetCampaignId);
        formData.append('sourceUsage', 'schedule');
        formData.append('tags', 'schedule,generated');
        if (caption) formData.append('caption', caption);

        const uploadHeaders = withHandlerPreviewHeaders({
          Authorization: `Bearer ${token}`,
        });

        const uploadRes = await fetch(`${API_BASE_URL}/api/media/upload?campaignId=${targetCampaignId}`, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to upload media from device.');
        }

        const mediaData = await uploadRes.json();
        const mediaId = mediaData._id;

        setSubmittingStep('scheduling');

        const channelTargets = channelsInCampaign.map((c) => ({
          socialAccountId: c.socialAccountId || null,
          campaignChannelId: c.campaignChannelId || c._id,
        }));

        const scheduleRes = await fetch(`${API_BASE_URL}/api/scheduler`, {
          method: 'POST',
          headers: withHandlerPreviewHeaders({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            campaignId: targetCampaignId,
            socialAccountIds: channelsInCampaign.map((c) => c.socialAccountId).filter(Boolean),
            campaignChannelIds: channelsInCampaign.map((c) => c.campaignChannelId || c._id).filter(Boolean),
            channelTargets,
            mediaIds: [mediaId],
            caption: caption.trim(),
            scheduledAt: scheduledDate.toISOString(),
            scheduleMode,
            platformSpecifics: {
              type: postType,
              postCaption: caption.trim(),
            },
          }),
        });

        if (!scheduleRes.ok) {
          const err = await scheduleRes.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to schedule post.');
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Post scheduled across ${selectedChannels.length} channel${selectedChannels.length > 1 ? 's' : ''} for ${formatScheduledDate(scheduledDate.toISOString())}!`,
      });

      handleClearFile();
      setCaption('');
      setScheduledAt(getDefaultDateTimeString());
      queryClient.invalidateQueries({ queryKey: ['creator', 'scheduled-posts'] });
    } catch (err) {
      console.error('Scheduling error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'An error occurred while scheduling.' });
    } finally {
      setSubmittingStep('');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (postId) => {
      const token = localStorage.getItem('tw_token');
      const targetCampaignId = activeChannel?.campaignId || availableChannels[0]?.campaignId;
      const res = await fetch(`${API_BASE_URL}/api/scheduler/${postId}?campaignId=${targetCampaignId}`, {
        method: 'DELETE',
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${token}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete scheduled post.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', 'scheduled-posts'] });
      setStatusMessage({ type: 'success', text: 'Scheduled post cancelled.' });
    },
    onError: (err) => {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to cancel post.' });
    },
  });

  const scheduledPosts = scheduledPostsQuery.data;
  const upcomingPosts = useMemo(() => {
    const list = Array.isArray(scheduledPosts) ? scheduledPosts : [];
    return list.filter((p) => !['published', 'published_auto', 'posted_manual', 'cancelled'].includes(p.status));
  }, [scheduledPosts]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans antialiased">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white m-0">Schedule Post</h2>
        <p className="text-xs text-zinc-400 mt-1 m-0">
          Upload media from your device and schedule publishing to your channels.
        </p>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Flat, Direct Scheduling Form (Constrained to comfortable composer width) */}
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        {/* Channel Selection (Multi-select) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Channels {availableChannels.length > 0 && `(${effectiveSelectedIds.length} of ${availableChannels.length} selected)`}
            </label>
            {availableChannels.length > 1 && (
              <button
                type="button"
                onClick={selectAllChannels}
                className="text-[11px] font-medium text-purple-400 hover:text-purple-300 transition"
              >
                {effectiveSelectedIds.length === availableChannels.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {availableChannels.length === 0 ? (
            <div className="text-xs text-zinc-400 py-2">
              No connected channels found. Connect your accounts in Channels first.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {availableChannels.map((channel) => {
                const isSelected = effectiveSelectedIds.includes(channel._id);
                return (
                  <button
                    key={channel._id}
                    type="button"
                    onClick={() => toggleChannel(channel._id)}
                    className={`relative p-[1.5px] rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#7831d6] via-[#9333ea] to-[#ec4899] shadow-[0_0_14px_rgba(120,49,214,0.35)]'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-[10.5px] transition ${
                        isSelected
                          ? 'bg-[#151518] text-white'
                          : 'bg-[#0c0c0e] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <AccountAvatar account={channel} className="h-7 w-7 rounded-full object-cover" />
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <PlatformIcon platform={channel.platform} className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-semibold leading-tight truncate">{channel.name}</p>
                        <p className="m-0 text-[10px] text-zinc-500 font-normal leading-tight truncate">
                          {formatHandle(channel.username || channel.name)}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="h-4 w-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 ml-1">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Device Media Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Media
            </label>
            {file && (
              <button
                type="button"
                onClick={handleClearFile}
                className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition"
              >
                <X className="h-3 w-3" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileChange}
            className="hidden"
            id="creator-file-input"
          />

          {!filePreviewUrl ? (
            <label
              htmlFor="creator-file-input"
              className="flex flex-col items-center justify-center border border-dashed border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-8 cursor-pointer transition text-center"
            >
              <UploadCloud className="h-6 w-6 text-zinc-400 mb-2" />
              <p className="text-xs font-semibold text-white m-0">
                Choose video or photo from this device
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 m-0">
                MP4, MOV, WEBM, JPG, PNG (up to 500MB)
              </p>
            </label>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center max-h-72">
                {file?.type.startsWith('video/') ? (
                  <video
                    src={filePreviewUrl}
                    controls
                    playsInline
                    className="max-h-72 w-auto object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={filePreviewUrl}
                    alt="Preview"
                    className="max-h-72 w-auto object-contain rounded-lg"
                  />
                )}
              </div>

              <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
                <span className="truncate">{file?.name}</span>
                <span className="shrink-0 ml-2">({(file?.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="caption-input" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Caption
            </label>
            {file?.type.startsWith('video/') && (
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPostType('reels')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    postType === 'reels' ? 'bg-white/20 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Reel / Short
                </button>
                <button
                  type="button"
                  onClick={() => setPostType('post')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    postType === 'post' ? 'bg-white/20 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Post
                </button>
              </div>
            )}
          </div>
          <textarea
            id="caption-input"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write caption, hashtags..."
            className="w-full rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/25 transition resize-none"
          />
        </div>

        {/* Publishing Mode: Auto vs Manual */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Publishing Mode
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode('auto')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                scheduleMode === 'auto'
                  ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/30'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Zap className={`h-3.5 w-3.5 ${scheduleMode === 'auto' ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span>Auto Post</span>
              <span className="text-[10px] text-zinc-500 font-normal">Direct via API</span>
            </button>

            <button
              type="button"
              onClick={() => setScheduleMode('manual')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                scheduleMode === 'manual'
                  ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/30'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className={`h-3.5 w-3.5 ${scheduleMode === 'manual' ? 'text-purple-400' : 'text-zinc-500'}`} />
              <span>Manual Post</span>
              <span className="text-[10px] text-zinc-500 font-normal">Share from device</span>
            </button>
          </div>
        </div>

        {/* Schedule Date & Time */}
        <div className="space-y-2">
          <label htmlFor="scheduled-at-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Publish Date & Time
          </label>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              id="scheduled-at-input"
              type="datetime-local"
              min={getMinDateTimeString()}
              value={scheduledAt}
              onChange={(e) => handleScheduledAtChange(e.target.value)}
              onBlur={handleScheduledAtBlur}
              className={`rounded-xl bg-white/[0.03] border px-3 py-2 text-xs font-medium focus:outline-none transition sm:w-64 [color-scheme:dark] ${
                dateError
                  ? 'border-rose-500/80 text-rose-200 ring-1 ring-rose-500/40'
                  : 'border-white/10 text-white focus:border-white/25'
              }`}
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickTime('now')}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-zinc-300 transition"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => applyQuickTime('1h')}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-zinc-300 transition"
              >
                In 1 hour
              </button>
              <button
                type="button"
                onClick={() => applyQuickTime('tonight')}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-zinc-300 transition"
              >
                Tonight 8 PM
              </button>
              <button
                type="button"
                onClick={() => applyQuickTime('tomorrow_10am')}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-zinc-300 transition"
              >
                Tomorrow 10 AM
              </button>
            </div>
          </div>

          {dateError && (
            <p className="text-[11px] text-rose-400 font-medium m-0 flex items-center gap-1.5 pt-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{dateError}</span>
            </p>
          )}
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={Boolean(submittingStep) || Boolean(dateError)}
            className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#7831d6] hover:bg-[#6825bc] active:scale-[0.98] text-white font-bold text-xs shadow-lg shadow-[#7831d6]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingStep === 'uploading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading from device...</span>
              </>
            ) : submittingStep === 'scheduling' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                <span>
                  {effectiveSelectedIds.length > 1
                    ? `Schedule to ${effectiveSelectedIds.length} Channels`
                    : 'Schedule Post'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Upcoming Scheduled Posts (Clean borderless list, only if posts exist) */}
      {upcomingPosts.length > 0 && (
        <div className="pt-8 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Upcoming Scheduled ({upcomingPosts.length})</span>
          </div>

          <div className="divide-y divide-white/10">
            {upcomingPosts.map((post) => {
              const targetChannel = availableChannels.find((c) => (
                (post.campaignChannelIds || []).includes(c._id) ||
                (post.socialAccountIds || []).includes(c.socialAccountId)
              )) || availableChannels[0];

              const mediaItem = post.mediaIds?.[0];
              const mediaUrl = typeof mediaItem === 'object' ? mediaItem?.url : '';
              const isVideo = mediaItem?.type === 'video';

              return (
                <div
                  key={post._id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                      {mediaUrl ? (
                        isVideo ? (
                          <Video className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <ImageIcon className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {targetChannel && (
                          <div className="relative shrink-0">
                            <AccountAvatar account={targetChannel} className="h-5 w-5 rounded-full object-cover" />
                            <div className="absolute -bottom-0.5 -right-0.5">
                              <PlatformIcon platform={targetChannel.platform} className="h-2 w-2" />
                            </div>
                          </div>
                        )}
                        <span className="text-xs font-semibold text-white truncate">
                          {targetChannel ? targetChannel.name : 'Channel'}
                        </span>
                      </div>
                      <p className="m-0 text-[11px] text-zinc-400 truncate mt-0.5">
                        {post.caption || 'No caption'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      post.scheduleMode === 'auto'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-purple-500/15 text-purple-300'
                    }`}>
                      {post.scheduleMode === 'auto' ? 'Auto' : 'Manual'}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      {formatScheduledDate(post.scheduledAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Cancel this scheduled post?')) {
                          deleteMutation.mutate(post._id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-zinc-500 hover:text-rose-400 p-1 rounded transition"
                      title="Cancel post"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorSchedulePost;
