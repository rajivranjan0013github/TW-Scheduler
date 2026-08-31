import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { parseVideoFormat } from './videoFormatUtils';

export const CampaignVideoFormatsPreview = ({
  marketingStrategies = [],
  keyMessaging = [],
}) => {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const formats = (marketingStrategies || []).map((str) => parseVideoFormat(str));

  if (formats.length === 0) {
    return (
      <div className="py-2 text-xs text-zinc-500">
        No video formats configured.
      </div>
    );
  }

  const handleCopy = (idx, text, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
        <span>Video Formats ({formats.length})</span>
      </div>

      <div className="space-y-1.5">
        {formats.slice(0, 3).map((format, idx) => (
          <div
            key={idx}
            onClick={(e) => handleCopy(idx, format.raw, e)}
            className="group flex items-start justify-between gap-2 py-1 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Click to copy format"
          >
            <div className="min-w-0 flex-1 leading-snug">
              <span className="font-semibold text-white mr-1.5">{format.tag}:</span>
              <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">
                {format.body}
              </span>
            </div>
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 transition-opacity shrink-0 pt-0.5">
              {copiedIndex === idx ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
            </span>
          </div>
        ))}
        {formats.length > 3 && (
          <div className="text-[11px] text-zinc-500 pt-0.5">
            +{formats.length - 3} more format{formats.length - 3 > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {keyMessaging?.[0] && (
        <div className="pt-1.5 text-xs text-zinc-500 italic truncate">
          &ldquo;{String(keyMessaging[0]).replace(/^"|"$/g, '')}&rdquo;
        </div>
      )}
    </div>
  );
};

export default CampaignVideoFormatsPreview;
