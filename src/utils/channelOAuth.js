import { API_BASE_URL } from '../config';
import { withHandlerPreviewHeaders } from './handlerPreview';

export const connectInstagramOAuth = async (targetCampaignId = null) => {
  const token = localStorage.getItem('tw_token');
  const returnUrl = `${window.location.origin}/auth/instagram/callback`;
  sessionStorage.setItem('instagram_oauth_redirect_uri', returnUrl);
  if (targetCampaignId) {
    sessionStorage.setItem('connect_campaign_id', targetCampaignId);
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/accounts/instagram/auth-url?redirectUri=${encodeURIComponent(returnUrl)}&campaignId=${encodeURIComponent(targetCampaignId || '')}`,
      { headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }) }
    );
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
  } catch (err) {
    console.warn('Failed to fetch Instagram auth URL from backend:', err);
  }
  window.location.assign(`${API_BASE_URL}/api/accounts/connect/instagram?campaignId=${encodeURIComponent(targetCampaignId || '')}`);
};

export const connectYoutubeOAuth = async (targetCampaignId = null) => {
  const token = localStorage.getItem('tw_token');
  const returnUrl = `${window.location.origin}/auth/youtube/callback`;
  if (targetCampaignId) {
    sessionStorage.setItem('connect_campaign_id', targetCampaignId);
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/accounts/youtube/auth-url?redirectUri=${encodeURIComponent(returnUrl)}&campaignId=${encodeURIComponent(targetCampaignId || '')}`,
      { headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }) }
    );
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
  } catch (err) {
    console.warn('Failed to fetch YouTube auth URL from backend:', err);
  }
  window.location.assign(`${API_BASE_URL}/api/accounts/connect/youtube?campaignId=${encodeURIComponent(targetCampaignId || '')}`);
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
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/accounts/facebook/auth-url?redirectUri=${encodeURIComponent(returnUrl)}&campaignId=${encodeURIComponent(targetCampaignId || '')}&reauthorizeAccountId=${encodeURIComponent(targetSocialAccountId || '')}`,
      { headers: withHandlerPreviewHeaders({ Authorization: `Bearer ${token}` }) }
    );
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
  } catch (err) {
    console.warn('Failed to fetch Facebook auth URL from backend:', err);
  }
  window.location.assign(`${API_BASE_URL}/api/accounts/connect/facebook?campaignId=${encodeURIComponent(targetCampaignId || '')}&socialAccountId=${encodeURIComponent(targetSocialAccountId || '')}`);
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
