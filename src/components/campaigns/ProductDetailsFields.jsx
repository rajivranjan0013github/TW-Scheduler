import { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  Package,
  Sparkles,
  Smartphone,
  Star,
  ExternalLink
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

const SOURCE_OPTIONS = [
  { id: 'app_store', label: 'App Store', icon: '🍎', placeholder: 'https://apps.apple.com/app/id...' },
  { id: 'play_store', label: 'Play Store', icon: '🤖', placeholder: 'https://play.google.com/store/apps/details?id=...' },
  { id: 'website', label: 'Website / Landing', icon: '🌐', placeholder: 'https://yourproduct.com' },
];

export const ProductDetailsFields = ({
  form,
  setForm,
  heading = 'Product & App Details',
  showHeader = true,
  requireLink = false,
}) => {
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedSuccess, setExtractedSuccess] = useState(false);

  // Auto-detect source when productUrl changes
  const handleUrlChange = (url) => {
    let source = form.productSource || 'app_store';
    const lower = url.toLowerCase();
    if (lower.includes('apps.apple.com') || lower.includes('itunes.apple.com')) {
      source = 'app_store';
    } else if (lower.includes('play.google.com')) {
      source = 'play_store';
    } else if (lower.startsWith('http')) {
      source = 'website';
    }
    setForm((current) => ({
      ...current,
      productUrl: url,
      productSource: source,
    }));
    setExtractError('');
    setExtractedSuccess(false);
  };

  const handleExtractInfo = async () => {
    const rawUrl = String(form.productUrl || '').trim();
    if (!rawUrl) {
      setExtractError('Please enter an App Store, Google Play, or product website link first.');
      return;
    }

    try {
      setExtracting(true);
      setExtractError('');
      setExtractedSuccess(false);

      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/ai/analyze-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: rawUrl,
          source: form.productSource || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract store information.');
      }

      setForm((current) => ({
        ...current,
        productName: data.productName || current.productName,
        name: data.productName || current.name || current.productName,
        productDescription: data.productDescription || current.productDescription,
        description: data.productDescription || current.description || current.productDescription,
        productSource: data.productSource || current.productSource,
        productUrl: data.productUrl || rawUrl,
        category: data.category || current.category || '',
        iconUrl: data.iconUrl || current.iconUrl || '',
        targetAudience: data.targetAudience || current.targetAudience || '',
        rating: data.rating || current.rating,
        ratingCount: data.ratingCount || current.ratingCount,
      }));

      setExtractedSuccess(true);
    } catch (err) {
      console.error('Extraction error:', err);
      setExtractError(err.message || 'Could not extract product data from link.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <section className={showHeader ? 'rounded-xl border border-white/10 bg-white/[0.025] p-5' : ''}>
      {showHeader && (
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7831d6]/20 text-[#c4b5fd]">
              <Smartphone className="h-4 w-4" />
            </span>
            <div>
              <h3 className="m-0 text-sm font-semibold text-white">{heading}</h3>
              <p className="m-0 mt-0.5 text-[11px] text-zinc-400">
                Connect your App Store / Play Store link to auto-generate marketing hooks.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Source selection tabs */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">
              Product Link {requireLink ? <span className="text-red-400">*</span> : <span className="text-zinc-500 font-normal">(recommended)</span>}
            </span>
            <span className="text-[10px] text-zinc-400">App Store • Play Store • Web</span>
          </div>

          <div className="flex gap-1.5 mb-2">
            {SOURCE_OPTIONS.map((opt) => {
              const isSelected = form.productSource === opt.id || (!form.productSource && opt.id === 'app_store');
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, productSource: opt.id }))}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                    isSelected
                      ? 'bg-[#7831d6]/30 text-purple-200 border border-[#7831d6]/50'
                      : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-zinc-200'
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* URL Input & Extract Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                value={form.productUrl || ''}
                onChange={(e) => handleUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExtractInfo();
                  }
                }}
                placeholder={
                  SOURCE_OPTIONS.find((s) => s.id === form.productSource)?.placeholder ||
                  'https://apps.apple.com/app/id...'
                }
                className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20"
              />
            </div>
            <button
              type="button"
              onClick={handleExtractInfo}
              disabled={extracting || !form.productUrl?.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
              title="Auto-extract app details and generate viral hooks"
            >
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
              )}
              <span>{extracting ? 'Extracting...' : 'Auto-Extract'}</span>
            </button>
          </div>

          {/* Extraction messages */}
          {extractError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{extractError}</span>
            </div>
          )}

          {extractedSuccess && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Successfully extracted store metadata & synthesized marketing hooks!</span>
            </div>
          )}
        </div>

        {/* Extracted App Preview Card */}
        {(form.iconUrl || form.category) && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            {form.iconUrl ? (
              <img
                src={form.iconUrl}
                alt={form.productName || 'App icon'}
                className="h-11 w-11 rounded-xl object-cover border border-white/10 shadow-sm"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-900/40 text-purple-300 border border-purple-500/20">
                <Package className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-xs font-semibold text-white m-0">
                  {form.productName || 'App Name'}
                </h4>
                {form.category && (
                  <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                    {form.category}
                  </span>
                )}
              </div>
              {form.rating && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-400">
                  <Star className="h-3 w-3 fill-current" />
                  <span className="font-semibold">{Number(form.rating).toFixed(1)}</span>
                  {form.ratingCount && (
                    <span className="text-zinc-500">({form.ratingCount.toLocaleString()} reviews)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Name */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-zinc-300">App / Product Name</span>
          <input
            value={form.productName || ''}
            onChange={(event) => {
              const productName = event.target.value;
              setForm((current) => ({ ...current, productName, name: productName }));
            }}
            placeholder="e.g. Penguin - Couples App"
            className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20"
          />
        </label>

        {/* Product Description */}
        <label className="block">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Product Description & Social Hook</span>
            <span className="text-[10px] text-zinc-400">Used by AI for video overlays & captions</span>
          </div>
          <textarea
            value={form.productDescription || ''}
            onChange={(event) => {
              const productDescription = event.target.value;
              setForm((current) => ({ ...current, productDescription, description: productDescription }));
            }}
            placeholder="Describe what your app does and why people download it..."
            rows={3}
            className="w-full resize-y rounded-lg border border-white/10 bg-black px-3 py-2.5 text-xs leading-5 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20"
          />
        </label>

        {/* Target Audience (Optional) */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-zinc-300">
            Target Audience <span className="text-zinc-500 font-normal">(optional)</span>
          </span>
          <input
            value={form.targetAudience || ''}
            onChange={(event) => {
              const targetAudience = event.target.value;
              setForm((current) => ({ ...current, targetAudience }));
            }}
            placeholder="e.g. Couples in long-distance relationships, college students"
            className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20"
          />
        </label>
      </div>
    </section>
  );
};

export default ProductDetailsFields;
