import { FONT_WEIGHTS } from '../videoEditor/videoEditorConstants';
import { DEFAULT_TEXT_SETTINGS } from './useBulkRows';

/**
 * Compact floating toolbar for per-row text styling (Figma Dark Theme).
 * Appears when the user clicks the caption overlay on a Video 1 card.
 */
export const FloatingTextControls = ({
  inverseZoomScale = 1,
  textSettings,
  onUpdate,
  onClose,
}) => {
  const { fontFamily, fontWeight, fontColor, strokeWidth, strokeColor, bgType } = textSettings;
  const weightIdx = FONT_WEIGHTS.indexOf(fontWeight);

  const handleBgTypeClick = (type) => {
    onUpdate({ bgType: type });
    if (type === 'White') onUpdate({ bgType: type, bgColor: '#FFFFFF' });
    else if (type === 'Snapchat') onUpdate({ bgType: type, bgColor: '#000000' });
    else onUpdate({ bgType: type });
  };

  const resetAll = () => {
    onUpdate({
      fontFamily: DEFAULT_TEXT_SETTINGS.fontFamily,
      fontWeight: DEFAULT_TEXT_SETTINGS.fontWeight,
      fontColor: DEFAULT_TEXT_SETTINGS.fontColor,
      strokeWidth: DEFAULT_TEXT_SETTINGS.strokeWidth,
      strokeColor: DEFAULT_TEXT_SETTINGS.strokeColor,
      bgType: DEFAULT_TEXT_SETTINGS.bgType,
      bgColor: DEFAULT_TEXT_SETTINGS.bgColor,
    });
  };

  return (
    <div
      data-text-controls="true"
      className="absolute z-40 bg-[#1c1c1f]/95 border border-[#303034] rounded-xl shadow-2xl p-3 space-y-2.5 w-[240px] text-[#e0e0e5] backdrop-blur-md"
      style={{
        top: '50%',
        left: 'calc(100% + 10px)',
        transform: `translateY(-50%) scale(${inverseZoomScale})`,
        transformOrigin: 'left center',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close */}
      <div className="flex items-center justify-between">
        <span
          className="cursor-default text-[10px] font-bold text-gray-500 uppercase tracking-wider"
          title="Double-click to reset all text controls"
          onDoubleClick={resetAll}
        >
          Text Style
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase"
        >
          Done
        </button>
      </div>

      {/* Font Family */}
      <div className="relative">
        <select
          value={fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full text-[10px] font-medium border border-[#35353a] rounded-lg p-1.5 bg-[#232326] text-white outline-none cursor-pointer appearance-none"
        >
          <option className="bg-[#232326] text-white" value="TikTok Sans">TikTok Sans</option>
          <option className="bg-[#232326] text-white" value="Roboto">Roboto</option>
          <option className="bg-[#232326] text-white" value="Impact">Impact</option>
          <option className="bg-[#232326] text-white" value="Arial">Arial</option>
        </select>
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Weight */}
      <div className="space-y-1">
        <span
          className="cursor-default text-[10px] font-bold text-zinc-400"
          title="Double-click to reset weight"
          onDoubleClick={() => onUpdate({ fontWeight: DEFAULT_TEXT_SETTINGS.fontWeight })}
        >
          Weight: {fontWeight}
        </span>
        <input
          type="range" min="0" max="5" step="1"
          value={weightIdx}
          onChange={(e) => onUpdate({ fontWeight: FONT_WEIGHTS[Number(e.target.value)] })}
          className="w-full accent-[#7831d6] h-1 appearance-none rounded-lg cursor-pointer"
          style={{ background: `linear-gradient(to right, #7831d6 ${(weightIdx / 5) * 100}%, #35353a ${(weightIdx / 5) * 100}%)` }}
        />
      </div>

      {/* Colors row */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <span
            className="cursor-default text-[10px] font-bold text-zinc-400"
            title="Double-click to reset color"
            onDoubleClick={() => onUpdate({ fontColor: DEFAULT_TEXT_SETTINGS.fontColor })}
          >
            Color
          </span>
          <div className="relative w-full h-6 rounded-lg overflow-hidden border border-[#35353a] cursor-pointer">
            <input
              type="color"
              value={fontColor.toLowerCase()}
              onChange={(e) => onUpdate({ fontColor: e.target.value.toUpperCase() })}
              className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] border-0 p-0 cursor-pointer"
            />
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <span
            className="cursor-default text-[10px] font-bold text-zinc-400"
            title="Double-click to reset stroke color"
            onDoubleClick={() => onUpdate({ strokeColor: DEFAULT_TEXT_SETTINGS.strokeColor })}
          >
            Stroke
          </span>
          <div className="relative w-full h-6 rounded-lg overflow-hidden border border-[#35353a] cursor-pointer">
            <input
              type="color"
              value={strokeColor.toLowerCase()}
              onChange={(e) => onUpdate({ strokeColor: e.target.value.toUpperCase() })}
              className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] border-0 p-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Stroke Width */}
      <div className="space-y-1">
        <span
          className="cursor-default text-[10px] font-bold text-zinc-400"
          title="Double-click to reset stroke width"
          onDoubleClick={() => onUpdate({ strokeWidth: DEFAULT_TEXT_SETTINGS.strokeWidth })}
        >
          Stroke: {Number(strokeWidth).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}px
        </span>
        <input
          type="range" min="0" max="10" step="0.125"
          value={strokeWidth}
          onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
          className="w-full accent-[#7831d6] h-1 appearance-none rounded-lg cursor-pointer"
          style={{ background: `linear-gradient(to right, #7831d6 ${(strokeWidth / 10) * 100}%, #35353a ${(strokeWidth / 10) * 100}%)` }}
        />
      </div>

      {/* Background Type */}
      <div className="space-y-1">
        <span
          className="cursor-default text-[10px] font-bold text-[#e0e0e5]"
          title="Double-click to reset background"
          onDoubleClick={() => onUpdate({
            bgType: DEFAULT_TEXT_SETTINGS.bgType,
            bgColor: DEFAULT_TEXT_SETTINGS.bgColor,
          })}
        >
          Background
        </span>
        <div className="flex gap-1.5">
          {['None', 'White', 'Snapchat'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleBgTypeClick(type)}
              className={`flex-1 py-1 text-[9px] font-semibold rounded-full border transition-all ${
                bgType === type
                  ? 'bg-[#7831d6] border-[#7831d6] text-white shadow-md'
                  : 'bg-[#232326] border-[#35353a] text-zinc-300 hover:bg-[#2a2a2e] hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
