import { formatHandle } from '../../utils/channelOAuth';

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
export const formatRelative = (value) => {
  if (!value) return '';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let amount = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(amount) < size) return relativeTimeFormat.format(Math.round(amount), unit);
    amount /= size;
  }
  return '';
};

export const fillPreview = (text, username = 'sample_user') => (
  String(text || '').replace(/\{\{\s*username\s*\}\}/gi, `@${username}`)
);

// Instagram commenters have @handles; Facebook only exposes a display name
export const commenterLabel = (item) => item?.username || item?.name || 'Unknown user';

export const accountLabel = (account) => (account ? formatHandle(account.username) || account.name : 'Unknown account');
