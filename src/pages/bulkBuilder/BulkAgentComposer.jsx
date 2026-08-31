import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronRight,
  Folder,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Sparkles,
  SquarePen,
  Undo2,
  Video,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { getActiveCampaignId } from '../../utils/campaignScope';
import { fetchMediaLibraryFolders } from '../videoEditorV2/media/mediaLibraryCache';
import {
  BULK_AGENT_RELEASE_EVENT,
  filterUnreferencedAgentReservations,
  groupAgentReservations,
  markAgentReservationReleaseComplete,
  queueAgentReservationReleases,
  readQueuedAgentReservationReleases,
} from './bulkAgentReservations';
import { deriveMentionRoles, shouldShowDefaultAudioHint } from './bulkAgentMentions.js';

const MAX_STORED_MESSAGES = 20;
const PLANNING_TIMEOUT_MS = 75_000;
const BLOCK_NODE_NAMES = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE']);

const AssignmentThumbnail = ({ src, className = 'h-5 w-5 rounded-md object-cover border border-white/10 shrink-0', fallbackIcon: FallbackIcon = Video }) => {
  const [hasError, setHasError] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  useEffect(() => {
    setHasError(false);
    setUseProxy(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className="h-5 w-5 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
        <FallbackIcon className="h-2.5 w-2.5 text-zinc-400" />
      </div>
    );
  }

  const effectiveUrl = useProxy && !src.startsWith('blob:') && !src.includes('/api/media/proxy')
    ? `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(src)}`
    : src;

  return (
    <img
      src={effectiveUrl}
      alt=""
      className={className}
      onError={() => {
        if (!useProxy && !src.startsWith('blob:') && !src.includes('/api/media/proxy')) {
          setUseProxy(true);
        } else {
          setHasError(true);
        }
      }}
    />
  );
};

const normalizeFolderId = (folder) => String(folder?._id || folder?.id || '');
const historyStorageKey = (campaignId) => `tw_bulk_agent_history:${campaignId || 'none'}`;
const draftStorageKey = (campaignId) => `tw_bulk_agent_draft:${campaignId || 'none'}`;
const pendingPlanStorageKey = (campaignId) => `tw_bulk_agent_pending_plan:${campaignId || 'none'}`;
const undoStorageKey = (campaignId) => `tw_bulk_agent_undo:${campaignId || 'none'}`;
const applyRecoveryStorageKey = (campaignId) => `tw_bulk_agent_apply_recovery:${campaignId || 'none'}`;

const createMessage = (role, content) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  role,
  content,
});

const readJsonStorage = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const readStoredMessages = (campaignId) => {
  const stored = readJsonStorage(historyStorageKey(campaignId), []);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((message) => message?.id !== 'bulk-agent-welcome')
    .slice(-MAX_STORED_MESSAGES);
};

const readStoredDraft = (campaignId) => {
  const stored = readJsonStorage(draftStorageKey(campaignId), {});
  return typeof stored?.html === 'string' ? stored.html : '';
};

const isPlanExpired = (plan) => (
  Boolean(plan?.expiresAt) && new Date(plan.expiresAt).getTime() <= Date.now()
);

const readStoredPendingPlan = (campaignId) => {
  const stored = readJsonStorage(pendingPlanStorageKey(campaignId), null);
  return stored?.id && stored.status === 'pending' && !isPlanExpired(stored) ? stored : null;
};

const readStoredUndo = (campaignId) => {
  const stored = readJsonStorage(undoStorageKey(campaignId), null);
  return stored?.changeSet?.planId ? stored : null;
};

const readApplyRecovery = (campaignId) => {
  const stored = readJsonStorage(applyRecoveryStorageKey(campaignId), null);
  return stored?.plan?.id ? stored : null;
};

const persistOptionalValue = (key, value) => {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // Optional browser persistence must not block board editing.
  }
};

const getMentionMatch = (value, caretPosition) => {
  const beforeCaret = value.slice(0, caretPosition);
  const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const mentionOffset = match[0].lastIndexOf('@');
  return {
    start: beforeCaret.length - match[0].length + mentionOffset,
    end: caretPosition,
    query: match[1].toLowerCase(),
  };
};

const readResponsePayload = async (response, fallback) => {
  const payload = await response.json().catch(() => ({}));
  return { ...payload, message: payload?.message || fallback, status: response.status };
};

const getMediaId = (asset) => String(asset?.mediaId || asset?.id || asset?._id || '');

const serializeCurrentBoard = (rows, isDualVideo) => ({
  isDualVideo,
  rows: (rows || []).map((row, index) => ({
    rowId: String(row?.id || ''),
    index,
    video1MediaId: getMediaId(row?.video1),
    video2MediaId: getMediaId(row?.video2),
    audioMediaId: getMediaId(row?.audio),
    caption: String(row?.caption || ''),
    textOverlays: Array.isArray(row?.textOverlays) ? row.textOverlays : [],
  })),
});

const canRetryWithReuse = (error) => {
  if (error?.code !== 'INSUFFICIENT_UNIQUE_MEDIA') return false;
  const availability = error?.availability || error?.details?.availability;
  if (typeof availability?.canAllowReuse === 'boolean') return availability.canAllowReuse;
  const shortages = ['primary', 'secondary', 'audio'].filter((role) => {
    const stats = availability?.[role];
    const required = Number(stats?.required || 0);
    const eligible = Number(stats?.eligible || 0);
    return required > eligible;
  });
  return shortages.length > 0 && shortages.every((role) => {
    const stats = availability?.[role];
    const source = Number(stats?.source || stats?.total || 0);
    const reserved = Number(stats?.reserved || 0);
    const unreservedCandidates = Math.max(
      Number(stats?.eligible || 0) + Number(stats?.insideCooldown || 0),
      source - reserved,
    );
    return unreservedCandidates > 0;
  });
};

const normalizeRetryAt = (error) => {
  if (error?.retryAt) return error.retryAt;
  const retryAfter = error?.retryAfter;
  if (Number.isFinite(Number(retryAfter)) && Number(retryAfter) > 0) {
    return new Date(Date.now() + Number(retryAfter) * 1000).toISOString();
  }
  return retryAfter || '';
};

const SummaryStat = ({ label, value }) => (
  <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
    <div className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-zinc-500">
      {label}
    </div>
    <div className="mt-0.5 text-sm font-bold text-zinc-100">{value}</div>
  </div>
);

const TASK_LABELS = Object.freeze({
  createFrames: 'Create frames', removeFrames: 'Remove frames', clearBoard: 'Clear board',
  setFirstVideo: 'Set first video', setSecondVideo: 'Set second video',
  setAudio: 'Set audio', removeAudio: 'Remove audio', addTextOverlay: 'Add text',
  updateTextContent: 'Change text', updateTextStyle: 'Style text',
  setTextPosition: 'Position text', setTextTiming: 'Time text',
  removeText: 'Remove text', selectMediaByContent: 'Match media content',
});

const describeCompiledTask = (task) => {
  const target = task?.target || {};
  const scope = target.scope === 'frameNumbers'
    ? `frames ${(target.frameNumbers || []).join(', ')}`
    : String(target.scope || 'allFrames').replace(/([A-Z])/g, ' $1').toLowerCase();
  const params = task?.params || {};
  let detail = '';
  if (task.type === 'createFrames') detail = `${params.count || ''}`;
  if (task.type === 'setTextPosition') {
    const position = params.position || params;
    const coordinates = [
      Number.isFinite(Number(position.x)) ? `x ${Math.round(Number(position.x) * 100)}%` : '',
      Number.isFinite(Number(position.y)) ? `y ${Math.round(Number(position.y) * 100)}%` : '',
    ].filter(Boolean).join(', ');
    detail = coordinates || position.preset || '';
  }
  if (['addTextOverlay', 'updateTextContent'].includes(task.type) && params.text) {
    detail = `“${params.text}”`;
  }
  return `${TASK_LABELS[task?.type] || task?.type || 'Task'} · ${scope}${detail ? ` · ${detail}` : ''}`;
};

const FolderSuggestionMenu = ({
  isVisible,
  foldersLoading,
  folderSuggestions,
  suggestionIndex,
  folderPaths,
  onHighlight,
  onSelect,
}) => {
  if (!isVisible) return null;
  return (
    <div
      id="bulk-agent-folder-suggestions"
      role="listbox"
      aria-label="Media Library folders"
      className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 max-h-64 overflow-y-auto rounded-xl border border-[#3b3b42] bg-[#18181b] p-1.5 shadow-2xl"
    >
      <div className="flex items-center justify-between px-2 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.14em] text-zinc-500">
        <span>Media Library folders</span>
        {foldersLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      {folderSuggestions.length > 0 ? folderSuggestions.map((folder, index) => {
        const folderId = normalizeFolderId(folder);
        const selected = index === suggestionIndex;
        return (
          <button
            id={`bulk-agent-folder-option-${folderId}`}
            key={folderId}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHighlight(index)}
            onClick={() => onSelect(folder)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${selected
              ? 'bg-white/[0.08] text-white font-semibold'
              : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Folder className="h-3.5 w-3.5 shrink-0 text-[#8ec5ff]" />
            <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">
              {folderPaths.get(folderId) || folder.name}
            </span>
            <span className="shrink-0 text-[8px] font-mono text-zinc-600">
              {Number(folder.itemCount || 0)} items
            </span>
          </button>
        );
      }) : (
        <div className="px-2.5 py-3 text-[10px] text-zinc-500">
          {foldersLoading ? 'Loading folders…' : 'No matching folders.'}
        </div>
      )}
    </div>
  );
};

const extractEditorText = (node) => {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return '';
  }
  if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-folder-mention')) {
    return `@${node.dataset.folderName || 'Folder'}`;
  }
  if (node.nodeName === 'BR') return '\n';
  let output = '';
  const children = Array.from(node.childNodes);
  children.forEach((child, index) => {
    const isBlock = child.nodeType === Node.ELEMENT_NODE && BLOCK_NODE_NAMES.has(child.nodeName);
    if (isBlock && output && !output.endsWith('\n')) output += '\n';
    output += extractEditorText(child);
    if (isBlock && index < children.length - 1 && !output.endsWith('\n')) output += '\n';
  });
  return output;
};

const createFolderMentionNode = (folder) => {
  const name = folder.name || 'Folder';
  const mention = document.createElement('span');
  mention.contentEditable = 'false';
  mention.dataset.folderMention = normalizeFolderId(folder);
  mention.dataset.folderName = name;
  mention.dataset.folderRole = 'unspecified';
  mention.className = 'mx-0.5 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-sky-500/10 px-1 align-baseline text-[11px] font-medium leading-5 text-[#8ec5ff] outline-none ring-sky-400/50 focus:ring-1';
  mention.title = `Attached folder @${name}. Press Delete to remove.`;
  mention.setAttribute('role', 'button');
  mention.setAttribute('tabindex', '0');
  mention.setAttribute('aria-label', `Attached folder ${name}. Press Delete to remove.`);

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  icon.classList.add('h-4', 'w-4', 'shrink-0');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z');
  icon.appendChild(path);
  const removeHint = document.createElement('span');
  removeHint.setAttribute('aria-hidden', 'true');
  removeHint.className = 'ml-0.5 text-zinc-500';
  removeHint.textContent = '×';
  mention.append(icon, document.createTextNode(`@${name}`), removeHint);
  return mention;
};

const createSanitizedEditorFragment = (html) => {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const output = document.createDocumentFragment();

  const appendBreak = (target) => {
    if (target.lastChild?.nodeName !== 'BR') target.appendChild(document.createElement('br'));
  };
  const appendNode = (node, target) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.nodeValue || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(node.nodeName)) return;
    if (node.hasAttribute('data-folder-mention')) {
      const folderId = String(node.dataset.folderMention || '');
      const name = String(node.dataset.folderName || 'Folder').slice(0, 160);
      if (folderId) {
        const mention = createFolderMentionNode({ _id: folderId, name });
        const role = node.dataset.folderRole;
        if (['primary', 'secondary', 'audio', 'unspecified'].includes(role)) {
          mention.dataset.folderRole = role;
        }
        target.appendChild(mention);
      }
      return;
    }
    if (node.nodeName === 'BR') {
      target.appendChild(document.createElement('br'));
      return;
    }
    const isBlock = BLOCK_NODE_NAMES.has(node.nodeName);
    if (isBlock && target.childNodes.length > 0) appendBreak(target);
    Array.from(node.childNodes).forEach((child) => appendNode(child, target));
    if (isBlock && node.nextSibling) appendBreak(target);
  };

  Array.from(template.content.childNodes).forEach((node) => appendNode(node, output));
  while (output.lastChild?.nodeName === 'BR') output.removeChild(output.lastChild);
  return output;
};

const InlineFolderEditor = forwardRef(({
  initialHtml,
  placeholder,
  className,
  disabled,
  suggestionsVisible,
  activeSuggestionId,
  onChange,
  onKeyDown,
}, forwardedRef) => {
  const rootRef = useRef(null);
  const lastRangeRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const sync = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const selection = window.getSelection();
    let beforeCaret = '';
    if (selection?.rangeCount && root.contains(selection.anchorNode)) {
      const caretRange = selection.getRangeAt(0);
      lastRangeRef.current = caretRange.cloneRange();
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(root);
      beforeRange.setEnd(caretRange.endContainer, caretRange.endOffset);
      beforeCaret = extractEditorText(beforeRange.cloneContents());
    }
    const mentions = Array.from(root.querySelectorAll('[data-folder-mention]')).map((node) => ({
      folderId: node.dataset.folderMention,
      name: node.dataset.folderName || 'Folder',
      role: node.dataset.folderRole || 'unspecified',
    }));
    onChangeRef.current?.({
      text: extractEditorText(root).replace(/\u00a0/g, ' '),
      mentions,
      html: root.innerHTML,
      beforeCaret: beforeCaret.replace(/\u00a0/g, ' '),
    });
  }, []);

  const setEditorHtml = useCallback((html) => {
    if (!rootRef.current) return;
    rootRef.current.replaceChildren(createSanitizedEditorFragment(html));
    lastRangeRef.current = null;
    sync();
  }, [sync]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || root.innerHTML === (initialHtml || '') || document.activeElement === root) return;
    setEditorHtml(initialHtml);
  }, [initialHtml, setEditorHtml]);

  const getEditorRange = useCallback(() => {
    const root = rootRef.current;
    const selection = window.getSelection();
    if (!root || !selection) return null;
    if (selection.rangeCount && root.contains(selection.anchorNode)) return selection.getRangeAt(0);
    if (lastRangeRef.current && root.contains(lastRangeRef.current.commonAncestorContainer)) {
      return lastRangeRef.current.cloneRange();
    }
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    return range;
  }, []);

  const selectRange = useCallback((range) => {
    const selection = window.getSelection();
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
    lastRangeRef.current = range.cloneRange();
  }, []);

  const insertTextAtSelection = useCallback((text) => {
    const range = getEditorRange();
    if (!range) return false;
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selectRange(range);
    return true;
  }, [getEditorRange, selectRange]);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      if (disabled || !rootRef.current) return;
      const range = getEditorRange();
      rootRef.current.focus();
      selectRange(range);
    },
    clear: () => setEditorHtml(''),
    setHtml: setEditorHtml,
    insertFolderTrigger: () => {
      if (disabled || !rootRef.current) return;
      const range = getEditorRange();
      rootRef.current.focus();
      if (!range) return;
      selectRange(range);
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(rootRef.current);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const beforeCaret = extractEditorText(beforeRange.cloneContents()).replace(/\u00a0/g, ' ');
      const separator = beforeCaret && !/\s$/.test(beforeCaret) ? ' ' : '';
      if (insertTextAtSelection(`${separator}@`)) sync();
    },
    replaceTriggerWithFolder: (folder) => {
      const root = rootRef.current;
      const range = getEditorRange();
      if (disabled || !root || !range) return;
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const beforeCaret = range.startContainer.nodeValue.slice(0, range.startOffset);
        const triggerMatch = beforeCaret.match(/@[^\s@]*$/);
        if (triggerMatch) range.setStart(range.startContainer, range.startOffset - triggerMatch[0].length);
      }
      const followingCharacter = range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.nodeValue.charAt(range.endOffset)
        : '';
      range.deleteContents();
      const mention = createFolderMentionNode(folder);
      const fragment = document.createDocumentFragment();
      fragment.appendChild(mention);
      let caretAnchor = mention;
      if (!followingCharacter || !/\s/.test(followingCharacter)) {
        const spacer = document.createTextNode('\u00a0');
        fragment.appendChild(spacer);
        caretAnchor = spacer;
      }
      range.insertNode(fragment);
      range.setStartAfter(caretAnchor);
      range.collapse(true);
      selectRange(range);
      sync();
    },
  }), [disabled, getEditorRange, insertTextAtSelection, selectRange, setEditorHtml, sync]);

  const removeMention = (mention) => {
    if (!mention || !rootRef.current?.contains(mention)) return;
    const nextSibling = mention.nextSibling;
    mention.remove();
    if (nextSibling?.nodeType === Node.TEXT_NODE && /^[\s\u00a0]+$/.test(nextSibling.nodeValue || '')) {
      nextSibling.remove();
    }
    rootRef.current.focus();
    sync();
  };

  const handlePaste = (event) => {
    if (disabled) return;
    event.preventDefault();
    if (insertTextAtSelection(event.clipboardData.getData('text/plain'))) sync();
  };

  const handleDrop = (event) => {
    if (disabled) return;
    event.preventDefault();
    if (insertTextAtSelection(event.dataTransfer.getData('text/plain'))) sync();
  };

  const handleEditorKeyDown = (event) => {
    const mention = event.target.closest?.('[data-folder-mention]');
    if (mention && ['Enter', ' ', 'Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault();
      removeMention(mention);
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <div
      ref={rootRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      aria-disabled={disabled}
      aria-autocomplete="list"
      aria-expanded={suggestionsVisible}
      aria-controls={suggestionsVisible ? 'bulk-agent-folder-suggestions' : undefined}
      aria-activedescendant={activeSuggestionId}
      data-placeholder={placeholder}
      onInput={sync}
      onBlur={sync}
      onClick={(event) => {
        if (!disabled) removeMention(event.target.closest?.('[data-folder-mention]'));
      }}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      onKeyDown={handleEditorKeyDown}
      className={`${className} empty:before:pointer-events-none empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)] ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    />
  );
});

InlineFolderEditor.displayName = 'InlineFolderEditor';

const AvailabilityDetails = ({ error }) => {
  const availability = error?.availability || error?.details?.availability;
  if (!availability || typeof availability !== 'object') return null;
  const entries = Object.entries(availability).filter(([, value]) => value && typeof value === 'object');
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[8px] text-red-200/75">
      {entries.slice(0, 3).map(([role, value]) => (
        <span key={role}>
          {role}: {Number(value.available ?? value.eligible ?? 0)} available
          {Number.isFinite(Number(value.reserved)) ? `, ${Number(value.reserved)} reserved` : ''}
        </span>
      ))}
    </div>
  );
};

export const BulkAgentComposer = ({
  token,
  campaignId: campaignIdProp,
  isDualVideo,
  isOpen,
  onOpenChange,
  canvasLeftOffset = 0,
  currentFrameCount,
  currentRows = [],
  onApplyPlan,
  onUndoPlan,
  onModeLockChange,
}) => {
  const campaignId = campaignIdProp || getActiveCampaignId();
  const initialDraftHtml = useMemo(() => readStoredDraft(campaignId), [campaignId]);
  const initialMessages = useMemo(() => readStoredMessages(campaignId), [campaignId]);
  const initialPlan = useMemo(() => readStoredPendingPlan(campaignId), [campaignId]);
  const editorRef = useRef(null);
  const messagesEndRef = useRef(null);
  const planningControllerRef = useRef(null);
  const applyingControllerRef = useRef(null);
  const planningRef = useRef(false);
  const applyingRef = useRef(false);
  const discardingRef = useRef(false);
  const releaseRunningRef = useRef(false);
  const releaseRetryTimerRef = useRef(null);
  const releaseRetryDelayRef = useRef(3_000);
  const processReleaseQueueRef = useRef(null);
  const mountedRef = useRef(true);
  const inputRef = useRef('');
  const draftHtmlRef = useRef(initialDraftHtml);
  const folderMentionsRef = useRef([]);
  const messagesRef = useRef(initialMessages);
  const planRef = useRef(initialPlan);
  const currentRowsRef = useRef(currentRows);
  const retryRequestRef = useRef(null);
  const applyRecoveryRef = useRef(readApplyRecovery(campaignId));

  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(() => Boolean(token && campaignId));
  const [input, setInput] = useState('');
  const [draftHtml, setDraftHtml] = useState(initialDraftHtml);
  const [folderMentions, setFolderMentions] = useState([]);
  const [mentionMatch, setMentionMatch] = useState(null);
  const mentionMatchRef = useRef(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [messages, setMessages] = useState(initialMessages);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isStartingNewChat, setIsStartingNewChat] = useState(false);
  const [plan, setPlan] = useState(initialPlan);
  const [undoState, setUndoState] = useState(() => readStoredUndo(campaignId));
  const [error, setError] = useState(null);
  const [reuseRetry, setReuseRetry] = useState(null);
  const [frameSelection, setFrameSelection] = useState({ planId: '', indexes: new Set() });
  const [previewAudioUrl, setPreviewAudioUrl] = useState('');
  const audioPlayerRef = useRef(null);
  const selectableFrameCount = plan?.assignments?.length || plan?.targetRows?.length || 0;
  const selectionPlanId = String(plan?.id || '');
  const selectedFrameIndexes = frameSelection.planId === selectionPlanId
    ? frameSelection.indexes
    : new Set(Array.from({ length: selectableFrameCount }, (_, index) => index));

  const toggleFrameSelection = (index) => {
    setFrameSelection(() => {
      const next = new Set(selectedFrameIndexes);
      if (next.has(index)) {
        if (next.size > 1) next.delete(index);
      } else {
        next.add(index);
      }
      return { planId: selectionPlanId, indexes: next };
    });
  };

  const toggleSelectAllFrames = () => {
    const total = (plan?.assignments?.length || plan?.targetRows?.length || 0);
    if (total === 0) return;
    if (selectedFrameIndexes.size === total) {
      setFrameSelection({ planId: selectionPlanId, indexes: new Set([0]) });
    } else {
      setFrameSelection({
        planId: selectionPlanId,
        indexes: new Set(Array.from({ length: total }, (_, index) => index)),
      });
    }
  };

  const toggleAudioPreview = (url) => {
    if (!url) return;
    if (previewAudioUrl === url) {
      audioPlayerRef.current?.pause();
      setPreviewAudioUrl('');
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => setPreviewAudioUrl('');
      setPreviewAudioUrl(url);
    }
  };

  useEffect(() => () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      planningControllerRef.current?.abort();
      applyingControllerRef.current?.abort();
      if (releaseRetryTimerRef.current) window.clearTimeout(releaseRetryTimerRef.current);
    };
  }, []);

  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => {
    draftHtmlRef.current = draftHtml;
    persistOptionalValue(draftStorageKey(campaignId), draftHtml ? { html: draftHtml } : null);
  }, [campaignId, draftHtml]);
  useEffect(() => { folderMentionsRef.current = folderMentions; }, [folderMentions]);
  useEffect(() => {
    messagesRef.current = messages;
    persistOptionalValue(historyStorageKey(campaignId), messages.slice(-MAX_STORED_MESSAGES));
  }, [campaignId, messages]);
  useEffect(() => {
    planRef.current = plan;
    persistOptionalValue(pendingPlanStorageKey(campaignId), plan);
  }, [campaignId, plan]);
  useEffect(() => { currentRowsRef.current = currentRows; }, [currentRows]);
  useEffect(() => { retryRequestRef.current = reuseRetry; }, [reuseRetry]);
  useEffect(() => {
    persistOptionalValue(undoStorageKey(campaignId), undoState);
  }, [campaignId, undoState]);

  const controlsLocked = isPlanning || isApplying || isDiscarding || isStartingNewChat;
  const modeLocked = controlsLocked || Boolean(plan);
  useEffect(() => {
    onModeLockChange?.(modeLocked);
    return () => onModeLockChange?.(false);
  }, [modeLocked, onModeLockChange]);

  useEffect(() => {
    if (!token || !campaignId) return undefined;
    const controller = new AbortController();
    fetchMediaLibraryFolders({ token, campaignId, signal: controller.signal })
      .then((items) => setFolders(items.filter((folder) => folder.kind !== 'carousel_set')))
      .catch((loadError) => {
        if (loadError?.name !== 'AbortError') {
          setError({ message: loadError.message || 'Unable to load folder suggestions.' });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFoldersLoading(false);
      });
    return () => controller.abort();
  }, [campaignId, token]);

  useEffect(() => {
    if (!token || !campaignId) return undefined;
    const controller = new AbortController();
    const recoverPendingPlan = async () => {
      try {
        const applyRecovery = applyRecoveryRef.current;
        if (applyRecovery?.plan?.id) {
          const recoveryResponse = await fetch(
            `${API_BASE_URL}/api/bulk-agent/plans/${encodeURIComponent(applyRecovery.plan.id)}`,
            { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
          );
          if ([404, 410].includes(recoveryResponse.status)) {
            applyRecoveryRef.current = null;
            persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
          } else {
            if (!recoveryResponse.ok) {
              const failure = await readResponsePayload(recoveryResponse, 'Unable to recover the applying plan.');
              throw Object.assign(new Error(failure.message), failure);
            }
            const recoveryPayload = await recoveryResponse.json();
            const recoveredPlan = recoveryPayload?.plan;
            if (recoveredPlan?.status === 'applied') {
              const storedUndo = readStoredUndo(campaignId);
              const alreadyOnBoard = currentRowsRef.current.some((row) => (
                row?.agentBoardRevisionPlanId === recoveredPlan.id
              ));
              let planForLocalApply = recoveredPlan;
              if (!alreadyOnBoard) {
                const idempotentApplyResponse = await fetch(
                  `${API_BASE_URL}/api/bulk-agent/plans/${encodeURIComponent(recoveredPlan.id)}/apply`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                      currentBoard: serializeCurrentBoard(
                        currentRowsRef.current,
                        typeof recoveredPlan.isDualVideo === 'boolean'
                          ? recoveredPlan.isDualVideo
                          : isDualVideo,
                      ),
                    }),
                  },
                );
                if (!idempotentApplyResponse.ok) {
                  const failure = await readResponsePayload(
                    idempotentApplyResponse,
                    'Unable to recover the applied plan.',
                  );
                  if (failure.code === 'BOARD_CHANGED' || failure.status === 409) {
                    const reservations = (recoveredPlan.assignments || []).flatMap((assignment) => (
                      ['video1', 'video2', 'audio'].map((slot) => ({
                        planId: recoveredPlan.id,
                        mediaId: getMediaId(assignment?.[slot]),
                      })).filter((entry) => entry.mediaId)
                    ));
                    if (reservations.length > 0) {
                      queueAgentReservationReleases(reservations, campaignId);
                    }
                    applyRecoveryRef.current = null;
                    persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
                    planRef.current = null;
                    setPlan(null);
                    setError({
                      message: 'The board changed before the previous plan could be recovered, so it was not applied locally. Its unused media is being released.',
                    });
                    return;
                  }
                  throw Object.assign(new Error(failure.message), failure);
                }
                const idempotentPayload = await idempotentApplyResponse.json();
                planForLocalApply = idempotentPayload?.plan || recoveredPlan;
              }
              if (!alreadyOnBoard) {
                const changeSet = onApplyPlan(planForLocalApply);
                if (!changeSet) throw new Error('The recovered plan did not contain a valid board change.');
                if (!changeSet.alreadyApplied && storedUndo?.planId !== recoveredPlan.id) {
                  const recoveredUndo = {
                    changeSet,
                    planId: recoveredPlan.id,
                    createdAt: new Date().toISOString(),
                  };
                  persistOptionalValue(undoStorageKey(campaignId), recoveredUndo);
                  setUndoState(recoveredUndo);
                }
              }
              applyRecoveryRef.current = null;
              persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
              planRef.current = null;
              setPlan(null);
              setMessages((current) => [
                ...current,
                createMessage('assistant', 'Recovered the plan that finished applying before the previous page closed.'),
              ]);
              return;
            }
            if (recoveredPlan?.status === 'pending' && !isPlanExpired(recoveredPlan)) {
              applyRecoveryRef.current = null;
              persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
              planRef.current = recoveredPlan;
              setPlan(recoveredPlan);
              return;
            }
            if (recoveredPlan?.status && recoveredPlan.status !== 'pending') {
              applyRecoveryRef.current = null;
              persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
              planRef.current = null;
              setPlan(null);
              return;
            }
          }
        }

        const response = await fetch(
          `${API_BASE_URL}/api/bulk-agent/plans/pending?campaignId=${encodeURIComponent(campaignId)}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
        );
        if (!response.ok) {
          const failure = await readResponsePayload(response, 'Unable to recover the pending plan.');
          throw Object.assign(new Error(failure.message), failure);
        }
        const payload = await response.json();
        if (payload?.plan?.id && !isPlanExpired(payload.plan)) {
          planRef.current = payload.plan;
          setPlan(payload.plan);
        } else {
          planRef.current = null;
          setPlan(null);
        }
      } catch (recoverError) {
        if (recoverError?.name !== 'AbortError') {
          setError({ message: recoverError.message || 'Unable to recover the pending plan.' });
        }
      }
    };
    void recoverPendingPlan();
    return () => controller.abort();
  }, [campaignId, isDualVideo, onApplyPlan, token]);

  useEffect(() => {
    if (!plan?.expiresAt) return undefined;
    const remainingMs = new Date(plan.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => {
      setPlan(null);
      setError({ message: 'That plan expired. Send the instruction again to reserve fresh media.' });
    }, Math.min(Math.max(0, remainingMs), 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [plan]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, messages, plan]);

  const folderPaths = useMemo(() => {
    const foldersById = new Map(folders.map((folder) => [normalizeFolderId(folder), folder]));
    const getPath = (folder) => {
      const names = [folder.name];
      const visited = new Set([normalizeFolderId(folder)]);
      let parentId = String(folder.parentFolderId?._id || folder.parentFolderId || '');
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = foldersById.get(parentId);
        if (!parent) break;
        names.unshift(parent.name);
        parentId = String(parent.parentFolderId?._id || parent.parentFolderId || '');
      }
      return names.join(' / ');
    };
    return new Map(folders.map((folder) => [normalizeFolderId(folder), getPath(folder)]));
  }, [folders]);

  const folderSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    return folders
      .filter((folder) => {
        const path = folderPaths.get(normalizeFolderId(folder)) || folder.name || '';
        const attached = folderMentions.some((mention) => mention.folderId === normalizeFolderId(folder));
        return !attached && (!mentionMatch.query || path.toLowerCase().includes(mentionMatch.query));
      })
      .sort((left, right) => {
        const leftName = folderPaths.get(normalizeFolderId(left)) || left.name;
        const rightName = folderPaths.get(normalizeFolderId(right)) || right.name;
        return leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: 'base' });
      })
      .slice(0, 8);
  }, [folderMentions, folderPaths, folders, mentionMatch]);

  const safeSuggestionIndex = Math.min(suggestionIndex, Math.max(0, folderSuggestions.length - 1));
  const activeSuggestionId = folderSuggestions[safeSuggestionIndex]
    ? `bulk-agent-folder-option-${normalizeFolderId(folderSuggestions[safeSuggestionIndex])}`
    : undefined;

  const handleEditorChange = useCallback(({ text, mentions, html, beforeCaret }) => {
    const contentChanged = html !== draftHtmlRef.current;
    const nextMatch = getMentionMatch(beforeCaret, beforeCaret.length);
    const previousMatch = mentionMatchRef.current;
    if (nextMatch?.start !== previousMatch?.start || nextMatch?.query !== previousMatch?.query) {
      setSuggestionIndex(0);
    }
    mentionMatchRef.current = nextMatch;
    draftHtmlRef.current = html;
    inputRef.current = text;
    folderMentionsRef.current = mentions;
    setMentionMatch(nextMatch);
    setDraftHtml(html);
    setInput(text);
    setFolderMentions(mentions);
    if (contentChanged) {
      setError(null);
      setReuseRetry(null);
    }
  }, []);

  const selectFolderSuggestion = useCallback((folder) => {
    if (!mentionMatchRef.current || !folder) return;
    editorRef.current?.replaceTriggerWithFolder(folder);
    mentionMatchRef.current = null;
    setMentionMatch(null);
    window.requestAnimationFrame(() => editorRef.current?.focus());
  }, []);

  const showFolderSuggestions = () => {
    if (controlsLocked) return;
    if (mentionMatchRef.current) editorRef.current?.focus();
    else editorRef.current?.insertFolderTrigger();
  };

  const openDrawer = () => {
    mentionMatchRef.current = null;
    setMentionMatch(null);
    onOpenChange(true);
    window.requestAnimationFrame(() => editorRef.current?.focus());
  };

  const discardPlan = useCallback(async (planToDiscard, { announce = true } = {}) => {
    if (!planToDiscard?.id) return true;
    if (discardingRef.current) return false;
    discardingRef.current = true;
    setIsDiscarding(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bulk-agent/plans/${encodeURIComponent(planToDiscard.id)}/discard`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok && ![404, 410].includes(response.status)) {
        const failure = await readResponsePayload(response, 'Unable to discard the plan.');
        throw Object.assign(new Error(failure.message), failure);
      }
      if (planRef.current?.id === planToDiscard.id) {
        planRef.current = null;
        setPlan(null);
      }
      if (applyRecoveryRef.current?.plan?.id === planToDiscard.id) {
        applyRecoveryRef.current = null;
        persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
      }
      if (announce) {
        setMessages((current) => [
          ...current,
          createMessage('assistant', 'Plan discarded. Its media reservation was released.'),
        ]);
      }
      return true;
    } catch (discardError) {
      setError({ message: discardError.message || 'Unable to discard the plan.' });
      return false;
    } finally {
      discardingRef.current = false;
      if (mountedRef.current) setIsDiscarding(false);
    }
  }, [campaignId, token]);

  const processReleaseQueue = useCallback(async () => {
    if (!token || !campaignId || releaseRunningRef.current) return;
    releaseRunningRef.current = true;
    let failed = false;
    try {
      for (let drainAttempt = 0; drainAttempt < 20; drainAttempt += 1) {
        const actionableReleases = filterUnreferencedAgentReservations(
          readQueuedAgentReservationReleases(campaignId),
          currentRowsRef.current,
        );
        const entries = groupAgentReservations(actionableReleases).slice(0, 100);
        if (entries.length === 0) break;
        const beforeCount = actionableReleases.length;
        const response = await fetch(`${API_BASE_URL}/api/bulk-agent/plans/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entries }),
        });
        if ([404, 410].includes(response.status)) {
          let isolatedFailure = null;
          for (const entry of entries) {
            try {
              const isolatedResponse = await fetch(
                `${API_BASE_URL}/api/bulk-agent/plans/${encodeURIComponent(entry.planId)}/release`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ sourceMediaIds: entry.sourceMediaIds }),
                },
              );
              if ([404, 410].includes(isolatedResponse.status)) {
                markAgentReservationReleaseComplete(entry.planId, entry.sourceMediaIds, campaignId);
                continue;
              }
              if (!isolatedResponse.ok) {
                const failure = await readResponsePayload(isolatedResponse, 'Unable to release unused media.');
                throw Object.assign(new Error(failure.message), failure);
              }
              const result = await isolatedResponse.json();
              const confirmedIds = Array.isArray(result?.releasedSourceMediaIds)
                ? result.releasedSourceMediaIds.map(String)
                : (
                    Number(result?.remainingCount) === 0
                    || result?.terminal === true
                    || ['discarded', 'released', 'expired'].includes(result?.plan?.status)
                    || Number(result?.releasedCount) >= entry.sourceMediaIds.length
                  )
                  ? entry.sourceMediaIds
                  : [];
              if (confirmedIds.length > 0) {
                markAgentReservationReleaseComplete(entry.planId, confirmedIds, campaignId);
              }
            } catch (entryError) {
              isolatedFailure ||= entryError;
            }
          }
          if (isolatedFailure) throw isolatedFailure;
          continue;
        }
        if (!response.ok) {
          const failure = await readResponsePayload(response, 'Unable to release unused media.');
          throw Object.assign(new Error(failure.message), failure);
        }
        const payload = await response.json();
        let entryFailureMessage = '';
        (Array.isArray(payload?.results) ? payload.results : []).forEach((result) => {
          const requested = entries.find((entry) => entry.planId === String(result?.planId || ''));
          if (!requested) return;
          const entryIsGone = [404, 410].includes(Number(result?.error?.status || result?.status));
          if (result?.ok === false && result?.terminal !== true && !entryIsGone) {
            entryFailureMessage ||= result?.message
              || result?.error?.message
              || 'Some media could not be released.';
          }
          const confirmedIds = Array.isArray(result?.releasedSourceMediaIds)
            ? result.releasedSourceMediaIds.map(String)
            : (
                Number(result?.remainingCount) === 0
                || result?.terminal === true
                || entryIsGone
                || ['discarded', 'released', 'expired'].includes(result?.plan?.status)
                || Number(result?.releasedCount) >= requested.sourceMediaIds.length
              )
              ? requested.sourceMediaIds
              : [];
          if (confirmedIds.length > 0) {
            markAgentReservationReleaseComplete(requested.planId, confirmedIds, campaignId);
          }
        });
        if (entryFailureMessage) throw new Error(entryFailureMessage);
        const afterCount = filterUnreferencedAgentReservations(
          readQueuedAgentReservationReleases(campaignId),
          currentRowsRef.current,
        ).length;
        if (afterCount === 0 || afterCount >= beforeCount) break;
      }
      releaseRetryDelayRef.current = 3_000;
    } catch (releaseError) {
      failed = true;
      if (mountedRef.current) {
        setError({ message: `${releaseError.message || 'Unable to release unused media.'} It will be retried automatically.` });
      }
    } finally {
      releaseRunningRef.current = false;
      const hasActionableReleases = filterUnreferencedAgentReservations(
        readQueuedAgentReservationReleases(campaignId),
        currentRowsRef.current,
      ).length > 0;
      if (hasActionableReleases && mountedRef.current && !releaseRetryTimerRef.current) {
        const retryDelay = releaseRetryDelayRef.current;
        releaseRetryTimerRef.current = window.setTimeout(() => {
          releaseRetryTimerRef.current = null;
          void processReleaseQueueRef.current?.();
        }, retryDelay);
        if (failed) releaseRetryDelayRef.current = Math.min(retryDelay * 2, 60_000);
      }
    }
  }, [campaignId, token]);

  useEffect(() => {
    void processReleaseQueue();
  }, [currentRows, processReleaseQueue]);

  useEffect(() => {
    processReleaseQueueRef.current = processReleaseQueue;
    return () => {
      processReleaseQueueRef.current = null;
    };
  }, [processReleaseQueue]);

  useEffect(() => {
    const handleReleaseEvent = (event) => {
      if (String(event.detail?.campaignId || '') === String(campaignId || '')) {
        void processReleaseQueue();
      }
    };
    window.addEventListener(BULK_AGENT_RELEASE_EVENT, handleReleaseEvent);
    window.addEventListener('online', processReleaseQueue);
    void processReleaseQueue();
    return () => {
      window.removeEventListener(BULK_AGENT_RELEASE_EVENT, handleReleaseEvent);
      window.removeEventListener('online', processReleaseQueue);
    };
  }, [campaignId, processReleaseQueue]);

  const submitInstruction = useCallback(async ({ allowReuse = false, retry = false } = {}) => {
    if (planningRef.current || applyingRef.current || discardingRef.current) return;
    const retryRequest = retry ? retryRequestRef.current : null;
    const submitted = retryRequest || {
      message: inputRef.current.trim(),
      html: draftHtmlRef.current,
      mentions: folderMentionsRef.current,
    };
    if (!submitted.message) return;
    if (!campaignId) {
      setError({ message: 'Select a campaign before using the assistant.' });
      return;
    }

    planningRef.current = true;
    onModeLockChange?.(true);
    setIsPlanning(true);
    setError(null);
    setReuseRetry(null);
    onOpenChange(true);
    if (planRef.current) {
      const discarded = await discardPlan(planRef.current, { announce: false });
      if (!discarded) {
        planningRef.current = false;
        setIsPlanning(false);
        return;
      }
    }

    const conversation = messagesRef.current.slice(-8).map(({ role, content }) => ({ role, content }));
    if (!retry) setMessages((current) => [...current, createMessage('user', submitted.message)]);
    const structuredMentions = deriveMentionRoles(submitted.message, submitted.mentions);
    const controller = new AbortController();
    planningControllerRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PLANNING_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/api/bulk-agent/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
        body: JSON.stringify({
          message: submitted.message,
          campaignId,
          isDualVideo,
          mentionedFolderIds: structuredMentions.map((mention) => mention.folderId),
          mentionedFolders: structuredMentions,
          conversation,
          currentFrameCount,
          currentBoard: serializeCurrentBoard(currentRowsRef.current, isDualVideo),
          allowReuse,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const failure = { ...payload, message: payload?.message || 'Unable to prepare the plan.', status: response.status };
        throw Object.assign(new Error(failure.message), failure);
      }
      if (payload?.clarification?.question) {
        setMessages((current) => [
          ...current,
          createMessage('assistant', payload.clarification.question),
        ]);
        if (draftHtmlRef.current === submitted.html) {
          editorRef.current?.clear();
          setDraftHtml('');
          setInput('');
          setFolderMentions([]);
          mentionMatchRef.current = null;
          setMentionMatch(null);
        }
        window.requestAnimationFrame(() => editorRef.current?.focus());
        return;
      }
      if (!payload?.plan) throw new Error('The assistant returned an empty plan.');
      planRef.current = payload.plan;
      setPlan(payload.plan);
      setMessages((current) => [
        ...current,
        createMessage('assistant', payload.plan.assistantMessage || 'I prepared a plan for review.'),
      ]);
      if (draftHtmlRef.current === submitted.html) {
        editorRef.current?.clear();
        setDraftHtml('');
        setInput('');
        setFolderMentions([]);
        mentionMatchRef.current = null;
        setMentionMatch(null);
      }
    } catch (requestError) {
      if (requestError?.name === 'AbortError' && !timedOut) return;
      const nextError = timedOut
        ? { message: 'Planning timed out. Your instruction is still here; try again.' }
        : {
            message: requestError.message || 'Unable to prepare the plan.',
            code: requestError.code,
            status: requestError.status,
            availability: requestError.availability,
            details: requestError.details,
            retryAt: normalizeRetryAt(requestError),
          };
      if (mountedRef.current) {
        setError(nextError);
        if (canRetryWithReuse(requestError)) {
          const savedRetry = { ...submitted, allowReuse: true };
          retryRequestRef.current = savedRetry;
          setReuseRetry(savedRetry);
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (planningControllerRef.current === controller) planningControllerRef.current = null;
      planningRef.current = false;
      if (mountedRef.current) setIsPlanning(false);
    }
  }, [campaignId, currentFrameCount, discardPlan, isDualVideo, onModeLockChange, onOpenChange, token]);

  const handleKeyDown = (event) => {
    if (mentionMatchRef.current) {
      if (event.key === 'Escape') {
        event.preventDefault();
        mentionMatchRef.current = null;
        setMentionMatch(null);
        return;
      }
      if (folderSuggestions.length > 0 && event.key === 'ArrowDown') {
        event.preventDefault();
        setSuggestionIndex((current) => (current + 1) % folderSuggestions.length);
        return;
      }
      if (folderSuggestions.length > 0 && event.key === 'ArrowUp') {
        event.preventDefault();
        setSuggestionIndex((current) => (current - 1 + folderSuggestions.length) % folderSuggestions.length);
        return;
      }
      if (folderSuggestions.length > 0 && (event.key === 'Enter' || event.key === 'Tab')) {
        event.preventDefault();
        selectFolderSuggestion(folderSuggestions[safeSuggestionIndex]);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitInstruction();
    }
  };

  const applyCurrentPlan = async () => {
    if (!planRef.current?.id || applyingRef.current || discardingRef.current) return;
    const planToApply = planRef.current;
    if (isPlanExpired(planToApply)) {
      setPlan(null);
      setError({ message: 'That plan expired. Send the instruction again.' });
      return;
    }
    applyingRef.current = true;
    setIsApplying(true);
    setError(null);

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPreviewAudioUrl('');
    }

    const hasAssignments = Array.isArray(planToApply.assignments) && planToApply.assignments.length > 0;
    const isSubset = hasAssignments && selectedFrameIndexes.size < planToApply.assignments.length;
    const filteredAssignments = hasAssignments
      ? planToApply.assignments.filter((_, index) => selectedFrameIndexes.has(index))
      : planToApply.assignments;
    const unselectedAssignments = hasAssignments
      ? planToApply.assignments.filter((_, index) => !selectedFrameIndexes.has(index))
      : [];

    const unselectedReservations = unselectedAssignments.flatMap((assignment) => (
      ['video1', 'video2', 'audio'].map((slot) => ({
        planId: planToApply.id,
        mediaId: getMediaId(assignment?.[slot]),
      })).filter((entry) => entry.mediaId)
    ));
    if (unselectedReservations.length > 0) {
      queueAgentReservationReleases(unselectedReservations, campaignId);
    }

    const planForApply = isSubset ? {
      ...planToApply,
      assignments: filteredAssignments,
      summary: {
        ...planToApply.summary,
        frameCount: filteredAssignments.length,
        affectedFrameCount: filteredAssignments.length,
      },
    } : planToApply;

    const applyRecovery = { plan: planForApply, startedAt: new Date().toISOString() };
    applyRecoveryRef.current = applyRecovery;
    persistOptionalValue(applyRecoveryStorageKey(campaignId), applyRecovery);
    const controller = new AbortController();
    applyingControllerRef.current = controller;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bulk-agent/plans/${encodeURIComponent(planToApply.id)}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentBoard: serializeCurrentBoard(
              currentRowsRef.current,
              typeof planForApply.isDualVideo === 'boolean'
                ? planForApply.isDualVideo
                : isDualVideo,
            ),
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        applyRecoveryRef.current = null;
        persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
        const failure = await readResponsePayload(response, 'Unable to apply the plan.');
        throw Object.assign(new Error(failure.message), failure);
      }
      const payload = await response.json();
      const appliedPlan = {
        ...(payload?.plan || planToApply),
        assignments: planForApply.assignments,
      };
      const changeSet = onApplyPlan(appliedPlan);
      if (!changeSet) throw new Error('The plan did not contain a valid board change.');
      if (!changeSet.alreadyApplied) {
        const nextUndoState = { changeSet, planId: appliedPlan.id, createdAt: new Date().toISOString() };
        persistOptionalValue(undoStorageKey(campaignId), nextUndoState);
        setUndoState(nextUndoState);
      }
      applyRecoveryRef.current = null;
      persistOptionalValue(applyRecoveryStorageKey(campaignId), null);
      planRef.current = null;
      setPlan(null);
      const affectedCount = filteredAssignments?.length
        || Number(
          appliedPlan.summary?.frameCount
          || appliedPlan.assignments?.length
          || appliedPlan.targetRows?.length
          || 0,
        );
      setMessages((current) => [
        ...current,
        createMessage('assistant', `Plan applied${affectedCount ? ` to ${affectedCount} frame${affectedCount === 1 ? '' : 's'}` : ''}${unselectedReservations.length > 0 ? ' (unselected media released)' : ''}. You can undo changes that have not been edited since.`),
      ]);
    } catch (applyError) {
      if (applyError?.name !== 'AbortError' && mountedRef.current) {
        setError({ message: applyError.message || 'Unable to apply the plan.' });
      }
    } finally {
      if (applyingControllerRef.current === controller) applyingControllerRef.current = null;
      applyingRef.current = false;
      if (mountedRef.current) setIsApplying(false);
    }
  };

  const undoAppliedPlan = () => {
    if (!undoState || controlsLocked) return;
    try {
      onUndoPlan(undoState.changeSet);
      persistOptionalValue(undoStorageKey(campaignId), null);
      setUndoState(null);
      setMessages((current) => [
        ...current,
        createMessage('assistant', 'The unchanged parts of the last AI plan were undone. Later manual edits were preserved.'),
      ]);
    } catch (undoError) {
      setError({ message: undoError.message || 'Unable to undo the AI plan.' });
    }
  };

  const startNewChat = async () => {
    if (isStartingNewChat || planningRef.current || applyingRef.current || discardingRef.current) return;
    setIsStartingNewChat(true);
    setError(null);
    try {
      if (planRef.current) {
        const discarded = await discardPlan(planRef.current, { announce: false });
        if (!discarded) return;
      }
      const nextMessages = [];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setDraftHtml('');
      editorRef.current?.clear();
      setInput('');
      setFolderMentions([]);
      mentionMatchRef.current = null;
      setMentionMatch(null);
      setSuggestionIndex(0);
      setReuseRetry(null);
      window.requestAnimationFrame(() => editorRef.current?.focus());
    } finally {
      setIsStartingNewChat(false);
    }
  };

  const assignments = Array.isArray(plan?.assignments) ? plan.assignments : [];
  const compiledTasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const targetRows = (Array.isArray(plan?.targetRows) ? plan.targetRows : []).map((target) => (
    typeof target === 'object' ? target : { rowId: typeof target === 'string' ? target : '', index: Number(target) }
  ));
  const planSummary = plan?.summary || {};
  const affectedFrameCount = planSummary.affectedFrameCount
    ?? planSummary.frameCount
    ?? (targetRows.length || assignments.length);
  const planIsDualVideo = typeof plan?.isDualVideo === 'boolean' ? plan.isDualVideo : isDualVideo;
  const showDefaultAudioHint = !plan && shouldShowDefaultAudioHint({
    message: input,
    mentions: folderMentions,
    folders,
  });
  const retryAt = error?.retryAt || error?.details?.retryAt || error?.availability?.retryAt;
  const errorPanel = error && (
    <div className="mt-1.5 rounded-lg bg-red-950/50 px-2 py-1.5 text-[9px] leading-relaxed text-red-300">
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{error.message}</span>
      </div>
      <AvailabilityDetails error={error} />
      {retryAt && (
        <div className="mt-1 pl-4 text-[8px] text-red-200/70">
          Earliest reserved media may be available {new Date(retryAt).toLocaleString()}.
        </div>
      )}
      {reuseRetry && !controlsLocked && (
        <button
          type="button"
          onClick={() => void submitInstruction({ allowReuse: true, retry: true })}
          className="ml-4 mt-1.5 rounded-md border border-red-300/25 bg-red-300/10 px-2 py-1 text-[8px] font-bold text-red-100 hover:bg-red-300/15"
        >
          Allow least-used repeats
        </button>
      )}
    </div>
  );

  const composerEditor = (placeholder, className) => (
    <InlineFolderEditor
      ref={editorRef}
      initialHtml={draftHtml}
      placeholder={placeholder}
      disabled={controlsLocked}
      suggestionsVisible={Boolean(mentionMatch)}
      activeSuggestionId={activeSuggestionId}
      onChange={handleEditorChange}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close Bulk Builder assistant"
          onClick={() => onOpenChange(false)}
          className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden transition-opacity"
        />
      )}

      {isOpen ? (
        <section
          aria-label="Bulk Builder AI assistant"
          className="absolute bottom-4 right-4 top-20 z-50 flex w-[min(440px,calc(100%_-_1rem))] select-text flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d10]/[0.98] text-zinc-100 shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Top Header */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0d0d10]/90 px-4 py-3.5 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/25 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-tight text-zinc-100">Bulk Composer</span>
                <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[8px] font-mono font-semibold text-violet-300">
                  {isDualVideo ? 'Dual Video' : 'Single Video'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void startNewChat()}
                disabled={controlsLocked}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-40"
                aria-label="Start a new chat"
                title="Clear conversation and start a new chat"
              >
                {isStartingNewChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SquarePen className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-all"
                aria-label="Close assistant drawer"
                title="Close drawer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Conversation Stream */}
            <div className={`space-y-2.5 px-4 py-3.5 ${messages.length === 0 && !isPlanning && !plan ? 'flex flex-1 flex-col items-center justify-center' : ''}`}>
              {messages.length === 0 && !isPlanning && !plan && (
                <div className="my-auto flex flex-col items-center justify-center px-2 py-6 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shadow-inner">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200">How can I help you build?</h4>
                  <p className="mt-1 text-[10px] text-zinc-500 max-w-64 leading-relaxed">
                    Uses campaign <span className="text-zinc-300 font-medium">Hooks</span> & <span className="text-zinc-300 font-medium">App Showcase</span> automatically. Type <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-violet-300 font-medium">@</code> for specific folders.
                  </p>
                  <div className="mt-4 flex flex-col gap-1.5 w-full max-w-72">
                    {[
                      'Create 10 frames with hooks',
                      'Add Trending BGM to all frames',
                      'Position captions at bottom',
                    ].map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        onClick={() => {
                          setInput(promptText);
                          editorRef.current?.setText?.(promptText);
                        }}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-left text-[10px] font-medium text-zinc-400 hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-zinc-200 transition-all group"
                      >
                        <span>{promptText}</span>
                        <ChevronRight className="h-3 w-3 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.slice(-8).map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] whitespace-pre-wrap rounded-xl px-2.5 py-2 text-[10px] leading-relaxed ${message.role === 'user'
                    ? 'bg-white text-black font-medium shadow-sm'
                    : 'border border-white/10 bg-white/5 text-zinc-300'
                  }`}>
                    {message.content}
                  </div>
                </div>
              ))}

              {isPlanning && (
                <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  Checking the board, folders, history and reservations…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Proposed Plan / Changeset Card */}
            {plan && (
              <div className="border-t border-white/[0.08] bg-[#111115] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/20 text-violet-300">
                      <Sparkles className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-violet-300">Proposed Changes</div>
                      <div className="text-[9px] text-zinc-500">Review and select frames to apply</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-300">
                    {plan.operation}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <SummaryStat label="Affected" value={affectedFrameCount} />
                  <SummaryStat label="Unique V1" value={planSummary.uniquePrimaryVideos ?? '—'} />
                  <SummaryStat label="Unique V2" value={planIsDualVideo ? (planSummary.uniqueSecondaryVideos ?? '—') : 'Off'} />
                  <SummaryStat label="Audio" value={planSummary.uniqueAudioTracks ?? 0} />
                </div>

                {compiledTasks.length > 0 && (
                  <div className="mb-3 max-h-24 space-y-1 overflow-y-auto rounded-xl border border-violet-500/20 bg-violet-500/5 p-2.5">
                    <div className="pb-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-violet-300">
                      Tasks to execute
                    </div>
                    {compiledTasks.map((task, index) => (
                      <div key={task.id || `${task.type}-${index}`} className="flex gap-2 text-[9px] leading-relaxed text-zinc-300">
                        <span className="shrink-0 font-mono text-zinc-500">{index + 1}.</span>
                        <span>{describeCompiledTask(task)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {assignments.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/40 p-2.5">
                    <div className="flex items-center justify-between px-1 pb-1.5 border-b border-white/[0.06] text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span>Frames ({selectedFrameIndexes.size}/{assignments.length} selected)</span>
                      <button
                        type="button"
                        onClick={toggleSelectAllFrames}
                        className="text-violet-300 hover:text-white transition-colors text-[9px]"
                      >
                        {selectedFrameIndexes.size === assignments.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
                      {assignments.map((assignment, index) => {
                        const isChecked = selectedFrameIndexes.has(index);
                        const audioUrl = assignment.audio?.url;
                        const isAudioPlaying = previewAudioUrl && previewAudioUrl === audioUrl;

                        return (
                          <div
                            key={`${assignment.targetRowId || assignment.video1?.mediaId || 'assignment'}-${index}`}
                            onClick={() => toggleFrameSelection(index)}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none text-[9px] ${
                              isChecked
                                ? 'border-violet-500/40 bg-violet-500/10 text-zinc-100 shadow-sm'
                                : 'border-white/5 bg-white/[0.02] text-zinc-500 opacity-60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFrameSelection(index)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-zinc-700 bg-zinc-800 text-violet-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 shrink-0 cursor-pointer"
                            />
                            <span className="w-4 shrink-0 font-mono text-[9px] font-bold text-zinc-500">
                              #{Number.isInteger(Number(assignment.targetIndex)) ? Number(assignment.targetIndex) + 1 : index + 1}
                            </span>

                            {/* Video 1 Preview */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                              <AssignmentThumbnail src={assignment.video1?.thumbnailUrl} />
                              <span className="truncate text-zinc-200 font-medium" title={assignment.video1?.name}>
                                {assignment.video1?.name || (assignment.caption ? `“${assignment.caption}”` : '') || 'Video 1'}
                              </span>
                            </div>

                            {/* Video 2 Preview (Dual Mode) */}
                            {assignment.video2 && (
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate border-l border-white/10 pl-1.5">
                                <AssignmentThumbnail src={assignment.video2?.thumbnailUrl} />
                                <span className="truncate text-zinc-300 font-medium" title={assignment.video2.name}>
                                  {assignment.video2.name}
                                </span>
                              </div>
                            )}

                            {/* Audio Snippet Preview */}
                            {assignment.audio && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAudioPreview(assignment.audio?.url);
                                }}
                                className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-lg bg-purple-950/40 border border-purple-800/40 hover:bg-purple-900/60 cursor-pointer transition text-purple-200"
                                title={`Preview: ${assignment.audio.name}`}
                              >
                                {isAudioPlaying ? (
                                  <Pause className="h-2.5 w-2.5 text-purple-300 animate-pulse" />
                                ) : (
                                  <Play className="h-2.5 w-2.5 text-purple-300" />
                                )}
                                <span className="max-w-16 truncate text-[8px] font-semibold">
                                  {assignment.audio.name}
                                </span>
                              </div>
                            )}

                            {/* Caption Badge */}
                            {assignment.textOverlays?.length > 0 && (
                              <span className="shrink-0 max-w-20 truncate rounded-md bg-sky-950/40 border border-sky-800/40 px-1.5 py-0.5 text-[8px] font-medium text-sky-300" title={assignment.textOverlays[0]?.text}>
                                {assignment.textOverlays[0]?.text || 'Text'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {assignments.length === 0 && targetRows.length > 0 && (
                  <div className="mt-2.5 max-h-24 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2.5">
                    {targetRows.slice(0, 8).map((target, index) => (
                      <div key={`${target.rowId || target.index || index}`} className="text-[9px] text-zinc-300">
                        Frame {Number.isInteger(Number(target.index ?? target.targetIndex))
                          ? Number(target.index ?? target.targetIndex) + 1
                          : index + 1}
                        {' — '}{plan.operation === 'clear' ? 'clear from board' : 'remove from board'}
                      </div>
                    ))}
                    {targetRows.length > 8 && (
                      <div className="text-[8px] font-semibold text-zinc-600">+{targetRows.length - 8} more frames</div>
                    )}
                  </div>
                )}

                {plan.warnings?.length > 0 && (
                  <div className="mt-2.5 space-y-1 rounded-xl border border-amber-800/40 bg-amber-950/20 p-2.5 text-[9px] leading-relaxed text-amber-300">
                    {plan.warnings.map((warning) => (
                      <div key={warning} className="flex gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3.5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void discardPlan(plan)}
                    disabled={controlsLocked}
                    className="rounded-xl border border-white/10 px-3.5 py-2 text-[10px] font-bold text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {isDiscarding ? 'Discarding…' : 'Discard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyCurrentPlan()}
                    disabled={controlsLocked || isPlanExpired(plan) || (assignments.length > 0 && selectedFrameIndexes.size === 0)}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-[#7831d6] px-4 py-2 text-[10px] font-extrabold text-white hover:from-violet-500 hover:to-[#6825bc] disabled:opacity-50 transition-all shadow-md shadow-violet-600/25 active:scale-95"
                  >
                    {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {assignments.length > 0 && selectedFrameIndexes.size < assignments.length
                      ? `Apply Selected (${selectedFrameIndexes.size})`
                      : `Apply plan (${assignments.length || targetRows.length || 1})`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Undo Notification Pill */}
          {undoState && !plan && (
            <div className="mx-3.5 mb-2 flex shrink-0 items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-950/90 px-3 py-2 text-[9px] font-semibold text-emerald-200 shadow-xl">
              <span>AI plan applied to the board.</span>
              <button
                type="button"
                onClick={undoAppliedPlan}
                disabled={controlsLocked}
                className="flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-emerald-100 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            </div>
          )}

          {/* Drawer Composer Input Box */}
          <div className="relative mx-3.5 mb-3.5 shrink-0 rounded-2xl border border-white/[0.1] bg-[#141418] p-3 shadow-xl transition-all focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20">
            <FolderSuggestionMenu
              isVisible={Boolean(mentionMatch) && !controlsLocked}
              foldersLoading={foldersLoading}
              folderSuggestions={folderSuggestions}
              suggestionIndex={safeSuggestionIndex}
              folderPaths={folderPaths}
              onHighlight={setSuggestionIndex}
              onSelect={selectFolderSuggestion}
            />
            {composerEditor('What do you want to create? (type @ for specific folders)', 'max-h-28 min-h-10 w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-1 py-1 text-[12px] leading-5 text-white outline-none placeholder:text-zinc-500')}
            {showDefaultAudioHint && (
              <div className="px-1 text-[8px] leading-relaxed text-sky-300/70" role="status">
                When no audio folder is attached, music uses Trending Songs automatically.
              </div>
            )}
            <div className="mt-2 flex items-center justify-between pt-1 border-t border-white/[0.04]">
              <button
                type="button"
                onClick={showFolderSuggestions}
                disabled={controlsLocked}
                className="flex items-center gap-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors disabled:opacity-40"
                aria-label="Attach a Media Library folder"
              >
                <Folder className="h-3 w-3 text-sky-400" />
                <span>Attach</span>
              </button>
              <button
                type="button"
                onClick={() => void submitInstruction()}
                disabled={!input.trim() || controlsLocked}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-zinc-600 shadow-md shadow-violet-600/20 active:scale-95"
                aria-label="Send instruction"
              >
                {isPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
            {errorPanel}
          </div>
        </section>
      ) : (
        /* Collapsed Floating Island Composer (Codex Style) */
        <div
          className="pointer-events-none absolute bottom-5 right-0 z-40 flex justify-center px-4 transition-[left] duration-200"
          style={{ left: `${canvasLeftOffset}px` }}
        >
          <section
            aria-label="Bulk Builder AI composer"
            className="pointer-events-auto relative w-full max-w-2xl select-text rounded-2xl border border-white/[0.1] bg-[#101014]/[0.94] p-3 text-zinc-100 shadow-[0_20px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <FolderSuggestionMenu
              isVisible={Boolean(mentionMatch) && !controlsLocked}
              foldersLoading={foldersLoading}
              folderSuggestions={folderSuggestions}
              suggestionIndex={safeSuggestionIndex}
              folderPaths={folderPaths}
              onHighlight={setSuggestionIndex}
              onSelect={selectFolderSuggestion}
            />
            {composerEditor('Ask AI to build or edit frames... (type @ for specific folders)', 'max-h-32 min-h-12 w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-1.5 pl-2 pr-12 text-[12px] leading-5 text-white outline-none placeholder:text-zinc-500')}
            {showDefaultAudioHint && (
              <div className="px-2 text-[8px] leading-relaxed text-sky-300/70" role="status">
                When no audio folder is attached, music uses Trending Songs automatically.
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-3 pt-1 border-t border-white/[0.04]">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={showFolderSuggestions}
                  disabled={controlsLocked}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 px-2.5 py-1 text-[10px] font-medium text-zinc-300 transition-colors disabled:opacity-40"
                  aria-label="Attach a Media Library folder"
                >
                  <Folder className="h-3.5 w-3.5 text-sky-400" />
                  <span>Attach @</span>
                </button>
                <span className="rounded-md bg-white/[0.03] border border-white/5 px-2 py-0.5 text-[9px] font-mono text-zinc-400">
                  {plan ? `${planIsDualVideo ? 'Dual' : 'Single'} locked` : (isDualVideo ? 'Dual Video' : 'Single Video')}
                </span>
                <span className="truncate text-[9px] text-zinc-500">
                  {currentFrameCount} frames on board
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={openDrawer}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"
                  aria-label="Expand agent drawer"
                  title="Open conversation panel"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void submitInstruction()}
                  disabled={!input.trim() || controlsLocked}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-zinc-600 shadow-md shadow-violet-600/25 active:scale-95"
                  aria-label="Send instruction"
                >
                  {isPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {errorPanel}
          </section>
        </div>
      )}
    </>
  );
};

export default BulkAgentComposer;
