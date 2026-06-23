import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Folder, MessageSquareCheck, MessageSquareWarning, MoreVertical, Music, Pencil, Search, Upload, Plus, Trash2, ChevronRight, Clock, Save } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from './videoEditor/videoEditorConstants';

const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  if (url.startsWith('https://pub-') || url.includes('r2.cloudflarestorage.com')) return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
  return url;
};

const getErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
};

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');

const getPathWithoutExtension = (filePath) => (
  String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
);

const getFileNameWithoutExtension = (filePath) => (
  getPathWithoutExtension(filePath).split('/').pop()
);

export const MediaLibrary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const [folders, setFolders] = useState([]);
  const [media, setMedia] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(() => {
    return location.state?.preselectedFolderId || 'root';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [savingFolderId, setSavingFolderId] = useState(null);
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [openMediaMenuId, setOpenMediaMenuId] = useState(null);
  const [captionDialogMedia, setCaptionDialogMedia] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const authToken = token || localStorage.getItem('tw_token');
  const canUpload = ['owner', 'admin', 'editor'].includes(user?.role);
  const canDelete = ['owner', 'admin'].includes(user?.role);
  const canManageFolders = canUpload;

  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(Array.isArray(data) ? data : []);
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to load folders.'));
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      setFolders([]);
      setErrorMessage(error.message || 'Failed to load folders.');
    } finally {
      setLoadingFolders(false);
    }
  }, [authToken]);

  const fetchMedia = useCallback(async () => {
    setLoadingMedia(true);
    setErrorMessage('');
    try {
      const params = new URLSearchParams();
      const campaignId = getActiveCampaignId();
      if (campaignId) params.set('campaignId', campaignId);
      if (activeFolderId) params.set('folderId', activeFolderId);
      const url = `${API_BASE_URL}/api/media?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMedia(Array.isArray(data) ? data : []);
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to load media.'));
      }
    } catch (error) {
      console.error('Failed to load media:', error);
      setMedia([]);
      setErrorMessage(error.message || 'Failed to load media.');
    } finally {
      setLoadingMedia(false);
    }
  }, [activeFolderId, authToken]);

  useEffect(() => {
    if (location.state?.preselectedFolderId) {
      queueMicrotask(() => setActiveFolderId(location.state.preselectedFolderId));
    }
  }, [location.state?.preselectedFolderId]);

  useEffect(() => {
    queueMicrotask(() => void fetchFolders());
  }, [fetchFolders]);

  useEffect(() => {
    queueMicrotask(() => void fetchMedia());
  }, [fetchMedia]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', activeFolderId === 'root' ? 'null' : activeFolderId);
    formData.append('tags', '');
    formData.append('caption', uploadCaption);
    formData.append('socialAccountIds', '');
    formData.append('campaignId', getActiveCampaignId());

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      if (response.ok) {
        setUploadCaption('');
        void fetchMedia();
      } else {
        throw new Error(await getErrorMessage(response, 'Upload failed.'));
      }
    } catch (error) {
      console.error('Failed uploading file:', error);
      alert(`Upload failed: ${error.message || 'Unable to save this file.'}`);
    } finally {
      setUploading(false);
      setUploadProgress('');
      e.target.value = '';
    }
  };

  const handleFolderUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const mediaFiles = selectedFiles.filter(file => (
      file.type.startsWith('image/') || file.type.startsWith('video/')
    ));
    const captionFiles = selectedFiles.filter(file => (
      file.type === 'text/plain' || /\.txt$/i.test(file.name)
    ));

    if (mediaFiles.length === 0) {
      alert('No supported image or video files were found in this folder.');
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const failedFiles = [];
      const firstRelativePath = mediaFiles[0].webkitRelativePath || mediaFiles[0].name;
      const folderName = firstRelativePath.split('/')[0] || 'Uploaded Folder';
      const folderResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          name: folderName,
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });

      if (!folderResponse.ok) {
        throw new Error(await getErrorMessage(folderResponse, 'Could not create folder in media library.'));
      }

      const createdFolder = await folderResponse.json();
      const targetFolderId = createdFolder._id;
      const captionsByPath = new Map();

      for (const captionFile of captionFiles) {
        const relativePath = captionFile.webkitRelativePath || captionFile.name;
        const captionText = await captionFile.text();
        captionsByPath.set(getPathWithoutExtension(relativePath), captionText);
        captionsByPath.set(getFileNameWithoutExtension(relativePath), captionText);
      }

      for (let index = 0; index < mediaFiles.length; index += 1) {
        const file = mediaFiles[index];
        const relativePath = file.webkitRelativePath || file.name;
        const sidecarCaption = captionsByPath.get(getPathWithoutExtension(relativePath))
          ?? captionsByPath.get(getFileNameWithoutExtension(relativePath));
        setUploadProgress(`Uploading ${index + 1}/${mediaFiles.length}: ${file.webkitRelativePath || file.name}`);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', targetFolderId);
        formData.append('tags', '');
        formData.append('caption', sidecarCaption ?? uploadCaption);
        formData.append('socialAccountIds', '');
        formData.append('campaignId', getActiveCampaignId());

        const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData,
        });

        if (!response.ok) {
          const message = await getErrorMessage(response, 'Upload failed.');
          failedFiles.push(`${file.name} (${message})`);
        }
      }

      setUploadCaption('');
      await fetchFolders();
      setActiveFolderId(targetFolderId);

      if (failedFiles.length > 0) {
        alert(`${failedFiles.length} files could not be uploaded: ${failedFiles.slice(0, 5).join(', ')}`);
      }
    } catch (error) {
      console.error('Failed uploading folder:', error);
      alert(`Folder upload failed: ${error.message || 'Unable to import this folder.'}`);
    } finally {
      setUploading(false);
      setUploadProgress('');
      e.target.value = '';
    }
  };

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
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ caption: nextCaption }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMedia((current) => current.map(mediaItem => (
          mediaItem._id === item._id ? updated : mediaItem
        )));
        setCaptionDrafts((current) => {
          const next = { ...current };
          delete next[item._id];
          return next;
        });
        return true;
      } else {
        throw new Error(await getErrorMessage(response, 'Unable to update media caption'));
      }
    } catch (error) {
      console.error('Failed saving caption:', error);
      alert(`Caption save failed: ${error.message || 'Unable to update media caption'}`);
      return false;
    } finally {
      setSavingCaptionId(null);
    }
  };

  const openCaptionDialog = (item, e) => {
    e.stopPropagation();
    setOpenMediaMenuId(null);
    setCaptionDialogMedia(item);
  };

  const closeCaptionDialog = () => {
    setCaptionDialogMedia(null);
  };

  const handleCaptionDialogSave = async (e) => {
    e.preventDefault();
    if (!captionDialogMedia) return;
    const saved = await handleSaveCaption(captionDialogMedia);
    if (saved) closeCaptionDialog();
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          name: newFolderName.trim(),
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });

      if (response.ok) {
        setNewFolderName('');
        setShowNewFolderModal(false);
        void fetchFolders();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to create folder.'));
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(error.message || 'Failed to create folder.');
    }
  };

  const openRenameFolderModal = (folder, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);
    setRenamingFolder(folder);
    setRenameFolderName(folder.name || '');
  };

  const closeRenameFolderModal = () => {
    setRenamingFolder(null);
    setRenameFolderName('');
  };

  const handleRenameFolder = async (e) => {
    e.preventDefault();
    if (!renamingFolder || !renameFolderName.trim()) return;

    setSavingFolderId(renamingFolder._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${renamingFolder._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          name: renameFolderName.trim(),
        }),
      });

      if (response.ok) {
        const updatedFolder = await response.json();
        setFolders((current) => current.map((folder) => (
          folder._id === updatedFolder._id ? updatedFolder : folder
        )));
        closeRenameFolderModal();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to rename folder.'));
      }
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert(error.message || 'Failed to rename folder.');
    } finally {
      setSavingFolderId(null);
    }
  };

  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);
    if (!window.confirm('Are you sure you want to delete this campaign folder? Files inside will be moved to the campaign library.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${folderId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        if (activeFolderId === folderId) {
          setActiveFolderId('root');
        }
        void fetchFolders();
        void fetchMedia();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to delete folder.'));
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert(error.message || 'Failed to delete folder.');
    }
  };

  const handleDeleteMedia = async (mediaId, e) => {
    e.stopPropagation();
    setOpenMediaMenuId(null);
    if (!window.confirm('Delete this media file permanently?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        void fetchMedia();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to delete media.'));
      }
    } catch (error) {
      console.error('Failed to delete media:', error);
      alert(error.message || 'Failed to delete media.');
    }
  };

  const getFolderParentId = (folder) => normalizeFolderId(folder.parentFolderId) || 'root';
  const visibleFolders = folders.filter((folder) => getFolderParentId(folder) === activeFolderId);
  const activeFolder = folders.find((folder) => folder._id === activeFolderId);
  const breadcrumbFolders = [];
  let breadcrumbFolder = activeFolder;
  while (breadcrumbFolder) {
    breadcrumbFolders.unshift(breadcrumbFolder);
    const parentId = getFolderParentId(breadcrumbFolder);
    if (!parentId || parentId === 'root') break;
    breadcrumbFolder = folders.find((folder) => folder._id === parentId);
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredMedia = media.filter(m => {
    if (filterType === 'all') return true;
    return m.type === filterType;
  }).filter(m => {
    if (!normalizedSearch) return true;
    const searchable = [
      m.name,
      m.caption,
      ...(m.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(normalizedSearch);
  });

  return (
    <div className="p-8 space-y-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f]">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Media Library</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Store campaign media, thumbnails, and captions in R2</p>
        </div>

        {canManageFolders && (
          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>
        )}
      </div>

      {/* Directory Breadcrumbs */}
      <div className="flex items-center gap-2 text-[11px] text-[#8e8e93] bg-white px-3 py-1.5 rounded-lg border border-[#e5e5ea] shadow-sm">
        <span 
          onClick={() => { setActiveFolderId('root'); setSearchQuery(''); }}
          className={`cursor-pointer hover:text-black ${activeFolderId === 'root' ? 'text-black font-semibold' : ''}`}
        >
          Campaign Library
        </span>
        {breadcrumbFolders.map((folder) => (
          <React.Fragment key={folder._id}>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span
              onClick={() => setActiveFolderId(folder._id)}
              className={`cursor-pointer hover:text-black ${folder._id === activeFolderId ? 'text-black font-semibold' : ''}`}
            >
              {folder.name || 'Campaign View'}
            </span>
          </React.Fragment>
        ))}
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-[#ff9500]/30 bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Folders List Grid */}
      {!searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {visibleFolders.map(folder => (
            <div 
              key={folder._id}
              onClick={() => setActiveFolderId(folder._id)}
              className="relative bg-white border border-[#e5e5ea] hover:border-gray-400 p-4 rounded-xl flex items-center justify-between cursor-pointer group transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Folder className="w-5 h-5 text-gray-400" />
                <span className="text-xs font-semibold text-black group-hover:text-black transition-colors">{folder.name}</span>
              </div>
              {(canManageFolders || canDelete) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFolderMenuId((current) => (current === folder._id ? null : folder._id));
                    }}
                    className="p-1.5 hover:bg-[#f5f5f7] hover:text-black rounded-md transition-all text-gray-400"
                    title="Folder actions"
                    aria-label="Folder actions"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                  {openFolderMenuId === folder._id && (
                    <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-[#e5e5ea] bg-white py-1 shadow-lg">
                      {canManageFolders && (
                        <button
                          type="button"
                          onClick={(e) => openRenameFolderModal(folder, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Rename</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFolder(folder._id, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {loadingFolders && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] p-6 rounded-xl text-center text-[#8e8e93] text-xs">
              Loading folders...
            </div>
          )}
          {!loadingFolders && activeFolderId === 'root' && folders.length === 0 && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] p-6 rounded-xl text-center text-[#8e8e93] text-xs">
              No campaigns created.
            </div>
          )}
          {!loadingFolders && activeFolderId !== 'root' && visibleFolders.length === 0 && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] p-6 rounded-xl text-center text-[#8e8e93] text-xs">
              No nested folders here.
            </div>
          )}
        </div>
      )}

      {/* Main Search & Upload Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Side: Filter Options */}
        <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 space-y-6 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f5f5f7] border border-[#e5e5ea] pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">File Type</label>
            <div className="grid grid-cols-4 gap-2">
              {['all', 'video', 'image', 'audio'].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    filterType === t 
                      ? 'bg-black text-white font-semibold' 
                      : 'bg-[#f5f5f7] text-gray-500 border border-[#e5e5ea] hover:text-black'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Upload Widget */}
          {canUpload ? (
            <div className="space-y-4 border-t border-[#e5e5ea] pt-6">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campaign Assets</label>
              
              <div className="space-y-2">
                <textarea
                  placeholder="Caption for single upload or folder fallback..."
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  className="h-20 w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3 py-2 rounded-lg focus:outline-none text-xs text-black placeholder:text-gray-400 resize-none"
                />
              </div>

              <div className="border border-dashed border-[#e5e5ea] rounded-xl p-6 text-center hover:border-gray-400 cursor-pointer relative group transition-all bg-[#f5f5f7]">
                <input 
                  type="file" 
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {uploading ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-5 h-5 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] text-gray-500">{uploadProgress || 'Uploading to R2...'}</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-gray-400">
                    <Upload className="w-6 h-6 mx-auto text-gray-400" />
                    <p className="text-xs font-semibold text-black">Click to upload file</p>
                    <p className="text-[10px] text-gray-500">Supports videos/images up to 100MB</p>
                  </div>
                )}
              </div>

              <div className="border border-dashed border-[#d2d2d7] rounded-xl p-5 text-center hover:border-gray-400 cursor-pointer relative group transition-all bg-white">
                <input
                  type="file"
                  accept="image/*,video/*,.txt,text/plain"
                  multiple
                  webkitdirectory="true"
                  directory="true"
                  onChange={handleFolderUpload}
                  disabled={uploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-2 text-gray-400">
                  <Folder className="w-6 h-6 mx-auto text-gray-400" />
                  <p className="text-xs font-semibold text-black">Import campaign folder</p>
                  <p className="text-[10px] text-gray-500">Use matching .txt files for per-video captions</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-[#e5e5ea] pt-6 text-xs font-medium text-[#8e8e93]">
              Your role can view media assets but cannot upload new files.
            </div>
          )}
        </div>

        {/* Right Side: Media Files Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
            {loadingMedia && (
              <div className="col-span-full border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm">
                Loading media assets...
              </div>
            )}

            {!loadingMedia && filteredMedia.map(item => (
              <div
                key={item._id}
                className="bg-white border border-[#e5e5ea] rounded-xl overflow-visible group hover:border-gray-400 transition-all flex flex-col relative shadow-sm"
              >
                {(() => {
                  return (
                    <>
                      {/* Media Preview Box */}
                      <div className="aspect-[9/16] bg-[#f5f5f7] relative overflow-hidden rounded-xl flex items-center justify-center">
                        {item.type === 'video' && item.thumbnailUrl ? (
                          <img src={getProxyUrl(item.thumbnailUrl)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                        ) : item.type === 'video' ? (
                          <video src={getProxyUrl(item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" controls preload="metadata" />
                        ) : item.type === 'audio' ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
                            <Music className="h-8 w-8 text-gray-400" />
                            <audio src={getProxyUrl(item.url)} controls preload="metadata" className="w-full max-w-[180px]" />
                          </div>
                        ) : (
                          <img src={getProxyUrl(item.thumbnailUrl || item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                        )}
                        <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded text-[8px] uppercase font-bold text-black border border-[#e5e5ea] shadow-sm">
                          {item.type}
                        </div>
                        <div
                          className={`absolute left-2 top-9 inline-flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm ${
                            item.caption?.trim()
                              ? 'border-[#34c759]/20 bg-white/95 text-[#15803d]'
                              : 'border-[#ff9500]/20 bg-white/95 text-[#b45309]'
                          }`}
                          title={item.caption?.trim() ? 'Caption saved' : 'No caption saved'}
                        >
                          {item.caption?.trim() ? (
                            <MessageSquareCheck className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquareWarning className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          <p className="m-0 truncate" title={item.name}>{item.name || 'Untitled media'}</p>
                        </div>
                      </div>

                      {/* Media Actions */}
                      <div className="absolute right-2 top-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMediaMenuId((current) => (current === item._id ? null : item._id));
                          }}
                          className="p-1.5 bg-white/95 hover:bg-white hover:text-black rounded-lg transition-all text-gray-500 border border-[#e5e5ea] shadow-sm"
                          title="Media actions"
                          aria-label="Media actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {openMediaMenuId === item._id && (
                          <>
                            <button
                              type="button"
                              aria-label="Close media actions"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMediaMenuId(null);
                              }}
                              className="fixed inset-0 z-10 cursor-default bg-transparent"
                            />
                            <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-lg border border-[#e5e5ea] bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={(e) => openCaptionDialog(item, e)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit caption</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMediaMenuId(null);
                                  navigate('/scheduler', { state: { preselectedMediaId: item._id } });
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                              >
                                <Clock className="h-3.5 w-3.5" />
                                <span>Schedule</span>
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteMedia(item._id, e)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}

            {!loadingMedia && filteredMedia.length === 0 && (
              <div className="col-span-full border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm">
                No media assets found.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-sm text-black shadow-xl">
            <h3 className="text-sm font-semibold text-black mb-4">
              {activeFolderId === 'root' ? 'New Campaign Folder' : 'New Nested Folder'}
            </h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Campaign folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] rounded-lg text-xs text-white"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renamingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-sm text-black shadow-xl">
            <h3 className="text-sm font-semibold text-black mb-4">Rename Folder</h3>
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Folder name"
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenameFolderModal}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFolderId === renamingFolder._id || !renameFolderName.trim()}
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] rounded-lg text-xs text-white disabled:cursor-not-allowed disabled:bg-[#a7c7ed]"
                >
                  {savingFolderId === renamingFolder._id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {captionDialogMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-lg text-black shadow-xl">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-black">Edit Caption</h3>
              <p className="mt-1 truncate text-xs text-[#8e8e93]" title={captionDialogMedia.name}>
                {captionDialogMedia.name || 'Media asset'}
              </p>
            </div>
            <form onSubmit={handleCaptionDialogSave} className="space-y-4">
              <textarea
                value={getCaptionDraft(captionDialogMedia)}
                onChange={(e) => setCaptionDrafts((current) => ({
                  ...current,
                  [captionDialogMedia._id]: e.target.value,
                }))}
                placeholder="Caption for this asset..."
                className="h-40 w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] p-3 text-xs leading-relaxed text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0071e3] resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeCaptionDialog}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCaptionId === captionDialogMedia._id || getCaptionDraft(captionDialogMedia) === (captionDialogMedia.caption || '')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#147ce5] disabled:cursor-not-allowed disabled:bg-[#a7c7ed]"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingCaptionId === captionDialogMedia._id ? 'Saving...' : 'Save caption'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default MediaLibrary;
