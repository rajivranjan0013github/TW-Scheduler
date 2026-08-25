const AUDIO_REQUEST_PATTERN = /\b(?:audio|music|soundtrack|songs?|tracks?|bgm)\b/i;
const AUDIO_DISABLE_PATTERN = /\bwithout\s+(?:any\s+)?(?:audio|music|soundtrack|songs?|tracks?|bgm)\b|\bno\s+(?:any\s+)?(?:audio|music|soundtrack|songs?|tracks?|bgm)\b(?!\s+(?:repeats?|reuse|duplicates?|repetitions?)\b)|\b(?:do\s+not|don't|dont)\s+(?:add|use|include|attach)\s+(?:any\s+)?(?:audio|music|soundtrack|songs?|tracks?|bgm)\b|\b(?:mute|muted|silent)\b/i;
const AUDIO_CLEAR_PATTERN = /\b(?:remove|clear|delete)\s+(?:the\s+)?(?:audio|music|soundtrack|songs?|tracks?|bgm)\b/i;
const AUDIO_FOLDER_NAME_PATTERN = /(?:^|[^a-z0-9])(?:audios?|music|songs?|sounds?)(?:$|[^a-z0-9])/i;

export const messageRequestsAudio = (message, mentions = []) => {
  let normalizedMessage = String(message || '').toLowerCase();
  let searchFrom = 0;
  (mentions || []).forEach((mention) => {
    const token = `@${String(mention?.name || '').toLowerCase()}`;
    if (token.length <= 1) return;
    let position = normalizedMessage.indexOf(token, searchFrom);
    if (position < 0) position = normalizedMessage.indexOf(token);
    if (position < 0) return;
    normalizedMessage = `${normalizedMessage.slice(0, position)}${' '.repeat(token.length)}${normalizedMessage.slice(position + token.length)}`;
    searchFrom = position + token.length;
  });
  return AUDIO_REQUEST_PATTERN.test(normalizedMessage)
    && !AUDIO_DISABLE_PATTERN.test(normalizedMessage)
    && !AUDIO_CLEAR_PATTERN.test(normalizedMessage);
};

const isExplicitAudioRole = ({ indicator, position, tokenEnd, clauseStart, clauseEnd, message }) => {
  if (indicator.role !== 'audio') return true;
  const linkText = indicator.end <= position
    ? message.slice(indicator.end, position)
    : message.slice(tokenEnd, indicator.start);
  const isLinked = indicator.end <= position
    ? /^\s*(?:from|using)\s*$/i.test(linkText)
    : /^\s*(?:as|using)\s+(?:(?:the|a|an|background)\s+)*$/i.test(linkText);
  if (isLinked) return true;

  // An adjacent noun label such as "@Music audio folder" is explicit, while
  // generic instructions such as "@Videos with music" describe an additional
  // output requirement and must not turn the video folder into an audio source.
  const beforeMention = message.slice(clauseStart, position);
  const afterMention = message.slice(tokenEnd, clauseEnd);
  return /\b(?:audio|music|soundtrack|songs?|tracks?)\s+(?:folder|source)\s*$/i.test(beforeMention)
    || /^\s*(?:audio|music|soundtrack|songs?|tracks?)\s+(?:folder|source)\b/i.test(afterMention);
};

export const deriveMentionRoles = (message, mentions) => {
  const normalizedMessage = String(message || '').toLowerCase();
  let searchFrom = 0;
  const positionedMentions = (mentions || []).map((mention) => {
    const token = `@${String(mention.name || '').toLowerCase()}`;
    let position = normalizedMessage.indexOf(token, searchFrom);
    if (position < 0) position = normalizedMessage.indexOf(token);
    if (position >= 0) searchFrom = position + token.length;
    return { mention, token, position, end: position >= 0 ? position + token.length : -1 };
  });
  const roleIndicators = [];
  [
    ['audio', /\b(audio|music|soundtrack|songs?|tracks?)\b/g],
    ['secondary', /\b(second|secondary|video\s*2|v2|second\s+video)\b/g],
    ['primary', /\b(first|primary|video\s*1|v1|first\s+video)\b/g],
  ].forEach(([role, pattern]) => {
    for (const match of normalizedMessage.matchAll(pattern)) {
      const start = match.index;
      const end = match.index + match[0].length;
      const isInsideMention = positionedMentions.some((item) => (
        item.position >= 0 && start < item.end && end > item.position
      ));
      if (!isInsideMention) roleIndicators.push({ role, start, end });
    }
  });
  const clauseBoundaries = Array.from(normalizedMessage.matchAll(/[,;.\n]|\s+and\s+/g)).map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  return positionedMentions.map(({ mention, token, position }) => {
    let role = mention.role || 'unspecified';
    if (position >= 0) {
      const tokenEnd = position + token.length;
      const clauseStart = clauseBoundaries
        .filter((boundary) => boundary.end <= position)
        .at(-1)?.end || 0;
      const clauseEnd = clauseBoundaries
        .find((boundary) => boundary.start >= tokenEnd)?.start || normalizedMessage.length;
      const localIndicators = roleIndicators.filter((indicator) => (
        indicator.start >= clauseStart
        && indicator.end <= clauseEnd
        && isExplicitAudioRole({
          indicator,
          position,
          tokenEnd,
          clauseStart,
          clauseEnd,
          message: normalizedMessage,
        })
      ));
      const nearest = localIndicators
        .map((indicator) => ({
          ...indicator,
          distance: indicator.end <= position
            ? position - indicator.end
            : indicator.start >= tokenEnd
              ? indicator.start - tokenEnd
              : 0,
        }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (nearest) role = nearest.role;
    }
    return { folderId: mention.folderId, name: mention.name, role };
  });
};

const isAudioCapableFolder = (folder, foldersById, visited = new Set()) => {
  if (!folder) return false;
  const folderId = String(folder?._id || folder?.id || '');
  if (folderId && visited.has(folderId)) return false;
  if (folderId) visited.add(folderId);
  const tags = Array.isArray(folder.tags)
    ? folder.tags.map((tag) => String(tag || '').toLowerCase())
    : [];
  const counts = folder.typeCounts || {};
  const audioCount = Number(counts.audio ?? folder.audioCount ?? 0);
  const videoCount = Number(counts.video ?? folder.videoCount ?? 0);
  const hasMediaEvidence = Object.hasOwn(counts, 'audio')
    || Object.hasOwn(counts, 'video')
    || folder.audioCount !== undefined
    || folder.videoCount !== undefined;
  if (hasMediaEvidence && audioCount > 0) return true;
  if (hasMediaEvidence && videoCount > 0) return false;
  if (tags.includes('audio')
    || tags.includes('music')
    || AUDIO_FOLDER_NAME_PATTERN.test(String(folder.name || ''))) return true;
  const parentId = String(folder.parentFolderId?._id || folder.parentFolderId || '');
  return parentId
    ? isAudioCapableFolder(foldersById?.get(parentId), foldersById, visited)
    : false;
};

export const shouldShowDefaultAudioHint = ({ message, mentions = [], folders = [] } = {}) => {
  if (!messageRequestsAudio(message, mentions)) return false;
  if (deriveMentionRoles(message, mentions).some((mention) => mention.role === 'audio')) return false;
  const foldersById = new Map((folders || []).map((folder) => [
    String(folder?._id || folder?.id || ''),
    folder,
  ]));
  return !(mentions || []).some((mention) => (
    isAudioCapableFolder(foldersById.get(String(mention?.folderId || '')), foldersById)
  ));
};
