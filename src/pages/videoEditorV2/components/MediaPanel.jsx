import { useMemo, useRef, useState } from 'react';
import {
  Film,
  FolderOpen,
  Image as ImageIcon,
  Music2,
  Plus,
  Search,
  Shapes,
  Type,
  UploadCloud,
} from 'lucide-react';

const TABS = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'elements', label: 'Elements', icon: Shapes },
];

const formatDuration = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const AssetCard = ({ asset, onAdd }) => {
  const isVideo = asset.type === 'video';
  const isAudio = asset.type === 'audio';

  return (
    <button
      type="button"
      onClick={() => onAdd(asset)}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#171a20] text-left transition hover:border-[#ff5500]/60 hover:bg-[#1b1f27] hover:shadow-lg hover:shadow-black/20"
      title={`Add ${asset.name} to timeline`}
    >
      <div className="relative aspect-[9/16] overflow-hidden bg-gray-950">
        {isVideo ? (
          <video
            src={asset.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03] group-hover:opacity-100"
          />
        ) : isAudio ? (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-950">
            <Music2 className="h-6 w-6 text-white/90" />
            <div className="absolute inset-x-3 bottom-3 flex h-5 items-end justify-center gap-0.5 opacity-70">
              {[7, 13, 10, 18, 9, 15, 6, 19, 12, 8, 16, 10].map((height, index) => (
                <span key={index} className="w-0.5 rounded-full bg-white" style={{ height }} />
              ))}
            </div>
          </div>
        ) : (
          <img src={asset.url} alt="" className="h-full w-full object-cover" />
        )}

        {asset.duration > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white">
            {formatDuration(asset.duration)}
          </span>
        )}
        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/95 text-[#ff5500] opacity-0 shadow-sm transition group-hover:opacity-100">
          <Plus className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex items-center gap-2 px-2 py-2">
        {isAudio ? <Music2 className="h-3 w-3 text-emerald-600" /> : isVideo ? <Film className="h-3 w-3 text-[#ff5500]" /> : <ImageIcon className="h-3 w-3 text-blue-600" />}
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-[#d7dbe2]">{asset.name}</span>
      </div>
    </button>
  );
};

export const MediaPanel = ({
  assets,
  onFilesSelected,
  onOpenLibrary,
  onAddAsset,
  onAddText,
}) => {
  const [activeTab, setActiveTab] = useState('media');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesTab = activeTab === 'media'
        ? asset.type !== 'audio'
        : activeTab === 'audio'
          ? asset.type === 'audio'
          : false;
      return matchesTab && (!query || asset.name.toLowerCase().includes(query));
    });
  }, [activeTab, assets, search]);

  return (
    <aside className="flex min-h-0 border-r border-white/10 bg-[#111318]">
      <nav className="flex w-16 shrink-0 flex-col gap-1 border-r border-white/10 px-1.5 py-2" aria-label="Editor assets">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
        {(activeTab === 'media' || activeTab === 'audio') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={activeTab === 'audio' ? 'audio/*' : 'video/*,image/*'}
              className="hidden"
              onChange={(event) => {
                onFilesSelected(Array.from(event.target.files || []));
                event.target.value = '';
              }}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#171a20] px-2.5 text-[10px] font-bold text-[#d7dbe2] transition hover:border-white/20 hover:bg-[#20242c] hover:text-white"
                aria-label={`Upload ${activeTab === 'audio' ? 'audio' : 'media'}`}
                title={`Upload ${activeTab === 'audio' ? 'Audio' : 'Media'}`}
              >
                <UploadCloud className="h-3.5 w-3.5 flex-shrink-0 text-[#ff5500]" />
                <span>Upload</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenLibrary(activeTab === 'audio' ? 'audio' : 'video')}
                className="flex h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#171a20] px-2.5 text-[10px] font-bold text-[#d7dbe2] transition hover:border-white/20 hover:bg-[#20242c] hover:text-white"
                aria-label="Browse Media Library"
                title="Browse Media Library"
              >
                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-[#0071e3]" />
                <span>Library</span>
              </button>

              <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#171a20] px-2.5 focus-within:border-[#ff5500]/60 focus-within:bg-[#1b1f27]">
                <Search className="h-3.5 w-3.5 flex-shrink-0 text-[#727985]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${activeTab === 'audio' ? 'audio' : 'media'}`}
                  className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-[#e6e8ec] outline-none placeholder:text-[#666d78]"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onAdd={onAddAsset} />
              ))}
            </div>

            {filteredAssets.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[10px] font-bold text-[#a6abb4]">No imported {activeTab === 'audio' ? 'audio' : 'media'}</p>
                <p className="mt-1 text-[9px] font-medium text-[#666d78]">Upload a file or choose one from the library.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-[#f5f7fa]">Add text</h3>
              <p className="mt-1 text-[10px] font-medium leading-relaxed text-[#8b929d]">Text layers can be moved and trimmed independently on the timeline.</p>
            </div>
            <button
              type="button"
              onClick={() => onAddText('Add text')}
              className="flex w-full items-center justify-center rounded-xl bg-[#ff5500] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ff6a1a]"
            >
              Add heading
            </button>
            {[
              { label: 'Title', className: 'text-2xl font-black' },
              { label: 'Subtitle', className: 'text-base font-semibold' },
              { label: 'Caption', className: 'text-xs font-bold uppercase tracking-wider' },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onAddText(preset.label)}
                className={`flex h-20 w-full items-center justify-center rounded-xl border border-white/10 bg-[#171a20] text-[#f5f7fa] transition hover:border-[#ff5500]/50 hover:bg-[#201914] ${preset.className}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'elements' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-[#f5f7fa]">Canvas guides</h3>
              <p className="mt-1 text-[10px] font-medium leading-relaxed text-[#8b929d]">Use Guides for safe areas. Select a video or image, then use the separate Crop button under the preview to edit its source area.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Safe area', 'Center guide', 'Crop frame', 'Rule of thirds'].map((label) => (
                <div key={label} className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-[#171a20] p-3 text-center text-[10px] font-bold text-[#aeb3bc]">
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
