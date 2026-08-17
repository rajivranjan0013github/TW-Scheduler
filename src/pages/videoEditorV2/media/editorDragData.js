import { trackAcceptsClipType } from '../project';

export const EDITOR_ITEM_DRAG_MIME = 'application/x-tw-editor-item';

let activeEditorDragItem = null;

const clipTypeMime = (clipType) => `application/x-tw-editor-${clipType}`;

export const getEditorDragClipType = (item) => (
  item?.kind === 'text' ? 'text' : item?.asset?.type || ''
);

export const setEditorDragData = (event, item) => {
  const clipType = getEditorDragClipType(item);
  if (!event?.dataTransfer || !clipType) return;

  activeEditorDragItem = item;
  const source = event.currentTarget;
  source?.addEventListener('dragend', () => {
    if (activeEditorDragItem === item) activeEditorDragItem = null;
  }, { once: true });

  event.dataTransfer.effectAllowed = 'copy';
  const sourceRect = source?.getBoundingClientRect?.();
  if (source && sourceRect) {
    event.dataTransfer.setDragImage(source, sourceRect.width / 2, sourceRect.height / 2);
  }
  event.dataTransfer.setData(EDITOR_ITEM_DRAG_MIME, JSON.stringify(item));
  event.dataTransfer.setData(clipTypeMime(clipType), clipType);
  event.dataTransfer.setData(
    'text/plain',
    item.kind === 'text' ? item.text || 'Text' : item.asset?.name || clipType,
  );
};

export const getActiveEditorDragItem = () => activeEditorDragItem;

export const clearActiveEditorDragItem = () => {
  activeEditorDragItem = null;
};

export const readEditorDragData = (dataTransfer) => {
  if (!dataTransfer) return null;
  try {
    const serialized = dataTransfer.getData(EDITOR_ITEM_DRAG_MIME);
    return serialized ? JSON.parse(serialized) : null;
  } catch {
    return null;
  }
};

export const getEditorDragTransferType = (dataTransfer) => {
  const types = Array.from(dataTransfer?.types || []);
  return ['video', 'image', 'audio', 'text'].find((type) => (
    types.includes(clipTypeMime(type))
  )) || '';
};

export const canDropEditorTypeOnTrack = (trackType, clipType) => (
  Boolean(clipType) && trackAcceptsClipType(trackType, clipType)
);
