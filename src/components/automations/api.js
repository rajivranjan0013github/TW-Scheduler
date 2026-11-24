import { API_BASE_URL } from '../../config';
import { withHandlerPreviewHeaders } from '../../utils/handlerPreview';
import { getActiveCampaignId } from '../../utils/campaignScope';

export const apiRequest = async (path, { method = 'GET', body, base = '/api/automations' } = {}) => {
  const token = localStorage.getItem('tw_token');
  const response = await fetch(`${API_BASE_URL}${base}${path}`, {
    method,
    headers: withHandlerPreviewHeaders({
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
};

// Every automations query key in one place. Keys are prefixes of each other on purpose:
// invalidating recentComments() also refreshes each account's list and the tab badge.
export const automationKeys = {
  accounts: () => ['automations', 'accounts'],
  rules: () => ['automations', 'rules'],
  events: () => ['automations', 'events'],
  media: (accountId) => ['automations', 'media', accountId],
  comments: (accountId, mediaId) => ['automations', 'comments', accountId, mediaId],
  recentComments: (accountId) => ['automations', 'recent-comments', ...(accountId ? [accountId] : [])],
  recentCommentsBadge: () => ['automations', 'recent-comments', 'badge'],
  conversations: (accountId) => ['automations', 'inbox', 'conversations', ...(accountId ? [accountId] : [])],
  messages: (conversationId) => ['automations', 'inbox', 'messages', conversationId],
};

// Admin panel: same request helper, pointed at the admin endpoints. Like every admin page,
// requests are scoped to the active campaign, which is added to each path as ?campaignId=.
export const adminRequest = (path, options = {}) => {
  const campaignId = getActiveCampaignId();
  const scoped = campaignId ? `${path}${path.includes('?') ? '&' : '?'}campaignId=${encodeURIComponent(campaignId)}` : path;
  return apiRequest(scoped, { ...options, base: '/api/admin/automations' });
};

// Builds "?a=1&b=2" from an object, skipping empty values
export const toQuery = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return search ? `?${search}` : '';
};

// Admin keys live under their own prefix so they never mix with a handler's cached data,
// and include the campaign so switching campaigns never shows another campaign's data.
// Invalidating adminAutomationKeys.all refreshes everything on the admin page.
export const adminAutomationKeys = {
  all: ['admin-automations'],
  accounts: (campaignId) => ['admin-automations', campaignId, 'accounts'],
  summary: (campaignId, filters) => ['admin-automations', campaignId, 'summary', filters],
  rules: (campaignId, filters) => ['admin-automations', campaignId, 'rules', filters],
  rule: (campaignId, ruleId) => ['admin-automations', campaignId, 'rule', ruleId],
  events: (campaignId, filters) => ['admin-automations', campaignId, 'events', filters],
  comments: (campaignId, filters) => ['admin-automations', campaignId, 'comments', filters],
};
