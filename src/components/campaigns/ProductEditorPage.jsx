import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ExternalLink,
  FileVideo2,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  WandSparkles,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { mediaLibraryKeys } from '../../pages/videoEditorV2/media/mediaLibraryCache';

const SOURCE_OPTIONS = [
  { id: 'app_store', label: 'App Store', placeholder: 'https://apps.apple.com/app/...' },
  { id: 'play_store', label: 'Play Store', placeholder: 'https://play.google.com/store/apps/details?id=...' },
  { id: 'website', label: 'Website', placeholder: 'https://yourproduct.com' },
];

const STEP_ITEMS = [
  { id: 'app', label: 'App', icon: Link2 },
  { id: 'showcase', label: 'Showcase', icon: Video },
  { id: 'learn', label: 'Learn', icon: BrainCircuit },
  { id: 'strategy', label: 'Strategy', icon: WandSparkles },
];

const getMediaId = (value) => String(value?._id || value || '');
const isFinished = (status) => status === 'completed' || status === 'failed';

const StatusPill = ({ status }) => {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Learned
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-300">
        <AlertCircle className="h-3 w-3" /> Needs retry
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-300">
      <Loader2 className="h-3 w-3 animate-spin" /> AI is learning
    </span>
  );
};

const MAX_SHOWCASE_VIDEOS = 12;

export const ProductEditorPage = ({
  form,
  setForm,
  saving,
  error,
  onSubmit,
  onCancel,
  canCancel = true,
  onSaveAndOpenQueue,
  onAutoSave,
  campaignId = '',
}) => {
  const initialStep = form.creativeBlueprints?.length
    ? 'strategy'
    : form.showcaseMediaIds?.length
      ? 'learn'
      : form.productUrl && form.productName
        ? 'showcase'
        : 'app';
  const [activeStep, setActiveStep] = useState(initialStep);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [resolvedCampaignId, setResolvedCampaignId] = useState(campaignId);
  const [showcaseVideos, setShowcaseVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [strategyGenerating, setStrategyGenerating] = useState(false);
  const [strategyError, setStrategyError] = useState('');
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('tw_token');
  const campaignWorkspaceId = resolvedCampaignId || campaignId;
  const activeStepIndex = STEP_ITEMS.findIndex((item) => item.id === activeStep);
  const completedVideos = showcaseVideos.filter((item) => item.aiStatus === 'completed');
  const processingVideos = showcaseVideos.filter((item) => !isFinished(item.aiStatus));
  const allAnalysisFinished = showcaseVideos.length > 0 && processingVideos.length === 0;

  useEffect(() => {
    const mediaIds = (form.showcaseMediaIds || []).map(getMediaId).filter(Boolean);
    if (!campaignWorkspaceId || mediaIds.length === 0 || showcaseVideos.length > 0) return;

    let cancelled = false;
    Promise.all(mediaIds.map(async (mediaId) => {
      const response = await fetch(
        `${API_BASE_URL}/api/media/${mediaId}/analyze-ai?campaignId=${encodeURIComponent(campaignWorkspaceId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return null;
      return response.json();
    })).then((items) => {
      if (!cancelled) setShowcaseVideos(items.filter(Boolean));
    });

    return () => { cancelled = true; };
  }, [form.showcaseMediaIds, campaignWorkspaceId, showcaseVideos.length, token]);

  useEffect(() => {
    const pendingIds = showcaseVideos
      .filter((item) => !isFinished(item.aiStatus))
      .map((item) => getMediaId(item));
    if (!campaignWorkspaceId || pendingIds.length === 0) return undefined;

    const intervalId = window.setInterval(async () => {
      const updates = await Promise.all(pendingIds.map(async (mediaId) => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/media/${mediaId}/analyze-ai?campaignId=${encodeURIComponent(campaignWorkspaceId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          return response.ok ? response.json() : null;
        } catch {
          return null;
        }
      }));
      const byId = new Map(updates.filter(Boolean).map((item) => [getMediaId(item), item]));
      if (byId.size > 0) {
        setShowcaseVideos((current) => current.map((item) => byId.get(getMediaId(item)) || item));
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [campaignWorkspaceId, showcaseVideos, token]);

  const handleUrlChange = (url) => {
    const lower = url.toLowerCase();
    let source = form.productSource || 'app_store';
    if (lower.includes('apps.apple.com') || lower.includes('itunes.apple.com')) source = 'app_store';
    else if (lower.includes('play.google.com')) source = 'play_store';
    else if (lower.startsWith('http')) source = 'website';
    setForm((current) => ({ ...current, productUrl: url, productSource: source }));
    setExtractError('');
  };

  const handleAnalyzeProduct = async () => {
    const rawUrl = String(form.productUrl || '').trim();
    if (!rawUrl) {
      setExtractError('Paste an App Store, Play Store, or website link first.');
      return;
    }

    try {
      setExtracting(true);
      setExtractError('');
      const response = await fetch(`${API_BASE_URL}/api/ai/analyze-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: rawUrl, source: form.productSource || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to learn this app.');

      const nextForm = {
        ...form,
        ...data,
        name: data.productName || form.name,
        description: data.productDescription || form.description,
        productUrl: data.productUrl || rawUrl,
        marketingStrategies: [],
        keyMessaging: [],
      };
      setForm(nextForm);

      if (onAutoSave) {
        const savedCampaign = await onAutoSave(nextForm);
        if (savedCampaign?._id) setResolvedCampaignId(savedCampaign._id);
      }
      setActiveStep('showcase');
    } catch (err) {
      setExtractError(err.message || 'Could not learn from this link.');
    } finally {
      setExtracting(false);
    }
  };

  const persistShowcaseIds = async (ids) => {
    if (!campaignWorkspaceId) return;
    const response = await fetch(`${API_BASE_URL}/api/accounts/campaigns/${campaignWorkspaceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ showcaseMediaIds: ids }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not attach showcase videos to this campaign.');
  };

  const uploadShowcaseFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => (
      file.type?.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name)
    ));
    if (!campaignWorkspaceId) {
      setUploadError('Analyze and save the app before adding showcase videos.');
      return;
    }
    if (files.length === 0) {
      setUploadError('Choose video screen recordings in MP4, MOV, or WebM format.');
      return;
    }

    const availableSlots = Math.max(0, MAX_SHOWCASE_VIDEOS - showcaseVideos.length);
    if (availableSlots <= 0) {
      setUploadError(`You have reached the maximum limit of ${MAX_SHOWCASE_VIDEOS} showcase videos. Remove one to add a new video.`);
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    const oversized = filesToUpload.find((file) => file.size > 100 * 1024 * 1024);
    if (oversized) {
      setUploadError(`${oversized.name} is larger than 100 MB.`);
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const uploaded = [];
      const failedUploads = [];
      for (const file of filesToUpload) {
        try {
          const body = new FormData();
          body.append('file', file);
          body.append('tags', 'app-showcase');
          body.append('aiMode', 'app_showcase');
          if (form.promoFolderId) {
            body.append('folderId', form.promoFolderId);
          }
          const response = await fetch(
            `${API_BASE_URL}/api/media/upload?campaignId=${encodeURIComponent(campaignWorkspaceId)}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body,
            }
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || `Could not upload ${file.name}.`);
          uploaded.push({
            ...data,
            aiStatus: 'processing',
            localPreviewUrl: URL.createObjectURL(file),
          });
        } catch (err) {
          failedUploads.push(`${file.name}: ${err.message || 'upload failed'}`);
        }
      }

      const nextVideos = [...showcaseVideos, ...uploaded];
      const nextIds = nextVideos.map((item) => getMediaId(item)).filter(Boolean);
      setShowcaseVideos(nextVideos);
      setForm((current) => ({ ...current, showcaseMediaIds: nextIds }));
      if (uploaded.length > 0) {
        await persistShowcaseIds(nextIds);
        queryClient?.invalidateQueries({ queryKey: mediaLibraryKeys.root });
      }
      if (failedUploads.length > 0) {
        setUploadError(failedUploads.join(' · '));
      } else if (files.length > availableSlots) {
        setUploadError(`Added the first ${uploaded.length} video${uploaded.length > 1 ? 's' : ''}. Maximum of ${MAX_SHOWCASE_VIDEOS} showcase videos reached.`);
      }
    } catch (err) {
      setUploadError(err.message || 'Showcase upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removeShowcaseVideo = async (mediaId) => {
    const nextVideos = showcaseVideos.filter((item) => getMediaId(item) !== mediaId);
    const nextIds = nextVideos.map((item) => getMediaId(item));
    setShowcaseVideos(nextVideos);
    setForm((current) => ({ ...current, showcaseMediaIds: nextIds }));
    try {
      await persistShowcaseIds(nextIds);
      queryClient?.invalidateQueries({ queryKey: mediaLibraryKeys.root });
    } catch (err) {
      setUploadError(err.message);
    }
  };

  const retryAnalysis = async (mediaId) => {
    setShowcaseVideos((current) => current.map((item) => (
      getMediaId(item) === mediaId ? { ...item, aiStatus: 'processing', aiError: '' } : item
    )));
    const response = await fetch(
      `${API_BASE_URL}/api/media/${mediaId}/analyze-ai?campaignId=${encodeURIComponent(campaignWorkspaceId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode: 'app_showcase' }),
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setUploadError(data.message || 'Could not restart video analysis.');
    }
  };

  const generateStrategy = async ({ listingOnly = false } = {}) => {
    if (!campaignWorkspaceId) {
      setStrategyError('Save the app before generating its strategy.');
      return;
    }
    try {
      setStrategyGenerating(true);
      setStrategyError('');
      setActiveStep('learn');
      const response = await fetch(`${API_BASE_URL}/api/ai/generate-campaign-strategy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId: campaignWorkspaceId,
          mediaIds: listingOnly ? [] : completedVideos.map((item) => getMediaId(item)),
          useListingOnly: listingOnly,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not build the campaign strategy.');
      setForm((current) => ({ ...current, ...data }));
      setActiveStep('strategy');
    } catch (err) {
      setStrategyError(err.message || 'Campaign strategy generation failed.');
    } finally {
      setStrategyGenerating(false);
    }
  };

  const learnedSignals = useMemo(() => {
    const analyses = completedVideos.map((item) => item.aiAnalysis?.appShowcase || {});
    const unique = (items) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];
    return {
      features: unique(analyses.flatMap((item) => item.featuresShown || [])).slice(0, 8),
      moments: unique(analyses.flatMap((item) => item.strongestMoments || [])).slice(0, 6),
    };
  }, [completedVideos]);

  const saveCurrentCampaign = (event, callback) => {
    event?.preventDefault?.();
    if (callback) callback(event);
    else onSubmit(event);
  };

  const renderAppStep = () => (
    <div className="mx-auto max-w-3xl py-4 md:py-10">
      <div className="mb-7">
        <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-200">
          <Link2 className="h-5 w-5" />
        </span>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-white">What are we promoting?</h1>
        <p className="m-0 mt-2 max-w-xl text-sm leading-6 text-zinc-400">
          Paste the official app or product link. AI will read the listing first, so every later hook is grounded in the actual product.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#141417] p-5 md:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setForm((current) => ({ ...current, productSource: option.id }))}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                (form.productSource || 'app_store') === option.id
                  ? 'border-violet-400/40 bg-violet-400/10 text-violet-100'
                  : 'border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="mb-2 block text-xs font-medium text-zinc-300" htmlFor="campaign-product-url">
          App Store, Play Store, or website link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="campaign-product-url"
            type="url"
            value={form.productUrl || ''}
            onChange={(event) => handleUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAnalyzeProduct();
              }
            }}
            placeholder={SOURCE_OPTIONS.find((item) => item.id === form.productSource)?.placeholder || SOURCE_OPTIONS[0].placeholder}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10"
          />
          <button
            type="button"
            onClick={handleAnalyzeProduct}
            disabled={extracting || !form.productUrl?.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {extracting ? 'Learning the app…' : 'Learn this app'}
          </button>
        </div>
        {extractError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {extractError}
          </div>
        )}
      </div>
    </div>
  );

  const renderShowcaseStep = () => (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#141417] p-5 md:p-6">
        <div className="mb-5">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Now show, don’t tell</p>
          <h1 className="m-0 mt-1.5 text-xl font-semibold text-white">Add your showcase videos</h1>
          <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Upload clean screen recordings of important flows. AI will learn which feature appears, what happens on screen, and which moment makes the strongest proof.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          multiple
          className="hidden"
          onChange={(event) => {
            uploadShowcaseFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            uploadShowcaseFiles(event.dataTransfer.files);
          }}
          className={`flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition ${
            dragActive
              ? 'border-violet-400 bg-violet-400/10'
              : 'border-white/15 bg-black/30 hover:border-white/30 hover:bg-white/[0.025]'
          }`}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-violet-300" /> : <Upload className="h-6 w-6 text-zinc-400" />}
          <span className="mt-3 text-sm font-medium text-white">
            {uploading ? 'Uploading your showcase…' : 'Drop screen recordings here'}
          </span>
          <span className="mt-1 text-xs text-zinc-500">
            MP4, MOV, or WebM · up to {MAX_SHOWCASE_VIDEOS} videos {showcaseVideos.length > 0 ? `(${showcaseVideos.length}/${MAX_SHOWCASE_VIDEOS})` : ''} · 100 MB each
          </span>
        </button>

        {uploadError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {uploadError}
          </div>
        )}

        {showcaseVideos.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {showcaseVideos.map((item) => {
              const mediaId = getMediaId(item);
              const previewUrl = item.localPreviewUrl || item.thumbnailUrl || item.url;
              return (
                <div key={mediaId} className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
                  <div className="relative aspect-video bg-zinc-950">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : previewUrl ? (
                      <video src={previewUrl} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><FileVideo2 className="h-6 w-6 text-zinc-600" /></div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeShowcaseVideo(mediaId)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/70 text-zinc-400 hover:text-white"
                      title="Remove from this campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="m-0 truncate text-xs font-medium text-white">{item.name || 'Showcase video'}</p>
                    <div className="mt-1.5"><StatusPill status={item.aiStatus || 'processing'} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => generateStrategy({ listingOnly: true })}
            disabled={strategyGenerating}
            className="text-left text-xs font-medium text-zinc-500 transition hover:text-zinc-200 disabled:opacity-50"
          >
            I don’t have showcase videos yet — use the listing
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('learn')}
            disabled={showcaseVideos.length === 0 || uploading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review AI learning <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-white/[0.08] bg-[#141417] p-5 lg:sticky lg:top-5">
        <div className="mb-4 flex items-center gap-2">
          {form.iconUrl ? (
            <img
              src={form.iconUrl}
              alt=""
              crossOrigin="anonymous"
              className="h-10 w-10 rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"><Sparkles className="h-4 w-4 text-violet-300" /></span>
          )}
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold text-white">{form.productName || 'Your app'}</p>
            <p className="m-0 mt-0.5 truncate text-[11px] text-zinc-500">{form.category || 'Product'}</p>
          </div>
        </div>
        <p className="m-0 text-xs leading-5 text-zinc-400">{form.keyBenefit || form.productDescription}</p>
        <div className="mt-4 border-t border-white/[0.08] pt-4">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Best recordings to add</p>
          <ul className="mt-3 space-y-2 pl-4 text-xs leading-5 text-zinc-400">
            <li>The fastest path to the core result</li>
            <li>A visible before-and-after moment</li>
            <li>One surprising or satisfying interaction</li>
          </ul>
        </div>
      </aside>
    </div>
  );

  const renderLearnStep = () => (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-white/[0.08] bg-[#141417] p-5 md:p-6">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Evidence before ideas</p>
        <h1 className="m-0 mt-1.5 text-xl font-semibold text-white">What AI sees in your showcase</h1>
        <p className="m-0 mt-2 text-sm leading-6 text-zinc-400">
          Each clip is analyzed independently. The final strategy only uses features and moments that are actually visible.
        </p>

        {strategyGenerating ? (
          <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200">
              <BrainCircuit className="h-6 w-6 animate-pulse" />
            </span>
            <h2 className="m-0 mt-4 text-sm font-semibold text-white">Pairing hooks with product proof…</h2>
            <p className="m-0 mt-2 max-w-md text-xs leading-5 text-zinc-400">
              AI is comparing the app promise with the strongest visible moments, then writing overlay lines that bridge the two.
            </p>
          </div>
        ) : showcaseVideos.length > 0 ? (
          <div className="mt-6 space-y-3">
            {showcaseVideos.map((item, index) => {
              const mediaId = getMediaId(item);
              const showcase = item.aiAnalysis?.appShowcase || {};
              return (
                <div key={mediaId} className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Video {index + 1}</p>
                      <h3 className="m-0 mt-1 truncate text-sm font-medium text-white">{item.name || 'Showcase recording'}</h3>
                    </div>
                    <StatusPill status={item.aiStatus || 'processing'} />
                  </div>
                  {item.aiStatus === 'completed' && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="m-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500">AI summary</p>
                        <p className="m-0 mt-1 text-xs leading-5 text-zinc-300">{item.aiAnalysis?.summary || 'Showcase flow understood.'}</p>
                      </div>
                      <div>
                        <p className="m-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Features shown</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(showcase.featuresShown || []).slice(0, 5).map((feature) => (
                            <span key={feature} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300">{feature}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {item.aiStatus === 'failed' && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-500/[0.06] px-3 py-2">
                      <span className="text-xs text-red-200">{item.aiError || 'This video could not be analyzed.'}</span>
                      <button type="button" onClick={() => retryAnalysis(mediaId)} className="inline-flex items-center gap-1 text-xs font-medium text-white">
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/30 p-5 text-sm text-zinc-400">
            No video evidence was supplied. The strategy will use store metadata and clearly identify which showcase shots still need to be recorded.
          </div>
        )}

        {strategyError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {strategyError}
          </div>
        )}

        {!strategyGenerating && showcaseVideos.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-500">
              {processingVideos.length > 0
                ? `${processingVideos.length} video${processingVideos.length === 1 ? '' : 's'} still processing`
                : `${completedVideos.length} video${completedVideos.length === 1 ? '' : 's'} ready for strategy`}
            </span>
            <button
              type="button"
              onClick={() => generateStrategy()}
              disabled={!allAnalysisFinished || completedVideos.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <WandSparkles className="h-4 w-4" /> Build campaign strategy
            </button>
          </div>
        )}
      </section>

      <aside className="h-fit rounded-2xl border border-white/[0.08] bg-[#141417] p-5 lg:sticky lg:top-5">
        <h2 className="m-0 text-sm font-semibold text-white">What AI learned</h2>
        <div className="mt-5">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Features shown</p>
          {learnedSignals.features.length > 0 ? (
            <ul className="mt-2.5 space-y-2 pl-4 text-xs leading-5 text-zinc-300">
              {learnedSignals.features.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="m-0 mt-2 text-xs text-zinc-500">Waiting for video analysis.</p>}
        </div>
        <div className="mt-5 border-t border-white/[0.08] pt-4">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Strongest moments</p>
          {learnedSignals.moments.length > 0 ? (
            <ul className="mt-2.5 space-y-2 pl-4 text-xs leading-5 text-zinc-300">
              {learnedSignals.moments.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="m-0 mt-2 text-xs text-zinc-500">Timestamped moments will appear here.</p>}
        </div>
      </aside>
    </div>
  );

  const renderStrategyStep = () => {
    const blueprints = form.creativeBlueprints || [];
    const learning = form.showcaseLearning || {};
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Ready to make</p>
              <h1 className="m-0 mt-1.5 text-xl font-semibold text-white">Hook + overlay + showcase recipes</h1>
              <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Each concept explains what grabs attention, what the viewer reads, and exactly which product proof follows.</p>
            </div>
            <button
              type="button"
              onClick={() => generateStrategy({ listingOnly: showcaseVideos.length === 0 })}
              disabled={strategyGenerating}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${strategyGenerating ? 'animate-spin' : ''}`} /> Regenerate
            </button>
          </div>

          <div className="space-y-4">
            {blueprints.map((blueprint, index) => (
              <article key={blueprint._id || `${blueprint.title}-${index}`} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141417]">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-400/10 text-[10px] font-semibold text-violet-200">{index + 1}</span>
                    <h2 className="m-0 text-sm font-semibold text-white">{blueprint.title || `Concept ${index + 1}`}</h2>
                  </div>
                  <span className="text-[10px] text-zinc-500">Short-form · 9:16</span>
                </div>
                <div className="grid md:grid-cols-3">
                  <div className="border-b border-white/[0.08] p-5 md:border-b-0 md:border-r">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Hook</span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-500">{blueprint.hook?.duration || '0-2s'}</span>
                    </div>
                    <p className="m-0 mt-3 text-sm font-medium leading-5 text-white">{blueprint.hook?.visual}</p>
                    <p className="m-0 mt-2 text-xs leading-5 text-zinc-400">{blueprint.hook?.direction}</p>
                  </div>
                  <div className="border-b border-white/[0.08] p-5 md:border-b-0 md:border-r">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Overlay</span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-500">{blueprint.overlay?.duration || '0-3s'}</span>
                    </div>
                    <blockquote className="m-0 mt-3 text-base font-semibold leading-6 text-white">“{blueprint.overlay?.text}”</blockquote>
                    <p className="m-0 mt-2 text-xs text-zinc-500">Place: {blueprint.overlay?.placement || 'upper-third'}</p>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Showcase</span>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-500">
                        {[blueprint.showcase?.startTime, blueprint.showcase?.endTime].filter(Boolean).join('–') || 'Proof'}
                      </span>
                    </div>
                    <p className="m-0 mt-3 text-sm font-medium leading-5 text-white">{blueprint.showcase?.feature}</p>
                    <p className="m-0 mt-2 text-xs leading-5 text-zinc-400">{blueprint.showcase?.direction}</p>
                  </div>
                </div>
                <div className="border-t border-white/[0.08] bg-black/20 px-5 py-3">
                  <p className="m-0 text-xs leading-5 text-zinc-400"><span className="font-medium text-zinc-200">Why it works:</span> {blueprint.rationale}</p>
                  {blueprint.cta && <p className="m-0 mt-1 text-xs text-zinc-500">CTA: {blueprint.cta}</p>}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={(event) => saveCurrentCampaign(event, onSubmit)} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.04] hover:text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save campaign'}
            </button>
            {onSaveAndOpenQueue && (
              <button type="button" onClick={(event) => saveCurrentCampaign(event, onSaveAndOpenQueue)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">
                Save & open queue <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-white/[0.08] bg-[#141417] p-5 lg:sticky lg:top-5">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-semibold">Strategy grounded</span>
          </div>
          <p className="m-0 mt-3 text-xs leading-5 text-zinc-400">{learning.summary || 'Built from the product listing and available showcase evidence.'}</p>
          {learning.audienceFit && (
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Audience fit</p>
              <p className="m-0 mt-2 text-xs leading-5 text-zinc-300">{learning.audienceFit}</p>
            </div>
          )}
          {learning.coverageGaps?.length > 0 && (
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Record next</p>
              <ul className="mt-2.5 space-y-2 pl-4 text-xs leading-5 text-zinc-400">
                {learning.coverageGaps.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] px-4 py-5 text-white sm:px-7 md:py-7">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            {canCancel && (
              <button type="button" onClick={onCancel} disabled={saving} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-white" title="Back to campaigns">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Campaign builder</p>
              <p className="m-0 mt-1 max-w-64 truncate text-sm font-semibold text-white">{form.productName || 'New app campaign'}</p>
            </div>
          </div>

          <nav aria-label="Campaign setup progress" className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto lg:max-w-2xl">
            {STEP_ITEMS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === activeStep;
              const isPassed = index < activeStepIndex;
              const canVisit = isPassed || isActive || (step.id === 'showcase' && Boolean(form.productName));
              return (
                <div key={step.id} className="flex min-w-0 flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    onClick={() => canVisit && setActiveStep(step.id)}
                    disabled={!canVisit}
                    className={`flex shrink-0 items-center gap-1.5 text-xs font-medium transition ${isActive ? 'text-white' : isPassed ? 'text-zinc-300' : 'text-zinc-600'}`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      isActive
                        ? 'border-violet-400/50 bg-violet-400/15 text-violet-200'
                        : isPassed
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                          : 'border-white/[0.08] bg-white/[0.02]'
                    }`}>
                      {isPassed ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span>{step.label}</span>
                  </button>
                  {index < STEP_ITEMS.length - 1 && <span className={`mx-2 h-px min-w-5 flex-1 ${index < activeStepIndex ? 'bg-emerald-400/25' : 'bg-white/[0.08]'}`} />}
                </div>
              );
            })}
          </nav>

          {form.productUrl ? (
            <a href={form.productUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 text-xs text-zinc-500 hover:text-white lg:inline-flex">
              View listing <ExternalLink className="h-3 w-3" />
            </a>
          ) : <span className="hidden w-20 lg:block" />}
        </header>

        {(error && !strategyError) && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {activeStep === 'app' && renderAppStep()}
        {activeStep === 'showcase' && renderShowcaseStep()}
        {activeStep === 'learn' && renderLearnStep()}
        {activeStep === 'strategy' && renderStrategyStep()}
      </div>
    </div>
  );
};

export default ProductEditorPage;
