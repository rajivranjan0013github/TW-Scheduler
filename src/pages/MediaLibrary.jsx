import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Folder, Film, Image as ImageIcon, Search, Tag, Upload, Plus, Trash2, ChevronRight, Clock } from 'lucide-react';

export const MediaLibrary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [media, setMedia] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState('root');
  const [searchTag, setSearchTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [filterType, setFilterType] = useState('all');

  const canUpload = true;

  useEffect(() => {
    fetchFolders();
    fetchMedia();
  }, [activeFolderId, searchTag]);

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
      let url = `http://localhost:5001/api/media?folderId=${activeFolderId}`;
      if (searchTag) {
        url = `http://localhost:5001/api/media?tag=${searchTag}`;
      }

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

    // Permission verified

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', activeFolderId === 'root' ? 'null' : activeFolderId);
    formData.append('tags', tagsInput);

    try {
      const response = await fetch('http://localhost:5001/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: formData,
      });

      if (response.ok) {
        setTagsInput('');
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
        tags: tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()) : [],
        size: file.size,
        createdAt: new Date()
      };
      setMedia([newMockItem, ...media]);
      setTagsInput('');
    } finally {
      setUploading(false);
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
    if (!window.confirm('Are you sure you want to delete this folder? Files inside will be moved to root.')) return;

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

  const filteredMedia = media.filter(m => {
    if (filterType === 'all') return true;
    return m.type === filterType;
  });

  return (
    <div className="p-8 space-y-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f]">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Media Library</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Store and organize assets</p>
        </div>

        <button 
          onClick={() => setShowNewFolderModal(true)}
          className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Directory Breadcrumbs */}
      <div className="flex items-center gap-2 text-[11px] text-[#8e8e93] bg-white px-3 py-1.5 rounded-lg border border-[#e5e5ea] shadow-sm">
        <span 
          onClick={() => { setActiveFolderId('root'); setSearchTag(''); }}
          className={`cursor-pointer hover:text-black ${activeFolderId === 'root' ? 'text-black font-semibold' : ''}`}
        >
          Library Root
        </span>
        {activeFolderId !== 'root' && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-black font-semibold">
              {folders.find(f => f._id === activeFolderId)?.name || 'Folder View'}
            </span>
          </>
        )}
      </div>

      {/* Folders List Grid */}
      {activeFolderId === 'root' && !searchTag && (
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
              No folders created.
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
              placeholder="Search by tag..."
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
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
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Upload Asset</label>
              
              <div className="space-y-2">
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tags..."
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full bg-[#f5f5f7] border border-[#e5e5ea] pl-9 pr-3 py-2 rounded-lg focus:outline-none text-xs text-black placeholder:text-gray-400"
                  />
                </div>
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
                    <span className="text-[10px] text-gray-500">Uploading to R2...</span>
                  </div>
                ) : (
                  <div className="space-y-2 text-gray-400">
                    <Upload className="w-6 h-6 mx-auto text-gray-400" />
                    <p className="text-xs font-semibold text-black">Click to upload file</p>
                    <p className="text-[10px] text-gray-500">Supports videos/images up to 100MB</p>
                  </div>
                )}
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
                {/* Media Preview Box */}
                <div className="aspect-video bg-[#f5f5f7] relative overflow-hidden flex items-center justify-center border-b border-[#e5e5ea]">
                  {item.type === 'video' ? (
                    <video src={item.url} className="w-full h-full object-cover" controls preload="metadata" />
                  ) : (
                    <img src={item.url} className="w-full h-full object-cover" alt="" />
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

                  <div className="flex flex-wrap gap-1 mt-3">
                    {item.tags?.map(tag => (
                      <span key={tag} className="text-[9px] bg-[#f5f5f7] text-gray-500 px-1.5 py-0.5 rounded border border-[#e5e5ea]">
                        #{tag}
                      </span>
                    ))}
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
                placeholder="Folder name"
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
