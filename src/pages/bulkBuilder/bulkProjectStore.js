export const BULK_ROWS_STORAGE_KEY = 'tw_bulk_builder_rows';
export const BULK_ROWS_CHANGED_EVENT = 'tw:bulk-rows-changed';

export const readBulkRowsSnapshot = () => {
  try {
    const value = JSON.parse(localStorage.getItem(BULK_ROWS_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const writeBulkRowsSnapshot = (
  rows,
  { source = 'unknown', rowId = '' } = {},
) => {
  localStorage.setItem(BULK_ROWS_STORAGE_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(BULK_ROWS_CHANGED_EVENT, {
    detail: { source, rowId: String(rowId || '') },
  }));
};

export const subscribeToBulkRows = (listener) => {
  const handleCustomChange = (event) => listener(event.detail || {});
  const handleStorageChange = (event) => {
    if (event.key === BULK_ROWS_STORAGE_KEY) listener({ source: 'storage' });
  };

  window.addEventListener(BULK_ROWS_CHANGED_EVENT, handleCustomChange);
  window.addEventListener('storage', handleStorageChange);
  return () => {
    window.removeEventListener(BULK_ROWS_CHANGED_EVENT, handleCustomChange);
    window.removeEventListener('storage', handleStorageChange);
  };
};
