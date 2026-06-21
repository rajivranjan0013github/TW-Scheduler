import { useState, useCallback } from 'react';
import { X, Sparkles, Loader2, Check } from 'lucide-react';
import { API_BASE_URL } from './videoEditorConstants';

export const TextGeneratorDialog = ({
  token,
  onClose,
  onSelectText,
}) => {
  const [vibe, setVibe] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError('');
    setSelectedIdx(null);
    setSuggestions([]);

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
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Error generating text suggestions:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = useCallback((text, idx) => {
    setSelectedIdx(idx);
    onSelectText(text);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onSelectText, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#ff5500]" />
            <h3 className="text-base font-bold text-gray-950">AI Overlay Text Generator</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close generator dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleGenerate} className="border-b border-gray-100 bg-gray-50 p-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              What is your video about? (Topic, Vibe, or Context - Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="e.g. funny gym bloopers, daily lifestyle vlog, aesthetic cooking recipe..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/10 transition-all text-gray-950"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-[#ff5500] px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Suggestions list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-semibold text-red-600">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full space-y-3 py-10">
              <Loader2 className="h-8 w-8 text-[#ff5500] animate-spin" />
              <p className="text-xs font-semibold text-gray-500 animate-pulse">Consulting Gemini for catchy suggestions...</p>
            </div>
          )}

          {!loading && suggestions.length === 0 && !error && (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-center text-xs font-medium text-gray-400 p-6">
              <Sparkles className="h-8 w-8 text-gray-300 mb-2" />
              <p className="max-w-xs">Describe the optional vibe of your video above and click generate to get 20 custom text captions.</p>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Generated suggestions (click one to apply)
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {suggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(item, idx)}
                    className={`group relative flex items-center justify-between rounded-xl border p-4 text-left text-xs font-semibold transition-all duration-150 hover:shadow-md ${
                      selectedIdx === idx
                        ? 'border-[#ff5500] bg-orange-50/50 text-[#ff5500]'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <span className="pr-4 whitespace-pre-line leading-relaxed">{item}</span>
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                      selectedIdx === idx ? 'bg-[#ff5500] text-white scale-100' : 'bg-gray-100 text-gray-400 scale-90 group-hover:scale-100'
                    }`}>
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-semibold text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
