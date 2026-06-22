import { FONT_WEIGHTS } from '../videoEditor/videoEditorConstants';
import { DEFAULT_DRAG_POS, DEFAULT_TEXT_SETTINGS } from './useBulkRows';

const POSITION_X_MIN = -146;
const POSITION_X_MAX = 146;
const POSITION_Y_MIN = -260;
const POSITION_Y_MAX = 260;

/**
 * Compact floating toolbar for per-row text styling (Figma Dark Theme).
 * Appears when the user clicks the caption overlay on a Video 1 card.
 */
export const FloatingTextControls = ({
  inverseZoomScale = 1,
  textSettings,
  dragPos = DEFAULT_DRAG_POS,
  placement,
  onUpdatePlacement,
  onUpdate,
  onUpdateDragPos,
  onClose,
}) => {
  const { fontFamily, fontWeight, fontSize, fontColor, strokeWidth, strokeColor, bgType } = textSettings;
  const weightIdx = FONT_WEIGHTS.indexOf(fontWeight);
  const fallbackPlacement = {
    x: Math.round(Math.min(Math.max(dragPos.x, 0), 240) - 120),
    y: Math.round(Math.min(Math.max(dragPos.y, 0), 460) - 230),
    minX: -120,
    maxX: 120,
    minY: -230,
    maxY: 230,
  };
  const activePlacement = placement || fallbackPlacement;
  const placementX = Math.round(activePlacement.x);
  const placementY = Math.round(activePlacement.y);
  const sliderX = Math.max(POSITION_X_MIN, Math.min(POSITION_X_MAX, placementX));
  const sliderY = Math.max(POSITION_Y_MIN, Math.min(POSITION_Y_MAX, placementY));
  const placementXPercent = ((sliderX - POSITION_X_MIN) / (POSITION_X_MAX - POSITION_X_MIN)) * 100;
  const placementYPercent = ((sliderY - POSITION_Y_MIN) / (POSITION_Y_MAX - POSITION_Y_MIN)) * 100;

  const handleBgTypeClick = (type) => {
    onUpdate({ bgType: type });
    if (type === 'White') onUpdate({ bgType: type, bgColor: '#FFFFFF' });
    else if (type === 'Snapchat') onUpdate({ bgType: type, bgColor: '#000000' });
    else onUpdate({ bgType: type });
  };

  const resetPosition = () => {
    if (onUpdatePlacement) onUpdatePlacement({ x: 0, y: 0 });
    else onUpdateDragPos?.({ ...dragPos, x: 120, y: 230 });
  };

  const resetAll = () => {
    onUpdate({ ...DEFAULT_TEXT_SETTINGS });
    resetPosition();
  };

  return (
    <div
      data-text-controls="true"
      className="absolute z-40 bg-[#18181b]/95 border border-[#2d2d30] rounded-xl shadow-2xl p-3 space-y-2.5 w-[240px] text-[#e0e0e5] backdrop-blur-md"
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
          className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase"
        >
          Done
        </button>
      </div>

      {/* Font Family */}
      <div className="relative">
        <select
          value={fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full text-[10px] font-medium border border-[#2d2d30] rounded-lg p-1.5 bg-[#121214] text-white outline-none cursor-pointer appearance-none"
        >
          <option className="bg-[#1e1e24] text-white" value="TikTok Sans">TikTok Sans</option>
          <option className="bg-[#1e1e24] text-white" value="Roboto">Roboto</option>
          <option className="bg-[#1e1e24] text-white" value="Impact">Impact</option>
          <option className="bg-[#1e1e24] text-white" value="Arial">Arial</option>
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
          className="cursor-default text-[10px] font-bold text-gray-400"
          title="Double-click to reset weight"
          onDoubleClick={() => onUpdate({ fontWeight: DEFAULT_TEXT_SETTINGS.fontWeight })}
        >
          Weight: {fontWeight}
        </span>
        <input
          type="range" min="0" max="5" step="1"
          value={weightIdx}
          onChange={(e) => onUpdate({ fontWeight: FONT_WEIGHTS[Number(e.target.value)] })}
          className="w-full accent-[#ff5500] h-1 appearance-none rounded-lg cursor-pointer"
          style={{ background: `linear-gradient(to right, #ff5500 ${(weightIdx / 5) * 100}%, #2d2d30 ${(weightIdx / 5) * 100}%)` }}
        />
      </div>

      {/* Size */}
      <div className="space-y-1">
        <span
          className="cursor-default text-[10px] font-bold text-gray-400"
          title="Double-click to reset size"
          onDoubleClick={() => onUpdate({ fontSize: DEFAULT_TEXT_SETTINGS.fontSize })}
        >
          Size: {fontSize}px
        </span>
        <input
          type="range" min="10" max="48" step="1"
          value={fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          className="w-full accent-[#ff5500] h-1 appearance-none rounded-lg cursor-pointer"
          style={{ background: `linear-gradient(to right, #ff5500 ${((fontSize - 10) / 38) * 100}%, #2d2d30 ${((fontSize - 10) / 38) * 100}%)` }}
        />
      </div>

      {/* Placement */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span
            className="cursor-default text-[10px] font-bold text-gray-400"
            title="Double-click to reset position"
            onDoubleClick={resetPosition}
          >
            Position
          </span>
          <span className="text-[9px] font-bold text-gray-500">
            X {placementX}, Y {placementY}
          </span>
        </div>
        <div className="space-y-2">
          <label className="grid grid-cols-[14px_1fr] items-center gap-2 text-[9px] font-bold text-gray-500">
            X
            <input
              type="range"
              min={POSITION_X_MIN}
              max={POSITION_X_MAX}
              step="1"
              value={sliderX}
              onChange={(e) => {
                const x = Number(e.target.value);
                if (onUpdatePlacement) onUpdatePlacement({ x, y: placementY });
                else onUpdateDragPos?.({ ...dragPos, x: x + 120 });
              }}
              className="w-full accent-[#ff5500] h-1 appearance-none rounded-lg cursor-pointer"
              style={{ background: `linear-gradient(to right, #2d2d30 0%, #2d2d30 ${placementXPercent}%, #ff5500 ${placementXPercent}%, #ff5500 ${placementXPercent + 1}%, #2d2d30 ${placementXPercent + 1}%, #2d2d30 100%)` }}
            />
          </label>
          <label className="grid grid-cols-[14px_1fr] items-center gap-2 text-[9px] font-bold text-gray-500">
            Y
            <input
              type="range"
              min={POSITION_Y_MIN}
              max={POSITION_Y_MAX}
              step="1"
              value={sliderY}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (onUpdatePlacement) onUpdatePlacement({ x: placementX, y });
                else onUpdateDragPos?.({ ...dragPos, y: y + 230 });
              }}
              className="w-full accent-[#ff5500] h-1 appearance-none rounded-lg cursor-pointer"
              style={{ background: `linear-gradient(to right, #2d2d30 0%, #2d2d30 ${placementYPercent}%, #ff5500 ${placementYPercent}%, #ff5500 ${placementYPercent + 1}%, #2d2d30 ${placementYPercent + 1}%, #2d2d30 100%)` }}
            />
          </label>
        </div>
      </div>

      {/* Colors row */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <span
            className="cursor-default text-[10px] font-bold text-gray-400"
            title="Double-click to reset color"
            onDoubleClick={() => onUpdate({ fontColor: DEFAULT_TEXT_SETTINGS.fontColor })}
          >
            Color
          </span>
          <div className="relative w-full h-6 rounded-lg overflow-hidden border border-[#2d2d30] cursor-pointer">
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
            className="cursor-default text-[10px] font-bold text-gray-400"
            title="Double-click to reset stroke color"
            onDoubleClick={() => onUpdate({ strokeColor: DEFAULT_TEXT_SETTINGS.strokeColor })}
          >
            Stroke
          </span>
          <div className="relative w-full h-6 rounded-lg overflow-hidden border border-[#2d2d30] cursor-pointer">
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
          className="cursor-default text-[10px] font-bold text-gray-400"
          title="Double-click to reset stroke width"
          onDoubleClick={() => onUpdate({ strokeWidth: DEFAULT_TEXT_SETTINGS.strokeWidth })}
        >
          Stroke: {strokeWidth}px
        </span>
        <input
          type="range" min="0" max="10" step="1"
          value={strokeWidth}
          onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
          className="w-full accent-[#ff5500] h-1 appearance-none rounded-lg cursor-pointer"
          style={{ background: `linear-gradient(to right, #ff5500 ${(strokeWidth / 10) * 100}%, #2d2d30 ${(strokeWidth / 10) * 100}%)` }}
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
                  ? 'bg-[#ff5500] border-[#ff5500] text-white shadow-md'
                  : 'bg-[#27272a] border-[#2d2d30] text-gray-300 hover:bg-[#3e3e42] hover:text-white'
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
