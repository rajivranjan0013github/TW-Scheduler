import { getActiveCampaignId } from '../../utils/campaignScope';

export const BULK_ROWS_STORAGE_KEY = 'tw_bulk_builder_rows';
export const BULK_ROWS_CHANGED_EVENT = 'tw:bulk-rows-changed';
const LEGACY_MIGRATION_KEY = 'tw_bulk_builder_rows_migrated_campaign';

export const getBulkRowsStorageKey = (campaignId = getActiveCampaignId()) => (
  `${BULK_ROWS_STORAGE_KEY}:${campaignId || 'none'}`
);

const readStoredRowsValue = (campaignId) => {
  const storageKey = getBulkRowsStorageKey(campaignId);
  const scopedValue = localStorage.getItem(storageKey);
  if (scopedValue !== null) return scopedValue;

  // Preserve an existing pre-campaign board once, without copying it into every campaign.
  const legacyValue = localStorage.getItem(BULK_ROWS_STORAGE_KEY);
  const migratedCampaignId = localStorage.getItem(LEGACY_MIGRATION_KEY);
  if (legacyValue !== null && !migratedCampaignId && campaignId) {
    localStorage.setItem(storageKey, legacyValue);
    localStorage.setItem(LEGACY_MIGRATION_KEY, campaignId);
    return legacyValue;
  }
  return '[]';
};

export const readBulkRowsSnapshot = (campaignId = getActiveCampaignId()) => {
  try {
    const value = JSON.parse(readStoredRowsValue(campaignId));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const writeBulkRowsSnapshot = (
  rows,
  { source = 'unknown', rowId = '', campaignId = getActiveCampaignId() } = {},
) => {
  localStorage.setItem(getBulkRowsStorageKey(campaignId), JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(BULK_ROWS_CHANGED_EVENT, {
    detail: { source, rowId: String(rowId || ''), campaignId },
  }));
};

export const subscribeToBulkRows = (
  listener,
  { campaignId = getActiveCampaignId() } = {},
) => {
  const storageKey = getBulkRowsStorageKey(campaignId);
  const handleCustomChange = (event) => {
    if (String(event.detail?.campaignId || '') !== String(campaignId || '')) return;
    listener(event.detail || {});
  };
  const handleStorageChange = (event) => {
    if (event.key === storageKey) listener({ source: 'storage', campaignId });
  };

  window.addEventListener(BULK_ROWS_CHANGED_EVENT, handleCustomChange);
  window.addEventListener('storage', handleStorageChange);
  return () => {
    window.removeEventListener(BULK_ROWS_CHANGED_EVENT, handleCustomChange);
    window.removeEventListener('storage', handleStorageChange);
  };
};
