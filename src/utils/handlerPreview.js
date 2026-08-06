export const getHandlerPreviewContext = () => {
  try {
    const context = JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    return context?.viewAs === 'account_handler' && context?.userId ? context : null;
  } catch {
    return null;
  }
};

export const withHandlerPreviewHeaders = (headers = {}, context = getHandlerPreviewContext()) => ({
  ...headers,
  ...(context?.userId ? { 'X-Handler-Preview-User-Id': context.userId } : {}),
});
