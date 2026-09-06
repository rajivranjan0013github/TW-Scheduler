import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
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
  FolderHeart,
  Play,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getHandlerPreviewContext, withHandlerPreviewHeaders } from '../utils/handlerPreview';
import { getMediaUrl } from '../utils/mediaUrls';
import { useAuth } from '../context/AuthContext';
import PlatformIcon from '../components/PlatformIcon';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';
import LoadingVideoPreview from '../components/LoadingVideoPreview';

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

const getUtf8ByteLength = (value = '') => new TextEncoder().encode(value).length;

const cancellablePostStatuses = new Set([
  'scheduled',
  'manual_ready',
  'downloaded',
  'paused',
  'posted_manual',
]);

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

const getPostStatusInfo = (post) => {
  const status = post?.status || 'scheduled';
  switch (status) {
    case 'manual_ready':
      return {
        label: 'Ready to Post',
        color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        icon: CheckCircle2,
      };
    case 'downloaded':
      return {
        label: 'Downloaded',
        color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        icon: CheckCircle2,
      };
    case 'publishing':
      return {
        label: 'Publishing',
        color: 'bg-purple-500/15 text-purple-300 border-purple-500/30 animate-pulse',
        icon: Loader2,
        spin: true,
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        icon: AlertCircle,
      };
    case 'paused':
      return {
        label: 'Paused',
        color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        icon: Clock,
      };
    case 'published':
    case 'published_auto':
    case 'posted_manual':
      return {
        label: 'Published',
        color: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
        icon: CheckCircle2,
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
        icon: AlertCircle,
      };
    case 'scheduled':
    default:
      return {
        label: 'Scheduled',
        color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        icon: Clock,
      };
  }
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
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const handlerPreviewUserId = getHandlerPreviewContext()?.userId || '';

  const location = useLocation();
  const preselected = location.state?.preselectedMedia;

  // Form State
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [selectedMediaAsset, setSelectedMediaAsset] = useState(preselected || null);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(
    preselected ? getMediaUrl(preselected.url, { apiBaseUrl: API_BASE_URL }) : ''
  );
  const [caption, setCaption] = useState(preselected?.caption || '');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubePrivacyStatus, setYoutubePrivacyStatus] = useState('private');
  const [youtubeMadeForKids, setYoutubeMadeForKids] = useState('');
  const [youtubeContainsSyntheticMedia, setYoutubeContainsSyntheticMedia] = useState(false);
  const [youtubeGuidelinesCertified, setYoutubeGuidelinesCertified] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(getDefaultDateTimeString());
  const [dateError, setDateError] = useState('');
  const [postType, setPostType] = useState(preselected?.type === 'video' ? 'reels' : 'post');
  const [scheduleMode, setScheduleMode] = useState('auto');
  const [submittingStep, setSubmittingStep] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState('');
  const [queueFilter, setQueueFilter] = useState('all');
  const [previewPost, setPreviewPost] = useState(null);

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
    const ownedAccounts = rawAccounts.filter((account) => (
      String(account?.userId?._id || account?.userId || '') === String(user?._id || '')
    ));

    const list = [];
    const seenTargets = new Set();

    // Personal accounts come first so creators can publish independently by default.
    ownedAccounts.forEach((acc) => {
      const accountId = String(acc._id || '');
      const targetKey = `personal:${accountId || getChannelKey(acc)}`;
      if (!accountId || seenTargets.has(targetKey)) return;
      seenTargets.add(targetKey);

      list.push({
        _id: targetKey,
        campaignId: null,
        campaignName: 'Personal',
        campaignChannelId: null,
        socialAccountId: acc._id,
        platform: acc.platform,
        name: acc.name || acc.displayName || acc.username || 'Channel',
        username: acc.username || '',
        avatarUrl: acc.avatarUrl || acc.profilePictureUrl || '',
        isConnected: acc.isConnected !== false,
      });
    });

    campaigns.forEach((camp) => {
      (camp.channels || []).forEach((ch) => {
        if (!ch) return;
        const channelKey = getChannelKey(ch);
        const socialId = ch.socialAccountId ? String(ch.socialAccountId) : null;
        const channelId = String(ch._id || '');
        const targetKey = `campaign:${camp._id}:${channelId || socialId || channelKey}`;
        if (seenTargets.has(targetKey)) return;
        seenTargets.add(targetKey);

        list.push({
          _id: targetKey,
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

    return list;
  }, [creatorCampaignsQuery.data, accountsQuery.data, user?._id]);

  // Effective selection logic (defaults to first channel if none explicitly selected)
  const effectiveSelectedIds = useMemo(() => {
    if (selectedChannelIds.length === 0 && availableChannels.length > 0) {
      const preselectedCampaignId = String(preselected?.campaignId?._id || preselected?.campaignId || '');
      const matchingChannel = availableChannels.find((channel) => (
        preselected?.scope === 'personal'
          ? !channel.campaignId
          : preselectedCampaignId && String(channel.campaignId || '') === preselectedCampaignId
      ));
      return [matchingChannel?._id || availableChannels[0]._id];
    }
    return selectedChannelIds;
  }, [selectedChannelIds, availableChannels, preselected]);

  const selectedChannels = useMemo(() => {
    return availableChannels.filter((c) => effectiveSelectedIds.includes(c._id));
  }, [availableChannels, effectiveSelectedIds]);
  const hasYoutubeApiTarget = scheduleMode !== 'manual'
    && selectedChannels.some((channel) => channel.platform === 'youtube');

  const activeChannel = selectedChannels[0] || availableChannels[0] || null;
  const selectableChannelCount = new Set(
    availableChannels.map((channel) => (
      channel.socialAccountId ? `account:${channel.socialAccountId}` : `target:${channel._id}`
    ))
  ).size;

  const toggleChannel = (channelId) => {
    setSelectedChannelIds((prev) => {
      const current = prev.length === 0 && availableChannels.length > 0
        ? [availableChannels[0]._id]
        : prev;
      if (current.includes(channelId)) {
        return current.filter((id) => id !== channelId);
      } else {
        const target = availableChannels.find((channel) => channel._id === channelId);
        const withoutDuplicateAccount = target?.socialAccountId
          ? current.filter((id) => {
            const selected = availableChannels.find((channel) => channel._id === id);
            return String(selected?.socialAccountId || '') !== String(target.socialAccountId);
          })
          : current;
        return [...withoutDuplicateAccount, channelId];
      }
    });
  };

  const selectAllChannels = () => {
    const seenSocialAccountIds = new Set();
    const selectableIds = availableChannels
      .filter((channel) => {
        const socialAccountId = String(channel.socialAccountId || '');
        if (!socialAccountId) return true;
        if (seenSocialAccountIds.has(socialAccountId)) return false;
        seenSocialAccountIds.add(socialAccountId);
        return true;
      })
      .map((channel) => channel._id);
    if (selectableIds.every((id) => effectiveSelectedIds.includes(id))) {
      setSelectedChannelIds([]);
    } else {
      setSelectedChannelIds(selectableIds);
    }
  };

  // 3. Fetch queue posts belonging to this creator/handler only.
  const scheduledPostsQuery = useQuery({
    queryKey: ['creator', handlerPreviewUserId, 'scheduled-posts'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/scheduler/creator/posts`, {
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch your scheduled queue.');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30 * 1000,
  });

  // 4. Fetch Creator's Media Library for in-form picker
  const targetCampaignIdForMedia = activeChannel?.campaignId || null;
  const mediaScopeKey = targetCampaignIdForMedia || 'personal';
  const creatorMediaQuery = useQuery({
    queryKey: ['creator', 'schedule', 'media-library', mediaScopeKey],
    queryFn: async () => {
      if (!activeChannel) return [];
      const mediaQuery = targetCampaignIdForMedia
        ? `campaignId=${encodeURIComponent(targetCampaignIdForMedia)}&onlyMyUploads=true`
        : 'scope=personal&onlyMyUploads=true';
      const res = await fetch(`${API_BASE_URL}/api/media?${mediaQuery}`, {
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(showMediaPicker && activeChannel),
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

    if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    const preview = URL.createObjectURL(selected);
    setSelectedMediaAsset(null);
    setFile(selected);
    setFilePreviewUrl(preview);
    setStatusMessage(null);

    const isVideoFile = selected.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v)$/i.test(selected.name);
    if (isVideoFile) {
      setPostType('reels');
    } else {
      setPostType('post');
    }
  };

  const handleClearFile = () => {
    if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFile(null);
    setSelectedMediaAsset(null);
    setFilePreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectFromLibrary = (item) => {
    if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFile(null);
    setSelectedMediaAsset(item);
    setFilePreviewUrl(getMediaUrl(item.url, { apiBaseUrl: API_BASE_URL }));
    setPostType(item.type === 'video' ? 'reels' : 'post');
    if (!caption && item.caption) setCaption(item.caption);
    setShowMediaPicker(false);
    setStatusMessage(null);
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

    if (!file && !selectedMediaAsset) {
      setStatusMessage({ type: 'error', text: 'Please upload or select a video or photo.' });
      return;
    }

    if (hasYoutubeApiTarget) {
      const isVideo = file?.type?.startsWith('video/') || selectedMediaAsset?.type === 'video';
      if (!isVideo) {
        setStatusMessage({ type: 'error', text: 'YouTube API publishing requires a video file.' });
        return;
      }
      if (!youtubeTitle.trim()) {
        setStatusMessage({ type: 'error', text: 'Enter a YouTube video title.' });
        return;
      }
      if (Array.from(youtubeTitle.trim()).length > 100) {
        setStatusMessage({ type: 'error', text: 'YouTube title must be 100 characters or fewer.' });
        return;
      }
      if (getUtf8ByteLength(youtubeDescription) > 5000) {
        setStatusMessage({ type: 'error', text: 'YouTube description must be 5,000 bytes or fewer.' });
        return;
      }
      if (!youtubeMadeForKids) {
        setStatusMessage({ type: 'error', text: 'Choose whether the YouTube video is made for kids.' });
        return;
      }
      if (!youtubeGuidelinesCertified) {
        setStatusMessage({ type: 'error', text: 'Confirm YouTube Community Guidelines compliance.' });
        return;
      }
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
        const cId = ch.campaignId || null;
        if (!campaignGroups.has(cId)) {
          campaignGroups.set(cId, []);
        }
        campaignGroups.get(cId).push(ch);
      });

      for (const [targetCampaignId, channelsInCampaign] of campaignGroups.entries()) {
        let mediaId = selectedMediaAsset?._id;

        if (!mediaId) {
          const formData = new FormData();
          formData.append('file', file);
          if (targetCampaignId) {
            formData.append('campaignId', targetCampaignId);
          } else {
            formData.append('scope', 'personal');
          }
          formData.append('sourceUsage', 'schedule');
          formData.append('tags', 'creator,schedule,generated');
          if (caption) formData.append('caption', caption);

          const uploadHeaders = withHandlerPreviewHeaders({
            Authorization: `Bearer ${token}`,
          });

          const uploadQuery = targetCampaignId
            ? `campaignId=${encodeURIComponent(targetCampaignId)}`
            : 'scope=personal';
          const uploadRes = await fetch(`${API_BASE_URL}/api/media/upload?${uploadQuery}`, {
            method: 'POST',
            headers: uploadHeaders,
            body: formData,
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to upload media from device.');
          }

          const mediaData = await uploadRes.json();
          mediaId = mediaData._id;
        }

        setSubmittingStep('scheduling');

        const channelTargets = channelsInCampaign.map((c) => ({
          socialAccountId: c.socialAccountId || null,
          campaignChannelId: targetCampaignId ? (c.campaignChannelId || c._id) : null,
        }));

        const scheduleRes = await fetch(`${API_BASE_URL}/api/scheduler`, {
          method: 'POST',
          headers: withHandlerPreviewHeaders({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({
            ...(targetCampaignId ? { campaignId: targetCampaignId } : {}),
            socialAccountIds: channelsInCampaign.map((c) => c.socialAccountId).filter(Boolean),
            campaignChannelIds: targetCampaignId
              ? channelsInCampaign.map((c) => c.campaignChannelId || c._id).filter(Boolean)
              : [],
            channelTargets,
            mediaIds: [mediaId],
            caption: caption.trim(),
            scheduledAt: scheduledDate.toISOString(),
            scheduleMode,
            platformSpecifics: {
              type: postType,
              postCaption: caption.trim(),
              ...(hasYoutubeApiTarget ? {
                youtube: {
                  title: youtubeTitle.trim(),
                  description: youtubeDescription,
                  privacyStatus: youtubePrivacyStatus,
                  selfDeclaredMadeForKids: youtubeMadeForKids === 'yes',
                  containsSyntheticMedia: youtubeContainsSyntheticMedia,
                  communityGuidelinesCertified: youtubeGuidelinesCertified,
                },
              } : {}),
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
      setYoutubeTitle('');
      setYoutubeDescription('');
      setYoutubePrivacyStatus('private');
      setYoutubeMadeForKids('');
      setYoutubeContainsSyntheticMedia(false);
      setYoutubeGuidelinesCertified(false);
      setScheduledAt(getDefaultDateTimeString());
      queryClient.invalidateQueries({ queryKey: ['creator', handlerPreviewUserId, 'scheduled-posts'] });
    } catch (err) {
      console.error('Scheduling error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'An error occurred while scheduling.' });
    } finally {
      setSubmittingStep('');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ postId, campaignId }) => {
      const token = localStorage.getItem('tw_token');
      const campaignQuery = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
      const res = await fetch(`${API_BASE_URL}/api/scheduler/${postId}${campaignQuery}`, {
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
      queryClient.invalidateQueries({ queryKey: ['creator', handlerPreviewUserId, 'scheduled-posts'] });
      setStatusMessage({ type: 'success', text: 'Scheduled post cancelled.' });
    },
    onError: (err) => {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to cancel post.' });
    },
  });

  const scheduledPosts = scheduledPostsQuery.data;
  const allQueuePosts = useMemo(() => {
    const list = Array.isArray(scheduledPosts) ? scheduledPosts : [];
    return list.filter((post) => {
      // The creator endpoint scopes ownership/assignment. Keep only posts whose
      // publishing target is currently connected. Older/manual queue records may
      // carry the connected account through campaignChannelIds instead.
      const hasConnectedAccount = (post.socialAccountIds || []).some((account) => {
        if (account && typeof account === 'object') {
          return account.isConnected !== false;
        }

        return availableChannels.some((channel) => (
          channel.isConnected
          && String(channel.socialAccountId || '') === String(account || '')
        ));
      });

      if (hasConnectedAccount) return true;

      return (post.campaignChannelIds || []).some((campaignChannel) => {
        const linkedAccount = campaignChannel?.socialAccountId;
        if (linkedAccount && typeof linkedAccount === 'object') {
          return linkedAccount.isConnected !== false;
        }

        const linkedAccountId = String(linkedAccount || '');
        return Boolean(linkedAccountId) && availableChannels.some((channel) => (
          channel.isConnected
          && String(channel.socialAccountId || '') === linkedAccountId
        ));
      });
    });
  }, [scheduledPosts, availableChannels]);

  const selectedQueuePosts = useMemo(() => {
    const selectedIds = new Set(
      selectedChannels.map((c) => String(c.campaignChannelId || '')).filter(Boolean)
    );
    const selectedSocialIds = new Set(
      selectedChannels.map((c) => String(c.socialAccountId || '')).filter(Boolean)
    );

    return allQueuePosts.filter((p) => {
      if (selectedIds.size > 0 || selectedSocialIds.size > 0) {
        const pChanIds = (p.campaignChannelIds || []).map((c) => String(c?._id || c));
        const pAccIds = (p.socialAccountIds || []).map((a) => String(a?._id || a));

        const matchesChannel = pChanIds.some((id) => selectedIds.has(id));
        const matchesAccount = pAccIds.some((id) => selectedSocialIds.has(id));

        return matchesChannel || matchesAccount;
      }
      return true;
    });
  }, [allQueuePosts, selectedChannels]);

  const visibleQueuePosts = queueFilter === 'selected' ? selectedQueuePosts : allQueuePosts;

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
                {effectiveSelectedIds.length === selectableChannelCount ? 'Deselect all' : 'Select all'}
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
                          {formatHandle(channel.username || channel.name)} · {channel.campaignName || 'Personal'}
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

        {/* Device Media Upload or Choose from Library */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Media
            </label>
            {(file || selectedMediaAsset) && (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                htmlFor="creator-file-input"
                className="flex flex-col items-center justify-center border border-dashed border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-6 cursor-pointer transition text-center"
              >
                <UploadCloud className="h-6 w-6 text-zinc-400 mb-2" />
                <p className="text-xs font-semibold text-white m-0">
                  Upload from this device
                </p>
                <p className="text-[10px] text-zinc-500 mt-1 m-0">
                  MP4, MOV, WEBM, JPG, PNG (up to 100MB)
                </p>
              </label>

              <button
                type="button"
                onClick={() => setShowMediaPicker(true)}
                className="flex flex-col items-center justify-center border border-dashed border-white/15 hover:border-purple-500/40 bg-white/[0.02] hover:bg-purple-500/[0.04] rounded-xl p-6 transition text-center group cursor-pointer"
              >
                <FolderHeart className="h-6 w-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold text-white m-0">
                  Choose from My Media
                </p>
                <p className="text-[10px] text-zinc-500 mt-1 m-0">
                  Select previously uploaded media
                </p>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center p-3 min-h-[240px]">
                {postType === 'reels' || Boolean(file?.type?.startsWith('video/')) || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file?.name || '') || selectedMediaAsset?.type === 'video' ? (
                  <div
                    className={`group relative ${
                      postType === 'reels' ? 'h-72 aspect-[9/16]' : 'h-64 aspect-video'
                    } max-w-full rounded-xl overflow-hidden bg-black border border-white/15 shadow-2xl cursor-pointer flex items-center justify-center`}
                    onClick={() => setVideoModalUrl(filePreviewUrl)}
                    onMouseEnter={(e) => {
                      const video = e.currentTarget.querySelector('video');
                      if (video) {
                        video.muted = false;
                        video.play().catch(() => {
                          video.muted = true;
                          video.play().catch(() => {});
                        });
                      }
                    }}
                    onMouseLeave={(e) => {
                      const video = e.currentTarget.querySelector('video');
                      if (video) {
                        video.pause();
                        video.currentTime = 0;
                      }
                    }}
                    title="Hover to preview with sound • Click to expand"
                  >
                    <LoadingVideoPreview
                      src={filePreviewUrl}
                      crossOrigin={filePreviewUrl?.startsWith('blob:') || filePreviewUrl?.startsWith('data:') ? undefined : 'anonymous'}
                      className="h-full w-full"
                      videoClassName="h-full w-full object-cover"
                      playsInline
                      preload="metadata"
                      poster={
                        selectedMediaAsset?.thumbnailUrl
                          ? getMediaUrl(selectedMediaAsset.thumbnailUrl, { apiBaseUrl: API_BASE_URL })
                          : undefined
                      }
                    />

                    {/* Centered Play Indicator (fades out while hovering/playing) */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 group-hover:opacity-0 transition-opacity z-10">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 border border-white/25 text-white shadow-xl shadow-black/50 backdrop-blur-sm group-hover:scale-110 transition-transform">
                        <Play className="h-5 w-5 fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    {/* Video / Reel Tag */}
                    <div className="pointer-events-none absolute top-2.5 right-2.5 z-10">
                      <span className="inline-flex items-center gap-1 rounded-md bg-black/80 border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-300 backdrop-blur-md shadow-sm">
                        <Video className="h-2.5 w-2.5 text-purple-400" />
                        {postType === 'reels' ? 'Reel' : 'Video'}
                      </span>
                    </div>

                    {/* From My Media Badge */}
                    {selectedMediaAsset && (
                      <div className="pointer-events-none absolute top-2.5 left-2.5 z-10">
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-600/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                          <FolderHeart className="h-2.5 w-2.5" />
                          From My Media
                        </span>
                      </div>
                    )}

                    {/* Hover/Click Hint */}
                    <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                      <span className="rounded-full bg-black/85 border border-white/15 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur-md shadow-md">
                        Hover to preview • Click to expand
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-72 max-w-full flex items-center justify-center overflow-hidden rounded-xl">
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      className="h-full w-auto object-contain rounded-xl"
                    />
                    {selectedMediaAsset && (
                      <div className="pointer-events-none absolute top-2.5 left-2.5 z-10">
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-600/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                          <FolderHeart className="h-2.5 w-2.5" />
                          From My Media
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{file?.name || selectedMediaAsset?.name}</span>
                  {(file?.type?.startsWith('video/') || selectedMediaAsset?.type === 'video') && (
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                      Video Preview
                    </span>
                  )}
                </div>
                {file?.size ? (
                  <span className="shrink-0 ml-2">({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
                ) : null}
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
            {(file?.type?.startsWith('video/') || selectedMediaAsset?.type === 'video') && (
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

        {hasYoutubeApiTarget && (
          <section className="space-y-4 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
            <div>
              <h3 className="m-0 text-sm font-bold text-white">YouTube upload details</h3>
              <p className="m-0 mt-1 text-[11px] leading-5 text-zinc-400">
                These values are sent to YouTube exactly as entered and apply only to selected YouTube channels.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="youtube-title-input" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Video title <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-zinc-500">{Array.from(youtubeTitle).length}/100</span>
              </div>
              <input
                id="youtube-title-input"
                type="text"
                value={youtubeTitle}
                maxLength={100}
                onChange={(event) => setYoutubeTitle(event.target.value)}
                placeholder="Enter the YouTube video title"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="youtube-description-input" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Description
                </label>
                <span className={`text-[10px] ${getUtf8ByteLength(youtubeDescription) > 5000 ? 'text-rose-400' : 'text-zinc-500'}`}>
                  {getUtf8ByteLength(youtubeDescription)}/5,000 bytes
                </span>
              </div>
              <textarea
                id="youtube-description-input"
                rows={4}
                value={youtubeDescription}
                onChange={(event) => setYoutubeDescription(event.target.value)}
                placeholder="Describe this video for YouTube viewers"
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="youtube-privacy-input" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Visibility <span className="text-red-400">*</span>
                </label>
                <select
                  id="youtube-privacy-input"
                  value={youtubePrivacyStatus}
                  onChange={(event) => setYoutubePrivacyStatus(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#151519] px-3 py-2.5 text-xs text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="youtube-kids-input" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Made for kids? <span className="text-red-400">*</span>
                </label>
                <select
                  id="youtube-kids-input"
                  value={youtubeMadeForKids}
                  onChange={(event) => setYoutubeMadeForKids(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#151519] px-3 py-2.5 text-xs text-white focus:border-red-500/50 focus:outline-none"
                  required
                >
                  <option value="">Choose an option</option>
                  <option value="no">No, it is not made for kids</option>
                  <option value="yes">Yes, it is made for kids</option>
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-zinc-300">
              <input
                type="checkbox"
                checked={youtubeContainsSyntheticMedia}
                onChange={(event) => setYoutubeContainsSyntheticMedia(event.target.checked)}
                className="mt-1 h-3.5 w-3.5 accent-red-500"
              />
              <span>This video contains realistic altered or synthetic content that should be disclosed to viewers.</span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-zinc-300">
              <input
                type="checkbox"
                checked={youtubeGuidelinesCertified}
                onChange={(event) => setYoutubeGuidelinesCertified(event.target.checked)}
                className="mt-1 h-3.5 w-3.5 accent-red-500"
                required
              />
              <span>
                I certify that this upload complies with the{' '}
                <a
                  href="https://www.youtube.com/howyoutubeworks/policies/community-guidelines/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-red-300 underline hover:text-red-200"
                >
                  YouTube Community Guidelines
                </a>.
              </span>
            </label>
          </section>
        )}

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

      {/* Complete creator/handler queue for connected accounts */}
      <div className="pt-8 border-t border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Post Queue ({visibleQueuePosts.length})</span>
            </div>

            {/* Filter Toggle: All vs Selected Channel */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setQueueFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  queueFilter === 'all'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All Connected Accounts ({allQueuePosts.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueFilter('selected')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  queueFilter === 'selected'
                    ? 'bg-[#7831d6] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Selected Channel ({selectedQueuePosts.length})
              </button>
            </div>
          </div>

          {scheduledPostsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
              <span>Loading your post queue...</span>
            </div>
          ) : scheduledPostsQuery.isError ? (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300">
              {scheduledPostsQuery.error?.message || 'Failed to load your scheduled queue.'}
            </div>
          ) : visibleQueuePosts.length === 0 ? (
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] text-center space-y-2">
              <p className="text-xs text-zinc-400 m-0">
                No queue posts found for the currently selected connected account.
              </p>
              {allQueuePosts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueueFilter('all')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  View all {allQueuePosts.length} connected-account queue posts →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {visibleQueuePosts.map((post) => {
                const postChannelIds = (post.campaignChannelIds || []).map((c) => String(c?._id || c));
                const postAccountIds = (post.socialAccountIds || []).map((a) => String(a?._id || a));

                const targetChannel = availableChannels.find((c) => (
                  postChannelIds.includes(String(c._id)) ||
                  postAccountIds.includes(String(c.socialAccountId))
                )) || null;

                const fallbackAccount = typeof post.socialAccountIds?.[0] === 'object' ? post.socialAccountIds[0] : null;
                const fallbackChannel = typeof post.campaignChannelIds?.[0] === 'object' ? post.campaignChannelIds[0] : null;
                const displayAccount = targetChannel || (fallbackAccount ? {
                  ...fallbackAccount,
                  name: fallbackAccount.name || fallbackAccount.displayName || fallbackAccount.username,
                } : null);
                const displayName = displayAccount?.name || displayAccount?.username || fallbackChannel?.displayName || fallbackChannel?.requestedHandle || 'Channel';
                const displayPlatform = displayAccount?.platform || fallbackChannel?.platform || 'facebook';

                const mediaItem = post.mediaIds?.[0];
                const mediaUrl = typeof mediaItem === 'object' ? mediaItem?.url : '';
                const isVideo = mediaItem?.type === 'video' || (typeof mediaItem === 'object' && /\.(mp4|mov|webm|mkv|m4v)$/i.test(mediaItem?.name || mediaUrl));
                const thumbUrl = mediaItem?.thumbnailUrl
                  ? getMediaUrl(mediaItem.thumbnailUrl, { apiBaseUrl: API_BASE_URL, proxy: true })
                  : '';
                const resolvedMediaUrl = mediaUrl
                  ? getMediaUrl(mediaUrl, { apiBaseUrl: API_BASE_URL, proxy: true })
                  : '';

                const statusInfo = getPostStatusInfo(post);
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={post._id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Clickable Video / Image Thumbnail */}
                      <button
                        type="button"
                        onClick={() => {
                          if (resolvedMediaUrl) {
                            setPreviewPost({
                              ...post,
                              resolvedMediaUrl,
                              thumbUrl,
                              isVideo,
                              displayName,
                              displayPlatform,
                              displayAccount,
                            });
                          }
                        }}
                        className="group/thumb relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-black/60 overflow-hidden shrink-0 flex items-center justify-center border border-white/10 hover:border-purple-500/50 transition shadow-sm cursor-pointer text-left"
                        title={resolvedMediaUrl ? 'Click to preview video' : 'Media preview'}
                      >
                        {isVideo ? (
                          thumbUrl ? (
                            <div className="relative h-full w-full">
                              <img
                                src={thumbUrl}
                                alt=""
                                className="h-full w-full object-cover transition duration-200 group-hover/thumb:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallbackVideo = e.currentTarget.parentElement?.querySelector('video');
                                  if (fallbackVideo) fallbackVideo.classList.remove('hidden');
                                }}
                              />
                              {resolvedMediaUrl && (
                                <video
                                  src={`${resolvedMediaUrl}#t=0.001`}
                                  preload="metadata"
                                  muted
                                  playsInline
                                  className="hidden h-full w-full object-cover"
                                />
                              )}
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 group-hover/thumb:bg-black/15 transition">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7831d6]/90 text-white shadow-md group-hover/thumb:scale-110 transition">
                                  <Play className="h-3 w-3 fill-white ml-0.5" />
                                </div>
                              </div>
                            </div>
                          ) : resolvedMediaUrl ? (
                            <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
                              <video
                                src={`${resolvedMediaUrl}#t=0.001`}
                                preload="metadata"
                                muted
                                playsInline
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 group-hover/thumb:bg-black/15 transition">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7831d6]/90 text-white shadow-md group-hover/thumb:scale-110 transition">
                                  <Play className="h-3 w-3 fill-white ml-0.5" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-purple-500/10 text-purple-400">
                              <Video className="h-5 w-5" />
                            </div>
                          )
                        ) : resolvedMediaUrl ? (
                          <img
                            src={resolvedMediaUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-200 group-hover/thumb:scale-105"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-zinc-500" />
                        )}
                      </button>

                      {/* Account details & Caption */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {displayAccount ? (
                            <div className="relative shrink-0">
                              <AccountAvatar account={displayAccount} className="h-5 w-5 rounded-full object-cover" />
                              <div className="absolute -bottom-0.5 -right-0.5">
                                <PlatformIcon platform={displayPlatform} className="h-2 w-2" />
                              </div>
                            </div>
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <PlatformIcon platform={displayPlatform} className="h-2 w-2" />
                            </div>
                          )}
                          <span className="text-xs font-semibold text-white truncate">
                            {displayName}
                          </span>
                        </div>
                        <p className="m-0 text-[11px] text-zinc-400 truncate mt-1">
                          {post.caption || 'No caption'}
                        </p>
                      </div>
                    </div>

                    {/* Status, Mode, Date & Actions */}
                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
                      {/* Post Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}
                        title={post.publishError || statusInfo.label}
                      >
                        <StatusIcon className={`h-2.5 w-2.5 ${statusInfo.spin ? 'animate-spin' : ''}`} />
                        <span>{statusInfo.label}</span>
                      </span>

                      {/* Schedule Mode Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        post.scheduleMode === 'auto'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      }`}>
                        {post.scheduleMode === 'auto' ? 'Auto' : 'Manual'}
                      </span>

                      {/* Scheduled Time */}
                      <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">
                        {formatScheduledDate(post.scheduledAt)}
                      </span>

                      {/* Watch Video Button */}
                      {resolvedMediaUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewPost({
                            ...post,
                            resolvedMediaUrl,
                            thumbUrl,
                            isVideo,
                            displayName,
                            displayPlatform,
                            displayAccount,
                          })}
                          className="text-xs text-purple-400 hover:text-purple-300 font-medium p-1 rounded hover:bg-white/5 transition flex items-center gap-1"
                          title="Watch video"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span className="hidden sm:inline">Watch</span>
                        </button>
                      )}

                      {/* Cancel / Delete Button */}
                      {cancellablePostStatuses.has(post.status) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Cancel this scheduled post?')) {
                              deleteMutation.mutate({
                                postId: post._id,
                                campaignId: String(post.campaignId?._id || post.campaignId || ''),
                              });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition"
                          title="Cancel post"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Choose from My Media Modal */}
      {showMediaPicker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowMediaPicker(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/15 bg-[#121216] p-6 shadow-2xl flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderHeart className="h-5 w-5 text-purple-400" />
                <h3 className="m-0 text-base font-bold text-white">Select from My Media</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {creatorMediaQuery.isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#7831d6]" />
                </div>
              ) : (creatorMediaQuery.data || []).length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  No uploads found in your media folder for this campaign.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {(creatorMediaQuery.data || []).map((item) => {
                    const isVideo = item.type === 'video';
                    const mediaUrl = getMediaUrl(item.url, { apiBaseUrl: API_BASE_URL });
                    const thumbUrl = item.thumbnailUrl ? getMediaUrl(item.thumbnailUrl, { apiBaseUrl: API_BASE_URL }) : undefined;

                    return (
                      <div
                        key={item._id}
                        onClick={() => handleSelectFromLibrary(item)}
                        onMouseEnter={(e) => {
                          if (!isVideo) return;
                          const video = e.currentTarget.querySelector('video');
                          if (!video) return;
                          video.muted = false;
                          video.play().catch(() => {
                            video.muted = true;
                            video.play().catch(() => {});
                          });
                        }}
                        onMouseLeave={(e) => {
                          if (!isVideo) return;
                          const video = e.currentTarget.querySelector('video');
                          if (!video) return;
                          video.pause();
                          video.currentTime = 0;
                        }}
                        className={`group relative cursor-pointer rounded-xl overflow-hidden border border-white/10 hover:border-purple-500 bg-black transition ${
                          isVideo ? 'aspect-[9/16]' : 'aspect-square'
                        }`}
                      >
                        {isVideo ? (
                          <LoadingVideoPreview
                            src={mediaUrl}
                            crossOrigin="anonymous"
                            className="h-full w-full"
                            videoClassName="h-full w-full object-cover"
                            playsInline
                            preload="metadata"
                            poster={thumbUrl}
                          />
                        ) : (
                          <img src={mediaUrl} crossOrigin="anonymous" alt="" className="h-full w-full object-cover group-hover:scale-105 transition" />
                        )}

                        {isVideo && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity z-10">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-sm shadow-md">
                              <Play className="h-3.5 w-3.5 fill-white text-white ml-0.5" />
                            </div>
                          </div>
                        )}

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 z-10">
                          <p className="m-0 truncate text-[11px] font-semibold text-white">{item.name}</p>
                          <span className="text-[9px] text-zinc-400 uppercase">{item.type}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Video Preview Modal */}
      {videoModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setVideoModalUrl('')}
        >
          <div
            className="relative max-h-[90vh] max-w-2xl w-full overflow-hidden rounded-2xl border border-white/15 bg-[#121216] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-3.5">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white m-0">Video Preview</h4>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalUrl('')}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-black p-2 max-h-[65vh] overflow-hidden">
              <video
                src={videoModalUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[60vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Post Full Preview Modal */}
      {previewPost && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-2xl w-full overflow-hidden rounded-2xl border border-white/15 bg-[#121216] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3 min-w-0">
                {previewPost.displayAccount ? (
                  <div className="relative shrink-0">
                    <AccountAvatar account={previewPost.displayAccount} className="h-8 w-8 rounded-full object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <PlatformIcon platform={previewPost.displayPlatform} className="h-3 w-3" />
                    </div>
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <PlatformIcon platform={previewPost.displayPlatform} className="h-3 w-3" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white m-0 truncate">
                    {previewPost.displayName}
                  </h4>
                  <p className="text-[11px] text-zinc-400 m-0 mt-0.5">
                    Scheduled for {formatScheduledDate(previewPost.scheduledAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const sInfo = getPostStatusInfo(previewPost);
                  const SIcon = sInfo.icon;
                  return (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${sInfo.color}`}>
                      <SIcon className={`h-3 w-3 ${sInfo.spin ? 'animate-spin' : ''}`} />
                      <span>{sInfo.label}</span>
                    </span>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setPreviewPost(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video / Media Content */}
            <div className="flex items-center justify-center bg-black p-4 max-h-[55vh] overflow-hidden">
              {previewPost.isVideo ? (
                <video
                  src={previewPost.resolvedMediaUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[50vh] w-auto rounded-xl object-contain shadow-lg"
                />
              ) : (
                <img
                  src={previewPost.resolvedMediaUrl}
                  alt=""
                  className="max-h-[50vh] w-auto rounded-xl object-contain"
                />
              )}
            </div>

            {/* Modal Footer / Details */}
            <div className="border-t border-white/10 p-4 space-y-3 bg-white/[0.02]">
              {previewPost.publishError && (
                <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold m-0">Publishing Error</p>
                    <p className="m-0 text-[11px] mt-0.5">{previewPost.publishError}</p>
                  </div>
                </div>
              )}

              {previewPost.caption && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                    Caption
                  </span>
                  <p className="text-xs text-zinc-200 m-0 max-h-20 overflow-y-auto whitespace-pre-wrap bg-white/5 p-2.5 rounded-lg border border-white/10">
                    {previewPost.caption}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">
                    Mode: <strong className="text-zinc-200 uppercase">{previewPost.scheduleMode}</strong>
                  </span>
                </div>
                {cancellablePostStatuses.has(previewPost.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Cancel this scheduled post?')) {
                        deleteMutation.mutate({
                          postId: previewPost._id,
                          campaignId: String(previewPost.campaignId?._id || previewPost.campaignId || ''),
                        });
                        setPreviewPost(null);
                      }
                    }}
                    className="text-rose-400 hover:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Cancel Post</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorSchedulePost;
