import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Video,
  Image as ImageIcon,
  Trash2,
  Calendar,
  Search,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderHeart,
  ChevronDown,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getMediaUrl } from '../utils/mediaUrls';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import LoadingVideoPreview from '../components/LoadingVideoPreview';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const CreatorMedia = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Filter & Search State
  const [filterType, setFilterType] = useState('all'); // 'all' | 'video' | 'image'
  const [searchQuery, setSearchQuery] = useState('');
  const [previewMedia, setPreviewMedia] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleVideoHoverStart = (e) => {
    const video = e.currentTarget.querySelector('video') || (e.target.tagName === 'VIDEO' ? e.target : null);
    if (!video || typeof video.play !== 'function') return;
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  };

  const handleVideoHoverEnd = (e) => {
    const video = e.currentTarget.querySelector('video') || (e.target.tagName === 'VIDEO' ? e.target : null);
    if (!video || typeof video.pause !== 'function') return;
    video.pause();
    video.currentTime = 0;
  };

  // 1. Fetch Creator Campaigns
  const campaignsQuery = useQuery({
    queryKey: ['creator', 'media', 'campaigns'],
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

  const campaigns = Array.isArray(campaignsQuery.data) ? campaignsQuery.data : [];
  const [selectedLibraryScope, setSelectedLibraryScope] = useState('personal');
  const activeCampaignId = selectedLibraryScope === 'personal' ? '' : selectedLibraryScope;
  const mediaScopeKey = activeCampaignId || 'personal';

  // 2. Fetch Creator's Uploaded Media
  const mediaQuery = useQuery({
    queryKey: ['creator', 'media', mediaScopeKey],
    queryFn: async () => {
      const mediaQuery = activeCampaignId
        ? `campaignId=${encodeURIComponent(activeCampaignId)}&onlyMyUploads=true`
        : 'scope=personal&onlyMyUploads=true';
      const res = await fetch(`${API_BASE_URL}/api/media?${mediaQuery}`, {
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to fetch media assets.');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30 * 1000,
  });

  const allMedia = useMemo(
    () => (Array.isArray(mediaQuery.data) ? mediaQuery.data : []),
    [mediaQuery.data]
  );

  // Filter & Search computation
  const filteredMedia = useMemo(() => {
    return allMedia.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (item.name || '').toLowerCase().includes(query);
        const matchesCaption = (item.caption || '').toLowerCase().includes(query);
        return matchesName || matchesCaption;
      }
      return true;
    });
  }, [allMedia, filterType, searchQuery]);

  const counts = useMemo(() => {
    let videos = 0;
    let images = 0;
    allMedia.forEach((m) => {
      if (m.type === 'video') videos++;
      else if (m.type === 'image') images++;
    });
    return { all: allMedia.length, video: videos, image: images };
  }, [allMedia]);

  // Upload Mutation
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'File size exceeds 500MB limit.' });
      return;
    }

    try {
      setIsUploading(true);
      setStatusMessage(null);
      const token = localStorage.getItem('tw_token');

      const formData = new FormData();
      formData.append('file', file);
      if (activeCampaignId) {
        formData.append('campaignId', activeCampaignId);
      } else {
        formData.append('scope', 'personal');
      }
      formData.append('sourceUsage', 'schedule');
      formData.append('tags', 'creator,schedule,generated');

      const uploadHeaders = withHandlerPreviewHeaders({
        Authorization: `Bearer ${token}`,
      });

      const uploadQuery = activeCampaignId
        ? `campaignId=${encodeURIComponent(activeCampaignId)}`
        : 'scope=personal';
      const res = await fetch(`${API_BASE_URL}/api/media/upload?${uploadQuery}`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed.');
      }

      setStatusMessage({ type: 'success', text: `Uploaded "${file.name}" to your media library!` });
      queryClient.invalidateQueries({ queryKey: ['creator', 'media', mediaScopeKey] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to upload media.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (mediaId) => {
      const token = localStorage.getItem('tw_token');
      const deleteQuery = activeCampaignId
        ? `campaignId=${encodeURIComponent(activeCampaignId)}`
        : 'scope=personal';
      const res = await fetch(`${API_BASE_URL}/api/media/${mediaId}?${deleteQuery}`, {
        method: 'DELETE',
        headers: withHandlerPreviewHeaders({
          Authorization: `Bearer ${token}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete media asset.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator', 'media', mediaScopeKey] });
      setStatusMessage({ type: 'success', text: 'Media deleted successfully.' });
      setDeleteConfirmId(null);
    },
    onError: (err) => {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete media.' });
      setDeleteConfirmId(null);
    },
  });

  // Navigate to Schedule page with media preselected
  const handleScheduleMedia = (item) => {
    navigate('/schedule', {
      state: {
        preselectedMedia: {
          _id: item._id,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          name: item.name,
          type: item.type,
          caption: item.caption,
          scope: item.scope,
          campaignId: item.campaignId,
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans antialiased">
      {/* Header & Campaign Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white m-0">My Media</h2>
          <p className="text-xs text-zinc-400 mt-1 m-0">
            Your own media library. No campaign is required.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Personal library is the default; assigned campaigns remain available. */}
          {campaigns.length > 0 && (
            <div className="relative">
              <select
                value={selectedLibraryScope}
                onChange={(e) => {
                  setSelectedLibraryScope(e.target.value);
                }}
                className="appearance-none rounded-xl border border-white/15 bg-white/5 py-2 pl-3 pr-8 text-xs font-semibold text-white transition hover:bg-white/10 focus:border-[#7831d6] focus:outline-none"
              >
                <option value="personal" className="bg-[#18181b] text-white">
                  Personal
                </option>
                {campaigns.map((camp) => (
                  <option key={camp._id} value={camp._id} className="bg-[#18181b] text-white">
                    {camp.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            </div>
          )}

          {/* Direct Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleUploadFile}
            className="hidden"
            id="creator-media-upload-input"
          />
          <label
            htmlFor="creator-media-upload-input"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7831d6] hover:bg-[#6825bc] active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-[#7831d6]/25 transition cursor-pointer ${
              isUploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>Upload Media</span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Status Alerts */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
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

      {/* Filter Tabs & Search Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 w-fit">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === 'all'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === 'video'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="h-3 w-3" />
            <span>Videos ({counts.video})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('image')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === 'image'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ImageIcon className="h-3 w-3" />
            <span>Photos ({counts.image})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search media..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 transition focus:border-white/25 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Media Content Grid */}
      {mediaQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-[#7831d6]" />
            <span className="text-xs">Loading your media library...</span>
          </div>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-3">
            <FolderHeart className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-white m-0">No media found</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm m-0">
            {searchQuery
              ? 'No media matches your search query.'
              : activeCampaignId
                ? 'You have not uploaded any media to this campaign yet. Upload videos or photos to get started.'
                : 'You have not uploaded any personal media yet. Upload videos or photos to get started.'}
          </p>
          {!searchQuery && (
            <label
              htmlFor="creator-media-upload-input"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Choose file to upload</span>
            </label>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredMedia.map((item) => {
            const isVideo = item.type === 'video';
            const mediaUrl = getAssetUrl(item.url);
            const thumbUrl = item.thumbnailUrl ? getAssetUrl(item.thumbnailUrl) : undefined;

            return (
              <div
                key={item._id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] transition hover:border-white/20 hover:shadow-lg"
              >
                {/* Media Preview Box (aspect-[9/16] for videos matching Admin Media, aspect-square for photos) */}
                <div
                  onClick={() => setPreviewMedia(item)}
                  onMouseEnter={isVideo ? handleVideoHoverStart : undefined}
                  onMouseLeave={isVideo ? handleVideoHoverEnd : undefined}
                  className={`relative ${isVideo ? 'aspect-[9/16]' : 'aspect-square'} w-full cursor-pointer bg-black overflow-hidden flex items-center justify-center`}
                >
                  {isVideo ? (
                    <LoadingVideoPreview
                      src={mediaUrl}
                      crossOrigin="anonymous"
                      className="h-full w-full"
                      videoClassName="h-full w-full object-cover cursor-pointer"
                      playsInline
                      preload="metadata"
                      poster={thumbUrl}
                      onMouseEnter={(e) => {
                        e.target.muted = false;
                        e.target.play().catch(() => {
                          e.target.muted = true;
                          e.target.play().catch(() => {});
                        });
                      }}
                      onMouseLeave={(e) => {
                        e.target.pause();
                        e.target.currentTime = 0;
                      }}
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      crossOrigin="anonymous"
                      alt={item.name}
                      className="h-full w-full object-cover object-[center_40%] transition duration-300 group-hover:scale-105"
                    />
                  )}

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2 pointer-events-none z-10">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#0a0a0a]/85 border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                      {isVideo ? <Video className="h-2.5 w-2.5 text-purple-400" /> : <ImageIcon className="h-2.5 w-2.5 text-blue-400" />}
                      {item.type}
                    </span>
                  </div>

                  {/* Size tag */}
                  {item.size ? (
                    <div className="absolute bottom-2 right-2 pointer-events-none z-10">
                      <span className="rounded-md bg-[#0a0a0a]/85 border border-white/10 px-1.5 py-0.5 text-[9px] font-medium text-zinc-300 backdrop-blur-md shadow-sm">
                        {formatBytes(item.size)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Metadata & Actions */}
                <div className="flex flex-1 flex-col justify-between p-3 space-y-2.5">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-bold text-white" title={item.name}>
                      {item.name}
                    </p>
                    <p className="m-0 mt-0.5 text-[10px] text-zinc-500">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleScheduleMedia(item)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-[#7831d6] hover:text-white px-2 py-1.5 text-[11px] font-semibold text-zinc-300 transition active:scale-95"
                    >
                      <Calendar className="h-3 w-3" />
                      <span>Schedule</span>
                    </button>

                    {deleteConfirmId === item._id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(item._id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-rose-500 transition"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg bg-white/10 px-1.5 py-1.5 text-[10px] text-zinc-400 hover:text-white transition"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item._id)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
                        title="Delete asset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Preview Modal */}
      {previewMedia && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-2xl w-full overflow-hidden rounded-2xl border border-white/15 bg-[#121216] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="min-w-0 pr-4">
                <h3 className="m-0 truncate text-sm font-bold text-white">{previewMedia.name}</h3>
                <p className="m-0 mt-0.5 text-[11px] text-zinc-400">
                  {formatDate(previewMedia.createdAt)} • {formatBytes(previewMedia.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Media Content */}
            <div className="flex items-center justify-center bg-black p-4 max-h-[60vh] overflow-hidden">
              {previewMedia.type === 'video' ? (
                <video
                  src={getMediaUrl(previewMedia.url, { apiBaseUrl: API_BASE_URL })}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[55vh] w-auto rounded-lg object-contain"
                />
              ) : (
                <img
                  src={getMediaUrl(previewMedia.url, { apiBaseUrl: API_BASE_URL })}
                  alt={previewMedia.name}
                  className="max-h-[55vh] w-auto rounded-lg object-contain"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-white/10 p-4 bg-white/[0.02]">
              <span className="text-xs text-zinc-400">
                {previewMedia.caption || 'No caption attached'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const target = previewMedia;
                  setPreviewMedia(null);
                  handleScheduleMedia(target);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#7831d6] hover:bg-[#6825bc] px-4 py-2 text-xs font-bold text-white shadow-md transition"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Schedule This Media</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorMedia;
