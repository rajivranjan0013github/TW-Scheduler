import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Calendar, Search, X, Plus, Trash2, MoreVertical, Eye } from 'lucide-react';

export const AdminFolders = () => {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create folder modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Dropdown states
  const [activeDropdownFolderId, setActiveDropdownFolderId] = useState(null);

  const filteredFolders = folders.filter((folder) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    const folderName = folder.name ? folder.name.toLowerCase() : '';
    const creatorName = folder.userId?.name ? folder.userId.name.toLowerCase() : '';
    const creatorEmail = folder.userId?.email ? folder.userId.email.toLowerCase() : '';
    
    return folderName.includes(query) || creatorName.includes(query) || creatorEmail.includes(query);
  });

  const handleCreateFolder = async (e) => {
    if (e) e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreating(true);
    setCreateError('');
    try {
      const response = await fetch('http://localhost:5001/api/media/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create folder.');
      }

      await fetchFolders();
      setIsCreateModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this folder? Files inside will be moved to the root.')) return;

    try {
      const response = await fetch(`http://localhost:5001/api/admin/folders/${folderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete folder.');
      }

      await fetchFolders();
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchFolders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5001/api/admin/folders', {
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load folders.');
      }
      setFolders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-8 text-[#1d1d1f]">
      <div className="mb-6 flex flex-col gap-4 border-b border-[#e5e5ea] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Campaign Manager</p>
          <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">Media Folders</h2>
          <p className="m-0 mt-1 text-xs text-[#8e8e93]">View and audit campaign media folders across workspaces.</p>
        </div>
        
        {/* Search & Create Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#d2d2d7] bg-white py-2 pl-9 pr-8 text-xs text-[#1d1d1f] placeholder-gray-400 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-black transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Create Folder Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] outline-none border-none cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Folder</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Folders List Table */}
      <div className="mt-6 rounded-xl border border-[#d2d2d7] bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-4 border-b border-[#e5e5ea] bg-[#fbfbfd] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] rounded-t-xl">
          <span>Folder Name</span>
          <span>Created By</span>
          <span>Created At</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#6e6e73] flex items-center justify-center gap-2 rounded-b-xl">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading folders...</span>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6e6e73] rounded-b-xl">
            {searchQuery ? 'No matching folders found.' : 'No folders found in the database.'}
          </div>
        ) : (
          filteredFolders.map((folder, index) => {
            const dateStr = folder.createdAt
              ? new Date(folder.createdAt).toLocaleDateString([], { dateStyle: 'medium' })
              : 'Unknown date';
            const isLast = index === filteredFolders.length - 1;
            const openUpward = isLast && filteredFolders.length > 2;

            return (
              <div
                key={folder._id}
                onClick={() => navigate(`/admin/folders/${folder._id}`)}
                className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr] items-center gap-4 border-b border-[#e5e5ea] px-5 py-4 last:border-b-0 last:rounded-b-xl text-sm hover:bg-[#f5f5f7] cursor-pointer transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="p-2 bg-[#f5f5f7] text-[#8e8e93] rounded-lg">
                    <Folder className="h-4 w-4" />
                  </div>
                  <span className="truncate font-semibold text-[#1d1d1f]">{folder.name}</span>
                </div>

                <div className="min-w-0">
                  {folder.userId ? (
                    <>
                      <p className="m-0 truncate font-semibold text-[#1d1d1f]">{folder.userId.name || 'Anonymous'}</p>
                      <p className="m-0 mt-0.5 truncate text-xs text-[#6e6e73]">{folder.userId.email}</p>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">Unknown user</span>
                  )}
                </div>

                <div className="text-xs text-[#515154] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{dateStr}</span>
                </div>

                <div className="flex justify-end relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdownFolderId(activeDropdownFolderId === folder._id ? null : folder._id);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-[#d2d2d7] bg-white p-1.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all cursor-pointer"
                    title="Actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {activeDropdownFolderId === folder._id && (
                    <>
                      {/* Transparent backdrop overlay to close dropdown on outside click */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownFolderId(null);
                        }}
                      />
                      {/* Dropdown Menu */}
                      <div className={`absolute right-0 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} z-20 w-36 rounded-lg border border-[#d2d2d7] bg-white py-1 shadow-lg animate-in fade-in duration-100`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownFolderId(null);
                            navigate(`/admin/folders/${folder._id}`);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] flex items-center gap-2 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-gray-500" />
                          <span>View Contents</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownFolderId(null);
                            handleDeleteFolder(folder._id, e);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-medium text-[#ff3b30] hover:bg-[#ff3b30]/10 flex items-center gap-2 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Folder</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md bg-white border border-[#d2d2d7] rounded-2xl shadow-2xl p-6 text-[#1d1d1f] zoom-in-95 animate-in duration-200"
          >
            <h3 className="m-0 text-base font-semibold tracking-tight">Create Folder</h3>
            <p className="m-0 mt-1.5 text-xs text-[#8e8e93]">Give a name to the folder you want to create.</p>
            
            {createError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {createError}
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="folder-name-input" className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
                Folder Name
              </label>
              <input
                id="folder-name-input"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Campaign Summer 2026"
                disabled={creating}
                className="mt-1.5 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs text-[#1d1d1f] placeholder-gray-400 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] outline-none disabled:opacity-50 transition-all"
                autoFocus
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewFolderName('');
                  setCreateError('');
                }}
                disabled={creating}
                className="rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7] outline-none disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newFolderName.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] outline-none disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminFolders;
