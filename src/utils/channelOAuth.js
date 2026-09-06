import { API_BASE_URL } from '../config';
import { withHandlerPreviewHeaders } from './handlerPreview';

const requestOAuthRedirect = async (url, token, provider) => {
  try {
    const response = await fetch(url, {
      headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.url) {
      throw new Error(data.message || `Unable to start ${provider} authorization.`);
    }
    window.location.assign(data.url);
  } catch (error) {
    console.error(`${provider} authorization failed:`, error);
    window.alert(error.message || `Unable to start ${provider} authorization.`);
  }
};

export const connectInstagramOAuth = async (targetCampaignId = null) => {
  const token = localStorage.getItem('tw_token');
  const returnUrl = `${window.location.origin}/auth/instagram/callback`;
  sessionStorage.setItem('instagram_oauth_redirect_uri', returnUrl);
  if (targetCampaignId) {
    sessionStorage.setItem('connect_campaign_id', targetCampaignId);
  }
  return requestOAuthRedirect(
    `${API_BASE_URL}/api/accounts/instagram/auth-url?redirectUri=${encodeURIComponent(returnUrl)}&campaignId=${encodeURIComponent(targetCampaignId || '')}`,
    token,
    'Instagram',
  );
};

export const connectYoutubeOAuth = async (targetCampaignId = null) => {
  const token = localStorage.getItem('tw_token');
  const returnUrl = `${window.location.origin}/auth/youtube/callback`;
  if (targetCampaignId) {
    sessionStorage.setItem('connect_campaign_id', targetCampaignId);
  }
  return requestOAuthRedirect(
    `${API_BASE_URL}/api/accounts/youtube/auth-url?redirectUri=${encodeURIComponent(returnUrl)}&campaignId=${encodeURIComponent(targetCampaignId || '')}`,
    token,
    'YouTube',
  );
};

export const connectMetaOAuth = async (targetCampaignId = null, targetSocialAccountId = null) => {
  const token = localStorage.getItem('tw_token');
  const returnUrl = `${window.location.origin}/auth/facebook/callback`;
  if (targetCampaignId) {
    sessionStorage.setItem('connect_campaign_id', targetCampaignId);
  }
  if (targetSocialAccountId) {
    sessionStorage.setItem('reauthorize_account_id', targetSocialAccountId);
  }
  return requestOAuthRedirect(
    `${API_BASE_URL}/api/accounts/facebook/auth-url?redirectUri=${encodeURIComponent(returnUrl)}&campaignId=${encodeURIComponent(targetCampaignId || '')}&reauthorizeAccountId=${encodeURIComponent(targetSocialAccountId || '')}`,
    token,
    'Facebook',
  );
};

export const formatHandle = (handle) => {
  if (!handle) return '';
  const clean = String(handle).trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
};

export const getStatusBadgeClasses = (status) => {
  if (status === 'verified') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'disconnected') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
};

export const getStatusLabel = (status) => {
  if (status === 'verified') return 'Connected';
  if (status === 'disconnected') return 'Disconnected';
  return 'Pending verification';
};
