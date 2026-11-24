import { CheckCircle2 } from 'lucide-react';

export const MediaGrid = ({ media, selectedIds, onToggle }) => (
  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
    {media.map((item) => {
      const selected = selectedIds.includes(item.id);
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onToggle(item.id)}
          title={item.caption || ''}
          className={`relative aspect-square overflow-hidden rounded-xl ring-2 transition ${
            selected ? 'ring-[#7831d6]' : 'ring-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <img
            src={item.thumbnail_url || item.media_url}
            alt={item.caption ? item.caption.slice(0, 60) : 'Post'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {selected && (
            <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#7831d6] text-white shadow">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);
