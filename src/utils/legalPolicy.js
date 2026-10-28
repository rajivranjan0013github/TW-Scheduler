export const LEGAL_POLICY_VERSION = '2026-10-26';
export const LEGAL_POLICY_UPDATED_LABEL = 'October 26, 2026';

export const hasCurrentPolicyConsent = (user) => (
  user?.policyConsent?.version === LEGAL_POLICY_VERSION
  && Boolean(user.policyConsent.acceptedAt)
);
