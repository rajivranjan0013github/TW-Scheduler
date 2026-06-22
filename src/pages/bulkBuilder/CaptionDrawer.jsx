import { useState, useCallback } from 'react';
import { X, Sparkles, Loader2, Check } from 'lucide-react';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';

/**
 * Right-side slide-in drawer for assigning captions to a bulk row (Figma Dark Theme).
 * Supports manual input and AI generation.
 */
export const CaptionDrawer = ({
  token,
  currentCaption,
  suggestions = [],
  onSuggestionsChange,
  vibe = '',
  onVibeChange,
  onApply,
  onClose,
}) => {
  const [manualText, setManualText] = useState(currentCaption || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleApplyManual = useCallback(() => {
    if (manualText.trim()) {
      onApply(manualText.trim());
    }
  }, [manualText, onApply]);

  const handleSelectSuggestion = useCallback((text) => {
    onApply(text);
  }, [onApply]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[380px] max-w-[90vw] bg-[#18181b] border-l border-[#2d2d30] flex flex-col animate-slide-in-right text-[#e0e0e5] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d2d30]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#ff5500]" />
            <h3 className="text-sm font-bold text-white">Assign Caption</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-[#27272a] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Manual Input */}
          <div className="p-5 border-b border-[#2d2d30] space-y-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Type your caption
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={3}
              placeholder="POV: You finally found an app made for couples."
              className="w-full text-xs border border-[#2d2d30] rounded-xl p-3 bg-[#121214] focus:bg-[#1a1a1e] transition-all outline-none resize-none text-white focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20"
            />
            <button
              type="button"
              onClick={handleApplyManual}
              disabled={!manualText.trim()}
              className="w-full rounded-xl bg-[#27272a] border border-[#3f3f46] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#3f3f46] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply Caption
            </button>
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
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Click to apply
                </p>
                {suggestions.map((text, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(text)}
                    className="group w-full flex items-center justify-between rounded-xl border border-[#2d2d30] bg-[#121214] p-3 text-left text-xs font-semibold text-gray-300 transition-all hover:border-[#ff5500]/40 hover:bg-[#1a1a1e] hover:text-white hover:shadow-sm"
                  >
                    <span className="pr-3 leading-relaxed whitespace-pre-line">{text}</span>
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-gray-600 group-hover:text-[#ff5500] transition-colors" />
                  </button>
                ))}
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
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#2d2d30] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2d2d30] bg-[#27272a] px-4 py-2 text-xs font-semibold text-gray-400 hover:bg-[#3f3f46] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </>
  );
};
