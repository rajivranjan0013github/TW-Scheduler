import { TRACK_TYPES } from './projectConstants.js';
import {
  clampNumber,
  createAudioClip,
  createEditorProject,
  createTextClip,
  createTrack,
  createVideoClip,
  deserializeProject,
  normalizeProject,
  sanitizeJsonValue,
} from './projectModel.js';
import {
  getAllClips,
  getPrimaryTrackByType,
  sortClipsByTimeline,
} from './projectUtils.js';
import {
  getClampedDragPos,
  getOverlayTextHeight,
  getOverlayTextWidth,
} from '../../videoEditor/videoEditorUtils.js';

const LEGACY_PREVIEW_WIDTH = 270;
const LEGACY_PREVIEW_HEIGHT = 480;
const LEGACY_OUTPUT = Object.freeze({
  width: 720,
  height: 1280,
  fps: 30,
  maxDuration: 30,
  backgroundColor: '#000000',
});

const LEGACY_DEFAULT_TEXT_SETTINGS = Object.freeze({
  fontFamily: 'TikTok Sans',
  fontWeight: 'Regular',
  fontSize: 15,
  fontColor: '#FFFFFF',
  strokeWidth: 3,
  strokeColor: '#000000',
  bgType: 'None',
  bgColor: '#000000',
});

const LEGACY_DEFAULT_DRAG_POS = Object.freeze({ x: 20, y: 220 });
const LEGACY_TEXT_LINE_HEIGHT = 1.3;
const LEGACY_TEXT_HORIZONTAL_PADDING = 6;
const LEGACY_TEXT_VERTICAL_PADDING = 3;
const BULK_TEXT_GEOMETRY_VERSION = 1;
const GEOMETRY_EPSILON = 0.0001;
const BULK_DURATION_EPSILON = 0.001;
const BULK_MIN_CLIP_DURATION = 0.1;
const BULK_CONTENT_FIELDS = Object.freeze([
  'video1',
  'video1Url',
  'video2',
  'video2Url',
  'caption',
  'textSettings',
  'dragPos',
  'audio',
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const pickBulkContentFields = (value = {}) => BULK_CONTENT_FIELDS.reduce((result, key) => {
  if (hasOwn(value, key)) result[key] = value[key];
  return result;
}, {});

const mergeBulkRowValues = (existingRow = {}, patch = {}) => {
  const merged = { ...existingRow, ...patch };
  ['video1', 'video2'].forEach((slot) => {
    const urlKey = `${slot}Url`;
    if (hasOwn(patch, slot) && !hasOwn(patch, urlKey)) {
      merged[urlKey] = patch[slot]?.url || '';
    } else if (hasOwn(patch, urlKey) && !hasOwn(patch, slot) && !patch[urlKey]) {
      merged[slot] = null;
    }
  });
  if (hasOwn(patch, 'textSettings')) {
    merged.textSettings = {
      ...(existingRow.textSettings || {}),
      ...(patch.textSettings || {}),
    };
  }
  if (hasOwn(patch, 'dragPos')) {
    merged.dragPos = {
      ...(existingRow.dragPos || {}),
      ...(patch.dragPos || {}),
    };
  }
  if (
    hasOwn(patch, 'audio')
    && patch.audio
    && typeof patch.audio === 'object'
    && existingRow.audio
    && typeof existingRow.audio === 'object'
  ) {
    merged.audio = { ...existingRow.audio, ...patch.audio };
    if (
      (hasOwn(patch.audio, 'id') || hasOwn(patch.audio, '_id'))
      && !hasOwn(patch.audio, 'mediaId')
    ) {
      delete merged.audio.mediaId;
    }
  }
  return merged;
};

const comparableJson = (value) => JSON.stringify(sanitizeJsonValue(value));

const bulkContentChanged = (existingRow, patch) => {
  const merged = mergeBulkRowValues(existingRow, patch);
  return BULK_CONTENT_FIELDS.some((key) => (
    comparableJson(existingRow?.[key]) !== comparableJson(merged[key])
  ));
};

const LEGACY_TO_EDITOR_FONT = Object.freeze({
  'TikTok Sans': 'Outfit',
  Roboto: 'Roboto',
  Impact: 'Anton',
  Arial: 'Arimo',
});

const EDITOR_TO_LEGACY_FONT = Object.freeze({
  Outfit: 'TikTok Sans',
  Roboto: 'Roboto',
  Anton: 'Impact',
  Arimo: 'Arial',
});

const NAMED_FONT_WEIGHTS = Object.freeze({
  Thin: 100,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
});

const toLegacyFontWeight = (value) => {
  if (typeof value === 'string' && Number.isNaN(Number(value))) return value;
  const numeric = Number(value) || 400;
  return Object.entries(NAMED_FONT_WEIGHTS).reduce((closest, entry) => (
    Math.abs(entry[1] - numeric) < Math.abs(closest[1] - numeric) ? entry : closest
  ), ['Regular', 400])[0];
};

const toId = (value) => {
  const id = value?._id ?? value?.id ?? value?.mediaId ?? value;
  return id === null || id === undefined ? '' : String(id);
};

const getKnownMediaDuration = (media, explicitDuration) => {
  const candidates = [
    explicitDuration,
    media?.duration,
    media?.sourceDuration,
    media?.videoDuration,
    media?.metadata?.duration,
  ];
  const duration = candidates.map(Number).find((value) => Number.isFinite(value) && value > 0);
  return duration || 0;
};

const getMediaDuration = (media, explicitDuration, fallbackDuration) => (
  getKnownMediaDuration(media, explicitDuration) || fallbackDuration
);

const getDurationOption = (options, slot) => {
  const durations = options.videoDurations;
  if (Array.isArray(durations)) return durations[slot === 'video1' ? 0 : 1];
  if (!durations || typeof durations !== 'object') return undefined;
  return durations[slot]
    ?? durations[slot === 'video1' ? 'input1' : 'input2']
    ?? durations[slot === 'video1' ? 0 : 1];
};

const legacyMediaToClipInput = (
  media,
  selectedUrl,
  { duration, sourceDuration = duration, durationEstimated = false },
) => ({
  mediaId: toId(media),
  name: media?.name || media?.filename || 'Library video',
  sourceUrl: selectedUrl || media?.url || '',
  originalUrl: media?.originalUrl || '',
  sourceType: media?.sourceType || 'library',
  mimeType: media?.mimeType || media?.mimetype || '',
  sourceDuration,
  duration,
  metadata: {
    legacyAssetId: toId(media),
    durationEstimated: durationEstimated === true,
    width: Number(media?.width) || undefined,
    height: Number(media?.height) || undefined,
  },
});

const normalizeLegacyBackgroundType = (value) => (
  String(value || '').toLowerCase() === 'none' ? 'None' : (value || 'None')
);

const getLegacyTextBoxMetrics = (text, settings, previewWidth) => {
  const normalizedSettings = {
    ...LEGACY_DEFAULT_TEXT_SETTINGS,
    ...(settings || {}),
  };
  normalizedSettings.bgType = normalizeLegacyBackgroundType(normalizedSettings.bgType);
  const textWidth = getOverlayTextWidth(
    text || ' ',
    Number(normalizedSettings.fontSize) || LEGACY_DEFAULT_TEXT_SETTINGS.fontSize,
    normalizedSettings.fontFamily,
    previewWidth,
    normalizedSettings.fontWeight,
  );
  const textHeight = getOverlayTextHeight(
    text || ' ',
    Number(normalizedSettings.fontSize) || LEGACY_DEFAULT_TEXT_SETTINGS.fontSize,
    normalizedSettings.bgType,
    normalizedSettings.fontFamily,
    previewWidth,
    normalizedSettings.fontWeight,
  );
  const horizontalPadding = normalizedSettings.bgType !== 'None' ? 20 : 0;
  const hasBackground = normalizedSettings.bgType !== 'None';
  const renderedPaddingX = hasBackground ? LEGACY_TEXT_HORIZONTAL_PADDING : 0;
  const renderedPaddingY = hasBackground ? LEGACY_TEXT_VERTICAL_PADDING : 0;
  const renderedTextHeight = textHeight - (hasBackground ? 8 : 0) + 2;

  return {
    settings: normalizedSettings,
    textWidth,
    textHeight,
    boxWidth: textWidth + horizontalPadding,
    boxHeight: textHeight,
    renderedPaddingX,
    renderedPaddingY,
    renderedBoxWidth: textWidth + renderedPaddingX * 2,
    renderedBoxHeight: renderedTextHeight + renderedPaddingY * 2,
  };
};

const normalizeLegacyTextTransform = (
  dragPos = {},
  text = '',
  settings = {},
  preview = {},
) => {
  const width = Number(preview.width) || LEGACY_PREVIEW_WIDTH;
  const height = Number(preview.height) || LEGACY_PREVIEW_HEIGHT;
  const metrics = getLegacyTextBoxMetrics(text, settings, width);
  const clampedDragPos = getClampedDragPos(
    {
      x: Number.isFinite(Number(dragPos.x)) ? Number(dragPos.x) : LEGACY_DEFAULT_DRAG_POS.x,
      y: Number.isFinite(Number(dragPos.y)) ? Number(dragPos.y) : LEGACY_DEFAULT_DRAG_POS.y,
    },
    text || ' ',
    Number(metrics.settings.fontSize),
    metrics.settings.fontFamily,
    metrics.settings.bgType,
    width,
    height,
    metrics.settings.fontWeight,
  );

  return {
    x: clampNumber(
      clampedDragPos.x + metrics.renderedBoxWidth / 2,
      0,
      width,
      width / 2,
    ) / width,
    y: clampNumber(
      clampedDragPos.y + metrics.renderedBoxHeight / 2,
      0,
      height,
      height / 2,
    ) / height,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipX: false,
    flipY: false,
  };
};

const legacyTextSettingsToStyle = (
  settings = {},
  fontScale = 1,
  metrics,
  preview = {},
) => {
  const normalizedSettings = metrics?.settings || {
    ...LEGACY_DEFAULT_TEXT_SETTINGS,
    ...settings,
  };
  const previewWidth = Number(preview.width) || LEGACY_PREVIEW_WIDTH;
  const previewHeight = Number(preview.height) || LEGACY_PREVIEW_HEIGHT;

  return {
    fontFamily: LEGACY_TO_EDITOR_FONT[normalizedSettings.fontFamily]
      || normalizedSettings.fontFamily
      || 'Outfit',
    fontWeight: NAMED_FONT_WEIGHTS[normalizedSettings.fontWeight]
      || Number(normalizedSettings.fontWeight)
      || 400,
    fontSize: (Number(normalizedSettings.fontSize) || LEGACY_DEFAULT_TEXT_SETTINGS.fontSize)
      * fontScale,
    color: normalizedSettings.fontColor || LEGACY_DEFAULT_TEXT_SETTINGS.fontColor,
    strokeWidth: (Number.isFinite(Number(normalizedSettings.strokeWidth))
      ? Number(normalizedSettings.strokeWidth)
      : LEGACY_DEFAULT_TEXT_SETTINGS.strokeWidth) * fontScale,
    strokeColor: normalizedSettings.strokeColor || LEGACY_DEFAULT_TEXT_SETTINGS.strokeColor,
    backgroundType: normalizedSettings.bgType || LEGACY_DEFAULT_TEXT_SETTINGS.bgType,
    backgroundColor: normalizedSettings.bgColor || LEGACY_DEFAULT_TEXT_SETTINGS.bgColor,
    textAlign: 'center',
    lineHeight: LEGACY_TEXT_LINE_HEIGHT,
    boxWidth: metrics ? metrics.renderedBoxWidth / previewWidth : 0,
    boxHeight: metrics ? metrics.renderedBoxHeight / previewHeight : 0,
    paddingX: metrics ? metrics.renderedPaddingX * fontScale : null,
    paddingY: metrics ? metrics.renderedPaddingY * fontScale : null,
    borderRadius: normalizedSettings.bgType === 'Snapchat'
      ? 4 * fontScale
      : normalizedSettings.bgType === 'White' ? 3 * fontScale : 0,
  };
};

const upgradeEmbeddedBulkTextGeometry = (project, row, options = {}) => {
  const previewWidth = Number(options.legacyPreview?.width) || LEGACY_PREVIEW_WIDTH;
  const previewHeight = Number(options.legacyPreview?.height) || LEGACY_PREVIEW_HEIGHT;
  const fontScale = project.output.width / previewWidth;
  const legacySettings = {
    ...LEGACY_DEFAULT_TEXT_SETTINGS,
    ...(row.textSettings || {}),
  };
  legacySettings.bgType = normalizeLegacyBackgroundType(legacySettings.bgType);
  const expectedFontFamily = LEGACY_TO_EDITOR_FONT[legacySettings.fontFamily]
    || legacySettings.fontFamily
    || 'Outfit';
  const expectedFontWeight = NAMED_FONT_WEIGHTS[legacySettings.fontWeight]
    || Number(legacySettings.fontWeight)
    || 400;
  const expectedFontSize = Number(legacySettings.fontSize) * fontScale;
  let changed = false;

  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (
        clip.type !== TRACK_TYPES.TEXT
        || clip.metadata?.bulkCaption !== true
        || clip.metadata?.bulkTextGeometryVersion === BULK_TEXT_GEOMETRY_VERSION
      ) {
        return clip;
      }
      const style = clip.style || {};
      const isUnmodifiedLegacyImport = (
        clip.text === row.caption
        && Math.abs(Number(style.boxWidth || 0)) <= GEOMETRY_EPSILON
        && Math.abs(Number(style.boxHeight || 0)) <= GEOMETRY_EPSILON
        && style.fontFamily === expectedFontFamily
        && Number(style.fontWeight) === Number(expectedFontWeight)
        && Math.abs(Number(style.fontSize) - expectedFontSize) <= GEOMETRY_EPSILON
      );
      if (!isUnmodifiedLegacyImport) return clip;

      const metrics = getLegacyTextBoxMetrics(clip.text, legacySettings, previewWidth);
      const sourceDragPos = {
        ...LEGACY_DEFAULT_DRAG_POS,
        ...(clip.metadata?.legacyDragPos || row.dragPos || {}),
      };
      const clampedDragPos = getClampedDragPos(
        sourceDragPos,
        clip.text || ' ',
        Number(metrics.settings.fontSize),
        metrics.settings.fontFamily,
        metrics.settings.bgType,
        previewWidth,
        previewHeight,
        metrics.settings.fontWeight,
      );
      const oldCenter = {
        x: (clampedDragPos.x + metrics.boxWidth / 2) / previewWidth,
        y: (clampedDragPos.y + metrics.boxHeight / 2) / previewHeight,
      };
      const positionWasUnmodified = (
        Math.abs(Number(clip.transform?.x) - oldCenter.x) <= GEOMETRY_EPSILON
        && Math.abs(Number(clip.transform?.y) - oldCenter.y) <= GEOMETRY_EPSILON
      );
      const importedStyle = legacyTextSettingsToStyle(
        legacySettings,
        fontScale,
        metrics,
        options.legacyPreview,
      );
      changed = true;
      return createTextClip({
        ...clip,
        style: {
          ...style,
          boxWidth: importedStyle.boxWidth,
          boxHeight: importedStyle.boxHeight,
          paddingX: importedStyle.paddingX,
          paddingY: importedStyle.paddingY,
          lineHeight: Math.abs(Number(style.lineHeight) - 1.2) <= GEOMETRY_EPSILON
            ? importedStyle.lineHeight
            : style.lineHeight,
          strokeWidth: Math.abs(
            Number(style.strokeWidth) - Number(legacySettings.strokeWidth),
          ) <= GEOMETRY_EPSILON
            ? importedStyle.strokeWidth
            : style.strokeWidth,
          borderRadius: Number(style.borderRadius) === 12
            ? importedStyle.borderRadius
            : style.borderRadius,
        },
        transform: positionWasUnmodified
          ? normalizeLegacyTextTransform(
              sourceDragPos,
              clip.text,
              legacySettings,
              options.legacyPreview,
            )
          : clip.transform,
        metadata: {
          ...clip.metadata,
          bulkTextGeometryVersion: BULK_TEXT_GEOMETRY_VERSION,
        },
      });
    }),
  }));

  return changed ? normalizeProject({ ...project, tracks }) : project;
};

const restoreEmbeddedProject = (row, options) => {
  if (!row?.editorProject) return null;
  try {
    return upgradeEmbeddedBulkTextGeometry(
      deserializeProject(row.editorProject),
      row,
      options,
    );
  } catch {
    return null;
  }
};

const applyLegacyVideoAudioDefault = (projectInput) => {
  const project = normalizeProject(projectInput);
  if (project.metadata?.legacyVideoAudioDefaultApplied === true) return project;

  const firstVideoTrack = project.tracks.find((track) => track.type === TRACK_TYPES.VIDEO);
  const boundVideoTrack = project.tracks.find((track) => (
    track.type === TRACK_TYPES.VIDEO
    && track.clips.some((clip) => Boolean(clip.metadata?.bulkSlot))
  ));
  const targetTrackId = boundVideoTrack?.id || firstVideoTrack?.id || '';

  return normalizeProject({
    ...project,
    tracks: project.tracks.map((track) => (
      track.id === targetTrackId ? { ...track, muted: true } : track
    )),
    metadata: {
      ...project.metadata,
      legacyVideoAudioDefaultApplied: true,
    },
  });
};

export const bulkRowToProject = (row = {}, options = {}) => {
  const embeddedProject = restoreEmbeddedProject(row, options);
  if (embeddedProject) {
    const projectWithAudioDefault = applyLegacyVideoAudioDefault(embeddedProject);
    const synchronizedProject = row.editorProjectStale
      ? mergeBulkRowPatchIntoProject(
          projectWithAudioDefault,
          row,
          pickBulkContentFields(row),
          options,
        )
      : projectWithAudioDefault;
    const hydratedProject = hydrateBulkProjectDurations(
      synchronizedProject,
      options.videoDurations,
    );
    return normalizeProject({
      ...hydratedProject,
      metadata: {
        ...hydratedProject.metadata,
        bulkRowId: toId(row.id),
        source: 'bulk-planning-board',
      },
    });
  }

  const defaultClipDuration = clampNumber(options.defaultClipDuration, 0.1, 30, 5);
  const output = { ...LEGACY_OUTPUT, ...(options.output || {}) };
  const previewWidth = Number(options.legacyPreview?.width) || LEGACY_PREVIEW_WIDTH;
  const videoTrack = {
    type: TRACK_TYPES.VIDEO,
    name: 'Video',
    clips: [],
    // Legacy/bulk videos commonly carry camera audio alongside a separate
    // selected soundtrack. Start the video lane muted; users can unmute it
    // from the timeline track header and that choice is then persisted.
    muted: true,
  };
  let timelineStart = 0;
  const legacyVideos = [
    { slot: 'video1', media: row.video1, url: row.video1Url },
    { slot: 'video2', media: row.video2, url: row.video2Url },
  ]
    .filter(({ media, url }) => Boolean(media || url))
    .map((entry) => ({
      ...entry,
      knownDuration: getKnownMediaDuration(
        entry.media,
        getDurationOption(options, entry.slot),
      ),
    }));
  const durationBudget = clampNumber(output.maxDuration, 0.1, 30, 30);
  const unknownDurationCount = legacyVideos.filter((entry) => !entry.knownDuration).length;
  const knownDurationTotal = legacyVideos.reduce(
    (total, entry) => total + entry.knownDuration,
    0,
  );
  const minimumEstimatedDuration = legacyVideos.length > 0
    ? Math.min(0.1, durationBudget / legacyVideos.length)
    : 0;
  const knownDurationBudget = Math.max(
    0,
    durationBudget - unknownDurationCount * minimumEstimatedDuration,
  );
  const knownDurationScale = unknownDurationCount > 0 && knownDurationTotal > knownDurationBudget
    ? knownDurationBudget / knownDurationTotal
    : 1;
  const distributedUnknownDuration = unknownDurationCount > 0
    ? Math.max(
        minimumEstimatedDuration,
        (durationBudget - knownDurationTotal * knownDurationScale) / unknownDurationCount,
      )
    : 0;

  legacyVideos.forEach(({ slot, media, url, knownDuration }) => {
    const durationEstimated = !knownDuration;
    const preferredDuration = durationEstimated
      ? distributedUnknownDuration
      : knownDuration * knownDurationScale;
    const duration = Math.min(
      durationBudget - timelineStart,
      preferredDuration,
    );
    if (duration <= 0) return;
    const mediaInput = legacyMediaToClipInput(media, url, {
      duration,
      sourceDuration: durationEstimated ? duration : knownDuration,
      durationEstimated,
    });
    const clip = createVideoClip({
      ...mediaInput,
      timelineStart,
      metadata: {
        ...mediaInput.metadata,
        bulkSlot: slot,
      },
    });
    videoTrack.clips.push(clip);
    timelineStart += duration;
  });

  const projectDuration = Math.max(0.1, timelineStart || defaultClipDuration);
  const firstVideoDuration = videoTrack.clips[0]?.duration || projectDuration;
  const textTrack = { type: TRACK_TYPES.TEXT, name: 'Text', clips: [] };
  if (typeof row.caption === 'string' && row.caption.length > 0) {
    const textMetrics = getLegacyTextBoxMetrics(
      row.caption,
      row.textSettings,
      previewWidth,
    );
    textTrack.clips.push(createTextClip({
      name: 'Caption',
      text: row.caption,
      timelineStart: 0,
      duration: firstVideoDuration,
      style: legacyTextSettingsToStyle(
        row.textSettings,
        output.width / previewWidth,
        textMetrics,
        options.legacyPreview,
      ),
      transform: normalizeLegacyTextTransform(
        row.dragPos,
        row.caption,
        row.textSettings,
        options.legacyPreview,
      ),
      metadata: {
        bulkCaption: true,
        bulkDurationBinding: 'video1',
        bulkTextGeometryVersion: BULK_TEXT_GEOMETRY_VERSION,
        legacyDragPos: {
          ...LEGACY_DEFAULT_DRAG_POS,
          ...(row.dragPos || {}),
        },
      },
    }));
  }

  const audioTrack = { type: TRACK_TYPES.AUDIO, name: 'Audio', clips: [] };
  if (row.audio) {
    const audioDuration = getMediaDuration(row.audio, options.audioDuration, projectDuration);
    const shouldLoop = audioDuration < projectDuration || row.audio.loop !== false;
    audioTrack.clips.push(createAudioClip({
      mediaId: toId(row.audio.mediaId || row.audio.id),
      name: row.audio.name || 'Background audio',
      sourceUrl: row.audio.url || '',
      originalUrl: row.audio.originalUrl || '',
      sourceType: row.audio.sourceType || 'library',
      mimeType: row.audio.mimeType || row.audio.mimetype || '',
      timelineStart: 0,
      sourceStart: 0,
      sourceDuration: audioDuration,
      duration: shouldLoop ? projectDuration : Math.min(projectDuration, audioDuration),
      loop: shouldLoop,
      volume: Number.isFinite(Number(row.audio.volume)) ? Number(row.audio.volume) : 1,
      frequency: Number(row.audio.frequency) || undefined,
      metadata: {
        bulkAudio: true,
        bulkDurationBinding: 'bulkVideos',
        legacyTrackId: row.audio.id || '',
        description: row.audio.description || '',
        frequency: Number(row.audio.frequency) || undefined,
        tags: Array.isArray(row.audio.tags) ? row.audio.tags : [],
        savedAt: row.audio.savedAt || '',
      },
    }));
  }

  return createEditorProject({
    id: options.projectId,
    name: options.name || `Bulk video ${row.id || ''}`.trim(),
    output,
    tracks: [videoTrack, textTrack, audioTrack],
    metadata: {
      bulkRowId: toId(row.id),
      source: 'bulk-planning-board',
      canvasPos: row.canvasPos || null,
      legacyVideoAudioDefaultApplied: true,
    },
  });
};

const clipMatchesLegacyAsset = (clip, asset) => {
  if (!clip || !asset) return false;
  const assetId = toId(asset);
  return Boolean(assetId && (assetId === clip.mediaId || assetId === clip.metadata?.legacyAssetId));
};

const clipToLegacyMedia = (clip, fallbackAsset) => {
  if (!clip) return null;
  const fallback = clipMatchesLegacyAsset(clip, fallbackAsset) ? fallbackAsset : {};
  const mediaId = clip.mediaId || clip.metadata?.legacyAssetId || clip.id;

  return {
    ...fallback,
    id: mediaId,
    name: clip.name,
    sourceType: clip.sourceType || fallback.sourceType || 'library',
    url: clip.sourceUrl || fallback.url || '',
    originalUrl: clip.originalUrl || fallback.originalUrl || '',
    duration: clip.metadata?.durationEstimated === true
      ? (fallback.duration || 0)
      : (clip.sourceDuration || fallback.duration || 0),
  };
};

const audioClipToLegacyTrack = (clip, fallbackTrack) => {
  if (!clip) return null;
  const fallback = clipMatchesLegacyAsset(clip, fallbackTrack) ? fallbackTrack : {};
  return {
    ...fallback,
    id: clip.metadata?.legacyTrackId || fallback.id || clip.id,
    mediaId: clip.mediaId || fallback.mediaId || '',
    name: clip.name,
    sourceType: clip.sourceType || fallback.sourceType || 'library',
    url: clip.sourceUrl || fallback.url || '',
    originalUrl: clip.originalUrl || fallback.originalUrl || '',
    duration: clip.sourceDuration || fallback.duration || 0,
    volume: clip.volume,
    loop: clip.loop,
    description: clip.metadata?.description || fallback.description || '',
    frequency: clip.frequency || clip.metadata?.frequency || fallback.frequency,
    tags: clip.metadata?.tags || fallback.tags || [],
    savedAt: clip.metadata?.savedAt || fallback.savedAt || '',
  };
};

const textClipToLegacySettings = (clip, fallbackSettings = {}, fontScale = 1) => {
  const fallback = {
    ...LEGACY_DEFAULT_TEXT_SETTINGS,
    ...(fallbackSettings || {}),
  };
  if (!clip) return fallback;

  return {
    ...fallback,
    fontFamily: EDITOR_TO_LEGACY_FONT[clip.style?.fontFamily]
      || clip.style?.fontFamily
      || fallback.fontFamily,
    fontWeight: toLegacyFontWeight(clip.style?.fontWeight || fallback.fontWeight),
    fontSize: Math.round(((clip.style?.fontSize ?? fallback.fontSize) / fontScale) * 100) / 100,
    fontColor: clip.style?.color || fallback.fontColor,
    strokeWidth: Math.round(((clip.style?.strokeWidth ?? fallback.strokeWidth) / fontScale) * 1000) / 1000,
    strokeColor: clip.style?.strokeColor || fallback.strokeColor,
    bgType: normalizeLegacyBackgroundType(clip.style?.backgroundType || fallback.bgType),
    bgColor: clip.style?.backgroundColor || fallback.bgColor,
  };
};

const textClipToLegacyDragPos = (
  clip,
  fallbackDragPos = {},
  preview = {},
  legacySettings = LEGACY_DEFAULT_TEXT_SETTINGS,
) => {
  if (!clip) return { ...LEGACY_DEFAULT_DRAG_POS, ...fallbackDragPos };
  const width = Number(preview.width) || LEGACY_PREVIEW_WIDTH;
  const height = Number(preview.height) || LEGACY_PREVIEW_HEIGHT;
  const metrics = getLegacyTextBoxMetrics(clip.text, legacySettings, width);
  const centerX = clampNumber(clip.transform?.x, 0, 1, 0.5) * width;
  const centerY = clampNumber(clip.transform?.y, 0, 1, 0.5) * height;
  const clampedDragPos = getClampedDragPos(
    {
      x: centerX - metrics.renderedBoxWidth / 2,
      y: centerY - metrics.renderedBoxHeight / 2,
    },
    clip.text || ' ',
    Number(metrics.settings.fontSize),
    metrics.settings.fontFamily,
    metrics.settings.bgType,
    width,
    height,
    metrics.settings.fontWeight,
  );

  return {
    x: Math.round(clampedDragPos.x * 100) / 100,
    y: Math.round(clampedDragPos.y * 100) / 100,
  };
};

const getLegacyVideoRepresentatives = (videoClips) => {
  const video1Tagged = videoClips.filter((clip) => clip.metadata?.bulkSlot === 'video1')[0] || null;
  const video2Tagged = videoClips.filter((clip) => (
    clip.metadata?.bulkSlot === 'video2' && clip.id !== video1Tagged?.id
  ))[0] || null;
  const reservedIds = new Set([video1Tagged?.id, video2Tagged?.id].filter(Boolean));
  const untagged = videoClips.filter((clip) => (
    !clip.metadata?.bulkSlot && !reservedIds.has(clip.id)
  ));
  const remaining = videoClips.filter((clip) => !reservedIds.has(clip.id));
  const video1Clip = video1Tagged || untagged.shift() || remaining.shift() || video2Tagged;
  const usedVideo1Id = video1Clip?.id;
  const video2Clip = video2Tagged && video2Tagged.id !== usedVideo1Id
    ? video2Tagged
    : untagged.find((clip) => clip.id !== usedVideo1Id)
      || remaining.find((clip) => (
        clip.id !== usedVideo1Id
        && clip.metadata?.bulkSlot !== video1Clip?.metadata?.bulkSlot
      ))
      || null;

  return { video1Clip, video2Clip };
};

const normalizeBulkRepresentativeBindings = (projectInput) => {
  const project = normalizeProject(projectInput);
  const visibleClipsByType = {
    [TRACK_TYPES.VIDEO]: sortClipsByTimeline(
      getAllClips(project).filter((clip) => (
        clip.type === TRACK_TYPES.VIDEO && clip.enabled !== false
      )),
    ),
    [TRACK_TYPES.TEXT]: sortClipsByTimeline(
      getAllClips(project).filter((clip) => (
        clip.type === TRACK_TYPES.TEXT && clip.enabled !== false
      )),
    ),
    [TRACK_TYPES.AUDIO]: sortClipsByTimeline(
      getAllClips(project).filter((clip) => (
        clip.type === TRACK_TYPES.AUDIO && clip.enabled !== false
      )),
    ),
  };
  const videoRepresentatives = getLegacyVideoRepresentatives(visibleClipsByType[TRACK_TYPES.VIDEO]);
  const taggedText = visibleClipsByType[TRACK_TYPES.TEXT].filter((clip) => (
    clip.metadata?.bulkCaption === true
  ));
  const taggedAudio = visibleClipsByType[TRACK_TYPES.AUDIO].filter((clip) => (
    clip.metadata?.bulkAudio === true
  ));
  const selectedBindings = {
    video1: videoRepresentatives.video1Clip?.id || '',
    video2: videoRepresentatives.video2Clip?.id || '',
    caption: (taggedText[0] || visibleClipsByType[TRACK_TYPES.TEXT][0])?.id || '',
    audio: (taggedAudio[0] || visibleClipsByType[TRACK_TYPES.AUDIO][0])?.id || '',
  };
  let changed = false;
  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      const metadata = { ...(clip.metadata || {}) };
      if (clip.type === TRACK_TYPES.VIDEO) {
        const nextSlot = clip.id === selectedBindings.video1
          ? 'video1'
          : clip.id === selectedBindings.video2 ? 'video2' : '';
        if (nextSlot) {
          if (metadata.bulkSlot !== nextSlot) {
            metadata.bulkSlot = nextSlot;
            changed = true;
          }
        } else if (hasOwn(metadata, 'bulkSlot')) {
          delete metadata.bulkSlot;
          changed = true;
        }
      } else if (clip.type === TRACK_TYPES.TEXT) {
        const shouldBind = clip.id === selectedBindings.caption;
        if (shouldBind && metadata.bulkCaption !== true) {
          metadata.bulkCaption = true;
          changed = true;
        } else if (!shouldBind && hasOwn(metadata, 'bulkCaption')) {
          delete metadata.bulkCaption;
          changed = true;
        }
      } else if (clip.type === TRACK_TYPES.AUDIO) {
        const shouldBind = clip.id === selectedBindings.audio;
        if (shouldBind && metadata.bulkAudio !== true) {
          metadata.bulkAudio = true;
          changed = true;
        } else if (!shouldBind && hasOwn(metadata, 'bulkAudio')) {
          delete metadata.bulkAudio;
          changed = true;
        }
      }
      return comparableJson(metadata) === comparableJson(clip.metadata)
        ? clip
        : { ...clip, metadata };
    }),
  }));

  return changed ? normalizeProject({ ...project, tracks }) : project;
};

const getTypedClips = (project, type) => sortClipsByTimeline(
  getAllClips(project).filter((clip) => clip.type === type),
);

const replaceProjectClip = (project, clipId, replacement) => ({
  ...project,
  tracks: project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => (clip.id === clipId ? replacement : clip)),
  })),
});

const removeProjectClips = (project, predicate) => ({
  ...project,
  tracks: project.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((clip) => !predicate(clip)),
  })),
});

const appendProjectClip = (project, type, clip) => {
  const primaryTrack = getPrimaryTrackByType(project, type);
  if (!primaryTrack) {
    const track = createTrack(type, {
      name: type === TRACK_TYPES.TEXT
        ? 'Text'
        : type === TRACK_TYPES.AUDIO ? 'Audio' : 'Video',
      clips: [clip],
      muted: type === TRACK_TYPES.VIDEO,
    });
    return { ...project, tracks: [...project.tracks, track] };
  }
  return {
    ...project,
    tracks: project.tracks.map((track) => (
      track.id === primaryTrack.id
        ? { ...track, clips: sortClipsByTimeline([...track.clips, clip]) }
        : track
    )),
  };
};

const getTaggedVideoClip = (project, slot) => getTypedClips(project, TRACK_TYPES.VIDEO)
  .find((clip) => clip.metadata?.bulkSlot === slot) || null;

const nearlyEqualDuration = (left, right) => (
  Math.abs(Number(left || 0) - Number(right || 0)) <= BULK_DURATION_EPSILON
);

/**
 * Replaces temporary duration estimates on the two legacy-bound video clips.
 * Only explicitly tagged bulk clips and their duration-bound caption/audio are
 * retimed; advanced clips, tracks, effects, crops, and transforms are retained.
 */
export function hydrateBulkProjectDurations(
  projectInput,
  videoDurations = {},
) {
  const project = normalizeProject(projectInput);
  const durationOptions = { videoDurations };
  const originalEntries = ['video1', 'video2']
    .map((slot) => ({
      slot,
      clip: getTaggedVideoClip(project, slot),
      duration: Number(getDurationOption(durationOptions, slot)),
    }))
    .filter(({ clip }) => Boolean(clip));
  const canHydrate = originalEntries.some(({ clip, duration }) => (
    clip.metadata?.durationEstimated === true
    && Number.isFinite(duration)
    && duration > 0
  ));
  if (!canHydrate) return project;

  const originalFirst = originalEntries.find(({ slot }) => slot === 'video1')?.clip || null;
  const originalTaggedEnd = originalEntries.reduce((maximum, { clip }) => Math.max(
    maximum,
    Number(clip.timelineStart || 0) + Number(clip.duration || 0),
  ), 0);
  const replacements = new Map();
  let timelineCursor = 0;

  originalEntries.forEach(({ clip, duration }, index) => {
    const resolvesEstimate = clip.metadata?.durationEstimated === true
      && Number.isFinite(duration)
      && duration > 0;
    const unresolvedClipsAfter = originalEntries.length - index - 1;
    const reservedDuration = unresolvedClipsAfter * BULK_MIN_CLIP_DURATION;
    const maximumTimelineDuration = Math.max(
      BULK_MIN_CLIP_DURATION,
      Number(project.output.maxDuration || 30) - timelineCursor - reservedDuration,
    );
    const playbackRate = Math.max(0.01, Number(clip.playbackRate) || 1);
    const nextSourceDuration = resolvesEstimate ? duration : Number(clip.sourceDuration || 0);
    const requestedSourceStart = Math.max(0, Number(clip.sourceStart || 0));
    const effectiveSourceStart = nextSourceDuration > 0
      ? Math.min(
          requestedSourceStart,
          Math.max(
            0,
            nextSourceDuration - Math.min(nextSourceDuration, BULK_MIN_CLIP_DURATION * playbackRate),
          ),
        )
      : requestedSourceStart;
    const availableTimelineDuration = nextSourceDuration > 0
      ? Math.max(0, (nextSourceDuration - effectiveSourceStart) / playbackRate)
      : Number(clip.duration || BULK_MIN_CLIP_DURATION);
    const estimatedAvailableDuration = Number(clip.sourceDuration || 0) > 0
      ? Math.max(
          0,
          (Number(clip.sourceDuration) - Number(clip.sourceStart || 0)) / playbackRate,
        )
      : Number(clip.duration || 0);
    const followsEstimatedSourceEnd = clip.metadata?.durationEstimated === true
      && nearlyEqualDuration(clip.duration, estimatedAvailableDuration);
    const preferredDuration = resolvesEstimate
      ? (followsEstimatedSourceEnd ? availableTimelineDuration : Number(clip.duration || 0))
      : Number(clip.duration || BULK_MIN_CLIP_DURATION);
    const nextMetadata = { ...(clip.metadata || {}) };
    if (resolvesEstimate) delete nextMetadata.durationEstimated;

    const nextClip = createVideoClip({
      ...clip,
      timelineStart: timelineCursor,
      sourceStart: effectiveSourceStart,
      sourceDuration: nextSourceDuration,
      duration: Math.min(preferredDuration, maximumTimelineDuration),
      metadata: nextMetadata,
    });
    replacements.set(clip.id, nextClip);
    timelineCursor = Number(nextClip.timelineStart || 0) + Number(nextClip.duration || 0);
  });

  const hydratedFirst = originalFirst ? replacements.get(originalFirst.id) : null;
  const hydratedTaggedEnd = timelineCursor;
  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (replacements.has(clip.id)) return replacements.get(clip.id);

      if (clip.type === TRACK_TYPES.TEXT && clip.metadata?.bulkCaption === true) {
        const followsFirstVideo = hydratedFirst && (
          clip.metadata?.bulkDurationBinding === 'video1'
          || (
            originalFirst
            && nearlyEqualDuration(clip.timelineStart, originalFirst.timelineStart)
            && nearlyEqualDuration(clip.duration, originalFirst.duration)
          )
        );
        if (!followsFirstVideo) return clip;
        return createTextClip({
          ...clip,
          timelineStart: hydratedFirst.timelineStart,
          duration: hydratedFirst.duration,
          metadata: {
            ...(clip.metadata || {}),
            bulkDurationBinding: 'video1',
          },
        });
      }

      if (clip.type === TRACK_TYPES.AUDIO && clip.metadata?.bulkAudio === true) {
        const followsBulkVideos = (
          clip.metadata?.bulkDurationBinding === 'bulkVideos'
          || (
            nearlyEqualDuration(clip.timelineStart, 0)
            && nearlyEqualDuration(clip.duration, originalTaggedEnd)
          )
        );
        if (!followsBulkVideos || hydratedTaggedEnd <= 0) return clip;
        const playbackRate = Math.max(0.01, Number(clip.playbackRate) || 1);
        const availableDuration = clip.loop || Number(clip.sourceDuration || 0) <= 0
          ? hydratedTaggedEnd
          : Math.max(
              0,
              (Number(clip.sourceDuration) - Number(clip.sourceStart || 0)) / playbackRate,
            );
        return createAudioClip({
          ...clip,
          timelineStart: 0,
          duration: Math.min(hydratedTaggedEnd, availableDuration),
          metadata: {
            ...(clip.metadata || {}),
            bulkDurationBinding: 'bulkVideos',
          },
        });
      }

      return clip;
    }),
  }));

  return normalizeProject({ ...project, tracks });
}

const getBoundAudioClip = (project, legacyAudio) => {
  const audioClips = getTypedClips(project, TRACK_TYPES.AUDIO);
  return audioClips.find((clip) => clip.metadata?.bulkAudio === true)
    || audioClips.find((clip) => (
      Boolean(clip.metadata?.legacyTrackId)
      && (!legacyAudio || clipMatchesLegacyAsset(clip, legacyAudio))
    ))
    || audioClips.find((clip) => Boolean(clip.metadata?.legacyTrackId))
    || null;
};

const getNewVideoTimelineStart = (project, slot) => {
  if (slot === 'video1') return 0;
  const firstVideo = getTaggedVideoClip(project, 'video1');
  return firstVideo
    ? Number(firstVideo.timelineStart || 0) + Number(firstVideo.duration || 0)
    : 0;
};

const mergeVideoBinding = (project, row, patch, slot, options) => {
  const urlKey = `${slot}Url`;
  if (!hasOwn(patch, slot) && !hasOwn(patch, urlKey)) return project;

  const media = row[slot] || null;
  const sourceUrl = row[urlKey] || media?.url || '';
  const currentClip = getTaggedVideoClip(project, slot);
  if (!media && !sourceUrl) {
    return removeProjectClips(project, (clip) => (
      clip.type === TRACK_TYPES.VIDEO && clip.metadata?.bulkSlot === slot
    ));
  }

  const knownDuration = getKnownMediaDuration(media, getDurationOption(options, slot));
  const timelineStart = currentClip?.timelineStart ?? getNewVideoTimelineStart(project, slot);
  const remainingDuration = Math.max(0.1, project.output.maxDuration - timelineStart);
  const duration = Math.min(
    remainingDuration,
    currentClip?.duration
      || knownDuration
      || clampNumber(options.defaultClipDuration, 0.1, remainingDuration, 5),
  );
  const mediaDescriptor = media || (currentClip ? {
    id: currentClip.mediaId || currentClip.metadata?.legacyAssetId || '',
    name: currentClip.name,
    url: currentClip.sourceUrl,
    originalUrl: currentClip.originalUrl,
    sourceType: currentClip.sourceType,
    mimeType: currentClip.mimeType,
  } : null);
  const nextMediaId = toId(mediaDescriptor);
  const nextIdentity = `${nextMediaId}|${sourceUrl}`;
  const currentIdentity = currentClip
    ? `${currentClip.mediaId}|${currentClip.sourceUrl}`
    : '';
  const sameIdentity = Boolean(currentClip && nextIdentity === currentIdentity);
  const preservePendingEstimate = sameIdentity
    && currentClip.metadata?.durationEstimated === true;
  const sourceDuration = preservePendingEstimate
    ? currentClip.sourceDuration
    : (knownDuration || (sameIdentity ? currentClip?.sourceDuration : 0) || duration);
  const mediaInput = legacyMediaToClipInput(mediaDescriptor, sourceUrl, {
    duration,
    sourceDuration,
    durationEstimated: preservePendingEstimate
      || (!knownDuration && (!sameIdentity || !currentClip?.sourceDuration)),
  });
  const nextClip = createVideoClip({
    ...(currentClip || {}),
    ...mediaInput,
    name: media?.name || media?.filename || currentClip?.name || 'Library video',
    timelineStart,
    sourceStart: currentClip && nextIdentity === currentIdentity ? currentClip.sourceStart : 0,
    metadata: {
      ...(currentClip?.metadata || {}),
      ...mediaInput.metadata,
      bulkSlot: slot,
    },
  });

  return currentClip
    ? replaceProjectClip(project, currentClip.id, nextClip)
    : appendProjectClip(project, TRACK_TYPES.VIDEO, nextClip);
};

const mergeCaptionBinding = (project, row, patch, options) => {
  const captionChanged = hasOwn(patch, 'caption');
  const settingsChanged = hasOwn(patch, 'textSettings');
  const positionChanged = hasOwn(patch, 'dragPos');
  const shouldMerge = captionChanged || settingsChanged || positionChanged;
  if (!shouldMerge) return project;

  const textClips = getTypedClips(project, TRACK_TYPES.TEXT);
  const currentClip = textClips.find((clip) => clip.metadata?.bulkCaption === true) || null;
  const caption = typeof row.caption === 'string' ? row.caption : '';
  if (!caption) {
    return removeProjectClips(project, (clip) => (
      clip.type === TRACK_TYPES.TEXT && clip.metadata?.bulkCaption === true
    ));
  }

  const previewWidth = Number(options.legacyPreview?.width) || LEGACY_PREVIEW_WIDTH;
  const previewHeight = Number(options.legacyPreview?.height) || LEGACY_PREVIEW_HEIGHT;
  const metrics = getLegacyTextBoxMetrics(caption, row.textSettings, previewWidth);
  const importedStyle = legacyTextSettingsToStyle(
    row.textSettings,
    project.output.width / previewWidth,
    metrics,
    options.legacyPreview,
  );
  const importedTransform = normalizeLegacyTextTransform(
    row.dragPos,
    caption,
    row.textSettings,
    { width: previewWidth, height: previewHeight },
  );
  const firstVideo = getTaggedVideoClip(project, 'video1');
  const duration = currentClip?.duration
    || firstVideo?.duration
    || Math.max(0.1, project.duration || clampNumber(options.defaultClipDuration, 0.1, 30, 5));
  const legacyStylePatch = settingsChanged || !currentClip ? {
    fontFamily: importedStyle.fontFamily,
    fontWeight: importedStyle.fontWeight,
    fontSize: importedStyle.fontSize,
    color: importedStyle.color,
    strokeWidth: importedStyle.strokeWidth,
    strokeColor: importedStyle.strokeColor,
    backgroundType: importedStyle.backgroundType,
    backgroundColor: importedStyle.backgroundColor,
    borderRadius: importedStyle.borderRadius,
  } : {};
  const shouldResetGeometry = !currentClip || options.resetTextGeometry === true;
  const geometryPatch = shouldResetGeometry
    ? {
        boxWidth: importedStyle.boxWidth,
        boxHeight: importedStyle.boxHeight,
        paddingX: importedStyle.paddingX,
      paddingY: importedStyle.paddingY,
      lineHeight: importedStyle.lineHeight,
      }
    : {};
  const nextTransform = currentClip && !shouldResetGeometry
    ? {
        ...currentClip.transform,
        ...(positionChanged ? { x: importedTransform.x, y: importedTransform.y } : {}),
      }
    : importedTransform;
  const nextClip = createTextClip({
    ...(currentClip || {}),
    name: currentClip?.name || 'Caption',
    text: caption,
    timelineStart: currentClip?.timelineStart ?? 0,
    duration,
    style: {
      ...(currentClip?.style || {}),
      ...geometryPatch,
      ...legacyStylePatch,
    },
    transform: nextTransform,
    metadata: {
      ...(currentClip?.metadata || {}),
      bulkCaption: true,
      bulkDurationBinding: currentClip?.metadata?.bulkDurationBinding || 'video1',
      bulkTextGeometryVersion: BULK_TEXT_GEOMETRY_VERSION,
      legacyDragPos: positionChanged || !currentClip
        ? {
            ...LEGACY_DEFAULT_DRAG_POS,
            ...(row.dragPos || {}),
          }
        : currentClip.metadata?.legacyDragPos,
    },
  });

  return currentClip
    ? replaceProjectClip(project, currentClip.id, nextClip)
    : appendProjectClip(project, TRACK_TYPES.TEXT, nextClip);
};

const mergeAudioBinding = (project, row, patch, options) => {
  if (!hasOwn(patch, 'audio')) return project;

  const currentClip = getBoundAudioClip(project, row.audio);
  if (!row.audio) {
    if (!currentClip) return project;
    return removeProjectClips(project, (clip) => (
      clip.type === TRACK_TYPES.AUDIO
      && (clip.metadata?.bulkAudio === true || clip.id === currentClip.id)
    ));
  }

  const audio = row.audio;
  const projectDuration = Math.max(
    0.1,
    project.duration || clampNumber(options.defaultClipDuration, 0.1, 30, 5),
  );
  const knownDuration = getMediaDuration(
    audio,
    options.audioDuration,
    currentClip?.sourceDuration || projectDuration,
  );
  const shouldLoop = audio.loop === undefined
    ? (currentClip?.loop ?? knownDuration < projectDuration)
    : audio.loop !== false;
  const mediaId = toId(audio.mediaId || audio.id);
  const sourceUrl = audio.url || '';
  const nextIdentity = `${mediaId}|${sourceUrl}`;
  const currentIdentity = currentClip
    ? `${currentClip.mediaId}|${currentClip.sourceUrl}`
    : '';
  const nextClip = createAudioClip({
    ...(currentClip || {}),
    mediaId,
    name: audio.name || currentClip?.name || 'Background audio',
    sourceUrl,
    originalUrl: audio.originalUrl || currentClip?.originalUrl || '',
    sourceType: audio.sourceType || currentClip?.sourceType || 'library',
    mimeType: audio.mimeType || audio.mimetype || currentClip?.mimeType || '',
    timelineStart: currentClip?.timelineStart ?? 0,
    sourceStart: currentClip && nextIdentity === currentIdentity ? currentClip.sourceStart : 0,
    sourceDuration: knownDuration,
    duration: currentClip?.duration || (shouldLoop ? projectDuration : Math.min(projectDuration, knownDuration)),
    loop: shouldLoop,
    volume: Number.isFinite(Number(audio.volume))
      ? Number(audio.volume)
      : (currentClip?.volume ?? 1),
    frequency: Number(audio.frequency) || currentClip?.frequency || undefined,
    metadata: {
      ...(currentClip?.metadata || {}),
      bulkAudio: true,
      bulkDurationBinding: currentClip?.metadata?.bulkDurationBinding || 'bulkVideos',
      legacyTrackId: audio.id || currentClip?.metadata?.legacyTrackId || '',
      description: audio.description || '',
      frequency: Number(audio.frequency) || undefined,
      tags: Array.isArray(audio.tags) ? audio.tags : [],
      savedAt: audio.savedAt || '',
    },
  });

  return currentClip
    ? replaceProjectClip(project, currentClip.id, nextClip)
    : appendProjectClip(project, TRACK_TYPES.AUDIO, nextClip);
};

/**
 * Applies fields supported by the Bulk Planning Board to their explicitly-bound timeline clips.
 * Untagged and advanced-only clips/tracks are intentionally left untouched.
 */
export function mergeBulkRowPatchIntoProject(
  projectInput,
  existingRow = {},
  patch = {},
  options = {},
) {
  const contentPatch = pickBulkContentFields(patch);
  const row = mergeBulkRowValues(existingRow, contentPatch);
  let project = normalizeBulkRepresentativeBindings(projectInput);
  project = mergeVideoBinding(project, row, contentPatch, 'video1', options);
  project = mergeVideoBinding(project, row, contentPatch, 'video2', options);
  project = mergeCaptionBinding(project, row, contentPatch, options);
  project = mergeAudioBinding(project, row, contentPatch, options);
  return hydrateBulkProjectDurations(
    normalizeProject(project),
    options.videoDurations,
  );
}

export const projectToBulkRow = (projectInput, existingRow = {}, options = {}) => {
  const project = normalizeBulkRepresentativeBindings(projectInput);
  const videoClips = sortClipsByTimeline(
    getAllClips(project).filter((clip) => clip.type === TRACK_TYPES.VIDEO && clip.enabled !== false),
  );
  const textClips = sortClipsByTimeline(
    getAllClips(project).filter((clip) => clip.type === TRACK_TYPES.TEXT && clip.enabled !== false),
  );
  const audioClips = sortClipsByTimeline(
    getAllClips(project).filter((clip) => clip.type === TRACK_TYPES.AUDIO && clip.enabled !== false),
  );
  const textClip = textClips.find((clip) => clip.metadata?.bulkCaption === true)
    || textClips[0]
    || null;
  const audioClip = audioClips.find((clip) => clip.metadata?.bulkAudio === true)
    || audioClips[0]
    || null;
  const { video1Clip, video2Clip } = getLegacyVideoRepresentatives(videoClips);
  const video1 = clipToLegacyMedia(video1Clip, existingRow.video1);
  const video2 = clipToLegacyMedia(video2Clip, existingRow.video2);
  const isDualVideo = options.isDualVideo
    ?? Boolean(existingRow.video2 || existingRow.video2Url || video2);
  const isReady = Boolean(video1 && (!isDualVideo || video2));
  const clearResult = options.clearResult !== false;
  const previewWidth = Number(options.legacyPreview?.width) || LEGACY_PREVIEW_WIDTH;
  const fontScale = project.output.width / previewWidth;
  const legacyTextSettings = textClipToLegacySettings(
    textClip,
    existingRow.textSettings,
    fontScale,
  );
  const embeddedProject = normalizeProject({
    ...project,
    metadata: {
      ...project.metadata,
      bulkRowId: toId(existingRow.id) || project.metadata?.bulkRowId,
      source: 'bulk-planning-board',
    },
  });

  return {
    ...existingRow,
    video1,
    video1Url: video1?.url || '',
    video2,
    video2Url: video2?.url || '',
    audio: audioClipToLegacyTrack(audioClip, existingRow.audio),
    caption: textClip?.text || '',
    textSettings: legacyTextSettings,
    dragPos: textClipToLegacyDragPos(
      textClip,
      existingRow.dragPos,
      options.legacyPreview,
      legacyTextSettings,
    ),
    status: clearResult ? (isReady ? 'ready' : 'draft') : existingRow.status,
    resultMediaId: clearResult ? '' : (existingRow.resultMediaId || ''),
    resultMediaUrl: clearResult ? '' : (existingRow.resultMediaUrl || ''),
    resultMediaName: clearResult ? '' : (existingRow.resultMediaName || ''),
    resultVideoUrl: clearResult ? '' : (existingRow.resultVideoUrl || ''),
    editorProjectId: project.id,
    editorProject: embeddedProject,
    editorProjectStale: false,
  };
};

/**
 * Returns a fully synchronized bulk row whose embedded editor project is the source of truth.
 * Existing stale rows are migrated by applying their complete legacy projection exactly once.
 */
export const syncBulkRowContent = (existingRow = {}, patch = {}, options = {}) => {
  const row = mergeBulkRowValues(existingRow, patch);
  const embeddedProject = restoreEmbeddedProject(existingRow, options);
  const shouldMergeCompleteLegacyRow = Boolean(existingRow.editorProjectStale);
  const contentPatch = shouldMergeCompleteLegacyRow
    ? pickBulkContentFields(row)
    : pickBulkContentFields(patch);

  const synchronizedProject = embeddedProject
    ? mergeBulkRowPatchIntoProject(embeddedProject, existingRow, contentPatch, options)
    : bulkRowToProject({
        ...row,
        editorProject: null,
        editorProjectStale: false,
      }, options);
  const project = hydrateBulkProjectDurations(
    synchronizedProject,
    options.videoDurations,
  );
  const didContentChange = shouldMergeCompleteLegacyRow
    || bulkContentChanged(existingRow, patch);
  const clearResult = typeof options.clearResult === 'boolean'
    ? options.clearResult
    : didContentChange;

  return projectToBulkRow(project, row, {
    ...options,
    clearResult,
  });
};

export const getBulkProjectTrack = (project, type) => getPrimaryTrackByType(project, type);
