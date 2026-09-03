import { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  parseVideoFormat,
  formatBlueprintString,
  VIDEO_FORMAT_TYPES,
  REACTION_HOOK_PRESETS,
} from './videoFormatUtils';

export const VideoFormatsStudio = ({
  marketingStrategies = [],
  onChange = () => {},
  onRegenerate = null,
  isExtracting = false,
  keyMessaging = [],
}) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const [editTag, setEditTag] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newFormatType, setNewFormatType] = useState('reaction_showcase');
  const [newFormatTag, setNewFormatTag] = useState('Influencer Reaction + App Showcase');
  const [newFormatText, setNewFormatText] = useState('');

  const formats = (marketingStrategies || []).map((str) => parseVideoFormat(str));

  const handleCopy = (index, text, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleStartEdit = (index, format, e) => {
    e?.stopPropagation();
    setEditingIndex(index);
    setEditTag(format.tag);
    setEditText(format.body);
  };

  const handleSaveEdit = (index) => {
    if (!editText.trim()) return;
    const updatedStr = formatBlueprintString(editTag, editText);
    const nextList = [...marketingStrategies];
    nextList[index] = updatedStr;
    onChange(nextList);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
    setEditTag('');
  };

  const handleDelete = (index, e) => {
    e?.stopPropagation();
    const nextList = marketingStrategies.filter((_, idx) => idx !== index);
    onChange(nextList);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleAddNew = () => {
    if (!newFormatText.trim()) return;
    const newStr = formatBlueprintString(newFormatTag, newFormatText);
    onChange([...marketingStrategies, newStr]);
    setNewFormatText('');
    setIsAddingNew(false);
  };

  const handleAddPreset = (preset) => {
    const newStr = formatBlueprintString(preset.tag, preset.body);
    // Don't add if duplicate
    if (!marketingStrategies.includes(newStr)) {
      onChange([...marketingStrategies, newStr]);
    }
  };

  const handleSelectNewType = (typeKey) => {
    setNewFormatType(typeKey);
    const meta = VIDEO_FORMAT_TYPES[typeKey];
    setNewFormatTag(meta ? meta.label : 'Custom Format');
    if (!newFormatText) {
      if (typeKey === 'reaction_showcase') {
        setNewFormatText('0-2s shocked creator reaction hook ("Wait, did this app actually just do that?!") → 3-7s live screen demo of core feature → CTA');
      } else if (typeKey === 'split_screen') {
        setNewFormatText('Top 60% creator live reaction & commentary + Bottom 40% live app UI walkthrough');
      } else if (typeKey === 'carousel') {
        setNewFormatText('Slide 1: Relatable hook question → Slides 2-4: Key app feature solutions → Slide 5: Download CTA');
      } else if (typeKey === 'teardown') {
        setNewFormatText('7-second fast cut showcasing standout killer feature with trending audio');
      } else if (typeKey === 'pov') {
        setNewFormatText('Hook: "POV: You finally found the app for this" with fast relatable walkthrough');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div>
          <h3 className="m-0 text-sm font-semibold text-white">
            Video Formats ({formats.length})
          </h3>
          <p className="m-0 mt-0.5 text-xs text-zinc-400">
            Hook + App Showcase and creative video blueprints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isExtracting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/15 hover:text-white disabled:opacity-50 shadow-sm"
              title="Regenerate formats with AI"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isExtracting ? 'animate-spin text-white' : ''}`} />
              <span>{isExtracting ? 'Generating...' : 'Regenerate'}</span>
            </button>
          )}

          {!isAddingNew && (
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(true);
                handleSelectNewType('reaction_showcase');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Format</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Reaction Hook + App Showcase Quick Presets (Play Around) ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
          <span>Quick Reaction Hook Presets:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REACTION_HOOK_PRESETS.map((preset, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => handleAddPreset(preset)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-white/15 hover:border-white/30 hover:text-white shadow-sm"
              title={preset.body}
            >
              <Plus className="h-3 w-3 text-zinc-400" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Add New Format Form (Inline) ── */}
      {isAddingNew && (
        <div className="py-4 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">New Format Blueprint</span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(VIDEO_FORMAT_TYPES).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectNewType(key)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition shadow-sm ${
                  newFormatType === key
                    ? 'bg-[#7831d6] text-white shadow-[#7831d6]/25'
                    : 'text-zinc-200 hover:text-white bg-white/10 border border-white/15 hover:bg-white/15'
                }`}
              >
                {meta.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={newFormatTag}
              onChange={(e) => setNewFormatTag(e.target.value)}
              placeholder="Format Name"
              className="rounded border border-white/10 bg-black px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
            />
            <input
              type="text"
              value={newFormatText}
              onChange={(e) => setNewFormatText(e.target.value)}
              placeholder="Creative blueprint details..."
              className="sm:col-span-2 rounded border border-white/10 bg-black px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/15 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddNew}
              disabled={!newFormatText.trim()}
              className="rounded-lg bg-[#7831d6] px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {formats.length === 0 && !isAddingNew && (
        <div className="py-6 text-center text-xs text-zinc-500">
          No video formats configured. Click any preset above or analyze a product link.
        </div>
      )}

      {/* ── Flat List of Video Formats ── */}
      <div className="divide-y divide-white/5">
        {formats.map((format, idx) => {
          const isEditing = editingIndex === idx;
          const isCopied = copiedIndex === idx;

          if (isEditing) {
            return (
              <div key={idx} className="py-3 space-y-2">
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  placeholder="Format Name"
                  className="w-full rounded border border-white/15 bg-black px-2.5 py-1 text-xs text-white outline-none focus:border-white/30"
                />
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  placeholder="Blueprint details..."
                  className="w-full rounded border border-white/15 bg-black px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-white/30 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-white/15 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(idx)}
                    className="rounded-lg bg-[#7831d6] px-3.5 py-1 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc]"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className="group flex items-start justify-between gap-3 py-3 hover:bg-white/[0.01] transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    {format.tag}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {format.meta.aspectRatio}
                  </span>
                </div>
                <p className="m-0 text-xs leading-relaxed text-zinc-300">
                  {format.body}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={(e) => handleCopy(idx, format.raw, e)}
                  className="p-1 text-zinc-400 hover:text-white transition-colors"
                  title="Copy text"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleStartEdit(idx, format, e)}
                  className="p-1 text-zinc-400 hover:text-white transition-colors"
                  title="Edit"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(idx, e)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Hook Quotes ── */}
      {keyMessaging && keyMessaging.length > 0 && (
        <div className="pt-3 border-t border-white/10 space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Hook Quotes
          </span>
          <div className="space-y-1">
            {keyMessaging.map((msg, mIdx) => {
              const cleanMsg = String(msg).replace(/^"|"$/g, '');
              return (
                <div
                  key={mIdx}
                  onClick={() => navigator.clipboard.writeText(cleanMsg)}
                  className="flex items-center justify-between text-xs text-zinc-400 hover:text-white py-0.5 cursor-pointer group"
                  title="Click to copy"
                >
                  <span className="italic truncate">&ldquo;{cleanMsg}&rdquo;</span>
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-500 ml-2 shrink-0">
                    Copy
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoFormatsStudio;
