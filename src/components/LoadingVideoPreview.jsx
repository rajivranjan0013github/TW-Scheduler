import { forwardRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const LoadingVideoPreview = forwardRef(({
  src,
  className = 'h-full w-full',
  videoClassName = 'h-full w-full object-cover',
  loadingLabel = 'Loading video',
  waitForLoadedData = false,
  onLoadedMetadata,
  onLoadedData,
  onError,
  crossOrigin,
  ...videoProps
}, ref) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useProxyFallback, setUseProxyFallback] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setUseProxyFallback(false);
  }, [src]);

  const isBlobOrData = typeof src === 'string' && (src.startsWith('blob:') || src.startsWith('data:'));
  const effectiveCrossOrigin = isBlobOrData ? undefined : crossOrigin;

  const effectiveSrc = useProxyFallback && src && !src.startsWith('blob:') && !src.startsWith('data:') && !src.includes('/api/media/proxy')
    ? `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(src)}`
    : src;

  const handleLoaded = (event, callback) => {
    setLoaded(true);
    setFailed(false);
    callback?.(event);
  };

  const handleError = (event) => {
    if (!useProxyFallback && src && !src.startsWith('blob:') && !src.startsWith('data:') && !src.includes('/api/media/proxy')) {
      setUseProxyFallback(true);
      return;
    }
    setFailed(true);
    setLoaded(false);
    onError?.(event);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        ref={ref}
        {...videoProps}
        crossOrigin={effectiveCrossOrigin}
        src={effectiveSrc}
        className={videoClassName}
        onLoadedMetadata={(event) => {
          onLoadedMetadata?.(event);
          if (!waitForLoadedData) handleLoaded(event);
        }}
        onLoadedData={(event) => handleLoaded(event, onLoadedData)}
        onCanPlay={(event) => handleLoaded(event)}
        onError={handleError}
      />
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden bg-zinc-900">
          <div className="absolute inset-0 video-preview-flow" />
          <div className="relative z-[2] flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/85">
            {failed ? (
              <span>Video unavailable</span>
            ) : (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{loadingLabel}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

LoadingVideoPreview.displayName = 'LoadingVideoPreview';

export default LoadingVideoPreview;

