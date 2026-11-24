// Maps the OAuth scopes stored on a SocialAccount (`account.scopes`) to the
// features they unlock, so the UI can show what a user granted and what is missing.
// Keep in sync with the scopes the backend requests in routes/accounts.js and
// services/youtubeService.js.

const YT = 'https://www.googleapis.com/auth/';

const PLATFORM_FEATURES = {
  facebook: [
    { key: 'publish', label: 'Publish posts', scopes: ['pages_manage_posts'] },
    { key: 'analytics', label: 'Analytics', scopes: ['pages_read_engagement'] },
    {
      key: 'comments',
      label: 'Comments',
      scopes: ['pages_manage_engagement', 'pages_read_user_content', 'pages_manage_metadata'],
    },
    { key: 'messages', label: 'Messages', scopes: ['pages_messaging', 'pages_manage_metadata'] },
  ],
  instagram: [
    { key: 'publish', label: 'Publish posts', scopes: ['instagram_business_content_publish'] },
    { key: 'analytics', label: 'Insights', scopes: ['instagram_business_manage_insights'] },
    { key: 'comments', label: 'Comments', scopes: ['instagram_business_manage_comments'] },
    { key: 'messages', label: 'DMs', scopes: ['instagram_business_manage_messages'] },
  ],
  youtube: [
    // force-ssl is a superset of upload/readonly, so it satisfies every feature.
    { key: 'publish', label: 'Upload videos', scopes: [`${YT}youtube.upload`], alternatives: [`${YT}youtube.force-ssl`, `${YT}youtube`] },
    { key: 'analytics', label: 'Channel stats', scopes: [`${YT}youtube.readonly`], alternatives: [`${YT}youtube.force-ssl`, `${YT}youtube`] },
    { key: 'comments', label: 'Comments', scopes: [`${YT}youtube.force-ssl`], alternatives: [`${YT}youtube`] },
  ],
};

const hasFeature = (granted, feature) => (
  feature.scopes.every((scope) => granted.has(scope))
  || (feature.alternatives || []).some((scope) => granted.has(scope))
);

/**
 * Returns { known, granted: Feature[], missing: Feature[] } for an account.
 * `known` is false when the account has no recorded scopes (connected before
 * scopes were stored, or Meta's token inspection was unavailable) — in that
 * case nothing should be reported as missing.
 */
export const getChannelPermissions = (account) => {
  const features = PLATFORM_FEATURES[account?.platform] || [];
  const scopes = Array.isArray(account?.scopes) ? account.scopes.filter(Boolean) : [];
  if (features.length === 0 || scopes.length === 0) {
    return { known: false, granted: [], missing: [] };
  }
  const granted = new Set(scopes);
  return {
    known: true,
    granted: features.filter((feature) => hasFeature(granted, feature)),
    missing: features.filter((feature) => !hasFeature(granted, feature)),
  };
};
