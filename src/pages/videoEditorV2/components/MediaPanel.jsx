import { useMemo, useRef, useState } from 'react';
import {
  Film,
  FolderOpen,
  ListVideo,
  Loader2,
  Megaphone,
  Music2,
  Plus,
  Search,
  Type,
} from 'lucide-react';
import { BulkQueuePanel } from './BulkQueuePanel';
import { MediaLibraryPanel } from './MediaLibraryPanel';

const TABS = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'promo', label: 'Promo', icon: Megaphone },
];

const formatDuration = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const AssetCard = ({ asset, onAdd }) => {
  const isVideo = asset.type === 'video';
  const isAudio = asset.type === 'audio';
  const [detectedDuration, setDetectedDuration] = useState(() => Number(asset.duration || 0));
  const [isPreviewing, setIsPreviewing] = useState(false);
  const audioPreviewRef = useRef(null);
  const videoPreviewRef = useRef(null);

  const startAudioPreview = () => {
    const audio = audioPreviewRef.current;
    if (!audio) return;
    void audio.play()
      .then(() => setIsPreviewing(true))
      .catch(() => setIsPreviewing(false));
  };

  const stopAudioPreview = () => {
    const audio = audioPreviewRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPreviewing(false);
  };

  const startVideoPreview = () => {
    const video = videoPreviewRef.current;
    if (!video) return;
    void video.play()
      .then(() => setIsPreviewing(true))
      .catch(() => setIsPreviewing(false));
  };

  const stopVideoPreview = () => {
    const video = videoPreviewRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setIsPreviewing(false);
  };

  if (isAudio) {
    return (
      <button
        type="button"
        onClick={() => onAdd(asset)}
        onMouseEnter={startAudioPreview}
        onMouseLeave={stopAudioPreview}
        className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#171a20] p-2.5 text-left transition hover:border-emerald-400/50 hover:bg-[#1b1f27] hover:shadow-lg hover:shadow-black/20"
        title={`Preview ${asset.name}; click to add it to the timeline`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/25 to-teal-500/10 text-emerald-400 ring-1 ring-emerald-400/20 ${
          isPreviewing ? 'animate-pulse' : ''
        }`}>
          <Music2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-bold text-[#e6e8ec]">{asset.name}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold text-[#727985]">
            <span>Audio</span>
            {detectedDuration > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{formatDuration(detectedDuration)}</span>
              </>
            ) : (
              <span className="text-[#666d78]">· Reading duration…</span>
            )}
          </span>
        </span>
        {asset.url && (
          <audio
            ref={audioPreviewRef}
            src={asset.url}
            crossOrigin="anonymous"
            preload="metadata"
            className="hidden"
            onLoadedMetadata={(event) => {
              const duration = Number(event.currentTarget.duration);
              if (Number.isFinite(duration) && duration > 0) setDetectedDuration(duration);
            }}
            onEnded={() => {
              if (audioPreviewRef.current) audioPreviewRef.current.currentTime = 0;
              setIsPreviewing(false);
            }}
          />
        )}
      </button>
    );
  }

  return (
    <div
      onMouseEnter={isVideo ? startVideoPreview : undefined}
      onMouseLeave={isVideo ? stopVideoPreview : undefined}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#171a20] transition hover:border-[#ff5500]/60 hover:bg-[#1b1f27] hover:shadow-lg hover:shadow-black/20"
    >
      <button
        type="button"
        onClick={() => onAdd(asset)}
        className="block w-full text-left"
        title={isVideo
          ? `Preview ${asset.name}; click to add it to the timeline`
          : `Add ${asset.name} to timeline`}
      >
        <div className="relative aspect-[9/16] overflow-hidden bg-gray-950">
          {isVideo ? (
            <video
              ref={videoPreviewRef}
              src={asset.url}
              muted
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              poster={asset.thumbnailUrl || undefined}
              className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03] group-hover:opacity-100"
              onLoadedMetadata={(event) => {
                const duration = Number(event.currentTarget.duration);
                if (Number.isFinite(duration) && duration > 0) setDetectedDuration(duration);
              }}
              onEnded={() => {
                if (videoPreviewRef.current) videoPreviewRef.current.currentTime = 0;
                setIsPreviewing(false);
              }}
            />
          ) : (
            <img src={asset.url} alt="" className="h-full w-full object-cover" />
          )}

          {detectedDuration > 0 && (
            <span className="absolute bottom-1.5 right-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white">
              {formatDuration(detectedDuration)}
            </span>
          )}
          {isVideo && !isPreviewing && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition group-hover:opacity-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-[8px] font-bold text-white">▶</span>
            </span>
          )}
          <span className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-white/95 text-[#ff5500] opacity-0 shadow-sm transition group-hover:opacity-100">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>
    </div>
  );
};

export const MediaPanel = ({
  className = '',
  token,
  promoAssets = [],
  promoFolderName = '',
  promoLoading = false,
  promoError = '',
  onOpenLibrary,
  libraryOpen = false,
  libraryMode = 'video',
  onCloseLibrary,
  onSelectLibrary,
  onAddPromoAsset,
  onAddText,
  bulkQueue = null,
}) => {
  const [activeTab, setActiveTab] = useState(() => (
    bulkQueue?.initiallyOpen ? 'bulk' : 'media'
  ));
  const [search, setSearch] = useState('');

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return promoAssets.filter((asset) => {
      const matchesTab = activeTab === 'promo' && asset.type === 'video';
      return matchesTab && (!query || asset.name.toLowerCase().includes(query));
    });
  }, [activeTab, promoAssets, search]);

  return (
    <aside className={`flex h-full min-h-0 border-r border-white/10 bg-[#111318] ${className}`}>
      <nav className="flex w-16 shrink-0 flex-col gap-1 border-r border-white/10 px-1.5 py-2" aria-label="Editor assets">
        {[...TABS, ...(bulkQueue ? [{ id: 'bulk', label: 'Queue', icon: ListVideo }] : [])].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'media' || tab.id === 'audio') {
                  onOpenLibrary(tab.id === 'audio' ? 'audio' : 'video');
                } else if (libraryOpen) {
                  onCloseLibrary?.();
                }
              }}
              className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-3 text-[9px] font-bold transition ${active ? 'bg-[#ff5500]/10 text-[#ff6a1a]' : 'text-[#727985] hover:bg-white/5 hover:text-[#d7dbe2]'}`}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {active && <span className="absolute bottom-2 right-0 top-2 w-0.5 rounded-full bg-[#ff5500]" />}
            </button>
          );
        })}
      </nav>

      <div className={`min-h-0 min-w-0 flex-1 ${libraryOpen || activeTab === 'bulk' ? 'overflow-hidden' : 'overflow-y-auto p-3'}`}>
        {libraryOpen && (
          <MediaLibraryPanel
            key={libraryMode}
            token={token}
            initialMediaType={libraryMode}
            onSelect={onSelectLibrary}
          />
        )}

        {!libraryOpen && (activeTab === 'media' || activeTab === 'audio') && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center p-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0071e3]/10 text-[#4da3ff] ring-1 ring-[#0071e3]/20">
              <FolderOpen className="h-5 w-5" />
            </span>
            <p className="mt-3 text-xs font-bold text-[#e6e8ec]">Media Library</p>
            <p className="mt-1 max-w-52 text-[9px] font-medium leading-relaxed text-[#727985]">
              Browse reusable images, videos, and audio from your library.
            </p>
            <button
              type="button"
              onClick={() => onOpenLibrary(activeTab === 'audio' ? 'audio' : 'video')}
              className="mt-4 rounded-xl bg-[#ff5500] px-4 py-2 text-[10px] font-bold text-white transition hover:bg-[#ff6a1a]"
            >
              Open Media Library
            </button>
          </div>
        )}

        {!libraryOpen && activeTab === 'promo' && (
          <div>
            <div>
              <h3 className="text-xs font-bold !text-[#f5f7fa]">Promo videos</h3>
              <p className="mt-1 text-[9px] font-medium leading-relaxed text-[#8b929d]">
                {promoFolderName
                  ? `Assigned folder: ${promoFolderName}`
                  : 'Assign a promo folder from Campaign Setup.'}
              </p>
            </div>

            <label className="mt-3 flex h-9 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#171a20] px-2.5 focus-within:border-[#ff5500]/60 focus-within:bg-[#1b1f27]">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#727985]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search promo videos"
                className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-[#e6e8ec] outline-none placeholder:text-[#666d78]"
              />
            </label>

            {promoLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-[10px] font-bold text-[#a6abb4]">
                <Loader2 className="h-4 w-4 animate-spin text-[#ff5500]" />
                Loading promo videos…
              </div>
            )}

            {!promoLoading && promoError && (
              <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-[10px] font-semibold text-red-300">
                {promoError}
              </div>
            )}

            {!promoLoading && !promoError && filteredAssets.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {filteredAssets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} onAdd={onAddPromoAsset} />
                ))}
              </div>
            )}

            {!promoLoading && !promoError && promoFolderName && filteredAssets.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[10px] font-bold text-[#a6abb4]">
                  {search.trim() ? 'No matching promo videos' : 'No videos in this promo folder'}
                </p>
              </div>
            )}
          </div>
        )}

        {!libraryOpen && activeTab === 'text' && (
          <div className="space-y-2.5">
            <div>
              <h3 className="text-xs font-bold !text-[#f5f7fa]">Text</h3>
              <p className="mt-1 text-[9px] font-medium leading-relaxed text-[#8b929d]">Add an editable text layer to the timeline.</p>
            </div>
            <button
              type="button"
              onClick={() => onAddText('Add text')}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-3 text-[11px] font-bold text-white transition hover:bg-[#ff6a1a]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add text
            </button>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#171a20]">
              {[
                { label: 'Title', previewClass: 'text-[13px] font-black' },
                { label: 'Subtitle', previewClass: 'text-[11px] font-semibold' },
                { label: 'Caption', previewClass: 'text-[9px] font-bold uppercase tracking-wide' },
              ].map((preset, index) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onAddText(preset.label)}
                  className={`group flex h-11 w-full items-center gap-3 px-3 text-left text-[#e6e8ec] transition hover:bg-[#201914] ${
                    index > 0 ? 'border-t border-white/10' : ''
                  }`}
                >
                  <Type className="h-3.5 w-3.5 shrink-0 text-[#727985] transition group-hover:text-[#ff6a1a]" />
                  <span className={`min-w-0 flex-1 ${preset.previewClass}`}>{preset.label}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-[#666d78] transition group-hover:text-[#ff6a1a]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {!libraryOpen && activeTab === 'bulk' && bulkQueue && (
          <BulkQueuePanel {...bulkQueue} />
        )}
      </div>
    </aside>
  );
};
