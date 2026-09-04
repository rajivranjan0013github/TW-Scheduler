export const getDirectMediaUrl = (url, apiBaseUrl = '') => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('/') && apiBaseUrl) {
    return `${apiBaseUrl.replace(/\/+$/, '')}${url}`;
  }
  return url;
};

export const getMediaProxyUrl = (url, apiBaseUrl = '') => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.includes('/api/media/proxy')) return url;
  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/api/media/proxy?url=${encodeURIComponent(url)}`;
};

export const getMediaUrl = (url, { proxy = false, apiBaseUrl = '' } = {}) => {
  if (!url) return '';
  if (proxy) return getMediaProxyUrl(url, apiBaseUrl);
  return getDirectMediaUrl(url, apiBaseUrl);
};
