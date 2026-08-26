import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Flame,
  Globe,
  Grid,
  Heart,
  HelpCircle,
  History,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Loader2,
  Megaphone,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCw,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Target,
  User,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

const SOURCE_OPTIONS = [
  { id: 'app_store', label: 'App Store', icon: '🍎', placeholder: 'https://apps.apple.com/.../id...' },
  { id: 'play_store', label: 'Play Store', icon: '🤖', placeholder: 'https://play.google.com/store/apps/details?id=...' },
  { id: 'website', label: 'Website', icon: '🌐', placeholder: 'https://yourproduct.com' },
];

export const ProductEditorPage = ({
  form,
  setForm,
  saving,
  error,
  onSubmit,
  onCancel,
  canCancel = true,
  isEditing = false,
  onSaveAndOpenQueue,
}) => {
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [copiedPositioning, setCopiedPositioning] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [validationError, setValidationError] = useState('');

  const isExtracted = Boolean(
    form.productName ||
    form.iconUrl ||
    form.keyBenefit ||
    (form.marketingStrategies && form.marketingStrategies.length > 0)
  );

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
    setForm((c) => ({
      ...c,
      productUrl: url,
      productSource: source,
    }));
    setExtractError('');
    setValidationError('');
  };

  const handleAnalyzeProduct = async () => {
    const rawUrl = String(form.productUrl || '').trim();
    const rawDesc = String(form.productDescription || '').trim();
    const rawName = String(form.productName || '').trim();

    if (!rawUrl && !rawDesc && !rawName) {
      setExtractError('Please enter an App Store link or product URL first.');
      return;
    }

    try {
      setExtracting(true);
      setExtractError('');
      setValidationError('');

      const token = localStorage.getItem('tw_token');
      const response = await fetch(`${API_BASE_URL}/api/ai/analyze-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: rawUrl || (rawName ? `https://${rawName.toLowerCase().replace(/\s+/g, '')}.com` : 'https://example.com'),
          source: form.productSource || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract product information.');
      }

      setForm((c) => ({
        ...c,
        productName: data.productName || c.productName || rawName,
        name: data.productName || c.name || rawName,
        productDescription: data.productDescription || c.productDescription || rawDesc,
        description: data.productDescription || c.description || rawDesc,
        productSource: data.productSource || c.productSource,
        productUrl: data.productUrl || rawUrl,
        category: data.category || c.category || '',
        iconUrl: data.iconUrl || c.iconUrl || '',
        targetAudience: data.targetAudience || c.targetAudience || '',
        developer: data.developer || c.developer || '',
        rating: data.rating || c.rating,
        ratingCount: data.ratingCount || c.ratingCount,
        screenshots: data.screenshots?.length ? data.screenshots : c.screenshots || [],
        keyBenefit: data.keyBenefit || '',
        coreFunction: data.coreFunction || '',
        useCases: Array.isArray(data.useCases) ? data.useCases : [],
        targetAudienceList: Array.isArray(data.targetAudienceList) ? data.targetAudienceList : [],
        marketingStrategies: Array.isArray(data.marketingStrategies) ? data.marketingStrategies : [],
        keyMessaging: Array.isArray(data.keyMessaging) ? data.keyMessaging : [],
        positioningStatement: data.positioningStatement || '',
      }));
    } catch (err) {
      setExtractError(err.message || 'Could not extract product data.');
    } finally {
      setExtracting(false);
    }
  };

  const copyPositioning = () => {
    if (!form.positioningStatement) return;
    navigator.clipboard.writeText(form.positioningStatement);
    setCopiedPositioning(true);
    setTimeout(() => setCopiedPositioning(false), 2000);
  };

  const validateAndSubmit = (e, callback) => {
    e?.preventDefault();
    setValidationError('');

    if (!String(form.productName || '').trim()) {
      setValidationError('Please analyze an app link or enter an app name.');
      return;
    }

    if (!String(form.productDescription || '').trim()) {
      setValidationError('Product description is required.');
      return;
    }

    if (callback) {
      callback(e);
    } else {
      onSubmit(e);
    }
  };

  const useCases = Array.isArray(form.useCases) ? form.useCases : [];
  const targetAudience = Array.isArray(form.targetAudienceList) ? form.targetAudienceList : [];
  const marketingStrategies = Array.isArray(form.marketingStrategies) ? form.marketingStrategies : [];
  const keyMessaging = Array.isArray(form.keyMessaging) ? form.keyMessaging : [];
  const positioning = form.positioningStatement || '';

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-6 bg-[#08060d] text-white overflow-hidden max-w-7xl mx-auto">
      {/* ────────────────────────────────────────────────────────── */}
      {/* TOP NAVBAR                                                 */}
      {/* ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-white transition"
              title="Back to products list"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7831d6]/30 text-[#c4b5fd]">
              <Sparkles className="h-4 w-4 text-purple-300" />
            </span>
            <span className="text-base font-bold tracking-tight text-white">MarketAI Product Studio</span>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition"
            >
              <History className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => validateAndSubmit(e, onSubmit)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/15 transition"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>{saving ? 'Saving...' : 'Save Workspace'}</span>
          </button>
          {onSaveAndOpenQueue && (
            <button
              type="button"
              onClick={(e) => validateAndSubmit(e, onSaveAndOpenQueue)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 hover:bg-[#6825bc] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save & Open Queue</span>
            </button>
          )}
        </div>
      </header>

      {/* Global Error Banner */}
      {(validationError || error || extractError) && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError || error || extractError}</span>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MAIN TWO-COLUMN STUDIO LAYOUT                              */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================= */}
        {/* LEFT COLUMN: 1. Tell us about your product (4 Cols)       */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0d0917] p-4 overflow-hidden">
          <div className="space-y-3">
            <h2 className="m-0 text-sm font-bold text-white">1. Tell us about your product</h2>

            {/* Store Link Input */}
            <div className="rounded-xl border border-white/10 bg-black/60 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  Store or Website Link
                </span>
                <div className="flex gap-1">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, productSource: opt.id }))}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition ${
                        form.productSource === opt.id || (!form.productSource && opt.id === 'app_store')
                          ? 'bg-[#7831d6] text-white'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="url"
                value={form.productUrl || ''}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={
                  SOURCE_OPTIONS.find((s) => s.id === form.productSource)?.placeholder ||
                  'https://apps.apple.com/.../id...'
                }
                className="w-full rounded-lg border border-white/10 bg-black px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#7831d6]"
              />
            </div>

            {/* Product Information Textarea Card */}
            <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Product Information</span>
                <span className="text-[10px] text-purple-300 font-mono">
                  {(form.productDescription || '').length} / 2000
                </span>
              </div>
              <textarea
                value={form.productDescription || ''}
                onChange={(e) => {
                  const productDescription = e.target.value;
                  setForm((c) => ({ ...c, productDescription, description: productDescription }));
                }}
                rows={6}
                placeholder="Product description and core value proposition..."
                className="w-full resize-none rounded-lg border border-purple-500/30 bg-black/80 px-2.5 py-2 text-xs leading-relaxed text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Big Analyze Button */}
          <div className="mt-3 pt-2">
            <button
              type="button"
              onClick={handleAnalyzeProduct}
              disabled={extracting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7831d6] to-[#9333ea] py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 hover:brightness-110 disabled:opacity-50 transition"
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-yellow-300" />}
              <span>{extracting ? 'Extracting Information...' : '✦ Analyze Product'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: 2. Extracted Info + 3. Marketing Insights   */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-3 overflow-hidden">
          {/* ──────────────────────────────────────────────────────── */}
          {/* 2. AI Extracted Product Information (4 Cards)            */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0917] p-3.5 shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-xs font-bold text-white">2. AI Extracted Product Information</h3>
                {isExtracted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.2 text-[9px] font-bold text-emerald-300">
                    <Check className="h-2.5 w-2.5" /> Extracted
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingInfo(!isEditingInfo)}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-purple-300 transition"
              >
                <Edit3 className="h-3 w-3" />
                <span>{isEditingInfo ? 'Done Editing' : 'Edit Information'}</span>
              </button>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* Card 1: Product Name */}
              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-2.5 flex items-start gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 shrink-0">
                  <Package className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium text-purple-300 uppercase tracking-wider">Product Name</span>
                  {isEditingInfo ? (
                    <input
                      value={form.productName || ''}
                      onChange={(e) => setForm((c) => ({ ...c, productName: e.target.value, name: e.target.value }))}
                      className="w-full bg-black/60 border border-purple-500/40 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-xs font-bold truncate mt-0.5 ${form.productName ? 'text-white' : 'text-zinc-500'}`}>
                      {form.productName || '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Category */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 flex items-start gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                  <Grid className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium text-emerald-300 uppercase tracking-wider">Category</span>
                  {isEditingInfo ? (
                    <input
                      value={form.category || ''}
                      onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                      className="w-full bg-black/60 border border-emerald-500/40 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-xs font-bold truncate mt-0.5 ${form.category ? 'text-white' : 'text-zinc-500'}`}>
                      {form.category || '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 3: Key Benefit */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-2.5 flex items-start gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-current" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium text-amber-300 uppercase tracking-wider">Key Benefit</span>
                  {isEditingInfo ? (
                    <input
                      value={form.keyBenefit || ''}
                      onChange={(e) => setForm((c) => ({ ...c, keyBenefit: e.target.value }))}
                      className="w-full bg-black/60 border border-amber-500/40 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-[11px] font-semibold line-clamp-2 mt-0.5 ${form.keyBenefit ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {form.keyBenefit || '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 4: Core Function */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-2.5 flex items-start gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium text-indigo-300 uppercase tracking-wider">Core Function</span>
                  {isEditingInfo ? (
                    <input
                      value={form.coreFunction || ''}
                      onChange={(e) => setForm((c) => ({ ...c, coreFunction: e.target.value }))}
                      className="w-full bg-black/60 border border-indigo-500/40 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-[11px] font-semibold line-clamp-2 mt-0.5 ${form.coreFunction ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {form.coreFunction || '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────── */}
          {/* 3. AI Generated Marketing Insights (2x2 Grid)            */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0917] p-3.5 flex-1 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="m-0 text-xs font-bold text-white">3. AI Generated Marketing Insights</h3>
                {isExtracted && (
                  <button
                    type="button"
                    onClick={handleAnalyzeProduct}
                    disabled={extracting}
                    className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-purple-300 transition"
                  >
                    <RotateCw className={`h-3 w-3 ${extracting ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                )}
              </div>

              {!isExtracted && (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-white/10 bg-black/20 my-auto">
                  <Sparkles className="h-8 w-8 text-purple-400/60 mb-2" />
                  <p className="m-0 text-xs font-medium text-zinc-300">No product analyzed yet</p>
                  <p className="m-0 mt-1 text-[11px] text-zinc-500 max-w-sm">
                    Paste an App Store or Play Store link on the left and click <strong>&quot;✦ Analyze Product&quot;</strong> to generate custom video formats, viral hooks, and insights.
                  </p>
                </div>
              )}

              {/* 2x2 Grid of Insight Cards */}
              {isExtracted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* 1. Use Cases */}
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-2">
                      <Target className="h-3.5 w-3.5" />
                      <span>Use Cases</span>
                    </div>
                    {useCases.length > 0 ? (
                      <ul className="m-0 space-y-1 pl-0 list-none text-[11px] text-zinc-300">
                        {useCases.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-[11px] text-zinc-500 italic">No use cases generated yet.</p>
                    )}
                  </div>

                  {/* 2. Target Audience */}
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                    <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold mb-2">
                      <Users className="h-3.5 w-3.5" />
                      <span>Target Audience</span>
                    </div>
                    {targetAudience.length > 0 ? (
                      <ul className="m-0 space-y-1 pl-0 list-none text-[11px] text-zinc-300">
                        {targetAudience.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5" />
                            <span className="line-clamp-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-[11px] text-zinc-500 italic">No target audience personas yet.</p>
                    )}
                  </div>

                  {/* 3. Video & Carousel Formats */}
                  <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-3">
                    <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold mb-2">
                      <Video className="h-3.5 w-3.5" />
                      <span>Video & Carousel Formats</span>
                    </div>
                    {marketingStrategies.length > 0 ? (
                      <ul className="m-0 space-y-1.5 pl-0 list-none text-[10.5px] text-zinc-300">
                        {marketingStrategies.slice(0, 4).map((item, idx) => {
                          const match = item.match(/^\[(.*?)\]\s*(.*)$/);
                          const tag = match ? match[1] : null;
                          const text = match ? match[2] : item;
                          return (
                            <li key={idx} className="flex items-start gap-1.5 leading-tight">
                              {tag ? (
                                <span className="rounded bg-sky-500/20 border border-sky-500/30 px-1 py-0.2 text-[8.5px] font-bold text-sky-300 shrink-0">
                                  {tag}
                                </span>
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0 mt-1" />
                              )}
                              <span className="line-clamp-2 text-zinc-200">{text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="m-0 text-[11px] text-zinc-500 italic">No video formats generated yet.</p>
                    )}
                  </div>

                  {/* 4. Viral 3s Hooks & Copy */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3">
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-2">
                      <Flame className="h-3.5 w-3.5" />
                      <span>Viral 3s Hooks & Copy</span>
                    </div>
                    {keyMessaging.length > 0 ? (
                      <ul className="m-0 space-y-1.5 pl-0 list-none text-[10.5px] text-zinc-200">
                        {keyMessaging.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 italic leading-tight">
                            <span className="text-amber-400 font-bold shrink-0">•</span>
                            <span className="line-clamp-2 text-zinc-200">&ldquo;{item.replace(/^"|"$/g, '')}&rdquo;</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-[11px] text-zinc-500 italic">No hooks generated yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ──────────────────────────────────────────────────────── */}
            {/* Bottom Full-Width Positioning Statement Card             */}
            {/* ──────────────────────────────────────────────────────── */}
            <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Sparkles className="h-4 w-4 text-purple-300 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-purple-300">
                    Positioning Statement
                  </span>
                  <p className={`m-0 text-xs leading-snug line-clamp-2 mt-0.5 ${positioning ? 'text-zinc-200' : 'text-zinc-500 italic'}`}>
                    {positioning || 'Analyze a product link on the left to generate an official market positioning statement.'}
                  </p>
                </div>
              </div>

              {positioning ? (
                <button
                  type="button"
                  onClick={copyPositioning}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition shrink-0"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedPositioning ? 'Copied!' : 'Copy'}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductEditorPage;
