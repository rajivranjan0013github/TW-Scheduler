import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { Plus, Film, Image as ImageIcon, Check, Trash2, Clock, AlertCircle } from 'lucide-react';

export const CalendarView = ({ selectedAccounts }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  
  // Modal states
  const [showComposer, setShowComposer] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [channels, setChannels] = useState([]);
  
  // Post Composer form states
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [caption, setCaption] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [postType, setPostType] = useState('reels');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  
  // Bulk Scheduling states
  const [isBulk, setIsBulk] = useState(false);
  const [bulkInterval, setBulkInterval] = useState('2');

  const isViewer = user?.role === 'viewer';

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
        setPostType(mediaItem.type === 'video' ? 'reels' : 'post');
      }
      
      // Clear location state to prevent reopening modal on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state, mediaList]);

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
    if (!scheduleTime) {
      alert('Pick a scheduling date and time');
      return;
    }

    try {
      const token = localStorage.getItem('tw_token');
      const body = {
        socialAccountIds: selectedChannels,
        mediaIds: selectedMedia,
        caption,
        scheduledAt: new Date(scheduleTime),
        platformSpecifics: { type: postType }
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
        setIsBulk(false);
        fetchPosts();
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
    if (isBulk) {
      if (selectedMedia.includes(medId)) {
        setSelectedMedia(selectedMedia.filter(id => id !== medId));
      } else {
        setSelectedMedia([...selectedMedia, medId]);
      }
    } else {
      setSelectedMedia([medId]);
      setShowMediaPicker(false);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f] font-sans">
      
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
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

      {/* Queue Feed List */}
      <div className="max-w-4xl mx-auto space-y-4">
        {posts.length === 0 ? (
          <div className="border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 text-gray-300 animate-pulse" />
            <span className="font-semibold text-gray-400">No scheduled posts in the queue.</span>
          </div>
        ) : (
          posts.map(post => {
            const firstMedia = post.mediaIds?.[0];
            const postDate = new Date(post.scheduledAt);
            const isOverdue = postDate < new Date() && post.status === 'scheduled';

            return (
              <div 
                key={post._id}
                className="bg-white border border-[#e5e5ea] rounded-xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between hover:border-gray-400 transition-all duration-150 shadow-sm"
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

      {/* Main Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 overflow-y-auto">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-xl text-black max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <h3 className="text-sm font-semibold text-black mb-6 uppercase tracking-wider">Compose Social Post</h3>

            <form onSubmit={handleComposeSubmit} className="space-y-6">
              
              {/* Channel Selector */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Select Portals</label>
                <div className="flex flex-wrap gap-2">
                  {channels.map(chan => (
                    <button
                      key={chan._id}
                      type="button"
                      onClick={() => {
                        if (selectedChannels.includes(chan._id)) {
                          setSelectedChannels(selectedChannels.filter(id => id !== chan._id));
                        } else {
                          setSelectedChannels([...selectedChannels, chan._id]);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        selectedChannels.includes(chan._id)
                          ? 'bg-black text-white font-semibold border-black'
                          : 'bg-[#f5f5f7] border-[#e5e5ea] text-gray-500 hover:text-black'
                      }`}
                    >
                      <img src={chan.avatarUrl} className="w-4 h-4 rounded-full object-cover border border-black/10" alt="" />
                      <span>{chan.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {['reels', 'post', 'story'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPostType(t)}
                      className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                        postType === t 
                          ? 'bg-black text-white font-semibold' 
                          : 'bg-[#f5f5f7] text-gray-500 border border-[#e5e5ea] hover:text-black'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Write Caption</label>
                <textarea
                  placeholder="Draft caption here..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-[#f5f5f7] border border-[#e5e5ea] p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black min-h-[80px] resize-y"
                />
              </div>

              {/* Media Picker */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Attach Media</label>
                
                <div className="flex flex-wrap gap-3 items-center">
                  {selectedMedia.map(medId => {
                    const file = mediaList.find(m => m._id === medId);
                    return file ? (
                      <div key={medId} className="w-12 h-12 rounded border border-[#e5e5ea] bg-[#f5f5f7] overflow-hidden relative group">
                        {file.type === 'video' ? (
                          <video src={file.url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={file.url} className="w-full h-full object-cover" alt="" />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedMedia(selectedMedia.filter(id => id !== medId))}
                          className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] text-white font-bold transition-opacity"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null;
                  })}
                  
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    className="w-12 h-12 rounded border border-dashed border-[#e5e5ea] hover:border-gray-400 flex flex-col items-center justify-center text-gray-500 hover:text-black transition-all bg-[#f5f5f7]"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                    <span className="text-[8px] mt-0.5">Add</span>
                  </button>
                </div>
              </div>

              {/* Scheduling Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#e5e5ea] pt-4">
                
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {isBulk ? 'Start Date & Time' : 'Date & Time'}
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Schedule Mode</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulk(!isBulk);
                      setSelectedMedia([]);
                    }}
                    className={`w-full py-2 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      isBulk 
                        ? 'bg-black text-white border-black font-semibold' 
                        : 'bg-[#f5f5f7] border-[#e5e5ea] text-gray-500 hover:text-black'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{isBulk ? 'Bulk Mode: ON' : 'Bulk Mode: OFF'}</span>
                  </button>
                </div>
              </div>

              {isBulk && (
                <div className="bg-[#f5f5f7] border border-[#e5e5ea] p-4 rounded-xl space-y-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase m-0">Bulk Posting Gap</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span>Interval gap:</span>
                    <select
                      value={bulkInterval}
                      onChange={(e) => setBulkInterval(e.target.value)}
                      className="bg-white border border-[#e5e5ea] text-black px-2 py-1 rounded focus:outline-none"
                    >
                      <option value="1">1 Hour</option>
                      <option value="2">2 Hours</option>
                      <option value="4">4 Hours</option>
                      <option value="12">12 Hours</option>
                      <option value="24">24 Hours (Daily)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#e5e5ea]">
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs font-semibold border border-[#e5e5ea] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                >
                  Confirm Posting
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Media Picker */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-5 rounded-2xl w-full max-w-md text-black max-h-[70vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#e5e5ea]">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">Select Media</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {mediaList.map(item => (
                <div
                  key={item._id}
                  onClick={() => selectMediaItem(item._id)}
                  className={`aspect-square rounded-lg overflow-hidden cursor-pointer border relative transition-all ${
                    selectedMedia.includes(item._id) 
                      ? 'border-black ring-1 ring-black/50 opacity-100' 
                      : 'border-[#e5e5ea] opacity-65 hover:opacity-100'
                  }`}
                >
                  {item.type === 'video' ? (
                    <video src={item.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.url} className="w-full h-full object-cover" alt="" />
                  )}
                  {selectedMedia.includes(item._id) && (
                    <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white bg-black rounded-full p-0.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-[#e5e5ea]">
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="px-4 py-1.5 bg-[#0071e3] hover:bg-[#147ce5] rounded-lg text-xs font-bold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default CalendarView;
