export const getActiveCampaignId = () => localStorage.getItem('active-campaign-id') || '';

export const withCampaignScope = (baseQuery = '') => {
  const params = new URLSearchParams(baseQuery);
  const campaignId = getActiveCampaignId();
  if (campaignId) {
    params.set('campaignId', campaignId);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
};
