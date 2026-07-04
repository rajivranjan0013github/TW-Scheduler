import instagramIcon from '../assets/platforms/instagram.png';
import facebookIcon from '../assets/platforms/facebook.png';
import tiktokIcon from '../assets/platforms/tiktok.png';
import youtubeIcon from '../assets/platforms/youtube.png';

const platformIcons = {
  instagram: instagramIcon,
  facebook: facebookIcon,
  tiktok: tiktokIcon,
  youtube: youtubeIcon,
};

const platformLabels = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const PlatformIcon = ({ platform, className = 'h-4 w-4', title, showFallback = true }) => {
  const normalizedPlatform = String(platform || '').toLowerCase();
  const icon = platformIcons[normalizedPlatform];
  const label = title || platformLabels[normalizedPlatform] || platform || 'Platform';

  if (!icon) {
    if (!showFallback) return null;
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full bg-slate-200 text-[9px] font-black uppercase text-slate-500`}
        title={label}
        aria-label={label}
      >
        {(label || '?').slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={icon}
      alt={label}
      title={label}
      className={`${className} inline-block shrink-0 object-contain`}
      loading="lazy"
    />
  );
};

export default PlatformIcon;
