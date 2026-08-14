import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Loader2, Plus, Bookmark, ArrowLeft, Search } from 'lucide-react';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';

/**
 * Right-side slide-in drawer for assigning captions to a bulk row (Figma Dark Theme).
 * Supports manual input and AI generation.
 */
export const CaptionDrawer = ({
  targetRowId,
  token,
  currentCaption,
  suggestions = [],
  onSuggestionsChange,
  vibe = '',
  onVibeChange,
  onApply,
  onClose,
  title = 'Assign Caption',
  manualLabel = 'Type your caption',
  manualPlaceholder = 'POV: You finally found an app made for couples.',
  applyLabel = 'Apply Caption',
  mountToViewport = false,
  side = 'right',
}) => {
  const [manualText, setManualText] = useState(currentCaption || '');
  const [activeTargetRowId, setActiveTargetRowId] = useState(targetRowId);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [savedCaptions, setSavedCaptions] = useState([]);
  const [savedCaptionSearch, setSavedCaptionSearch] = useState('');
  const [viewMode, setViewMode] = useState('main'); // 'main' | 'bookmarks'
  const opensFromLeft = side === 'left';

  if (activeTargetRowId !== targetRowId) {
    setActiveTargetRowId(targetRowId);
    setManualText(currentCaption || '');
  }

  // Load saved captions from database
  useEffect(() => {
    const fetchSavedCaptions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/saved-captions`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setSavedCaptions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching saved captions:', err);
      } finally { /* request completed */ }
    };
    void fetchSavedCaptions();
  }, [token]);

  const isBookmarked = useCallback((text) => {
    return savedCaptions.some((item) => (item.text || '').trim() === text.trim());
  }, [savedCaptions]);

  const handleToggleBookmark = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    const trimmedText = text.trim();
    const existing = savedCaptions.find((item) => (item.text || '').trim() === trimmedText);

    if (existing) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/saved-captions/${existing._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
        });
        if (response.ok) {
          setSavedCaptions((prev) => prev.filter((item) => item._id !== existing._id));
        } else {
          const errData = await response.json();
          setError(errData.message || 'Failed to remove bookmark.');
        }
      } catch (err) {
        console.error('Error removing bookmark:', err);
        setError('Failed to remove bookmark.');
      }
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/saved-captions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ text: trimmedText }),
        });
        if (response.ok) {
          const newSaved = await response.json();
          setSavedCaptions((prev) => [newSaved, ...prev]);
        } else {
          const errData = await response.json();
          setError(errData.message || 'Failed to save bookmark.');
        }
      } catch (err) {
        console.error('Error saving bookmark:', err);
        setError('Failed to save bookmark.');
      }
    }
  }, [token, savedCaptions]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError('');
    onSuggestionsChange([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/generate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ vibe }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to generate text.');
      }

      const data = await response.json();
      onSuggestionsChange(data.suggestions || []);
    } catch (err) {
      console.error('Error generating text suggestions:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, vibe, onSuggestionsChange]);

  const handleGenerateMore = useCallback(async () => {
    setLoadingMore(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/generate-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ vibe, exclude: suggestions }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to generate more text.');
      }

      const data = await response.json();
      const newSuggestions = data.suggestions || [];
      onSuggestionsChange([...suggestions, ...newSuggestions]);
    } catch (err) {
      console.error('Error generating more text suggestions:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [token, vibe, suggestions, onSuggestionsChange]);

  const handleApplyManual = useCallback(() => {
    if (manualText.trim()) {
      onApply(manualText.trim());
    }
  }, [manualText, onApply]);

  const handleSelectSuggestion = useCallback((text) => {
    onApply(text);
  }, [onApply]);

  const drawer = (
    <>
      {mountToViewport && (
        <button
          type="button"
          className="fixed inset-0 z-[110] cursor-default bg-black/45 backdrop-blur-[1px]"
          onClick={onClose}
          aria-label="Close AI text drawer"
        />
      )}
      {/* Drawer */}
      <div className={`fixed bottom-0 top-0 flex w-[380px] max-w-[90vw] flex-col bg-[#18181b] text-[#e0e0e5] shadow-2xl ${opensFromLeft
        ? 'left-0 animate-slide-in-left border-r border-[#2d2d30]'
        : 'right-0 animate-slide-in-right border-l border-[#2d2d30]'} ${mountToViewport ? 'z-[120]' : 'z-50'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2d2d30] bg-[#121214]">
          {viewMode === 'bookmarks' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('main')}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-[#27272a] hover:text-white transition-colors"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>
              <h3 className="text-sm font-bold text-white" style={{ color: '#ffffff' }}>Saved Captions</h3>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#ff5500]" />
              <h3 className="text-sm font-bold text-white" style={{ color: '#ffffff' }}>{title}</h3>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {viewMode === 'main' && (
              <button
                type="button"
                onClick={() => setViewMode('bookmarks')}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-[#27272a] hover:text-white transition-colors"
                title="Saved Captions"
              >
                <Bookmark className="h-4 w-4 text-[#ff5500]" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-[#27272a] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'bookmarks' ? (
            /* Bookmarked view mode */
            <div className="p-5 space-y-3">
              {savedCaptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 rounded-xl border border-dashed border-[#2d2d30] p-4">
                  <Bookmark className="h-6 w-6 text-gray-600 mb-2" />
                  <p className="text-xs font-semibold">No saved captions yet</p>
                  <p className="text-[10px] text-gray-500 mt-1 max-w-[220px]">
                    Bookmark custom inputs or AI recommendations to see them here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="mb-3 flex items-center gap-2 rounded-xl border border-[#2d2d30] bg-[#121214] px-3 py-2.5 text-gray-500 focus-within:border-[#ff5500]/60 focus-within:text-[#ff5500]">
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <input
                      type="search"
                      value={savedCaptionSearch}
                      onChange={(event) => setSavedCaptionSearch(event.target.value)}
                      placeholder="Filter saved captions..."
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-gray-200 outline-none placeholder:text-gray-600"
                    />
                  </label>
                  {savedCaptions
                    .filter((item) => item.text?.toLowerCase().includes(savedCaptionSearch.trim().toLowerCase()))
                    .map((item) => (
                    <div key={item._id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(item.text)}
                        className="w-full min-w-0 whitespace-pre-wrap break-words rounded-xl border border-[#2d2d30] bg-[#121214] py-3 pl-3 pr-10 text-left text-xs font-semibold leading-relaxed text-gray-300 hover:border-[#ff5500]/40 hover:bg-[#1a1a1e] hover:text-white"
                        title={item.text}
                      >
                        {item.text}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(item.text)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-950/50 hover:text-red-400"
                        title="Remove saved caption"
                        aria-label="Remove saved caption"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {savedCaptionSearch.trim() && savedCaptions.filter((item) => item.text?.toLowerCase().includes(savedCaptionSearch.trim().toLowerCase())).length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#2d2d30] px-4 py-8 text-center text-xs font-semibold text-gray-500">
                      No saved captions match “{savedCaptionSearch.trim()}”.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Main view mode */
            <>
              {/* Manual Input */}
              <div className="p-5 border-b border-[#2d2d30] space-y-3">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  {manualLabel}
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={3}
                  placeholder={manualPlaceholder}
                  className="w-full text-xs border border-[#2d2d30] rounded-xl p-3 bg-[#121214] focus:bg-[#1a1a1e] transition-all outline-none resize-none text-white focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApplyManual}
                    disabled={!manualText.trim()}
                    className="flex-1 rounded-xl bg-[#27272a] border border-[#3f3f46] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#3f3f46] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {applyLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleBookmark(manualText)}
                    disabled={!manualText.trim()}
                    className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border transition-all ${
                      isBookmarked(manualText)
                        ? 'border-[#ff5500]/30 bg-[#ff5500]/10 text-[#ff5500]'
                        : 'border-[#2d2d30] bg-[#121214] text-gray-500 hover:text-white hover:border-[#3f3f46]'
                    }`}
                    title="Bookmark caption"
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 h-px bg-[#2d2d30]" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Or Generate with AI</span>
                <div className="flex-1 h-px bg-[#2d2d30]" />
              </div>

              {/* AI Generation */}
              <div className="px-5 pb-5 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vibe}
                    onChange={(e) => onVibeChange(e.target.value)}
                    placeholder="Optional topic/vibe..."
                    className="flex-1 rounded-xl border border-[#2d2d30] bg-[#121214] px-3 py-2.5 text-xs outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all text-white"
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-xl bg-[#ff5500] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-orange-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {loading ? '' : 'Generate'}
                  </button>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-950/40 bg-red-950/20 p-3 text-xs font-semibold text-red-400">
                    {error}
                  </div>
                )}

                {loading && (
                  <div className="flex flex-col items-center py-8 space-y-2">
                    <Loader2 className="h-6 w-6 text-[#ff5500] animate-spin" />
                    <p className="text-[10px] font-semibold text-gray-400 animate-pulse">Generating suggestions...</p>
                  </div>
                )}

                {!loading && suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Click to apply
                    </p>
                    {suggestions.map((text, idx) => {
                      const bookmarked = isBookmarked(text);
                      return (
                        <div
                          key={idx}
                          className="group w-full flex items-center justify-between rounded-xl border border-[#2d2d30] bg-[#121214] p-2.5 text-left transition-all hover:border-[#ff5500]/40 hover:bg-[#1a1a1e] hover:shadow-sm"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectSuggestion(text)}
                            className="flex-1 text-left text-xs font-semibold text-gray-300 group-hover:text-white outline-none pr-2 truncate"
                          >
                            <span className="leading-relaxed whitespace-pre-line truncate">{text}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBookmark(text)}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
                              bookmarked
                                ? 'bg-[#ff5500]/10 text-[#ff5500]'
                                : 'text-gray-500 hover:text-white'
                            }`}
                            title={bookmarked ? "Remove Bookmark" : "Bookmark caption"}
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleGenerateMore}
                      disabled={loadingMore}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2d2d30] hover:border-[#ff5500]/60 bg-[#121214] p-3 text-xs font-bold text-[#ff5500] hover:text-orange-500 hover:bg-[#1a1a1e] transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-3"
                    >
                      {loadingMore ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff5500]" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-[#ff5500]" />
                      )}
                      Generate More AI Suggestions
                    </button>
                  </div>
                )}

                {!loading && suggestions.length === 0 && !error && (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-[#2d2d30] p-6 text-center">
                    <Sparkles className="h-6 w-6 text-gray-600 mb-2" />
                    <p className="text-[10px] font-medium text-gray-500 max-w-[200px]">
                      Click Generate to get 20 AI-crafted caption suggestions
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.25s ease-out;
        }
      `}</style>
    </>
  );

  return mountToViewport && typeof document !== 'undefined'
    ? createPortal(drawer, document.body)
    : drawer;
};
