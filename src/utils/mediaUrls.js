export const getDirectMediaUrl = (url) => url || '';

export const getMediaProxyUrl = (url, apiBaseUrl) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  return `${apiBaseUrl}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

export const getMediaUrl = (url, { proxy = false, apiBaseUrl = '' } = {}) => (
  proxy ? getMediaProxyUrl(url, apiBaseUrl) : getDirectMediaUrl(url)
);
