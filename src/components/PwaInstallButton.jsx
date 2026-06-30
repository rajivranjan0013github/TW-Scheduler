import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

export const PwaInstallButton = ({
  collapsed = false,
  dark = false,
  className = '',
  popoverClassName = '',
}) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { canInstall, install, isIOS, shouldShowInstall } = usePwaInstallPrompt();

  if (!shouldShowInstall) return null;

  const handleInstallClick = async () => {
    if (canInstall) {
      const didInstall = await install();
      if (didInstall) return;
    }

    setIsHelpOpen(true);
  };

  const helpText = isIOS
    ? 'On iPhone or iPad, open this in Safari, tap the Share button, then choose Add to Home Screen.'
    : 'If the install prompt does not open, use your browser menu and choose Install Easy Post or Add to Home Screen.';

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`flex items-center justify-center gap-2 rounded-md border text-xs font-semibold transition ${
          collapsed ? 'h-8 w-8 p-0' : 'w-full px-2.5 py-1.5'
        } ${
          dark
            ? 'border-white/10 bg-white/5 text-[#cbd5e1] hover:bg-white/10 hover:text-white'
            : 'border-[#d2d2d7] bg-white text-[#1d1d1f] hover:border-[#a1a1aa] hover:bg-[#f8fafc]'
        }`}
        title="Install Easy Post"
      >
        <Download className="h-3.5 w-3.5 flex-shrink-0" />
        {!collapsed && <span>Install App</span>}
      </button>

      {isHelpOpen && (
        <div className={`absolute bottom-full z-50 mb-2 w-60 rounded-lg border p-3 text-left shadow-xl ${
          dark
            ? 'border-white/10 bg-[#0f172a] text-[#e5e7eb] shadow-black/30'
            : 'border-[#e5e5ea] bg-white text-[#1d1d1f] shadow-black/10'
        } ${popoverClassName}`}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="m-0 text-xs font-bold">Install Easy Post</p>
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className={`rounded p-0.5 transition ${dark ? 'hover:bg-white/10' : 'hover:bg-[#f5f5f7]'}`}
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className={`m-0 text-[11px] leading-relaxed ${dark ? 'text-[#cbd5e1]' : 'text-[#4b5563]'}`}>
            {helpText}
          </p>
        </div>
      )}
    </div>
  );
};
