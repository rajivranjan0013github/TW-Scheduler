export const getActiveCampaignId = () => localStorage.getItem('active-campaign-id') || '';

export const clearActiveCampaign = (userId = '') => {
  localStorage.removeItem('active-campaign-id');
  localStorage.removeItem('active-campaign-name');
  localStorage.removeItem('active-campaign-main-email');
  if (userId) {
    localStorage.removeItem(`active-campaign-id:${userId}`);
  }
  window.dispatchEvent(new CustomEvent('campaign-selected', {
    detail: { campaignId: '', campaignName: '', mainEmail: '' }
  }));
};

export const withCampaignScope = (baseQuery = '') => {
  const params = new URLSearchParams(baseQuery);
  const campaignId = getActiveCampaignId();
  if (campaignId) {
    params.set('campaignId', campaignId);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const invalidateAllCampaignQueries = async (queryClient, campaignId = getActiveCampaignId()) => {
  if (!queryClient) return;
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['admin'] }),
    queryClient.invalidateQueries({ queryKey: ['channels'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
    queryClient.invalidateQueries({ queryKey: ['publishedPosts'] }),
    queryClient.invalidateQueries({ queryKey: ['creator'] }),
    campaignId ? queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }) : Promise.resolve(),
  ]);
};
