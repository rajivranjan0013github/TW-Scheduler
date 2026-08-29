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
  onAutoSave,
}) => {
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [copiedPositioning, setCopiedPositioning] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [autoSaved, setAutoSaved] = useState(false);

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
    setAutoSaved(false);
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
      setAutoSaved(false);

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

      const nextForm = {
        ...form,
        productName: data.productName || form.productName || rawName,
        name: data.productName || form.name || rawName,
        productDescription: data.productDescription || form.productDescription || rawDesc,
        description: data.productDescription || form.description || rawDesc,
        productSource: data.productSource || form.productSource,
        productUrl: data.productUrl || rawUrl,
        category: data.category || form.category || '',
        iconUrl: data.iconUrl || form.iconUrl || '',
        targetAudience: data.targetAudience || form.targetAudience || '',
        developer: data.developer || form.developer || '',
        rating: data.rating || form.rating,
        ratingCount: data.ratingCount || form.ratingCount,
        screenshots: data.screenshots?.length ? data.screenshots : form.screenshots || [],
        keyBenefit: data.keyBenefit || '',
        coreFunction: data.coreFunction || '',
        useCases: Array.isArray(data.useCases) ? data.useCases : [],
        targetAudienceList: Array.isArray(data.targetAudienceList) ? data.targetAudienceList : [],
        marketingStrategies: Array.isArray(data.marketingStrategies) ? data.marketingStrategies : [],
        keyMessaging: Array.isArray(data.keyMessaging) ? data.keyMessaging : [],
        positioningStatement: data.positioningStatement || '',
      };

      setForm(nextForm);

      // Auto-save immediately to database so user doesn't have to save again
      if (onAutoSave) {
        try {
          await onAutoSave(nextForm);
          setAutoSaved(true);
        } catch (saveError) {
          console.warn('Auto-save after analysis failed:', saveError);
        }
      }
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
    <div className="h-full flex flex-col justify-between p-4 md:p-6 bg-[#0c0c0e] text-foreground font-sans antialiased overflow-hidden max-w-7xl mx-auto">
      {/* ────────────────────────────────────────────────────────── */}
      {/* TOP HEADER: GHOSTFEED FLOATING CAPSULE BAR                 */}
      {/* ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-3.5 mb-3.5 shrink-0">
        <div className="flex items-center gap-3">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all disabled:opacity-50"
              title="Back to products list"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.04] text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-zinc-200" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">MarketAI Studio</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Short-Form OS
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <History className="h-3.5 w-3.5 text-zinc-400" />
              <span>Back</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => validateAndSubmit(e, onSubmit)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-white/[0.08] bg-white/[0.05] px-4 py-1.5 text-xs font-medium text-white hover:bg-white/[0.10] hover:border-white/[0.14] transition-all active:scale-[0.98]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-zinc-300" />}
            <span>{saving ? 'Saving...' : 'Save Workspace'}</span>
          </button>
          {onSaveAndOpenQueue && (
            <button
              type="button"
              onClick={(e) => validateAndSubmit(e, onSaveAndOpenQueue)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-[12px] bg-white px-4 py-1.5 text-xs font-semibold text-black shadow-sm hover:bg-zinc-200 transition-all active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save & Open Queue</span>
            </button>
          )}
        </div>
      </header>

      {/* Global Error Banner */}
      {(validationError || error || extractError) && (
        <div className="mb-3 flex items-center gap-2 rounded-[12px] border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError || error || extractError}</span>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MAIN TWO-COLUMN STUDIO LAYOUT                              */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* ========================================================= */}
        {/* LEFT COLUMN: 1. Tell us about your product (4 Cols)       */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-4 shadow-xl backdrop-blur-xl overflow-hidden">
          <div className="space-y-3">
            <h2 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              1. Product Input
            </h2>

            {/* Store Link Input */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Store or Website Link
                </span>
                {/* Capsule Tab Switcher */}
                <div className="flex rounded-full bg-white/[0.04] p-0.5 border border-white/[0.06]">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, productSource: opt.id }))}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        form.productSource === opt.id || (!form.productSource && opt.id === 'app_store')
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
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
                className="w-full rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 outline-none hover:border-white/[0.12] focus:border-white/30 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>

            {/* Product Information Textarea Card */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">Product Description</span>
                <span className="text-[10px] text-zinc-500 font-mono">
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
                className="w-full resize-none rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none hover:border-white/[0.12] focus:border-white/30 focus:ring-1 focus:ring-white/10 transition-all"
              />
            </div>
          </div>

          {/* Big Analyze Button */}
          <div className="mt-3 pt-2">
            <button
              type="button"
              onClick={handleAnalyzeProduct}
              disabled={extracting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-white text-black py-2.5 text-xs font-semibold shadow-sm hover:bg-zinc-200 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-zinc-800" />}
              <span>{extracting ? 'Analyzing...' : '✦ Analyze Product'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: 2. Extracted Info + 3. Video Formats        */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-3 overflow-hidden">
          {/* ──────────────────────────────────────────────────────── */}
          {/* 2. AI Extracted Product Information (4 Cards)            */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-3.5 shadow-xl backdrop-blur-xl shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                  2. Extracted App Profile
                </h3>
                {autoSaved ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    <Check className="h-2.5 w-2.5" /> Auto-Saved
                  </span>
                ) : isExtracted ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    <Check className="h-2.5 w-2.5" /> Extracted
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingInfo(!isEditingInfo)}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
              >
                <Edit3 className="h-3 w-3" />
                <span>{isEditingInfo ? 'Done Editing' : 'Edit Information'}</span>
              </button>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* Card 1: Product Name */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-start gap-2 hover:bg-white/[0.04] transition-colors">
                <div className="relative h-6 w-6 shrink-0">
                  {form.iconUrl ? (
                    <img
                      src={form.iconUrl}
                      alt=""
                      className="h-6 w-6 rounded-[6px] object-cover border border-white/10"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          e.currentTarget.nextElementSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.04] text-zinc-300"
                    style={{ display: form.iconUrl ? 'none' : 'flex' }}
                  >
                    <Package className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Product Name</span>
                  {isEditingInfo ? (
                    <input
                      value={form.productName || ''}
                      onChange={(e) => setForm((c) => ({ ...c, productName: e.target.value, name: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-xs font-bold truncate mt-0.5 ${form.productName ? 'text-white' : 'text-zinc-500'}`}>
                      {form.productName || '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Category */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-start gap-2 hover:bg-white/[0.04] transition-colors">
                <span className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.04] text-emerald-400 shrink-0">
                  <Grid className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Category</span>
                  {isEditingInfo ? (
                    <input
                      value={form.category || ''}
                      onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-xs font-bold truncate mt-0.5 ${form.category ? 'text-white' : 'text-zinc-500'}`}>
                      {form.category || '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 3: Key Benefit */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-start gap-2 hover:bg-white/[0.04] transition-colors">
                <span className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.04] text-amber-400 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-current" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Key Benefit</span>
                  {isEditingInfo ? (
                    <input
                      value={form.keyBenefit || ''}
                      onChange={(e) => setForm((c) => ({ ...c, keyBenefit: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
                    />
                  ) : (
                    <span className={`block text-[11px] font-semibold line-clamp-2 mt-0.5 ${form.keyBenefit ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {form.keyBenefit || '—'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 4: Core Function */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-start gap-2 hover:bg-white/[0.04] transition-colors">
                <span className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.04] text-sky-400 shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Core Function</span>
                  {isEditingInfo ? (
                    <input
                      value={form.coreFunction || ''}
                      onChange={(e) => setForm((c) => ({ ...c, coreFunction: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white outline-none mt-0.5"
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
          {/* 3. AI Generated Video & Carousel Formats (2x2 Grid)      */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-3.5 shadow-xl backdrop-blur-xl flex-1 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                  3. Video & Marketing Intelligence
                </h3>
                {isExtracted && (
                  <button
                    type="button"
                    onClick={handleAnalyzeProduct}
                    disabled={extracting}
                    className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
                  >
                    <RotateCw className={`h-3 w-3 ${extracting ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                )}
              </div>

              {!isExtracted && (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] my-auto">
                  <Sparkles className="h-7 w-7 text-zinc-500 mb-2" />
                  <p className="m-0 text-xs font-semibold text-zinc-300">No product analyzed yet</p>
                  <p className="m-0 mt-1 text-[11px] text-zinc-500 max-w-sm">
                    Paste an App Store or Play Store link on the left and click <strong>&quot;✦ Analyze Product&quot;</strong> to generate custom video formats, viral hooks, and insights.
                  </p>
                </div>
              )}

              {/* 2x2 Grid of Insight Cards */}
              {isExtracted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* 1. Use Cases */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold mb-2">
                      <Target className="h-3.5 w-3.5" />
                      <span>Use Cases</span>
                    </div>
                    {useCases.length > 0 ? (
                      <ul className="m-0 space-y-1.5 pl-0 list-none text-[11px] text-zinc-300">
                        {useCases.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-tight">
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
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold mb-2">
                      <Users className="h-3.5 w-3.5" />
                      <span>Target Audience</span>
                    </div>
                    {targetAudience.length > 0 ? (
                      <ul className="m-0 space-y-1.5 pl-0 list-none text-[11px] text-zinc-300">
                        {targetAudience.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-tight">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0 mt-1" />
                            <span className="line-clamp-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-[11px] text-zinc-500 italic">No target audience personas yet.</p>
                    )}
                  </div>

                  {/* 3. Video & Carousel Formats */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold mb-2">
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
                                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.2 text-[8.5px] font-bold text-sky-300 shrink-0">
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
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold mb-2">
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
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Sparkles className="h-4 w-4 text-zinc-300 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">
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
                  className="inline-flex items-center gap-1 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all shrink-0"
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
