import { forwardRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingVideoPreview = forwardRef(({
  src,
  className = 'h-full w-full',
  videoClassName = 'h-full w-full object-cover',
  loadingLabel = 'Loading video',
  onLoadedMetadata,
  onLoadedData,
  onError,
  ...videoProps
}, ref) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const handleLoaded = (event, callback) => {
    setLoaded(true);
    setFailed(false);
    callback?.(event);
  };

  const handleError = (event) => {
    setFailed(true);
    setLoaded(false);
    onError?.(event);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        ref={ref}
        {...videoProps}
        src={src}
        className={videoClassName}
        onLoadedMetadata={(event) => handleLoaded(event, onLoadedMetadata)}
        onLoadedData={(event) => handleLoaded(event, onLoadedData)}
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
