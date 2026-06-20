import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Folder, Search, Upload, Plus, Trash2, ChevronRight, Clock, Save, Film } from 'lucide-react';

const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('https://pub-') || url.includes('r2.cloudflarestorage.com')) {
    return `http://localhost:5001/api/media/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

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
  const [folders, setFolders] = useState([]);
  const [media, setMedia] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(() => {
    return location.state?.preselectedFolderId || 'root';
  });

  useEffect(() => {
    if (location.state?.preselectedFolderId) {
      setActiveFolderId(location.state.preselectedFolderId);
    }
  }, [location.state?.preselectedFolderId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const canUpload = true;

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [activeFolderId]);

  const fetchFolders = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/media/folders', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const fetchMedia = async () => {
    try {
      const params = new URLSearchParams();
      if (activeFolderId) params.set('folderId', activeFolderId);
      const url = `http://localhost:5001/api/media?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMedia(data);
      }
    } catch (error) {
      console.error('Failed to load media:', error);
    }
  };

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

    try {
      const response = await fetch('http://localhost:5001/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: formData,
      });

      if (response.ok) {
        setUploadCaption('');
        fetchMedia();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed uploading file:', error);
      alert('Upload failed. Using fallback simulation.');
      const fakeUrl = file.type.startsWith('video/') 
        ? 'https://assets.mixkit.co/videos/preview/mixkit-waves-breaking-in-the-sunset-1527-large.mp4'
        : 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600';
      
      const newMockItem = {
        _id: `m_${Date.now()}`,
        folderId: activeFolderId === 'root' ? null : activeFolderId,
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: fakeUrl,
        storageKey: `mock-${Date.now()}`,
        caption: uploadCaption,
        tags: [],
        socialAccountIds: [],
        size: file.size,
        createdAt: new Date()
      };
      setMedia([newMockItem, ...media]);
      setUploadCaption('');
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
      const folderResponse = await fetch('http://localhost:5001/api/media/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: JSON.stringify({
          name: folderName,
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });

      if (!folderResponse.ok) {
        const error = await folderResponse.json();
        throw new Error(error.message || 'Could not create folder in media library.');
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

        const response = await fetch('http://localhost:5001/api/media/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
          },
          body: formData,
        });

        if (!response.ok) {
          failedFiles.push(file.name);
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
      alert('Folder upload failed.');
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
      const response = await fetch(`http://localhost:5001/api/media/${item._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
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
      } else {
        const error = await response.json();
        alert(`Caption save failed: ${error.message || 'Unable to update media caption'}`);
      }
    } catch (error) {
      console.error('Failed saving caption:', error);
      alert('Caption save failed.');
    } finally {
      setSavingCaptionId(null);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch('http://localhost:5001/api/media/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: JSON.stringify({ name: newFolderName }),
      });

      if (response.ok) {
        setNewFolderName('');
        setShowNewFolderModal(false);
        fetchFolders();
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this campaign folder? Files inside will be moved to the campaign library.')) return;

    try {
      const response = await fetch(`http://localhost:5001/api/media/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        if (activeFolderId === folderId) {
          setActiveFolderId('root');
        }
        fetchFolders();
        fetchMedia();
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  const handleDeleteMedia = async (mediaId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this media file permanently?')) return;

    try {
      const response = await fetch(`http://localhost:5001/api/media/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        fetchMedia();
      }
    } catch (error) {
      console.error('Failed to delete media:', error);
      setMedia(media.filter(m => m._id !== mediaId));
    }
  };

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

        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/media/editor')}
            className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] hover:bg-[#f5f5f7] text-[#1d1d1f] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <Film className="w-3.5 h-3.5 text-blue-600" />
            <span>Video Editor</span>
          </button>

          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Directory Breadcrumbs */}
      <div className="flex items-center gap-2 text-[11px] text-[#8e8e93] bg-white px-3 py-1.5 rounded-lg border border-[#e5e5ea] shadow-sm">
        <span 
          onClick={() => { setActiveFolderId('root'); setSearchQuery(''); }}
          className={`cursor-pointer hover:text-black ${activeFolderId === 'root' ? 'text-black font-semibold' : ''}`}
        >
          Campaign Library
        </span>
        {activeFolderId !== 'root' && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-black font-semibold">
              {folders.find(f => f._id === activeFolderId)?.name || 'Campaign View'}
            </span>
          </>
        )}
      </div>

      {/* Folders List Grid */}
      {activeFolderId === 'root' && !searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {folders.map(folder => (
            <div 
              key={folder._id}
              onClick={() => setActiveFolderId(folder._id)}
              className="bg-white border border-[#e5e5ea] hover:border-gray-400 p-4 rounded-xl flex items-center justify-between cursor-pointer group transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Folder className="w-5 h-5 text-gray-400" />
                <span className="text-xs font-semibold text-black group-hover:text-black transition-colors">{folder.name}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteFolder(folder._id, e)}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[#f5f5f7] hover:text-red-500 rounded-md transition-all text-gray-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {folders.length === 0 && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] p-6 rounded-xl text-center text-[#8e8e93] text-xs">
              No campaigns created.
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
            <div className="grid grid-cols-3 gap-2">
              {['all', 'video', 'image'].map(t => (
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
          {canUpload && (
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
          )}
        </div>

        {/* Right Side: Media Files Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredMedia.map(item => (
              <div
                key={item._id}
                className="bg-white border border-[#e5e5ea] rounded-xl overflow-hidden group hover:border-gray-400 transition-all flex flex-col relative shadow-sm"
              >
                {(() => {
                  return (
                    <>
                      {/* Media Preview Box */}
                      <div className="aspect-video bg-[#f5f5f7] relative overflow-hidden flex items-center justify-center border-b border-[#e5e5ea]">
                        {item.type === 'video' && item.thumbnailUrl ? (
                          <img src={getProxyUrl(item.thumbnailUrl)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                        ) : item.type === 'video' ? (
                          <video src={getProxyUrl(item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" controls preload="metadata" />
                        ) : (
                          <img src={getProxyUrl(item.thumbnailUrl || item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                        )}
                        <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded text-[8px] uppercase font-bold text-black border border-[#e5e5ea] shadow-sm">
                          {item.type}
                        </div>
                      </div>

                      {/* Details Footer */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-[#1d1d1f] truncate m-0" title={item.name}>{item.name}</h4>
                          <p className="text-[10px] text-gray-500 mt-1">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>

                        <div className="mt-3 space-y-2">
                          <textarea
                            value={getCaptionDraft(item)}
                            onChange={(e) => setCaptionDrafts((current) => ({
                              ...current,
                              [item._id]: e.target.value,
                            }))}
                            placeholder="Caption for this asset..."
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
                      </div>

                      {/* Hover Delete & Schedule Actions */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/scheduler', { state: { preselectedMediaId: item._id } });
                        }}
                        className="absolute top-2 right-10 p-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-transparent shadow-sm flex items-center gap-1 text-[9px] font-semibold"
                        title="Schedule Post"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Schedule</span>
                      </button>

                      <button
                        onClick={(e) => handleDeleteMedia(item._id, e)}
                        className="absolute top-2 right-2 p-1.5 bg-white/95 hover:bg-red-500 hover:text-white rounded-lg transition-all text-gray-500 opacity-0 group-hover:opacity-100 border border-[#e5e5ea] shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  );
                })()}
              </div>
            ))}

            {filteredMedia.length === 0 && (
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
            <h3 className="text-sm font-semibold text-black mb-4">New Campaign Folder</h3>
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

    </div>
  );
};
export default MediaLibrary;
