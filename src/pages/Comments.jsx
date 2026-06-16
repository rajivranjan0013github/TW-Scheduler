import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, Search, Filter, CheckCircle, MessageCircle, RefreshCw, AlertCircle } from 'lucide-react';

export const Comments = () => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTexts, setReplyTexts] = useState({});
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(null); // track which comment is being replied to
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchComments();
  }, [selectedAccountId]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Failed to load accounts in inbox:', error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = 'http://localhost:5001/api/comments';
      if (selectedAccountId !== 'all') {
        url = `http://localhost:5001/api/comments?accountId=${selectedAccountId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      } else {
        const errData = await response.json();
        setError(errData.message || 'Failed to load comments');
      }
    } catch (error) {
      console.error('Failed to load inbox comments:', error);
      setError('Network error loading comments');
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (comment, e) => {
    e.preventDefault();
    const replyText = replyTexts[comment._id];
    if (!replyText?.trim()) return;

    setReplying(comment._id);
    try {
      const response = await fetch(`http://localhost:5001/api/comments/${comment._id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        },
        body: JSON.stringify({ 
          text: replyText,
          accountDbId: comment.accountDbId, // needed to find access token
        }),
      });

      if (response.ok) {
        setReplyTexts({ ...replyTexts, [comment._id]: '' });
        // Refresh comments to show the new reply
        fetchComments();
      } else {
        const errData = await response.json();
        alert(`Reply failed: ${errData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to post comment reply:', error);
      alert('Reply failed. Please try again.');
    } finally {
      setReplying(null);
    }
  };

  const handleReplyTextChange = (commentId, text) => {
    setReplyTexts({
      ...replyTexts,
      [commentId]: text
    });
  };

  const filteredComments = comments.filter(c => {
    if (!searchQuery) return true;
    return c.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="p-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f] space-y-8">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Inbox</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Real comments from your connected channels</p>
        </div>

        <button
          onClick={fetchComments}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e5e5ea] rounded-lg text-xs text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-white border border-[#e5e5ea] p-4 rounded-xl shadow-sm">
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f5f5f7] border border-[#e5e5ea] pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black placeholder:text-gray-400"
          />
        </div>

        {/* Channels Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-2 py-2 rounded-lg text-xs text-black cursor-pointer focus:outline-none"
          >
            <option value="all">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc._id} value={acc.accountId}>{acc.name}</option>
            ))}
          </select>
        </div>

        <div className="text-right text-xs text-gray-500 font-semibold md:pr-4">
          {loading ? (
            <span className="text-[#8e8e93]">Loading...</span>
          ) : (
            <>
              Comments: <span className="text-black font-bold">{comments.length}</span>
              {' · '}
              Open: <span className="text-black font-bold">{comments.filter(c => !c.isReplied).length}</span>
            </>
          )}
        </div>

      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mb-3" />
          <p className="text-xs">Fetching comments from Meta...</p>
        </div>
      )}

      {/* Inbox comments listing */}
      {!loading && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {filteredComments.map(comment => {
            const account = accounts.find(a => a.accountId === comment.accountId);
            return (
              <div 
                key={comment._id}
                className="bg-white border border-[#e5e5ea] rounded-xl p-5 space-y-4 hover:border-gray-400 transition-all duration-150 relative shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold text-gray-500 text-[10px] border border-[#e5e5ea]">
                      {comment.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-black">@{comment.username}</span>
                      <span className="text-[10px] text-gray-500 ml-2">
                        {new Date(comment.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Platform badge */}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                      comment.platform === 'instagram' 
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {comment.platform === 'instagram' ? 'IG' : 'FB'}
                    </span>

                    {account && (
                      <div className="flex items-center gap-1.5 bg-[#f5f5f7] border border-[#e5e5ea] px-2.5 py-0.5 rounded-md text-[9px] text-gray-500">
                        <img src={account.avatarUrl} className="w-3.5 h-3.5 rounded-full object-cover border border-black/10" alt="" />
                        <span>{account.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Post context */}
                {comment.postCaption && (
                  <div className="text-[10px] text-gray-400 bg-[#f5f5f7] px-3 py-1.5 rounded-lg truncate">
                    <MessageCircle className="w-2.5 h-2.5 inline mr-1" />
                    On: "{comment.postCaption.substring(0, 80)}{comment.postCaption.length > 80 ? '...' : ''}"
                  </div>
                )}

                {/* Comment text body */}
                <div className="text-xs text-[#1d1d1f] font-normal pl-2 leading-relaxed">
                  {comment.text}
                </div>

                {/* Previous replies history list */}
                {comment.replies.length > 0 && (
                  <div className="bg-[#f5f5f7] border border-[#e5e5ea] p-3 rounded-lg space-y-2.5 mt-2">
                    {comment.replies.map((reply, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="flex items-center gap-1 font-semibold text-black mb-0.5">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          <span>@{reply.username}</span>
                          <span className="text-[8px] text-gray-400 font-normal ml-2">
                            {new Date(reply.timestamp).toLocaleString([], { timeStyle: 'short' })}
                          </span>
                        </div>
                        <p className="leading-relaxed text-gray-500 pl-4 m-0">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Box Section */}
                <form 
                  onSubmit={(e) => handleReplySubmit(comment, e)}
                  className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e5e5ea]"
                >
                  <input
                    type="text"
                    placeholder="Type reply..."
                    value={replyTexts[comment._id] || ''}
                    onChange={(e) => handleReplyTextChange(comment._id, e.target.value)}
                    className="flex-1 bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                  />
                  <button
                    type="submit"
                    disabled={replying === comment._id}
                    className="p-2 bg-[#0071e3] hover:bg-[#147ce5] text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 text-xs font-semibold"
                  >
                    {replying === comment._id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </form>

              </div>
            );
          })}

          {filteredComments.length === 0 && !error && (
            <div className="border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm">
              {comments.length === 0 
                ? 'No comments found on your recent posts.' 
                : 'No comments match your search.'}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
export default Comments;
