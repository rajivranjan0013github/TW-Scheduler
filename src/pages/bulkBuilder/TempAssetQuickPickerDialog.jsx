import { X, Video, Music, Play } from 'lucide-react';
import { API_BASE_URL } from '../videoEditor/videoEditorConstants';

const proxiedMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

export const TempAssetQuickPickerDialog = ({
  type,
  items = [],
  onSelect,
  onBrowseGlobal,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Select {type === 'video' ? 'Second Video' : 'Audio Track'}
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
              From Temporary Library
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 font-medium">
              No items in your temporary library.
            </div>
          ) : (
            <div className={type === 'video' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
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
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition-all hover:border-[#ff5500]/60 hover:shadow-md"
                    >
                      <div className="relative aspect-[9/16] bg-gray-100">
                        <video
                          src={resolvedUrl}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/10 text-white">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[10px] font-bold text-gray-900" title={item.name}>
                          {item.name || 'Untitled video'}
                        </p>
                      </div>
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={item.id || item.url}
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-3 text-left text-xs font-semibold text-gray-800 transition-all hover:border-[#ff5500]/60 hover:bg-orange-50/10 active:scale-[0.99]"
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

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 bg-gray-50 flex flex-col gap-2">
          <button
            type="button"
            onClick={onBrowseGlobal}
            className="w-full py-2 bg-[#ff5500] hover:bg-orange-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
          >
            {type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
            Browse Global Library
          </button>
        </div>
      </div>
    </div>
  );
};
