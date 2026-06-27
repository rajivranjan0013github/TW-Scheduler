import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Folder, Upload, X, Tag, AlertTriangle, Music, Save, Trash2 } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { getProxiedMediaUrl } from '../utils/mediaUrls';

const getProxyUrl = (url) => getProxiedMediaUrl(url, API_BASE_URL);

export const AdminFolderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTags, setUploadTags] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);

  const invalidateFolderDetailCaches = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'folder-details'] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'folders'] }),
    queryClient.invalidateQueries({ queryKey: ['media-library'] }),
    queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);

  const fetchAccounts = async () => {
    try {
      const scope = withCampaignScope();
      const data = await queryClient.fetchQuery({
        queryKey: ['admin', 'folder-details', 'accounts', scope],
        queryFn: async () => {
          const response = await fetch(`${API_BASE_URL}/api/accounts${scope}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.message || 'Failed to fetch accounts.');
          }
          return payload;
        },
        staleTime: 2 * 60 * 1000,
      });
      const connected = data.filter((acc) => acc.isConnected !== false);
      setAccounts(connected);
      setSelectedAccountIds(connected.map((acc) => acc._id));
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (selectedAccountIds.length === 0) {
      setUploadError('Please select at least one social account.');
      return;
    }

    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('folderId', id);
    formData.append('tags', uploadTags);
    formData.append('caption', uploadCaption);
    formData.append('socialAccountIds', selectedAccountIds.join(','));
    formData.append('campaignId', getActiveCampaignId());

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload media asset.');
      }

      await invalidateFolderDetailCaches();
      await fetchFolderDetails({ force: true });
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTags('');
      setUploadCaption('');
      setUploadError('');
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!window.confirm('Are you sure you want to delete this folder? Files inside will be moved to the root.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/folders/${id}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete folder.');
      }

      await invalidateFolderDetailCaches();
      navigate('/admin/folders');
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchFolderDetails = async ({ force = false } = {}) => {
    if (!folder && media.length === 0) setLoading(true);
    setError('');
    try {
      const scope = withCampaignScope();
      const queryKey = ['admin', 'folder-details', id, scope];
      if (force) {
        await queryClient.invalidateQueries({ queryKey });
      }
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(`${API_BASE_URL}/api/admin/folders/${id}${scope}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.message || 'Failed to load folder details.');
          }
          return payload;
        },
        staleTime: 60 * 1000,
      });
      setFolder(data.folder);
      setMedia(data.media);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolderDetails();
    fetchAccounts();
  }, [id]);

  const getCaptionDraft = (item) => (
    captionDrafts[item._id] !== undefined ? captionDrafts[item._id] : (item.caption || '')
  );

  const handleSaveCaption = async (item) => {
    const nextCaption = getCaptionDraft(item);
    setSavingCaptionId(item._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${item._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: JSON.stringify({ caption: nextCaption }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to update media caption');
      }

      setMedia((current) => current.map((mediaItem) => (
        mediaItem._id === item._id ? data : mediaItem
      )));
      setCaptionDrafts((current) => {
        const next = { ...current };
        delete next[item._id];
        return next;
      });
      await invalidateFolderDetailCaches();
    } catch (err) {
      alert(`Caption save failed: ${err.message}`);
    } finally {
      setSavingCaptionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-8 text-[#1d1d1f]">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-[#e5e5ea] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <button
            onClick={() => navigate('/admin/folders')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Media Folders</span>
          </button>
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Campaign Manager</p>
            <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f] flex items-center gap-2">
              <Folder className="h-5 w-5 text-[#3478f6]" />
              {folder ? folder.name : 'Folder Details'}
            </h2>
            {folder?.userId && (
              <p className="m-0 mt-1 text-xs text-[#8e8e93]">
                Created by: <span className="font-semibold text-black">{folder.userId.name}</span> ({folder.userId.email})
              </p>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteFolder}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ff3b30]/20 bg-white px-4 py-2 text-xs font-semibold text-[#ff3b30] transition hover:bg-[#ff3b30]/10 cursor-pointer animate-in fade-in"
            title="Delete Folder"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Folder</span>
          </button>
          
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] outline-none border-none cursor-pointer"
          >
            <Upload className="h-4.5 w-4.5" />
            <span>Upload Content</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3 bg-white border border-[#d2d2d7] rounded-xl shadow-sm">
          <div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-medium">Loading folder assets...</span>
        </div>
      ) : (
        <>


          {/* Media Grid */}
          <div className="mt-8 animate-in fade-in duration-300">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Media Assets ({media.length})</h3>
            {media.length === 0 ? (
              <div className="border border-dashed border-[#e5e5ea] bg-white p-16 rounded-xl text-center text-gray-500 text-xs shadow-sm">
                No media assets found in this folder.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {media.map((item) => (
                  <div
                    key={item._id}
                    className="bg-white border border-[#e5e5ea] rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-gray-400 transition-all duration-150 group"
                  >
                    {/* Media Preview */}
                    <div className="aspect-video bg-[#f5f5f7] relative overflow-hidden flex items-center justify-center border-b border-[#e5e5ea]">
                      {item.type === 'video' && item.thumbnailUrl ? (
                        <img src={getProxyUrl(item.thumbnailUrl)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                      ) : item.type === 'video' ? (
                        <video src={getProxyUrl(item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" controls preload="none" />
                      ) : item.type === 'audio' ? (
                        <div className="flex flex-col items-center justify-center w-full h-full p-3 gap-1 bg-[#f5f5f7]">
                          <Music className="h-7 w-7 text-[#ff2d55]" />
                          <audio src={getProxyUrl(item.url)} crossOrigin="anonymous" className="w-full max-w-[95%] scale-90" controls preload="metadata" />
                        </div>
                      ) : (
                        <img src={getProxyUrl(item.thumbnailUrl || item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                      )}
                      <span className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded text-[8px] uppercase font-bold text-black border border-[#e5e5ea]">
                        {item.type}
                      </span>
                    </div>

                    {/* Metadata Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-[#1d1d1f] truncate m-0" title={item.name}>{item.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-1">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>

                      <div className="mt-3 space-y-2">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Caption stored on this asset</span>
                        <textarea
                          value={getCaptionDraft(item)}
                          onChange={(e) => setCaptionDrafts((current) => ({
                            ...current,
                            [item._id]: e.target.value,
                          }))}
                          placeholder="Caption for this video..."
                          className="h-20 w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] p-2 text-[10px] leading-relaxed text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0071e3] resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCaption(item)}
                          disabled={savingCaptionId === item._id || getCaptionDraft(item) === (item.caption || '')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#1d1d1f] transition-all hover:border-gray-400 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:border-[#e5e5ea]"
                        >
                          <Save className="h-3 w-3" />
                          <span>{savingCaptionId === item._id ? 'Saving...' : 'Save caption'}</span>
                        </button>
                      </div>

                      {/* Targeted Accounts Avatars */}
                      {item.socialAccountIds && item.socialAccountIds.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-[9px] text-gray-500">
                          <span className="font-semibold">{item.socialAccountIds.length} account{item.socialAccountIds.length === 1 ? '' : 's'}</span>
                          <div className="flex -space-x-1">
                            {item.socialAccountIds.map((account) => (
                              <img
                                key={account._id}
                                src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                                crossOrigin="anonymous"
                                title={`${account.name} (@${account.username}) · ${account.platform}`}
                                className="h-4.5 w-4.5 rounded-full border border-white object-cover"
                                alt=""
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.tags.map((tag) => (
                            <span key={tag} className="text-[8px] bg-[#f5f5f7] text-gray-500 px-1.5 py-0.5 rounded border border-[#e5e5ea] font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Upload Content Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleUploadSubmit}
            className="w-full max-w-md bg-white border border-[#d2d2d7] rounded-2xl shadow-2xl p-6 text-[#1d1d1f] zoom-in-95 animate-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-3 mb-4">
              <h3 className="m-0 text-base font-semibold tracking-tight">Upload Content</h3>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadTags('');
                  setUploadCaption('');
                  setUploadError('');
                }}
                disabled={uploading}
                className="text-gray-400 hover:text-black transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {uploadError}
              </div>
            )}

            {/* Drag & Drop File Selector */}
            <div className="border border-dashed border-[#d2d2d7] rounded-xl p-6 text-center hover:border-gray-400 transition-colors relative bg-[#f5f5f7]/50">
              <input
                type="file"
                accept="image/*,video/*,audio/*,.mp3"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              {uploadFile ? (
                <div className="space-y-1">
                  <p className="m-0 text-xs font-semibold text-black truncate max-w-xs mx-auto">{uploadFile.name}</p>
                  <p className="m-0 text-[10px] text-gray-500">{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="m-0 text-xs font-semibold text-black">Choose a file or drag & drop</p>
                  <p className="m-0 text-[10px] text-gray-400 mt-1">Supports Images, Videos and Audio (MP3)</p>
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="mt-4">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                Caption
              </label>
              <textarea
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Describe your content..."
                disabled={uploading}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs text-[#1d1d1f] placeholder-gray-400 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] outline-none disabled:opacity-50 transition-all resize-none"
              />
            </div>

            {/* Tags */}
            <div className="mt-4">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="e.g. promo, summer, video"
                disabled={uploading}
                className="mt-1.5 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs text-[#1d1d1f] placeholder-gray-400 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] outline-none disabled:opacity-50 transition-all"
              />
            </div>

            {/* Publishing channels warning */}
            {accounts.length === 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-[11px] text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 animate-pulse" />
                <span>No publishing channels found. Connect channels before using this campaign folder for publishing.</span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadTags('');
                  setUploadCaption('');
                  setUploadError('');
                }}
                disabled={uploading}
                className="rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7] outline-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadFile || selectedAccountIds.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] outline-none disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminFolderDetails;
