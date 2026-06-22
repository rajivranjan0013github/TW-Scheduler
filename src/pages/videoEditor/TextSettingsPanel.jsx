import { useState } from 'react';
import { Music, Type, Palette } from 'lucide-react';
import { FONT_WEIGHTS } from './videoEditorConstants';

/**
 * Right column panel — Condensed with tabs to minimize vertical height.
 * Houses Font settings, Style/Bg details, and Audio chooser trigger.
 */
export const TextSettingsPanel = ({
  // Audio
  selectedAudio,
  onOpenAudioDialog,
  onClearAudio,
  // Font
  fontFamily,
  onFontFamilyChange,
  fontWeight,
  onFontWeightChange,
  fontSize,
  onFontSizeChange,
  fontColor,
  onFontColorChange,
  // Stroke
  strokeWidth,
  onStrokeWidthChange,
  strokeColor,
  onStrokeColorChange,
  // Background
  bgType,
  onBgTypeChange,
  bgColor,
  onBgColorChange,
}) => {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'style' | 'audio'
  const weightSliderValue = FONT_WEIGHTS.indexOf(fontWeight);

  const handleWeightSliderChange = (e) => {
    const val = Number(e.target.value);
    onFontWeightChange(FONT_WEIGHTS[val]);
  };

  const handleBgTypeClick = (type) => {
    onBgTypeChange(type);
    if (type === 'White') onBgColorChange('#FFFFFF');
    else if (type === 'Snapchat') onBgColorChange('#000000');
  };

  return (
    <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm select-none max-h-[580px] flex flex-col">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-100 pb-2 mb-3.5">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-[9px] ${
            activeTab === 'text'
              ? 'border-[#ff5500] text-[#ff5500]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Type className="h-3 w-3" />
          Text
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('style')}
          className={`flex-1 py-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-[9px] ${
            activeTab === 'style'
              ? 'border-[#ff5500] text-[#ff5500]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Palette className="h-3 w-3" />
          Style
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-[9px] ${
            activeTab === 'audio'
              ? 'border-[#ff5500] text-[#ff5500]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Music className="h-3 w-3" />
          Audio
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto pr-0.5">
        {activeTab === 'audio' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">Audio Settings</label>
              <button
                type="button"
                onClick={onOpenAudioDialog}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white py-2 px-3 text-left text-xs font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.99]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Music className="h-4 w-4 flex-shrink-0 text-[#ff5500]" />
                  <span className="truncate">{selectedAudio ? selectedAudio.name : 'Swap audio'}</span>
                </span>
                <span className="text-[10px] font-bold uppercase text-gray-400">Choose</span>
              </button>
              {selectedAudio && (
                <button
                  type="button"
                  onClick={onClearAudio}
                  className="text-[10px] font-semibold text-gray-500 underline hover:text-black"
                >
                  Use original video audio
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3.5">
            {/* Font Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">Font Family</label>
              <div className="relative">
                <select
                  value={fontFamily}
                  onChange={(e) => onFontFamilyChange(e.target.value)}
                  className="w-full text-xs font-medium border border-gray-200 rounded-xl py-2 px-3 bg-white outline-none cursor-pointer appearance-none"
                >
                  <option value="TikTok Sans">TikTok Sans</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Impact">Impact</option>
                  <option value="Arial">Arial</option>
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Font Weight Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span>Weight: {fontWeight}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={weightSliderValue}
                onChange={handleWeightSliderChange}
                className="w-full accent-[#ff5500] bg-gray-100 rounded-lg cursor-pointer h-1.5 appearance-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${(weightSliderValue / 5) * 100}%, #f3f4f6 ${(weightSliderValue / 5) * 100}%, #f3f4f6 100%)`
                }}
              />
            </div>

            {/* Font Size Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span>Size: {fontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="72"
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="w-full accent-[#ff5500] bg-gray-100 rounded-lg cursor-pointer h-1.5 appearance-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${((fontSize - 12) / 60) * 100}%, #f3f4f6 ${((fontSize - 12) / 60) * 100}%, #f3f4f6 100%)`
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'style' && (
          <div className="space-y-3.5">
            {/* Text Color */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">Text Color</label>
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={fontColor.toLowerCase()}
                    onChange={(e) => onFontColorChange(e.target.value.toUpperCase())}
                    className="absolute inset-[-4px] w-[50px] h-[50px] border-0 p-0 cursor-pointer"
                  />
                  <div className="absolute inset-0 border border-white rounded-lg pointer-events-none"></div>
                </div>
                <input
                  type="text"
                  value={fontColor}
                  onChange={(e) => onFontColorChange(e.target.value.toUpperCase())}
                  className="w-full text-xs font-semibold bg-gray-100 border border-transparent rounded-xl py-2 px-3 outline-none uppercase tracking-wide text-gray-700"
                />
              </div>
            </div>

            {/* Stroke Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span>Stroke: {strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                className="w-full accent-[#ff5500] bg-gray-100 rounded-lg cursor-pointer h-1.5 appearance-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${(strokeWidth / 10) * 100}%, #f3f4f6 ${(strokeWidth / 10) * 100}%, #f3f4f6 100%)`
                }}
              />
            </div>

            {/* Stroke Color */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">Stroke Color</label>
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={strokeColor.toLowerCase()}
                    onChange={(e) => onStrokeColorChange(e.target.value.toUpperCase())}
                    className="absolute inset-[-4px] w-[50px] h-[50px] border-0 p-0 cursor-pointer"
                  />
                  <div className="absolute inset-0 border border-white rounded-lg pointer-events-none"></div>
                </div>
                <input
                  type="text"
                  value={strokeColor}
                  onChange={(e) => onStrokeColorChange(e.target.value.toUpperCase())}
                  className="w-full text-xs font-semibold bg-gray-100 border border-transparent rounded-xl py-2 px-3 outline-none uppercase tracking-wide text-gray-700"
                />
              </div>
            </div>

            {/* Background */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">Background</label>
              <div className="flex gap-2">
                {['White', 'None', 'Snapchat'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleBgTypeClick(type)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                      bgType === type
                        ? 'bg-[#ff5500] border-[#ff5500] text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Background Color */}
              <div className={`pt-1.5 transition-all duration-200 ${bgType === 'None' ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer">
                    <input
                      type="color"
                      disabled={bgType === 'None'}
                      value={bgColor.toLowerCase()}
                      onChange={(e) => onBgColorChange(e.target.value.toUpperCase())}
                      className="absolute inset-[-4px] w-[50px] h-[50px] border-0 p-0 cursor-pointer"
                    />
                    <div className="absolute inset-0 border border-white rounded-lg pointer-events-none"></div>
                  </div>
                  <input
                    type="text"
                    disabled={bgType === 'None'}
                    value={bgType === 'None' ? 'None' : bgColor}
                    onChange={(e) => onBgColorChange(e.target.value.toUpperCase())}
                    className="w-full text-xs font-semibold bg-gray-100 border border-transparent rounded-xl py-2 px-3 outline-none uppercase tracking-wide text-gray-700"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
