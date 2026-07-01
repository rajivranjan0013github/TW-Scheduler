import { useState } from 'react';
import { X, Video, Music, Play, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';
import LoadingVideoPreview from '../../components/LoadingVideoPreview';

const proxiedMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

export const TempAssetQuickPickerDialog = ({
  type,
  slotLabel,
  items = [],
  onSelect,
  onBrowseGlobal,
  onClose,
}) => {
  const assetLabel = slotLabel || (type === 'video' ? 'Video' : 'Audio Track');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[78vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#18181b] border border-[#2d2d30] shadow-2xl text-[#e0e0e5]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d2d30] px-4 py-2.5 bg-[#121214]">
          <div>
            <h3 className="text-sm font-bold text-white" style={{ color: '#ffffff' }}>
              Select {assetLabel}
            </h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5" style={{ color: '#a1a1aa' }}>
              From Temporary Library
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBrowseGlobal}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff5500] text-white shadow-sm transition-all hover:bg-orange-600 active:scale-95"
              title="Add more from library"
              aria-label="Add more from library"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-[#27272a] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 font-medium">
              No items in your temporary library.
            </div>
          ) : (
             <div className={type === 'video' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-2'}>
              {items.map((item) => {
                if (type === 'video') {
                  const resolvedUrl = item.sourceType === 'library'
                    ? proxiedMediaUrl(item.originalUrl || item.url)
                    : (item.url || '');
                  return (
                    <button
                      key={item.id || item.url}
                      type="button"
                      onClick={() => onSelect(item)}
                      className="overflow-hidden rounded-xl border border-[#2d2d30] bg-[#121214] text-left shadow-sm transition-all hover:border-[#ff5500]/60 hover:shadow-md relative"
                    >
                      <div className="relative aspect-[9/16] bg-zinc-900">
                        <LoadingVideoPreview
                          src={resolvedUrl}
                          className="absolute inset-0"
                          videoClassName="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </span>
                        {/* Bottom Title Overlay */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-[2px] rounded text-[8px] font-bold text-gray-300 truncate px-1 py-0.5 text-center z-10" title={item.name}>
                          {item.name || 'Untitled video'}
                        </div>
                      </div>
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={item.id || item.url}
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#2d2d30] bg-[#121214] p-3 text-left text-xs font-semibold text-white transition-all hover:border-[#ff5500]/60 hover:bg-[#1a1a1e] active:scale-[0.99]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                        <span className="truncate">{item.name}</span>
                      </span>
                    </button>
                  );
                }
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

const TEMP_TABS = [
  { id: 'video1', label: 'First Video', type: 'video' },
  { id: 'video2', label: 'Second Video', type: 'video' },
  { id: 'audio', label: 'Music', type: 'audio' },
];

export const TempMediaLibraryDialog = ({
  library = { video1: [], video2: [], audio: [] },
  onAddMore,
  onRemove,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('video1');
  const activeMeta = TEMP_TABS.find((tab) => tab.id === activeTab) || TEMP_TABS[0];
  const items = Array.isArray(library[activeTab]) ? library[activeTab] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[78vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2d2d30] bg-[#18181b] text-[#e0e0e5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2d2d30] bg-[#121214] px-4 py-2.5">
          <div>
            <h3 className="text-sm font-bold text-white" style={{ color: '#ffffff' }}>Temporary Media Library</h3>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400" style={{ color: '#a1a1aa' }}>
              Browser-only quick picks for bulk rows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddMore}
              className="flex items-center gap-1.5 rounded-lg bg-[#ff5500] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-orange-600 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              Add More
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-[#27272a] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-[#2d2d30] bg-[#18181b] px-4">
          {TEMP_TABS.map((tab) => {
            const count = Array.isArray(library[tab.id]) ? library[tab.id].length : 0;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'border-[#ff5500] text-[#ff5500]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-[#2d2d30] text-center">
              {activeMeta.type === 'video' ? (
                <Video className="mb-3 h-8 w-8 text-gray-600" />
              ) : (
                <Music className="mb-3 h-8 w-8 text-gray-600" />
              )}
              <p className="text-sm font-bold text-gray-300">No {activeMeta.label.toLowerCase()} files yet.</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Use Add More to place files in this tab.</p>
            </div>
          ) : activeMeta.type === 'video' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {items.map((item) => {
                const resolvedUrl = item.sourceType === 'library'
                  ? proxiedMediaUrl(item.originalUrl || item.url)
                  : (item.url || '');
                return (
                  <div
                    key={item.id || item.url}
                    className="overflow-hidden rounded-xl border border-[#2d2d30] bg-[#121214] shadow-sm relative group"
                  >
                    <div className="relative aspect-[9/16] bg-zinc-900">
                      <LoadingVideoPreview
                        src={resolvedUrl}
                        className="absolute inset-0"
                        videoClassName="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
                          <Play className="h-4 w-4 fill-current" />
                        </span>
                      </span>
                      {/* Top-Right Trash Button Overlay */}
                      <div className="absolute top-1.5 right-1.5 z-10">
                        <button
                          type="button"
                          onClick={() => onRemove(activeTab, item)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/50 text-gray-400 hover:bg-red-950/60 hover:text-red-400 transition-all shadow-sm"
                          title="Remove from temporary library"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Bottom Title Overlay */}
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-[2px] rounded text-[8px] font-bold text-gray-300 truncate px-1 py-0.5 text-center z-10" title={item.name}>
                        {item.name || 'Untitled video'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.id || item.url}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#2d2d30] bg-[#121214] p-3 text-xs font-semibold text-white"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Music className="h-4 w-4 shrink-0 text-[#ff5500]" />
                    <span className="truncate">{item.name || 'Untitled audio'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(activeTab, item)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-950/40 hover:text-red-400"
                    title="Remove from temporary library"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
