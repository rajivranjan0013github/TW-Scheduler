const MEDIA_PUBLIC_HOST = 'media.theeasypost.com';

export const shouldProxyMediaUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return false;

  try {
    return new URL(url).hostname === MEDIA_PUBLIC_HOST;
  } catch {
    return false;
  }
};

export const getProxiedMediaUrl = (url, apiBaseUrl) => {
  if (!shouldProxyMediaUrl(url)) return url || '';
  return `${apiBaseUrl}/api/media/proxy?url=${encodeURIComponent(url)}`;
};
