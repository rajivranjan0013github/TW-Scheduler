export const VIDEO_FORMAT_TYPES = {
  reaction_showcase: {
    id: 'reaction_showcase',
    label: 'Influencer Reaction + App Showcase',
    aspectRatio: '9:16',
    badge: 'Reaction Hook',
    tagBg: 'bg-white/10 text-white border-white/20',
    shortDesc: '0-2s creator reaction hook cut directly into live app UI walkthrough and CTA.',
  },
  split_screen: {
    id: 'split_screen',
    label: 'Split-Screen Reaction & UI',
    aspectRatio: '9:16',
    badge: '60/40 Split',
    tagBg: 'bg-white/10 text-white border-white/20',
    shortDesc: 'Top creator facecam reaction paired with bottom live app walkthrough.',
  },
  carousel: {
    id: 'carousel',
    label: 'Multi-Slide Carousel',
    aspectRatio: '4:5 / 1:1',
    badge: '5 Slides',
    tagBg: 'bg-white/10 text-white border-white/20',
    shortDesc: 'Swipeable pain-point hook leading to step-by-step screenshots and CTA.',
  },
  teardown: {
    id: 'teardown',
    label: '7s Feature Teardown',
    aspectRatio: '9:16',
    badge: '7s Fast Cut',
    tagBg: 'bg-white/10 text-white border-white/20',
    shortDesc: 'Fast 7-second aesthetic cut highlighting one killer feature.',
  },
  pov: {
    id: 'pov',
    label: 'Relatable POV Reel',
    aspectRatio: '9:16',
    badge: 'POV Reel',
    tagBg: 'bg-white/10 text-white border-white/20',
    shortDesc: 'Relatable POV hook with realistic everyday scenario and product flow.',
  },
  custom: {
    id: 'custom',
    label: 'Custom Video Blueprint',
    aspectRatio: '9:16',
    badge: 'Custom',
    tagBg: 'bg-white/10 text-white border-white/20',
    shortDesc: 'Custom short-form video directive for this product.',
  },
};

export const REACTION_HOOK_PRESETS = [
  {
    label: 'Shocked Reaction',
    tag: 'Influencer Reaction + App Showcase',
    body: '0-2s shocked creator reaction hook ("Wait, did this app actually just do that?!") → 3-7s live screen recording demonstrating the core feature → CTA',
  },
  {
    label: 'Relatable Frustration',
    tag: 'Influencer Reaction + App Showcase',
    body: '0-2s creator facepalm reaction ("Why did nobody tell me about this app sooner?") → 3-6s instant app solution walkthrough → CTA',
  },
  {
    label: 'Split-Screen Facecam + UI',
    tag: 'Split-Screen Reaction & UI',
    body: 'Top 60% creator live reaction & commentary + Bottom 40% live app UI walkthrough in real-time',
  },
  {
    label: 'Skeptic Test Reaction',
    tag: 'Influencer Reaction + App Showcase',
    body: '0-2s creator skeptic reaction ("Testing if this app is actually worth the hype...") → 3-7s impressive result walkthrough → payoff',
  },
  {
    label: 'Green Screen Breakdown',
    tag: 'Influencer Reaction + App Showcase',
    body: 'Creator green-screen overlay over live app screen reacting to results and pointing out killer features',
  },
];

export const parseVideoFormat = (formatString = '') => {
  const str = String(formatString || '').trim();
  const match = str.match(/^\[(.*?)\]\s*(.*)$/);
  const tag = match ? match[1].trim() : '';
  const text = match ? match[2].trim() : str;
  const lower = (tag || str).toLowerCase();

  let type = 'custom';
  if (lower.includes('reaction') || lower.includes('influencer') || lower.includes('creator hook')) {
    type = 'reaction_showcase';
  } else if (lower.includes('split') || lower.includes('dual')) {
    type = 'split_screen';
  } else if (lower.includes('carousel') || lower.includes('slide') || lower.includes('swipe')) {
    type = 'carousel';
  } else if (lower.includes('7s') || lower.includes('teardown') || lower.includes('fast') || lower.includes('cut')) {
    type = 'teardown';
  } else if (lower.includes('pov') || lower.includes('reel') || lower.includes('relatable') || lower.includes('story')) {
    type = 'pov';
  }

  const meta = VIDEO_FORMAT_TYPES[type] || VIDEO_FORMAT_TYPES.custom;

  return {
    raw: str,
    tag: tag || meta.label,
    body: text,
    type,
    meta,
  };
};

export const formatBlueprintString = (tag, body) => {
  const cleanTag = String(tag || '').trim().replace(/^\[|\]$/g, '');
  const cleanBody = String(body || '').trim();
  if (!cleanTag) return cleanBody;
  return `[${cleanTag}] ${cleanBody}`;
};
