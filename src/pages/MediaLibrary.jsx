import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Folder, Images, Info, MessageSquareCheck, MessageSquareWarning, MoreVertical, Music, Pencil, Search, Upload, Plus, Trash2, ChevronRight, Clock, Save, Sparkles, Tags, X } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from './videoEditor/videoEditorConstants';
import {
  MEDIA_LIBRARY_STALE_TIME,
  MEDIA_LIBRARY_GC_TIME,
  mediaLibraryKeys,
} from './videoEditorV2/media/mediaLibraryCache';
import { getMediaUrl } from '../utils/mediaUrls';
import { generateVideoThumbnailBlob } from '../utils/videoThumbnail';
import LoadingVideoPreview from '../components/LoadingVideoPreview';

const PAGE_SIZE = 18;

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });
const getProxiedAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL, proxy: true });

const getErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
};

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');
const normalizeScope = (scope) => (scope === 'global' ? 'global' : 'campaign');

const getMediaFolderKind = (item, folders = []) => {
  const targetFolderId = String(item?.folderId?._id || item?.folderId || '');
  if (!targetFolderId) return null;

  const folderMap = new Map((folders || []).map((f) => [String(f._id), f]));
  let currentId = targetFolderId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = folderMap.get(currentId);
    if (!folder) break;

    const name = String(folder.name || '').toLowerCase().trim();
    const tags = (folder.tags || []).map((t) => String(t).toLowerCase());

    if (name.includes('hook') || tags.includes('hooks') || tags.includes('hook')) {
      return 'hook';
    }
    if (
      name.includes('showcase') ||
      name.includes('promo') ||
      name.includes('demo') ||
      tags.includes('app-showcase') ||
      tags.includes('showcase')
    ) {
      return 'showcase';
    }

    currentId = folder.parentFolderId ? String(folder.parentFolderId?._id || folder.parentFolderId) : null;
  }
  return null;
};

const getMediaFolderName = (item, folders = []) => {
  const targetFolderId = String(item?.folderId?._id || item?.folderId || '');
  if (!targetFolderId) return 'Library Root';
  const folder = (folders || []).find((f) => String(f._id) === targetFolderId);
  return folder?.name || 'Folder';
};

const normalizeTagList = (tags) => {
  const rawTags = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return Array.from(new Set(
    rawTags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
  ));
};

const getRelativePath = (file) => file.webkitRelativePath || file.name || '';

const splitRelativePath = (file) => {
  const relativePath = getRelativePath(file);
  const lastSlashIndex = relativePath.lastIndexOf('/');
  const directory = lastSlashIndex === -1 ? '' : relativePath.slice(0, lastSlashIndex);
  const filename = lastSlashIndex === -1 ? relativePath : relativePath.slice(lastSlashIndex + 1);
  const dotIndex = filename.lastIndexOf('.');
  const basename = dotIndex === -1 ? filename : filename.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : filename.slice(dotIndex + 1).toLowerCase();

  return {
    directory: directory.toLowerCase(),
    basename: basename.toLowerCase(),
    extension,
  };
};

const getCaptionMatchKeys = (file) => {
  const { directory, basename } = splitRelativePath(file);
  const baseKey = `${directory}/${basename}`;
  const keys = [baseKey];

  if (basename.endsWith('s')) {
    keys.push(`${directory}/${basename.slice(0, -1)}`);
  } else {
    keys.push(`${directory}/${basename}s`);
  }

  return keys;
};

const buildCaptionFileMap = async (files) => {
  const captionFiles = files.filter((file) => splitRelativePath(file).extension === 'txt');
  const captionMap = new Map();

  await Promise.all(captionFiles.map(async (file) => {
    const { directory, basename } = splitRelativePath(file);
    const text = (await file.text()).trim();
    if (!text) return;
    captionMap.set(`${directory}/${basename}`, text);
  }));

  return captionMap;
};

const getImportedCaption = (captionMap, mediaFile) => {
  for (const key of getCaptionMatchKeys(mediaFile)) {
    if (captionMap.has(key)) return captionMap.get(key);
  }
  return '';
};

const isSupportedMediaFile = (file) => (
  file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')
);

const getPathParts = (file) => (file.webkitRelativePath || file.name || '')
  .split('/')
  .filter(Boolean);

const naturalFileCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const getSlideSortKey = (slide) => {
  const parts = getPathParts(slide.file);
  return parts[parts.length - 1] || slide.name || '';
};

const getCarouselSetSortKey = (set) => set.id || set.name || '';

const buildCarouselSetDrafts = async (files) => {
  const mediaFiles = files.filter(file => (
    file.type.startsWith('image/') || file.type.startsWith('video/')
  ));
  const captionMap = await buildCaptionFileMap(files);
  const groups = new Map();

  mediaFiles.forEach((file, uploadIndex) => {
    const parts = getPathParts(file);
    const setName = parts.length >= 2 ? parts[parts.length - 2] : 'Carousel Set';
    const parentName = parts.length >= 3 ? parts[0] : 'Carousel Sets';
    const setPath = parts.length >= 2 ? parts.slice(0, -1).join('/') : setName;
    if (!groups.has(setPath)) {
      groups.set(setPath, {
        id: setPath,
        name: setName,
        parentName,
        caption: '',
        slides: [],
      });
    }
    const group = groups.get(setPath);
    group.slides.push({
      id: `${setPath}-${uploadIndex}`,
      file,
      name: file.name,
      uploadIndex,
      previewUrl: URL.createObjectURL(file),
    });
  });

  const drafts = Array.from(groups.values())
    .map((group) => {
      const captionFile = files.find((file) => {
        const parts = getPathParts(file);
        if (parts.length < 2 || !file.name.toLowerCase().endsWith('.txt')) return false;
        return parts.slice(0, -1).join('/') === group.id;
      });
      return {
        ...group,
        caption: captionFile ? '' : group.caption,
        slides: group.slides.sort((a, b) => naturalFileCollator.compare(
          getSlideSortKey(a),
          getSlideSortKey(b)
        )),
        getCaption: (file) => getImportedCaption(captionMap, file),
      };
    })
    .filter((group) => group.slides.length > 0)
    .sort((a, b) => naturalFileCollator.compare(
      getCarouselSetSortKey(a),
      getCarouselSetSortKey(b)
    ));

  await Promise.all(drafts.map(async (group) => {
    const setCaptionFile = files.find((file) => {
      const parts = getPathParts(file);
      if (parts.length < 2 || !file.name.toLowerCase().endsWith('.txt')) return false;
      const filename = parts[parts.length - 1].toLowerCase();
      const directory = parts.slice(0, -1).join('/');
      return directory === group.id && ['caption.txt', 'captions.txt'].includes(filename);
    });
    if (setCaptionFile) {
      group.caption = (await setCaptionFile.text()).trim();
    }
  }));

  return drafts;
};

const buildSingleCarouselDraft = (files, setName = 'Carousel Set') => {
  const slides = files
    .filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'))
    .map((file, uploadIndex) => ({
      id: `carousel-file-${uploadIndex}`,
      file,
      name: file.name,
      uploadIndex,
      previewUrl: URL.createObjectURL(file),
    }));

  if (slides.length === 0) return [];

  return [{
    id: `carousel-${Date.now()}`,
    name: setName,
    parentName: 'Carousel Uploads',
    caption: '',
    slides,
    getCaption: () => '',
  }];
};

const buildFileUploadDrafts = async (files) => {
  const captionMap = await buildCaptionFileMap(files);
  return files
    .filter(isSupportedMediaFile)
    .map((file, uploadIndex) => {
      const caption = getImportedCaption(captionMap, file);
      return {
        id: `file-upload-${Date.now()}-${uploadIndex}`,
        file,
        name: file.name,
        uploadIndex,
        caption,
        previewUrl: URL.createObjectURL(file),
      };
    });
};

const formatFileSize = (size) => {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

export const getFolderStats = (folder, allFolders = []) => {
  const folderId = normalizeFolderId(folder?._id);
  const childSubfolders = allFolders.filter(
    (item) => normalizeFolderId(item?.parentFolderId) === folderId
  );
  const subfolderCount = childSubfolders.length || Number(folder?.subfolderCount || 0);
  const directMediaCount = Number(folder?.itemCount ?? (folder?.carouselOrder || []).length ?? 0);
  const totalSubItems = childSubfolders.reduce(
    (acc, sub) => acc + Number(sub.itemCount ?? (sub.carouselOrder || []).length ?? 0),
    0
  );

  let label = '';
  if (subfolderCount > 0 && directMediaCount > 0) {
    label = `${subfolderCount} ${subfolderCount === 1 ? 'folder' : 'folders'} • ${directMediaCount} ${directMediaCount === 1 ? 'item' : 'items'}`;
  } else if (subfolderCount > 0) {
    if (totalSubItems > 0) {
      label = `${subfolderCount} ${subfolderCount === 1 ? 'folder' : 'folders'} • ${totalSubItems} ${totalSubItems === 1 ? 'item' : 'items'}`;
    } else {
      label = `${subfolderCount} ${subfolderCount === 1 ? 'folder' : 'folders'}`;
    }
  } else {
    label = `${directMediaCount} ${directMediaCount === 1 ? 'item' : 'items'}`;
  }

  let preview = folder?.coverMedia || folder?.previewMedia;
  if (!preview && childSubfolders.length > 0) {
    const subWithPreview = childSubfolders.find((sub) => sub.coverMedia || sub.previewMedia);
    preview = subWithPreview?.coverMedia || subWithPreview?.previewMedia || null;
  }

  return {
    subfolderCount,
    directMediaCount,
    totalSubItems,
    label,
    preview,
  };
};

const MediaFolderPreview = ({ folder, allFolders = [] }) => {
  const stats = getFolderStats(folder, allFolders);
  const preview = stats.preview;
  const previewSource = preview?.thumbnailUrl || preview?.url;
  const [useProxy, setUseProxy] = useState(false);
  const imageSource = useProxy ? getProxiedAssetUrl(previewSource) : getAssetUrl(previewSource);

  return (
    <span className="relative block h-[72px] w-[90px] flex-shrink-0" aria-hidden="true">
      <span className="absolute left-1 top-0 h-4 w-10 rounded-t-lg bg-[#323740]" />
      <span className="absolute inset-x-0 bottom-0 top-2 overflow-hidden rounded-xl border border-white/10 bg-[#282c33] shadow-sm">
        <span className="absolute inset-x-1.5 bottom-0 top-3 overflow-hidden rounded-t-lg bg-[#282c33]">
          {previewSource && preview?.type === 'image' && (
            <img
              src={imageSource}
              alt=""
              loading="lazy"
              className="relative z-[1] mx-auto h-full w-3/4 rounded-t-lg object-cover object-[center_40%]"
              onError={() => setUseProxy(true)}
            />
          )}
          {previewSource && preview?.type === 'video' && (
            preview.thumbnailUrl ? (
              <img
                src={imageSource}
                alt=""
                loading="lazy"
                className="relative z-[1] mx-auto h-full w-3/4 rounded-t-lg object-cover object-[center_40%]"
                onError={() => setUseProxy(true)}
              />
            ) : (
              <LoadingVideoPreview
                src={getAssetUrl(preview.url)}
                className="relative z-[1] mx-auto h-full w-3/4 overflow-hidden rounded-t-lg"
                videoClassName="h-full w-full object-cover"
                loadingLabel=""
                waitForLoadedData
                muted
                playsInline
                preload="metadata"
              />
            )
          )}
          {preview?.type === 'audio' && (
            <span className="flex h-full w-full items-center justify-center text-[#8e8e93]">
              <Music className="h-6 w-6" />
            </span>
          )}
          {!previewSource && preview?.type !== 'audio' && (
            <span className="flex h-full w-full items-center justify-center text-[#666d78]">
              <Folder className="h-6 w-6" />
            </span>
          )}
        </span>
      </span>
    </span>
  );
};

const createUploadBatchId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const UPLOAD_CONCURRENCY = 20;

const runWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

export const MediaLibrary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();

  const campaignId = getActiveCampaignId();
  const initialFolderId = location.state?.preselectedFolderId || 'root';

  const [folders, setFolders] = useState(() => {
    const cached = queryClient.getQueryData(mediaLibraryKeys.folders(campaignId));
    return Array.isArray(cached) ? cached : [];
  });
  const [media, setMedia] = useState(() => {
    if (initialFolderId === 'root') return [];
    const cached = queryClient.getQueryData(
      mediaLibraryKeys.media(campaignId, initialFolderId, 1, PAGE_SIZE)
    );
    return Array.isArray(cached) ? cached : [];
  });
  const [activeFolderId, setActiveFolderId] = useState(initialFolderId);

  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderScope, setNewFolderScope] = useState('campaign');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [savingCaptionId, setSavingCaptionId] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [savingFolderId, setSavingFolderId] = useState(null);
  const [taggingFolder, setTaggingFolder] = useState(null);
  const [folderTagDrafts, setFolderTagDrafts] = useState([]);
  const [folderTagInput, setFolderTagInput] = useState('');
  const [savingFolderTagsId, setSavingFolderTagsId] = useState(null);
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [settingFolderCoverId, setSettingFolderCoverId] = useState(null);
  const [folderPendingDelete, setFolderPendingDelete] = useState(null);
  const [deletingFolderId, setDeletingFolderId] = useState(null);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState('');
  const [openMediaMenuId, setOpenMediaMenuId] = useState(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState([]);
  const [captionDialogMedia, setCaptionDialogMedia] = useState(null);
  const [taggingMedia, setTaggingMedia] = useState(null);
  const [mediaTagDrafts, setMediaTagDrafts] = useState([]);
  const [mediaTagInput, setMediaTagInput] = useState('');
  const [savingMediaTagsId, setSavingMediaTagsId] = useState(null);
  const [loadingFolders, setLoadingFolders] = useState(() => {
    const cached = queryClient.getQueryData(mediaLibraryKeys.folders(campaignId));
    return !Array.isArray(cached) || cached.length === 0;
  });
  const [loadingMedia, setLoadingMedia] = useState(() => {
    if (initialFolderId === 'root') return false;
    const cached = queryClient.getQueryData(
      mediaLibraryKeys.media(campaignId, initialFolderId, 1, PAGE_SIZE)
    );
    return !Array.isArray(cached) || cached.length === 0;
  });
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [renamingMedia, setRenamingMedia] = useState(null);
  const [renameMediaName, setRenameMediaName] = useState('');
  const [savingMediaNameId, setSavingMediaNameId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [carouselDrafts, setCarouselDrafts] = useState([]);
  const [carouselParentName, setCarouselParentName] = useState('');
  const [carouselUploadInputKey, setCarouselUploadInputKey] = useState(0);
  const [fileUploadDrafts, setFileUploadDrafts] = useState([]);
  const [fileUploadInputKey, setFileUploadInputKey] = useState(0);
  const [uploadFolderName, setUploadFolderName] = useState('');
  const [uploadFolderScope, setUploadFolderScope] = useState('campaign');
  const [draggingSlide, setDraggingSlide] = useState(null);
  const [viewingAiMediaId, setViewingAiMediaId] = useState(null);
  const [analyzingMediaId, setAnalyzingMediaId] = useState(null);
  const fileUploadDraftsRef = useRef([]);
  const folderCoverInputRef = useRef(null);
  const folderCoverTargetRef = useRef(null);
  // Per-set save progress: { [setId]: 'pending' | 'uploading' | 'done' | 'error' }
  const [setProgress, setSetProgress] = useState({});

  const authToken = token || localStorage.getItem('tw_token');
  const canUpload = ['owner', 'admin', 'editor'].includes(user?.role);
  const canDelete = ['owner', 'admin'].includes(user?.role);
  const canManageGlobalMedia = ['owner', 'admin'].includes(user?.role);
  const canManageFolders = canUpload;
  const canSchedule = canUpload;
  const resetUploadProgress = () => setUploadProgress(null);
  const getUploadProgressText = () => {
    if (!uploadProgress) return 'Uploading to R2...';

    const uploaded = uploadProgress.completed || 0;
    const failed = uploadProgress.failed || 0;
    const active = uploadProgress.active || 0;
    const total = uploadProgress.total || 0;
    const pieces = [`Uploaded ${uploaded}/${total}`];
    if (active > 0) pieces.push(`${active} active`);
    if (failed > 0) pieces.push(`${failed} failed`);
    return pieces.join(' • ');
  };
  const invalidateMediaCaches = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['media-library'] }),
    queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
  const updateEditorFolderCache = (folderId, updates) => {
    queryClient.setQueriesData(
      { queryKey: mediaLibraryKeys.allFolders },
      (current) => (Array.isArray(current)
        ? current.map((folder) => (
            String(folder._id) === String(folderId) ? { ...folder, ...updates } : folder
          ))
        : current),
    );
  };

  const clearCarouselDrafts = () => {
    carouselDrafts.forEach((set) => {
      set.slides.forEach((slide) => URL.revokeObjectURL(slide.previewUrl));
    });
    setCarouselDrafts([]);
    setCarouselParentName('');
    setDraggingSlide(null);
    setCarouselUploadInputKey((current) => current + 1);
  };

  const clearFileUploadDrafts = () => {
    fileUploadDrafts.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
    setFileUploadDrafts([]);
    setUploadFolderName('');
    setUploadFolderScope('campaign');
    setFileUploadInputKey((current) => current + 1);
  };

  useEffect(() => {
    fileUploadDraftsRef.current = fileUploadDrafts;
  }, [fileUploadDrafts]);

  useEffect(() => () => {
    fileUploadDraftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
  }, []);

  useEffect(() => {
    if (!openFolderMenuId) return undefined;

    const closeFolderMenuOnOutsideClick = (event) => {
      if (event.target.closest('[data-folder-menu]')) return;
      setOpenFolderMenuId(null);
    };

    document.addEventListener('pointerdown', closeFolderMenuOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeFolderMenuOnOutsideClick);
  }, [openFolderMenuId]);

  const uploadMediaFiles = async ({
    files,
    folderId,
    getCaption = () => '',
    getUploadOrder = () => undefined,
    uploadBatchId = '',
    uploadBatchCreatedAt = '',
    scope = 'campaign',
    progressLabel = 'Uploading',
  }) => {
    const failedFiles = [];
    const uploadedMedia = [];
    let completed = 0;
    let failed = 0;
    let active = 0;
    let shouldAttemptDirectUpload = true;

    const updateProgress = (currentFile = '') => {
      setUploadProgress({
        total: files.length,
        completed,
        failed,
        active,
        currentFile,
      });
    };

    const uploadViaNode = async (file, caption, uploadOrder) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', folderId);
      formData.append('tags', '');
      formData.append('caption', caption);
      if (uploadBatchId) formData.append('uploadBatchId', uploadBatchId);
      if (uploadBatchCreatedAt) formData.append('uploadBatchCreatedAt', uploadBatchCreatedAt);
      if (uploadOrder !== undefined) formData.append('uploadOrder', String(uploadOrder));
      formData.append('socialAccountIds', '');
      formData.append('campaignId', getActiveCampaignId());
      formData.append('scope', normalizeScope(scope));

      const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Upload failed.'));
      }
      return response.json();
    };

    const uploadDirectToR2 = async (file, caption, uploadOrder) => {
      const campaignId = getActiveCampaignId();
      const contentType = file.type || 'application/octet-stream';
      const isVideo = typeof contentType === 'string' && contentType.startsWith('video/');

      const [initResponse, thumbBlob] = await Promise.all([
        fetch(`${API_BASE_URL}/api/media/direct-upload/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            campaignId,
            scope: normalizeScope(scope),
            folderId,
            name: file.name,
            contentType,
            size: file.size,
          }),
        }),
        isVideo ? generateVideoThumbnailBlob(file).catch(() => null) : Promise.resolve(null),
      ]);

      if (!initResponse.ok) {
        throw new Error(await getErrorMessage(initResponse, 'Direct upload is not available.'));
      }

      const upload = await initResponse.json();

      const uploadPromises = [
        fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: file,
        }),
      ];

      let hasUploadedThumbnail = false;
      if (thumbBlob && upload.thumbnailUploadUrl) {
        uploadPromises.push(
          fetch(upload.thumbnailUploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'image/jpeg',
            },
            body: thumbBlob,
          }).then((res) => {
            if (res.ok) hasUploadedThumbnail = true;
          }).catch(() => {})
        );
      }

      const [r2Response] = await Promise.all(uploadPromises);

      if (!r2Response.ok) {
        throw new Error('Direct upload to R2 failed.');
      }

      const completeResponse = await fetch(`${API_BASE_URL}/api/media/direct-upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId,
          scope: normalizeScope(scope),
          folderId,
          mediaId: upload.mediaId,
          name: file.name,
          contentType,
          size: file.size,
          storageKey: upload.storageKey,
          ...(hasUploadedThumbnail && upload.thumbnailStorageKey
            ? {
                thumbnailStorageKey: upload.thumbnailStorageKey,
                thumbnailUrl: upload.thumbnailUrl,
              }
            : {}),
          caption,
          ...(uploadBatchId ? { uploadBatchId } : {}),
          ...(uploadBatchCreatedAt ? { uploadBatchCreatedAt } : {}),
          ...(uploadOrder !== undefined ? { uploadOrder } : {}),
          tags: '',
          socialAccountIds: '',
        }),
      });

      if (!completeResponse.ok) {
        throw new Error(await getErrorMessage(completeResponse, 'Could not save uploaded media.'));
      }
      return completeResponse.json();
    };

    updateProgress('');

    await runWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, index) => {
      active += 1;
      updateProgress(`${progressLabel}: ${file.webkitRelativePath || file.name}`);

      try {
        const caption = getCaption(file);
        const uploadOrder = getUploadOrder(file, index);
        if (shouldAttemptDirectUpload) {
          try {
            const uploaded = await uploadDirectToR2(file, caption, uploadOrder);
            uploadedMedia.push({ file, media: uploaded });
            return;
          } catch (directError) {
            shouldAttemptDirectUpload = false;
            console.warn('Direct R2 upload failed, using Node upload fallback for this batch:', directError.message);
          }
        }
        const uploaded = await uploadViaNode(file, caption, uploadOrder);
        uploadedMedia.push({ file, media: uploaded });
      } catch (error) {
        failed += 1;
        failedFiles.push(`${file.name} (${error.message || 'Upload failed'})`);
      } finally {
        active -= 1;
        completed += 1;
        updateProgress(file.webkitRelativePath || file.name);
      }
    });

    return { failedFiles, uploadedMedia };
  };

  const fetchFolders = useCallback(async ({ force = false } = {}) => {
    const currentCampaignId = getActiveCampaignId();
    const queryKey = mediaLibraryKeys.folders(currentCampaignId);
    const cached = queryClient.getQueryData(queryKey);
    if (!cached || cached.length === 0) {
      setLoadingFolders(true);
    } else {
      setFolders(cached);
    }
    setErrorMessage('');
    try {
      if (force) {
        await queryClient.invalidateQueries({ queryKey });
      }
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          if (!response.ok) {
            throw new Error(await getErrorMessage(response, 'Failed to load folders.'));
          }
          return response.json();
        },
        staleTime: force ? 0 : MEDIA_LIBRARY_STALE_TIME,
        gcTime: MEDIA_LIBRARY_GC_TIME,
      });
      const nextFolders = Array.isArray(data) ? data : [];
      setFolders(nextFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      if (!cached) setFolders([]);
      setErrorMessage(error.message || 'Failed to load folders.');
    } finally {
      setLoadingFolders(false);
    }
  }, [authToken, queryClient]);

  const openFolderCoverPicker = (folder, event) => {
    event.stopPropagation();
    setOpenFolderMenuId(null);
    folderCoverTargetRef.current = folder;
    folderCoverInputRef.current?.click();
  };

  const handleFolderCoverSelect = async (event) => {
    const file = event.target.files?.[0];
    const folder = folderCoverTargetRef.current;
    event.target.value = '';
    if (!file || !folder) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Choose an image file for the folder cover.');
      return;
    }

    setSettingFolderCoverId(folder._id);
    setErrorMessage('');
    try {
      const { failedFiles, uploadedMedia } = await uploadMediaFiles({
        files: [file],
        folderId: folder._id,
        scope: normalizeScope(folder.scope),
        progressLabel: 'Uploading folder cover',
      });
      const coverMedia = uploadedMedia[0]?.media;
      if (failedFiles.length > 0 || !coverMedia?._id) {
        throw new Error(failedFiles[0] || 'The cover image could not be uploaded.');
      }

      const response = await fetch(`${API_BASE_URL}/api/media/folders/${folder._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ coverMediaId: coverMedia._id }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Could not set the folder cover.'));
      }

      const updatedFolder = await response.json();
      setFolders((current) => current.map((currentFolder) => (
        currentFolder._id === folder._id
          ? {
              ...currentFolder,
              ...updatedFolder,
              coverMediaId: coverMedia._id,
              coverMedia: {
                _id: coverMedia._id,
                name: coverMedia.name || file.name,
                type: 'image',
                url: coverMedia.url,
                thumbnailUrl: coverMedia.thumbnailUrl || '',
              },
              itemCount: Number(currentFolder.itemCount || 0) + 1,
            }
          : currentFolder
      )));
      updateEditorFolderCache(folder._id, {
        ...updatedFolder,
        coverMediaId: coverMedia._id,
        coverMedia: {
          _id: coverMedia._id,
          name: coverMedia.name || file.name,
          type: 'image',
          url: coverMedia.url,
          thumbnailUrl: coverMedia.thumbnailUrl || '',
        },
      });
      await invalidateMediaCaches();
    } catch (error) {
      console.error('Failed setting folder cover:', error);
      setErrorMessage(error.message || 'Could not set the folder cover.');
    } finally {
      folderCoverTargetRef.current = null;
      setSettingFolderCoverId(null);
      resetUploadProgress();
    }
  };

  const handleRemoveFolderCover = async (folder, event) => {
    event.stopPropagation();
    setOpenFolderMenuId(null);
    setSettingFolderCoverId(folder._id);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${folder._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ coverMediaId: null }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Could not remove the folder cover.'));
      }

      const updatedFolder = await response.json();
      setFolders((current) => current.map((currentFolder) => (
        currentFolder._id === folder._id
          ? {
              ...currentFolder,
              ...updatedFolder,
              coverMediaId: null,
              coverMedia: null,
            }
          : currentFolder
      )));
      updateEditorFolderCache(folder._id, {
        ...updatedFolder,
        coverMediaId: null,
        coverMedia: null,
      });
      await invalidateMediaCaches();
    } catch (error) {
      console.error('Failed removing folder cover:', error);
      setErrorMessage(error.message || 'Could not remove the folder cover.');
    } finally {
      setSettingFolderCoverId(null);
    }
  };

  const fetchMedia = useCallback(async (targetPageOrOptions = 1, maybeOptions = {}) => {
    let targetPage = 1;
    let force = false;

    if (typeof targetPageOrOptions === 'boolean') {
      force = targetPageOrOptions;
      targetPage = 1;
    } else if (typeof targetPageOrOptions === 'number') {
      targetPage = targetPageOrOptions;
      force = Boolean(maybeOptions?.force);
    } else if (typeof targetPageOrOptions === 'object' && targetPageOrOptions !== null) {
      targetPage = targetPageOrOptions.page || 1;
      force = Boolean(targetPageOrOptions.force);
    }

    const isFirstPage = targetPage === 1;
    const currentCampaignId = getActiveCampaignId();
    const queryKey = mediaLibraryKeys.media(currentCampaignId, activeFolderId, targetPage, PAGE_SIZE);
    const cached = isFirstPage && !force ? queryClient.getQueryData(queryKey) : null;

    if (isFirstPage) {
      if (!cached || cached.length === 0) {
        setLoadingMedia(true);
      } else {
        setMedia(cached);
      }
    } else {
      setLoadingMore(true);
    }
    setErrorMessage('');
    try {
      const params = new URLSearchParams();
      if (currentCampaignId) params.set('campaignId', currentCampaignId);
      if (activeFolderId) params.set('folderId', activeFolderId);
      params.set('page', String(targetPage));
      params.set('limit', String(PAGE_SIZE));
      const url = `${API_BASE_URL}/api/media?${params.toString()}`;

      let items = [];
      if (force) {
        // Direct network fetch bypassing stale query cache
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
        if (!response.ok) {
          throw new Error(await getErrorMessage(response, 'Failed to load media.'));
        }
        const freshData = await response.json();
        items = Array.isArray(freshData) ? freshData : [];
        queryClient.setQueryData(queryKey, items);
      } else {
        const data = await queryClient.fetchQuery({
          queryKey,
          queryFn: async () => {
            const response = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
            if (!response.ok) {
              throw new Error(await getErrorMessage(response, 'Failed to load media.'));
            }
            return response.json();
          },
          staleTime: MEDIA_LIBRARY_STALE_TIME,
          gcTime: MEDIA_LIBRARY_GC_TIME,
        });
        items = Array.isArray(data) ? data : [];
      }

      if (isFirstPage) {
        setMedia(items);
      } else {
        setMedia((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === PAGE_SIZE);
      setPage(targetPage);
    } catch (error) {
      console.error('Failed to load media:', error);
      if (isFirstPage && !cached) {
        setMedia([]);
      }
      setErrorMessage(error.message || 'Failed to load media.');
    } finally {
      if (isFirstPage) {
        setLoadingMedia(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [activeFolderId, authToken, queryClient]);

  useEffect(() => {
    if (location.state?.preselectedFolderId) {
      queueMicrotask(() => setActiveFolderId(location.state.preselectedFolderId));
    }
  }, [location.state?.preselectedFolderId]);

  useEffect(() => {
    queueMicrotask(() => void fetchFolders());
  }, [fetchFolders]);

  useEffect(() => {
    if (activeFolderId !== 'root') {
      queueMicrotask(() => void fetchMedia());
    } else {
      setMedia([]);
      setLoadingMedia(false);
    }
  }, [activeFolderId, fetchMedia]);

  // Automatically refresh when any video is currently being analyzed by AI
  useEffect(() => {
    const hasProcessingAi = media.some((m) => m.type === 'video' && m.aiStatus === 'processing');
    if (!hasProcessingAi) return;

    const timeout = setTimeout(() => {
      fetchMedia(1, { force: true });
    }, 2500);

    return () => clearTimeout(timeout);
  }, [media, fetchMedia]);

  const viewingAiMedia = React.useMemo(() => {
    if (!viewingAiMediaId) return null;
    return media.find((m) => m._id === viewingAiMediaId) || null;
  }, [media, viewingAiMediaId]);

  const handleTriggerAiAnalysis = async (mediaId, e) => {
    if (e) e.stopPropagation();
    setAnalyzingMediaId(mediaId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/analyze-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Failed to start AI analysis.'));
      }

      setMedia((prev) => prev.map((m) => (m._id === mediaId ? { ...m, aiStatus: 'processing', aiError: '' } : m)));
    } catch (error) {
      console.error('Failed to trigger AI analysis:', error);
      alert(error.message || 'Failed to start AI analysis.');
    } finally {
      setAnalyzingMediaId(null);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      clearCarouselDrafts();
      clearFileUploadDrafts();
      const drafts = await buildFileUploadDrafts(selectedFiles);
      if (drafts.length === 0) {
        alert('Select supported image, video, or audio files to upload.');
        e.target.value = '';
        return;
      }
      setFileUploadDrafts(drafts);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed preparing files:', error);
      alert(`Upload prep failed: ${error.message || 'Unable to read these files.'}`);
      e.target.value = '';
    }
  };

  const handleConfirmFileUpload = async () => {
    if (fileUploadDrafts.length === 0) return;
    const needsFolder = activeFolderId === 'root';
    const nextFolderName = uploadFolderName.trim();
    if (needsFolder && !nextFolderName) {
      setErrorMessage('Create a folder name before uploading from Library Root.');
      return;
    }

    setUploading(true);
    resetUploadProgress();
    setErrorMessage('');

    try {
      let targetFolderId = activeFolderId === 'root' ? null : activeFolderId;
      const targetScope = activeFolderId === 'root' ? uploadFolderScope : activeFolderScope;
      let createdFolder = null;

      if (needsFolder) {
        const folderResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            campaignId: getActiveCampaignId(),
            scope: targetScope,
            name: nextFolderName,
            parentFolderId: null,
          }),
        });

        if (!folderResponse.ok) {
          throw new Error(await getErrorMessage(folderResponse, 'Could not create folder in media library.'));
        }

        createdFolder = await folderResponse.json();
        targetFolderId = createdFolder._id;
      }

      const { failedFiles } = await uploadMediaFiles({
        files: fileUploadDrafts.map((draft) => draft.file),
        folderId: targetFolderId || 'null',
        getCaption: (file) => fileUploadDrafts.find((draft) => draft.file === file)?.caption || '',
        getUploadOrder: (file, index) => fileUploadDrafts.find((draft) => draft.file === file)?.uploadIndex ?? index,
        uploadBatchId: createUploadBatchId(),
        uploadBatchCreatedAt: new Date().toISOString(),
        scope: targetScope,
        progressLabel: 'Uploading file',
      });

      await invalidateMediaCaches();
      if (createdFolder) {
        await fetchFolders();
        setActiveFolderId(targetFolderId);
      } else {
        void fetchMedia(1, { force: true });
      }
      clearFileUploadDrafts();

      if (failedFiles.length > 0) {
        alert(`${failedFiles.length} files could not be uploaded: ${failedFiles.slice(0, 5).join(', ')}`);
      }
    } catch (error) {
      console.error('Failed uploading files:', error);
      alert(`Upload failed: ${error.message || 'Unable to save these files.'}`);
    } finally {
      setUploading(false);
      resetUploadProgress();
    }
  };

  const handleCarouselFolderSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      clearCarouselDrafts();
      const drafts = await buildCarouselSetDrafts(selectedFiles);
      if (drafts.length === 0) {
        alert('No supported image or video files were found in these carousel folders.');
        e.target.value = '';
        return;
      }

      const firstParts = getPathParts(drafts[0].slides[0].file);
      setCarouselParentName(firstParts.length >= 3 ? firstParts[0] : 'Carousel Sets');
      setCarouselDrafts(drafts);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed preparing carousel sets:', error);
      alert(`Carousel import failed: ${error.message || 'Unable to read this folder.'}`);
      e.target.value = '';
    }
  };

  const handleCarouselFilesSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    try {
      clearCarouselDrafts();
      const activeName = activeFolder?.name || 'Carousel Set';
      const drafts = buildSingleCarouselDraft(selectedFiles, activeName);
      if (drafts.length === 0) {
        alert('Select at least two supported image or video files for this carousel.');
        e.target.value = '';
        return;
      }
      if (drafts[0].slides.length < 2) {
        drafts.forEach((set) => set.slides.forEach((slide) => URL.revokeObjectURL(slide.previewUrl)));
        alert('A carousel needs at least two image or video files.');
        e.target.value = '';
        return;
      }

      setCarouselParentName('Carousel Uploads');
      setCarouselDrafts(drafts);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed preparing carousel files:', error);
      alert(`Carousel import failed: ${error.message || 'Unable to read these files.'}`);
      e.target.value = '';
    }
  };

  const moveCarouselSlideToIndex = (setId, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setCarouselDrafts((current) => current.map((set) => {
      if (set.id !== setId) return set;
      if (fromIndex >= set.slides.length || toIndex >= set.slides.length) return set;
      const nextSlides = [...set.slides];
      const [moved] = nextSlides.splice(fromIndex, 1);
      nextSlides.splice(toIndex, 0, moved);
      return { ...set, slides: nextSlides };
    }));
    setDraggingSlide({ setId, index: toIndex });
  };

  const handleSlideDragStart = (event, setId, index) => {
    setDraggingSlide({ setId, index });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify({ setId, index }));
  };

  const handleSlideDragOver = (event, setId, index) => {
    event.preventDefault();
    if (!draggingSlide || draggingSlide.setId !== setId || draggingSlide.index === index) return;
    moveCarouselSlideToIndex(setId, draggingSlide.index, index);
  };

  const handleSlideDrop = (event) => {
    event.preventDefault();
    setDraggingSlide(null);
  };

  const updateCarouselCaption = (setId, nextCaption) => {
    setCarouselDrafts((current) => current.map((set) => (
      set.id === setId ? { ...set, caption: nextCaption } : set
    )));
  };

  const applyToAll = (caption) => {
    setCarouselDrafts((current) => current.map((set) => ({ ...set, caption })));
  };

  const handleSaveCarouselSets = async () => {
    if (carouselDrafts.length === 0) return;

    const invalidSet = carouselDrafts.find((set) => set.slides.length < 2 || set.slides.length > 10);
    if (invalidSet) {
      alert(`${invalidSet.name} needs 2 to 10 slides for Instagram carousel publishing.`);
      return;
    }

    setUploading(true);
    resetUploadProgress();
    // Initialise all sets as 'pending'
    setSetProgress(Object.fromEntries(carouselDrafts.map((s) => [s.id, 'pending'])));

    try {
      // ── Step 1: Create parent folder ─────────────────────────────────────
      const parentResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          scope: activeFolderId === 'root' ? 'campaign' : activeFolderScope,
          name: carouselParentName || 'Carousel Sets',
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });
      if (!parentResponse.ok) {
        throw new Error(await getErrorMessage(parentResponse, 'Could not create carousel parent folder.'));
      }
      const parentFolder = await parentResponse.json();

      // ── Step 2: Create ALL set sub-folders in parallel ───────────────────
      const setFolderResults = await Promise.all(
        carouselDrafts.map(async (set) => {
          const res = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
              campaignId: getActiveCampaignId(),
              scope: activeFolderId === 'root' ? 'campaign' : activeFolderScope,
              name: set.name,
              parentFolderId: parentFolder._id,
              kind: 'carousel_set',
              carouselCaption: set.caption || '',
            }),
          });
          if (!res.ok) throw new Error(await getErrorMessage(res, `Could not create ${set.name}.`));
          return { set, setFolder: await res.json() };
        })
      );

      // ── Step 3: Upload files & save order — up to 3 sets concurrently ────
      const SET_UPLOAD_CONCURRENCY = 3;
      const errors = [];
      const createdSetFolders = [];

      await runWithConcurrency(setFolderResults, SET_UPLOAD_CONCURRENCY, async ({ set, setFolder }) => {
        setSetProgress((prev) => ({ ...prev, [set.id]: 'uploading' }));
        try {
          const { failedFiles, uploadedMedia } = await uploadMediaFiles({
            files: set.slides.map((slide) => slide.file),
            folderId: setFolder._id,
            getCaption: (file) => set.getCaption(file),
            scope: normalizeScope(parentFolder.scope || (activeFolderId === 'root' ? 'campaign' : activeFolderScope)),
            progressLabel: `Uploading ${set.name}`,
          });

          if (failedFiles.length > 0) {
            throw new Error(`${failedFiles.length} files in ${set.name} could not be uploaded: ${failedFiles.slice(0, 3).join(', ')}`);
          }

          const mediaByFile = new Map(uploadedMedia.map(({ file, media: uploaded }) => [file, uploaded]));
          const carouselOrder = set.slides
            .map((slide) => mediaByFile.get(slide.file)?._id)
            .filter(Boolean);

          const orderRes = await fetch(`${API_BASE_URL}/api/media/folders/${setFolder._id}/carousel${withCampaignScope()}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
              campaignId: getActiveCampaignId(),
              carouselCaption: set.caption || '',
              carouselOrder,
            }),
          });
          if (!orderRes.ok) throw new Error(await getErrorMessage(orderRes, `Could not save slide order for ${set.name}.`));

          const updatedSetFolder = await orderRes.json();
          createdSetFolders.push(updatedSetFolder);
          setSetProgress((prev) => ({ ...prev, [set.id]: 'done' }));
        } catch (err) {
          errors.push(err.message);
          setSetProgress((prev) => ({ ...prev, [set.id]: 'error' }));
        }
      });

      if (errors.length > 0) {
        throw new Error(errors.join(' | '));
      }

      // ── Step 4: Optimistic folder state update — no full refetch ─────────
      // Inject the parent folder and all set sub-folders directly into state.
      setFolders((prev) => {
        const existingIds = new Set(prev.map((f) => String(f._id)));
        const toAdd = [parentFolder, ...createdSetFolders].filter(
          (f) => !existingIds.has(String(f._id))
        );
        return [...prev, ...toAdd];
      });

      await invalidateMediaCaches();
      setActiveFolderId(parentFolder._id);
      clearCarouselDrafts();
    } catch (error) {
      console.error('Failed saving carousel sets:', error);
      alert(`Carousel set upload failed: ${error.message || 'Unable to save carousel sets.'}`);
    } finally {
      setUploading(false);
      resetUploadProgress();
      setSetProgress({});
    }
  };

  const getCaptionDraft = (item) => (
    captionDrafts[item._id] !== undefined ? captionDrafts[item._id] : (item.caption || '')
  );

  const handleSaveCaption = async (item) => {
    const nextCaption = getCaptionDraft(item);
    setSavingCaptionId(item._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${item._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ caption: nextCaption }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMedia((current) => current.map(mediaItem => (
          mediaItem._id === item._id ? updated : mediaItem
        )));
        setCaptionDrafts((current) => {
          const next = { ...current };
          delete next[item._id];
          return next;
        });
        await invalidateMediaCaches();
        return true;
      } else {
        throw new Error(await getErrorMessage(response, 'Unable to update media caption'));
      }
    } catch (error) {
      console.error('Failed saving caption:', error);
      alert(`Caption save failed: ${error.message || 'Unable to update media caption'}`);
      return false;
    } finally {
      setSavingCaptionId(null);
    }
  };

  const openCaptionDialog = (item, e) => {
    e.stopPropagation();
    setOpenMediaMenuId(null);
    setCaptionDialogMedia(item);
  };

  const closeCaptionDialog = () => {
    setCaptionDialogMedia(null);
  };

  const handleCaptionDialogSave = async (e) => {
    e.preventDefault();
    if (!captionDialogMedia) return;
    const saved = await handleSaveCaption(captionDialogMedia);
    if (saved) closeCaptionDialog();
  };

  const handleGenerateAICaption = async () => {
    if (!captionDialogMedia) return;
    setGeneratingCaption(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/generate-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          videoName: captionDialogMedia.name,
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.caption) {
          setCaptionDrafts((current) => ({
            ...current,
            [captionDialogMedia._id]: data.caption,
          }));
        }
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to generate caption.'));
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      alert(error.message || 'Failed to generate caption.');
    } finally {
      setGeneratingCaption(false);
    }
  };

  const openRenameMediaModal = (item, e) => {
    e.stopPropagation();
    setOpenMediaMenuId(null);
    setRenamingMedia(item);
    setRenameMediaName(item.name || '');
  };

  const closeRenameMediaModal = () => {
    setRenamingMedia(null);
    setRenameMediaName('');
  };

  const handleRenameMedia = async (e) => {
    e.preventDefault();
    if (!renamingMedia || !renameMediaName.trim()) return;

    setSavingMediaNameId(renamingMedia._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${renamingMedia._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: renameMediaName.trim(),
        }),
      });

      if (response.ok) {
        const updatedMedia = await response.json();
        setMedia((current) => current.map((item) => (
          item._id === updatedMedia._id ? updatedMedia : item
        )));
        await invalidateMediaCaches();
        closeRenameMediaModal();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to rename file.'));
      }
    } catch (error) {
      console.error('Failed to rename media file:', error);
      alert(error.message || 'Failed to rename file.');
    } finally {
      setSavingMediaNameId(null);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          scope: activeFolderId === 'root' ? newFolderScope : activeFolderScope,
          name: newFolderName.trim(),
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });

      if (response.ok) {
        setNewFolderName('');
        setNewFolderScope('campaign');
        setShowNewFolderModal(false);
        await invalidateMediaCaches();
        void fetchFolders();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to create folder.'));
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(error.message || 'Failed to create folder.');
    }
  };

  const openRenameFolderModal = (folder, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);
    setRenamingFolder(folder);
    setRenameFolderName(folder.name || '');
  };

  const closeRenameFolderModal = () => {
    setRenamingFolder(null);
    setRenameFolderName('');
  };

  const handleRenameFolder = async (e) => {
    e.preventDefault();
    if (!renamingFolder || !renameFolderName.trim()) return;

    setSavingFolderId(renamingFolder._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${renamingFolder._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          name: renameFolderName.trim(),
        }),
      });

      if (response.ok) {
        const updatedFolder = await response.json();
        setFolders((current) => current.map((folder) => (
          folder._id === updatedFolder._id ? updatedFolder : folder
        )));
        await invalidateMediaCaches();
        closeRenameFolderModal();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to rename folder.'));
      }
    } catch (error) {
      console.error('Failed to rename folder:', error);
      alert(error.message || 'Failed to rename folder.');
    } finally {
      setSavingFolderId(null);
    }
  };

  const openFolderTagsModal = (folder, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);
    setTaggingFolder(folder);
    setFolderTagDrafts(normalizeTagList(folder.tags || []));
    setFolderTagInput('');
  };

  const closeFolderTagsModal = () => {
    setTaggingFolder(null);
    setFolderTagDrafts([]);
    setFolderTagInput('');
  };

  const addFolderTagDraft = (rawValue = folderTagInput) => {
    const nextTags = normalizeTagList(rawValue);
    if (nextTags.length === 0) return;
    setFolderTagDrafts((current) => normalizeTagList([...current, ...nextTags]));
    setFolderTagInput('');
  };

  const removeFolderTagDraft = (tagToRemove) => {
    setFolderTagDrafts((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const handleFolderTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFolderTagDraft();
    }
    if (e.key === 'Backspace' && !folderTagInput && folderTagDrafts.length > 0) {
      removeFolderTagDraft(folderTagDrafts[folderTagDrafts.length - 1]);
    }
  };

  const handleSaveFolderTags = async (e) => {
    e.preventDefault();
    if (!taggingFolder) return;

    const nextTags = normalizeTagList([...folderTagDrafts, folderTagInput]);
    setSavingFolderTagsId(taggingFolder._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${taggingFolder._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          tags: nextTags,
        }),
      });

      if (response.ok) {
        const updatedFolder = await response.json();
        setFolders((current) => current.map((folder) => (
          folder._id === updatedFolder._id ? updatedFolder : folder
        )));
        await invalidateMediaCaches();
        closeFolderTagsModal();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to save folder tags.'));
      }
    } catch (error) {
      console.error('Failed to save folder tags:', error);
      alert(error.message || 'Failed to save folder tags.');
    } finally {
      setSavingFolderTagsId(null);
    }
  };

  const handleChangeFolderScope = async (folder, nextScope, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);

    const folderName = folder.name || 'this folder';
    const isGlobal = nextScope === 'global';
    const confirmed = window.confirm(isGlobal
      ? `Make "${folderName}" global? This will make the folder, nested folders, and media inside it available across campaigns.`
      : `Make "${folderName}" campaign only? This will move the folder, nested folders, and media inside it into the current campaign only.`
    );
    if (!confirmed) return;

    setSavingFolderId(folder._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${folder._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          scope: nextScope,
        }),
      });

      if (response.ok) {
        const updatedFolder = await response.json();
        setFolders((current) => current.map((item) => (
          item._id === updatedFolder._id ? updatedFolder : item
        )));
        await invalidateMediaCaches();
        await fetchFolders();
        void fetchMedia();
        alert(isGlobal ? `"${folderName}" is now global.` : `"${folderName}" is now campaign only.`);
      } else {
        throw new Error(await getErrorMessage(response, isGlobal ? 'Failed to make folder global.' : 'Failed to make folder campaign only.'));
      }
    } catch (error) {
      console.error('Failed to change folder scope:', error);
      alert(error.message || 'Failed to change folder scope.');
    } finally {
      setSavingFolderId(null);
    }
  };

  const openMediaTagsModal = (item, e) => {
    e.stopPropagation();
    setOpenMediaMenuId(null);
    setTaggingMedia(item);
    setMediaTagDrafts(normalizeTagList(item.tags || []));
    setMediaTagInput('');
  };

  const closeMediaTagsModal = () => {
    setTaggingMedia(null);
    setMediaTagDrafts([]);
    setMediaTagInput('');
  };

  const addMediaTagDraft = (rawValue = mediaTagInput) => {
    const nextTags = normalizeTagList(rawValue);
    if (nextTags.length === 0) return;
    setMediaTagDrafts((current) => normalizeTagList([...current, ...nextTags]));
    setMediaTagInput('');
  };

  const removeMediaTagDraft = (tagToRemove) => {
    setMediaTagDrafts((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const handleMediaTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addMediaTagDraft();
    }
    if (e.key === 'Backspace' && !mediaTagInput && mediaTagDrafts.length > 0) {
      removeMediaTagDraft(mediaTagDrafts[mediaTagDrafts.length - 1]);
    }
  };

  const handleSaveMediaTags = async (e) => {
    e.preventDefault();
    if (!taggingMedia) return;

    const nextTags = normalizeTagList([...mediaTagDrafts, mediaTagInput]);
    setSavingMediaTagsId(taggingMedia._id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${taggingMedia._id}${withCampaignScope()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tags: nextTags,
        }),
      });

      if (response.ok) {
        const updatedMedia = await response.json();
        setMedia((current) => current.map((item) => (
          item._id === updatedMedia._id ? updatedMedia : item
        )));
        await invalidateMediaCaches();
        closeMediaTagsModal();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to save media tags.'));
      }
    } catch (error) {
      console.error('Failed to save media tags:', error);
      alert(error.message || 'Failed to save media tags.');
    } finally {
      setSavingMediaTagsId(null);
    }
  };

  const openDeleteFolderModal = (folder, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);
    setFolderPendingDelete(folder);
    setErrorMessage('');
  };

  const closeDeleteFolderModal = () => {
    if (deletingFolderId) return;
    setFolderPendingDelete(null);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderPendingDelete || deletingFolderId) return;
    const folderId = folderPendingDelete._id;
    const folderName = folderPendingDelete.name || 'Folder';

    setDeletingFolderId(folderId);
    setDeleteStatusMessage(`Deleting "${folderName}" and its files...`);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/folders/${folderId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        if (activeFolderId === folderId) {
          setActiveFolderId('root');
        }
        await invalidateMediaCaches();
        void fetchFolders();
        void fetchMedia();
        setDeleteStatusMessage(`Deleted "${folderName}".`);
        window.setTimeout(() => {
          setDeleteStatusMessage((current) => (current === `Deleted "${folderName}".` ? '' : current));
        }, 3500);
        setFolderPendingDelete(null);
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to delete folder.'));
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      setErrorMessage(`Could not delete "${folderName}": ${error.message || 'Failed to delete folder.'}`);
      setDeleteStatusMessage('');
    } finally {
      setDeletingFolderId(null);
    }
  };

  const handleDeleteMedia = async (mediaId, e) => {
    e.stopPropagation();
    setOpenMediaMenuId(null);
    if (!window.confirm('Delete this media file permanently?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}${withCampaignScope()}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        await invalidateMediaCaches();
        void fetchMedia();
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to delete media.'));
      }
    } catch (error) {
      console.error('Failed to delete media:', error);
      alert(error.message || 'Failed to delete media.');
    }
  };

  const getFolderParentId = (folder) => normalizeFolderId(folder.parentFolderId) || 'root';
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleFolders = folders
    .filter((folder) => getFolderParentId(folder) === activeFolderId)
    .filter((folder) => {
      if (!normalizedSearch) return true;
      const searchable = [
        folder.name,
        ...(folder.tags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedSearch);
    })
    .sort((a, b) => naturalFileCollator.compare(a.name || '', b.name || ''));
  const activeFolder = folders.find((folder) => folder._id === activeFolderId);
  const activeFolderScope = normalizeScope(activeFolder?.scope);
  const canManageActiveLocation = activeFolderId === 'root' || activeFolderScope !== 'global' || canManageGlobalMedia;
  const breadcrumbFolders = [];
  let breadcrumbFolder = activeFolder;
  while (breadcrumbFolder) {
    breadcrumbFolders.unshift(breadcrumbFolder);
    const parentId = getFolderParentId(breadcrumbFolder);
    if (!parentId || parentId === 'root') break;
    breadcrumbFolder = folders.find((folder) => folder._id === parentId);
  }

  const filteredMedia = media.filter(m => {
    if (!normalizedSearch) return true;
    const searchable = [
      m.name,
      m.caption,
      ...(m.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(normalizedSearch);
  });
  const selectedMediaItems = selectedMediaIds
    .map((mediaId) => media.find((item) => item._id === mediaId))
    .filter(Boolean);
  const selectedMediaType = selectedMediaItems[0]?.type || '';
  const selectableFilteredMedia = selectedMediaType
    ? filteredMedia.filter((item) => item.type === selectedMediaType)
    : filteredMedia;
  const allSelectableVisibleSelected = selectableFilteredMedia.length > 0
    && selectableFilteredMedia.every((item) => selectedMediaIds.includes(item._id));

  const toggleMediaSelection = (item) => {
    setOpenMediaMenuId(null);
    if (selectedMediaIds.includes(item._id)) {
      setSelectedMediaIds((current) => current.filter((mediaId) => mediaId !== item._id));
      return;
    }

    if (selectedMediaType && item.type !== selectedMediaType) {
      setErrorMessage(`Selected files must be the same media type. Clear the ${selectedMediaType} selection before selecting ${item.type}.`);
      return;
    }

    setErrorMessage('');
    setSelectedMediaIds((current) => [...current, item._id]);
  };

  const handleSelectAllVisibleMedia = () => {
    if (filteredMedia.length === 0) return;

    const currentType = selectedMediaType || filteredMedia[0]?.type;
    const sameTypeVisible = filteredMedia.filter((item) => item.type === currentType);

    if (sameTypeVisible.length > 0 && sameTypeVisible.every((item) => selectedMediaIds.includes(item._id))) {
      setSelectedMediaIds((current) => current.filter((mediaId) => !sameTypeVisible.some((item) => item._id === mediaId)));
      return;
    }

    const next = new Set(selectedMediaIds);
    sameTypeVisible.forEach((item) => next.add(item._id));
    if (filteredMedia.some((item) => item.type !== currentType)) {
      setErrorMessage(`Select all added only ${currentType} files. Clear selection to select a different media type.`);
    } else {
      setErrorMessage('');
    }
    setSelectedMediaIds(Array.from(next));
  };

  const handleScheduleSelectedMedia = () => {
    if (selectedMediaIds.length === 0) return;
    navigate('/scheduler/new', { state: { preselectedMediaIds: selectedMediaIds } });
  };

  const updateFileUploadCaption = (draftId, caption) => {
    setFileUploadDrafts((current) => current.map((draft) => (
      draft.id === draftId ? { ...draft, caption } : draft
    )));
  };

  if (fileUploadDrafts.length > 0) {
    const matchedCaptions = fileUploadDrafts.filter((draft) => draft.caption.trim()).length;
    const uploadTargetName = activeFolderId === 'root'
      ? (uploadFolderName.trim() || 'New folder required')
      : (activeFolder?.name || 'Current folder');
    const uploadTargetScope = activeFolderId === 'root' ? uploadFolderScope : activeFolderScope;
    const uploadDisabled = uploading || (activeFolderId === 'root' && !uploadFolderName.trim());

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0a0a0a] px-5 py-3 shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={clearFileUploadDrafts}
                disabled={uploading}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Back
              </button>
              <div className="min-w-0">
                <h2 className="m-0 text-base font-bold tracking-tight text-white">Review upload</h2>
                <p className="m-0 mt-0.5 text-[11px] font-medium text-zinc-400">
                  {fileUploadDrafts.length} files selected &bull; order preserved &bull; {matchedCaptions}/{fileUploadDrafts.length} captions matched
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={clearFileUploadDrafts}
                disabled={uploading}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFileUpload}
                disabled={uploadDisabled}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#7831d6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-[#7831d6]/25"
              >
                {uploading ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{uploading ? 'Uploading...' : 'Upload to folder'}</span>
              </button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {uploading && (
          <div className="mx-5 mt-3 overflow-hidden rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/10">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-4 w-4 rounded-full border-2 border-[#7831d6] border-t-transparent animate-spin" />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-xs font-semibold text-[#c4b5fd]">{getUploadProgressText()}</p>
                {uploadProgress?.currentFile && (
                  <p className="m-0 mt-0.5 truncate text-[11px] text-zinc-400">{uploadProgress.currentFile}</p>
                )}
              </div>
              {uploadProgress?.total > 0 && (
                <span className="text-[11px] font-bold text-[#c4b5fd]">
                  {uploadProgress.completed}/{uploadProgress.total}
                </span>
              )}
            </div>
            {uploadProgress?.total > 0 && (
              <div className="h-1 bg-[#7831d6]/20">
                <div
                  className="h-full bg-[#7831d6] transition-all duration-300"
                  style={{ width: `${Math.round(((uploadProgress.completed || 0) / uploadProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a0a0a] shadow-sm">
            <div className="grid grid-cols-[58px_76px_minmax(160px,1fr)_minmax(220px,1.35fr)_92px] items-center gap-3 border-b border-white/[0.08] bg-black px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              <span>Order</span>
              <span>Preview</span>
              <span>File</span>
              <span>Caption</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {fileUploadDrafts.map((draft, index) => {
                const hasCaption = Boolean(draft.caption.trim());
                return (
                  <div
                    key={draft.id}
                    className="grid grid-cols-[58px_76px_minmax(160px,1fr)_minmax(220px,1.35fr)_92px] items-center gap-3 px-3 py-2.5"
                  >
                    <span className="font-mono text-xs font-bold text-zinc-500">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black">
                      {draft.file.type.startsWith('video/') ? (
                        <video src={draft.previewUrl} muted playsInline className="h-full w-full object-cover" />
                      ) : draft.file.type.startsWith('audio/') ? (
                        <Music className="h-5 w-5 text-zinc-400" />
                      ) : (
                        <img src={draft.previewUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-xs font-semibold text-white" title={draft.name}>{draft.name}</p>
                      <p className="m-0 mt-0.5 text-[10px] font-medium text-zinc-400">
                        {draft.file.type || 'Media'} {formatFileSize(draft.file.size) ? `· ${formatFileSize(draft.file.size)}` : ''}
                      </p>
                    </div>
                    <textarea
                      value={draft.caption}
                      onChange={(e) => updateFileUploadCaption(draft.id, e.target.value)}
                      disabled={uploading}
                      placeholder="No caption matched. Add one here..."
                      className="h-16 w-full resize-none rounded-md border border-white/10 bg-black px-2.5 py-2 text-[11px] leading-relaxed text-white placeholder:text-zinc-500 focus:border-[#7831d6] focus:outline-none focus:ring-1 focus:ring-[#7831d6] disabled:opacity-50"
                    />
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${
                      hasCaption
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {hasCaption ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      {hasCaption ? 'Matched' : 'Missing'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-3">
            <section className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Folder className="h-4 w-4 text-zinc-400" />
                <h3 className="m-0 text-xs font-bold text-white">Target folder</h3>
              </div>
              {activeFolderId === 'root' ? (
                <div className="space-y-2">
                  <p className="m-0 text-[11px] font-medium text-zinc-400">
                    At Library Root: create folder first
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-zinc-400">New folder name</span>
                    <input
                      type="text"
                      value={uploadFolderName}
                      onChange={(e) => setUploadFolderName(e.target.value)}
                      disabled={uploading}
                      placeholder="Folder name"
                      className="w-full rounded-md border border-white/10 bg-black px-2.5 py-2 text-xs font-semibold text-white placeholder:text-zinc-500 focus:border-[#7831d6] focus:outline-none focus:ring-1 focus:ring-[#7831d6] disabled:opacity-50"
                    />
                  </label>
                  {canManageGlobalMedia && (
                    <label className="flex items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                      <span className="text-[11px] font-semibold text-white">Global folder</span>
                      <input
                        type="checkbox"
                        checked={uploadFolderScope === 'global'}
                        onChange={(e) => setUploadFolderScope(e.target.checked ? 'global' : 'campaign')}
                        disabled={uploading}
                        className="h-3.5 w-3.5 accent-[#7831d6]"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-[#7831d6]/30 bg-[#7831d6]/15 px-3 py-2">
                  <p className="m-0 text-[11px] font-bold text-[#c4b5fd]">Inside folder: upload here</p>
                  <p className="m-0 mt-0.5 truncate text-xs font-semibold text-white" title={activeFolder?.name}>
                    Current folder: {activeFolder?.name || 'Current folder'}
                  </p>
                  {activeFolderScope === 'global' && (
                    <p className="m-0 mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">Global</p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-white/[0.08] bg-[#0a0a0a] p-3 shadow-sm">
              <h3 className="m-0 text-xs font-bold text-white">Ready to upload</h3>
              <p className="m-0 mt-1 text-[11px] font-medium leading-relaxed text-zinc-400">
                Assets and captions will be saved to <span className="font-bold text-white">{uploadTargetName}</span>.
                {uploadTargetScope === 'global' ? ' This folder is global.' : ''}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {fileUploadDrafts.slice(0, 12).map((draft) => (
                  <div key={draft.id} className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-black border border-white/10">
                    {draft.file.type.startsWith('video/') ? (
                      <video src={draft.previewUrl} muted playsInline className="h-full w-full object-cover" />
                    ) : draft.file.type.startsWith('audio/') ? (
                      <Music className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <img src={draft.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
              {fileUploadDrafts.length > 12 && (
                <p className="m-0 mt-2 text-[10px] font-semibold text-zinc-500">
                  +{fileUploadDrafts.length - 12} more files
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    );
  }

  if (carouselDrafts.length > 0) {
    const totalSlides = carouselDrafts.reduce((sum, set) => sum + set.slides.length, 0);
    const validSets = carouselDrafts.filter((set) => set.slides.length >= 2 && set.slides.length <= 10).length;

    return (
      <div className="min-h-screen bg-black text-white">
        {/* Sticky Header Bar */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/[0.08] px-6 py-3 shadow-md">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Title + Stats */}
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={clearCarouselDrafts}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors flex-shrink-0 shadow-sm"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Back
              </button>
              <div className="min-w-0">
                <h2 className="m-0 text-xl font-bold tracking-tight text-white leading-tight">{carouselParentName || 'Carousel Sets'}</h2>
                <p className="m-0 text-xs text-zinc-400 mt-0.5">
                  {carouselDrafts.length} sets &bull; {totalSlides} slides &bull; {validSets}/{carouselDrafts.length} ready
                </p>
              </div>
            </div>
            {/* Right: Action Buttons */}
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={clearCarouselDrafts}
                disabled={uploading}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCarouselSets}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-[#7831d6]/25 hover:bg-[#6825bc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {uploading ? 'Saving...' : 'Save Carousel Sets'}
              </button>
            </div>
          </div>
        </div>

        {/* Upload progress panel — per-set breakdown */}
        {uploading && (
          <div className="mx-6 mt-4 rounded-xl border border-[#7831d6]/30 bg-[#7831d6]/10 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#7831d6]/20">
              <div className="h-4 w-4 rounded-full border-2 border-[#7831d6] border-t-transparent animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="m-0 text-xs font-semibold text-[#c4b5fd]">
                  {(() => {
                    const done = Object.values(setProgress).filter(s => s === 'done').length;
                    const total = carouselDrafts.length;
                    const fileDone = uploadProgress?.completed || 0;
                    const fileTotal = uploadProgress?.total || 0;
                    if (total > 0) return `Saving sets… ${done}/${total} complete`;
                    if (fileTotal > 0) return `Uploading files… ${fileDone}/${fileTotal}`;
                    return 'Preparing upload…';
                  })()}
                </p>
                {uploadProgress?.currentFile && (
                  <p className="m-0 mt-0.5 truncate text-[11px] text-zinc-400">{uploadProgress.currentFile}</p>
                )}
              </div>
              {/* Overall progress fraction */}
              {uploadProgress?.total > 0 && (
                <span className="flex-shrink-0 text-[11px] font-bold text-[#c4b5fd]">
                  {uploadProgress.completed}/{uploadProgress.total}
                </span>
              )}
            </div>

            {/* Overall file progress bar */}
            {uploadProgress?.total > 0 && (
              <div className="h-1 w-full bg-[#7831d6]/20">
                <div
                  className="h-full bg-[#7831d6] transition-all duration-300"
                  style={{ width: `${Math.round(((uploadProgress.completed || 0) / uploadProgress.total) * 100)}%` }}
                />
              </div>
            )}

            {/* Per-set status rows */}
            {carouselDrafts.length > 0 && (
              <div className="px-4 py-2 space-y-1.5">
                {carouselDrafts.map((set) => {
                  const status = setProgress[set.id] || 'pending';
                  return (
                    <div key={set.id} className="flex items-center gap-2.5">
                      {/* Status icon */}
                      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {status === 'done' && (
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {status === 'uploading' && (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#7831d6] border-t-transparent animate-spin" />
                        )}
                        {status === 'error' && (
                          <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {status === 'pending' && (
                          <div className="w-3 h-3 rounded-full border-2 border-white/20" />
                        )}
                      </span>
                      <span className={`text-[11px] font-semibold truncate flex-1 ${
                        status === 'done' ? 'text-emerald-400'
                        : status === 'error' ? 'text-rose-400'
                        : status === 'uploading' ? 'text-[#c4b5fd]'
                        : 'text-zinc-400'
                      }`}>
                        {set.name}
                        <span className="ml-1.5 font-normal opacity-70">· {set.slides.length} slides</span>
                      </span>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide ${
                        status === 'done' ? 'text-emerald-400'
                        : status === 'error' ? 'text-rose-400'
                        : status === 'uploading' ? 'text-[#c4b5fd]'
                        : 'text-zinc-500'
                      }`}>
                        {status === 'done' ? 'Done' : status === 'error' ? 'Failed' : status === 'uploading' ? 'Uploading' : 'Waiting'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Carousel Set Cards */}
        <div className="p-4 space-y-2">
          {carouselDrafts.map((set, setIndex) => {
            const hasCaption = Boolean((set.caption || '').trim());
            const hasSlideWarning = set.slides.length < 2 || set.slides.length > 10;

            return (
              <section key={set.id} className="rounded-xl bg-[#0a0a0a] border border-white/[0.08] shadow-sm overflow-hidden">
                {/* Top header: number + name + badges — compact single row */}
                <div className="flex items-center gap-2.5 px-4 py-1.5 border-b border-white/[0.08] bg-black">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-bold text-white">
                    {setIndex + 1}
                  </span>
                  <h3 className="m-0 flex-1 min-w-0 truncate text-sm font-semibold text-white">{set.name}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="rounded-full bg-[#7831d6]/20 px-2 py-0.5 text-[11px] font-semibold text-[#c4b5fd]">
                      {set.slides.length} slides
                    </span>
                    {hasCaption && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Caption ✓</span>
                    )}
                    {hasSlideWarning && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">2–10 needed</span>
                    )}
                  </div>
                </div>

                {/* Bottom body: thumbnails + caption side by side */}
                <div className="flex items-stretch">
                  {/* Thumbnails */}
                  <div className="flex-1 min-w-0 p-2 flex items-center">
                    <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {set.slides.map((slide, index) => {
                        const isDragging = draggingSlide?.setId === set.id && draggingSlide?.index === index;
                        return (
                          <div
                            key={slide.id}
                            draggable={!uploading}
                            onDragStart={(event) => handleSlideDragStart(event, set.id, index)}
                            onDragOver={(event) => handleSlideDragOver(event, set.id, index)}
                            onDrop={handleSlideDrop}
                            onDragEnd={() => setDraggingSlide(null)}
                            className={`group relative flex-shrink-0 rounded-lg overflow-hidden border border-white/10 ${isDragging ? 'opacity-50' : ''} ${uploading ? '' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ width: '96px' }}
                            title={slide.name}
                          >
                            {slide.file.type.startsWith('video/') ? (
                              <video src={slide.previewUrl} muted playsInline className="w-full h-auto block" />
                            ) : (
                              <img src={slide.previewUrl} className="w-full h-auto block" alt="" />
                            )}
                            <span className="absolute left-1 top-1 rounded bg-black/80 border border-white/10 px-1 py-0.5 text-[9px] font-bold text-white shadow-sm">
                              {index + 1}
                            </span>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="flex-shrink-0 w-[380px] p-2 border-l border-white/[0.08] flex flex-col gap-1">
                    <p className="m-0 text-[11px] font-semibold text-zinc-300">Caption</p>
                    <textarea
                      value={set.caption}
                      onChange={(e) => updateCarouselCaption(set.id, e.target.value)}
                      disabled={uploading}
                      placeholder="Caption..."
                      className="flex-1 w-full resize-none rounded-lg border border-white/10 bg-black p-2.5 text-xs leading-relaxed text-white placeholder:text-zinc-500 focus:border-[#7831d6] focus:outline-none focus:ring-1 focus:ring-[#7831d6] transition-all disabled:opacity-50"
                    />
                    {carouselDrafts.length > 1 && set.caption.trim() && (
                      <button
                        type="button"
                        onClick={() => applyToAll(set.caption)}
                        disabled={uploading}
                        className="self-end text-[11px] font-semibold text-[#c4b5fd] hover:text-white disabled:opacity-40 transition-colors"
                      >
                        Apply to all sets ↓
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-[#0a0a0a] min-h-screen text-white">
      <input
        ref={folderCoverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFolderCoverSelect}
      />

      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-white">
            Media Library
          </h1>
          <nav
            className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs font-medium text-zinc-400"
            aria-label="Media folder breadcrumb"
          >
            <button
              type="button"
              onClick={() => { setActiveFolderId('root'); setSearchQuery(''); }}
              className={`flex-shrink-0 rounded px-1 py-0.5 transition-colors hover:text-white ${
                activeFolderId === 'root' ? 'font-semibold text-white' : ''
              }`}
            >
              All media
            </button>
            {breadcrumbFolders.map((folder) => (
              <React.Fragment key={folder._id}>
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                <button
                  type="button"
                  onClick={() => setActiveFolderId(folder._id)}
                  title={folder.name}
                  className={`max-w-[180px] flex-shrink-0 truncate rounded px-1 py-0.5 transition-colors hover:text-white ${
                    folder._id === activeFolderId ? 'font-semibold text-white' : ''
                  }`}
                >
                  {folder.name || 'Folder'}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-shrink-0">
          <label className="relative min-w-[220px] flex-1 lg:w-64 lg:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files and folders"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#0a0a0a] pl-9 pr-3 text-sm text-white outline-none transition focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20 placeholder:text-zinc-500"
            />
          </label>
          {canManageFolders && canManageActiveLocation && (
            <>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7831d6] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#6825bc] shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Assets</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#7831d6] bg-[#7831d6] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#6825bc] shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New folder</span>
              </button>
            </>
          )}
        </div>
      </header>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {deleteStatusMessage && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
          deletingFolderId
            ? 'border-purple-500/30 bg-purple-500/10 text-purple-200'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        }`}>
          {deletingFolderId ? (
            <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-[#7831d6] border-t-transparent animate-spin" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span>{deleteStatusMessage}</span>
        </div>
      )}

      {/* Folders */}
      {(!searchQuery || visibleFolders.length > 0) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleFolders.map(folder => {
            const isDeletingThisFolder = deletingFolderId === folder._id;
            const isSettingThisFolderCover = settingFolderCoverId === folder._id;
            const isFolderBusy = isDeletingThisFolder || isSettingThisFolderCover;
            const canManageThisFolder = normalizeScope(folder.scope) !== 'global' || canManageGlobalMedia;
            const stats = getFolderStats(folder, folders);
            return (
            <div
              key={folder._id}
              onClick={() => {
                if (isFolderBusy) return;
                setActiveFolderId(folder._id);
              }}
              className={`relative flex min-w-0 items-center gap-4 rounded-xl px-2 py-2.5 group transition-colors border border-transparent ${
                isFolderBusy
                  ? 'cursor-wait opacity-70'
                  : 'cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08]'
              }`}
            >
              <MediaFolderPreview folder={folder} allFolders={folders} />

              <div className="flex-1 min-w-0 overflow-hidden">
                <span
                  className="block truncate text-sm font-bold leading-tight text-white"
                  title={folder.name}
                >
                  {folder.name}
                </span>
                <span className="mt-1 block text-xs font-medium text-zinc-400">
                  {stats.label}
                </span>
                <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                  {folder.kind === 'carousel_set' && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded bg-[#7831d6]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#c4b5fd]">
                      <Images className="h-2.5 w-2.5" />
                      Carousel
                    </span>
                  )}
                  {normalizeScope(folder.scope) === 'global' && (
                    <span className="inline-flex flex-shrink-0 rounded bg-[#7831d6]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#c4b5fd]">
                      Global
                    </span>
                  )}
                  {(folder.tags || []).length > 0 && (
                    <>
                    {(folder.tags || []).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="max-w-[76px] truncate rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-300"
                        title={tag}
                      >
                        {tag}
                      </span>
                    ))}
                    {(folder.tags || []).length > 2 && (
                      <span className="text-[9px] font-semibold text-zinc-400">
                        +{folder.tags.length - 2}
                      </span>
                    )}
                    </>
                  )}
                </div>
              </div>
              {/* Actions kebab — only visible on hover to save space */}
              {((canManageFolders && canManageThisFolder) || (canDelete && canManageThisFolder)) && (
                <div className="relative flex-shrink-0" data-folder-menu>
	                  <button
	                    type="button"
	                    onClick={(e) => {
	                      e.stopPropagation();
                      if (isFolderBusy) return;
	                      setOpenFolderMenuId((current) => (current === folder._id ? null : folder._id));
	                    }}
	                    disabled={isFolderBusy}
	                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-white transition-all disabled:cursor-wait disabled:opacity-40"
	                    title="Folder actions"
	                    aria-label="Folder actions"
	                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                  {openFolderMenuId === folder._id && (
                    <div className="absolute right-0 top-6 z-20 w-36 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a0a0a] py-1 shadow-2xl text-white">
                      <button
                        type="button"
	                        onClick={(e) => {
	                          e.stopPropagation();
                          if (isDeletingThisFolder) return;
	                          setOpenFolderMenuId(null);
	                          navigate('/scheduler/new', { state: { preselectedFolderId: folder._id } });
	                        }}
	                        disabled={isDeletingThisFolder}
	                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                      >
                        <Clock className="h-3 w-3 text-[#c4b5fd]" />
                        <span>Schedule</span>
                      </button>
                      {canManageFolders && canManageThisFolder && (
                        <>
	                          <button
	                            type="button"
	                            onClick={(e) => openRenameFolderModal(folder, e)}
	                            disabled={isDeletingThisFolder}
	                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                          >
                            <Pencil className="h-3 w-3 text-[#c4b5fd]" />
                            <span>Rename</span>
                          </button>
	                          <button
	                            type="button"
	                            onClick={(e) => openFolderTagsModal(folder, e)}
	                            disabled={isDeletingThisFolder}
	                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                          >
                            <Tags className="h-3 w-3 text-[#c4b5fd]" />
                            <span>Add tags</span>
                          </button>
	                          <button
	                            type="button"
	                            onClick={(e) => openFolderCoverPicker(folder, e)}
	                            disabled={isFolderBusy}
	                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                          >
                            <Images className="h-3 w-3 text-[#c4b5fd]" />
                            <span>{folder.coverMediaId ? 'Change cover' : 'Set cover image'}</span>
                          </button>
                          {folder.coverMediaId && (
	                          <button
	                            type="button"
	                            onClick={(e) => handleRemoveFolderCover(folder, e)}
	                            disabled={isFolderBusy}
	                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-zinc-400 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                          >
                              <X className="h-3 w-3" />
                              <span>Remove cover</span>
                            </button>
                          )}
                          {canManageGlobalMedia && normalizeScope(folder.scope) !== 'global' && (
	                          <button
	                            type="button"
	                            onClick={(e) => handleChangeFolderScope(folder, 'global', e)}
	                            disabled={isDeletingThisFolder || savingFolderId === folder._id}
	                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-[#c4b5fd] hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                          >
                              <Folder className="h-3 w-3" />
                              <span>{savingFolderId === folder._id ? 'Saving...' : 'Make global'}</span>
                            </button>
                          )}
                          {canManageGlobalMedia && normalizeScope(folder.scope) === 'global' && (
	                          <button
	                            type="button"
	                            onClick={(e) => handleChangeFolderScope(folder, 'campaign', e)}
	                            disabled={isDeletingThisFolder || savingFolderId === folder._id}
	                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-zinc-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
	                          >
                              <Folder className="h-3 w-3" />
                              <span>Make campaign-only</span>
                            </button>
                          )}
                        </>
                      )}
                      {canDelete && canManageThisFolder && (
	                        <button
	                          type="button"
	                          onClick={(e) => openDeleteFolderModal(folder, e)}
	                          disabled={isDeletingThisFolder}
	                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-50"
	                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
	                  )}
	                </div>
	              )}
              {isDeletingThisFolder && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/75 backdrop-blur-[1px]">
                  <div className="inline-flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 shadow-sm">
                    <span className="h-3 w-3 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
                    <span>Deleting...</span>
                  </div>
                </div>
              )}
	              {isSettingThisFolderCover && (
	                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/75 backdrop-blur-[1px]">
	                  <div className="inline-flex items-center gap-2 rounded-md border border-[#7831d6]/30 bg-[#7831d6]/20 px-2.5 py-1.5 text-[11px] font-bold text-[#c4b5fd] shadow-sm">
	                    <span className="h-3 w-3 rounded-full border-2 border-[#7831d6] border-t-transparent animate-spin" />
	                    <span>Updating cover...</span>
	                  </div>
	                </div>
	              )}
	            </div>
            );
          })}
          {loadingFolders && (
            <div className="col-span-full border border-dashed border-white/[0.08] py-3 rounded-lg text-center text-zinc-500 text-[11px]">
              Loading folders...
            </div>
          )}
          {!loadingFolders && activeFolderId === 'root' && folders.length === 0 && (
            <div className="col-span-full border border-dashed border-white/[0.08] py-3 rounded-lg text-center text-zinc-500 text-[11px]">
              No campaigns created.
            </div>
          )}
        </div>
      )}

      {/* Media Files Grid - only inside folders */}
      {activeFolderId !== 'root' && (
        <div className="space-y-3">
          {canSchedule && filteredMedia.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#0a0a0a] px-3 py-2 shadow-sm text-white">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-bold text-white">
                  {selectedMediaIds.length > 0
                    ? `${selectedMediaIds.length} ${selectedMediaType || 'media'} file${selectedMediaIds.length === 1 ? '' : 's'} selected`
                    : 'Select media files'}
                </p>
                <p className="m-0 mt-0.5 text-[10px] font-medium text-zinc-400">
                  {selectedMediaIds.length > 0
                    ? 'Only one media type can be selected per schedule batch.'
                    : 'Use checkboxes to schedule files directly.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisibleMedia}
                  disabled={filteredMedia.length === 0}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allSelectableVisibleSelected ? 'Deselect visible' : 'Select visible'}
                </button>
                {selectedMediaIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMediaIds([])}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleScheduleSelectedMedia}
                  disabled={selectedMediaIds.length === 0}
                  className="inline-flex items-center gap-1 rounded-md bg-[#7831d6] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clock className="h-3 w-3" />
                  <span>Schedule selected</span>
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {loadingMedia && (
              <div className="col-span-full border border-dashed border-white/[0.08] p-12 rounded-xl text-center text-zinc-500 text-xs bg-[#0a0a0a] shadow-sm">
                Loading media assets...
              </div>
            )}

            {!loadingMedia && filteredMedia.map(item => {
              const isSelected = selectedMediaIds.includes(item._id);
              const selectionLocked = Boolean(selectedMediaType && item.type !== selectedMediaType);
              const canManageThisMedia = normalizeScope(item.scope) !== 'global' || canManageGlobalMedia;
              return (
              <div
                key={item._id}
                className={`bg-[#0a0a0a] border rounded-xl overflow-visible group transition-all flex flex-col relative shadow-sm ${
                  isSelected
                    ? 'border-[#7831d6] ring-2 ring-[#7831d6]/30'
                    : selectionLocked
                      ? 'border-white/[0.08] opacity-60'
                      : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                {(() => {
                  return (
                    <>
                      {/* Media Preview Box */}
                      <div className={`${item.type === 'audio' ? 'aspect-square' : 'aspect-[9/16]'} bg-black relative overflow-hidden rounded-xl flex items-center justify-center`}>
                        {canSchedule && (
                          <label
                            className={`absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border bg-black/80 shadow-sm ${
                              selectionLocked
                                ? 'cursor-not-allowed border-white/10 text-zinc-600'
                                : 'cursor-pointer border-white/10 text-white hover:border-[#7831d6]'
                            }`}
                            title={selectionLocked ? `Clear ${selectedMediaType} selection before selecting ${item.type}` : (isSelected ? 'Deselect media' : 'Select media')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={selectionLocked}
                              onChange={() => toggleMediaSelection(item)}
                              className="h-3.5 w-3.5 accent-[#7831d6]"
                              aria-label={isSelected ? 'Deselect media' : 'Select media'}
                            />
                          </label>
                        )}
                        {item.type === 'video' ? (
                          <LoadingVideoPreview
                            src={getAssetUrl(item.url)} 
                            crossOrigin="anonymous" 
                            videoClassName="w-full h-full object-cover cursor-pointer"
                            playsInline
                            preload="metadata"
                            onMouseEnter={(e) => {
                              e.target.muted = false;
                              e.target.play().catch(err => {
                                console.warn('Autoplay with audio blocked by browser policy:', err);
                              });
                            }}
                            onMouseLeave={(e) => {
                              e.target.pause();
                              e.target.currentTime = 0;
                            }}
                          />
                        ) : item.type === 'audio' ? (
                          <div
                            className="flex h-full w-full items-center gap-3 px-4"
                            onMouseEnter={(e) => {
                              const container = e.currentTarget;
                              const audio = container.querySelector('audio');
                              const overlay = container.querySelector('[data-wave-progress]');
                              if (!audio) return;
                              audio.play().catch(() => {});
                              const update = () => {
                                if (audio.paused) return;
                                const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
                                if (overlay) overlay.style.width = `${pct}%`;
                                requestAnimationFrame(update);
                              };
                              requestAnimationFrame(update);
                            }}
                            onMouseLeave={(e) => {
                              const container = e.currentTarget;
                              const audio = container.querySelector('audio');
                              const overlay = container.querySelector('[data-wave-progress]');
                              if (audio) { audio.pause(); audio.currentTime = 0; }
                              if (overlay) overlay.style.width = '0%';
                            }}
                          >
                            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                              <p className="text-xs font-semibold text-white truncate leading-tight m-0">
                                {item.name || 'Audio'}
                              </p>
                              {/* Waveform with progress */}
                              <div className="relative w-full h-6 flex items-end gap-[2px]">
                                {/* Static gray waveform bars */}
                                {[3,7,5,12,8,18,10,22,15,28,20,32,25,35,30,38,33,40,36,38,33,35,30,28,25,32,38,35,30,28,22,18,25,32,28,22,15,20,12,10,7,12,8,5,3,7,10,5,3,4].map((h, i) => (
                                  <div
                                    key={i}
                                    className="flex-1 rounded-full bg-zinc-800"
                                    style={{ height: `${(h / 40) * 100}%`, minWidth: '2px' }}
                                  />
                                ))}
                                {/* Progress overlay — clipped colored bars */}
                                <div
                                  data-wave-progress
                                  className="absolute inset-0 overflow-hidden flex items-end gap-[2px] transition-none"
                                  style={{ width: '0%' }}
                                >
                                  {[3,7,5,12,8,18,10,22,15,28,20,32,25,35,30,38,33,40,36,38,33,35,30,28,25,32,38,35,30,28,22,18,25,32,28,22,15,20,12,10,7,12,8,5,3,7,10,5,3,4].map((h, i) => (
                                    <div
                                      key={i}
                                      className="flex-1 rounded-full bg-[#7831d6]"
                                      style={{ height: `${(h / 40) * 100}%`, minWidth: '2px' }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <p className="text-[11px] text-zinc-500 m-0 leading-none" data-audio-duration={item._id}></p>
                            </div>
                            <audio
                              src={getAssetUrl(item.url)}
                              crossOrigin="anonymous"
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                const dur = e.target.duration;
                                if (!isFinite(dur)) return;
                                const mins = Math.floor(dur / 60);
                                const secs = Math.floor(dur % 60).toString().padStart(2, '0');
                                const el = e.target.parentElement?.querySelector(`[data-audio-duration="${item._id}"]`);
                                if (el) el.textContent = `${mins}:${secs}`;
                              }}
                              className="hidden"
                            />
                          </div>
                        ) : (
                          <img src={getAssetUrl(item.url)} crossOrigin="anonymous" className="h-full w-full object-cover object-[center_40%]" alt="" />
                        )}
                        <div className={`${canSchedule ? 'left-10' : 'left-2'} absolute top-2 bg-[#0a0a0a]/90 px-2 py-0.5 rounded text-[8px] uppercase font-bold text-white border border-white/[0.08] shadow-sm`}>
                          {item.type}
                        </div>
                        {item.type === 'video' && item.aiStatus === 'processing' && (
                          <div className="absolute right-10 top-2 rounded bg-purple-950/90 border border-purple-500/50 px-2 py-0.5 text-[8px] font-bold tracking-wide text-purple-200 shadow-sm flex items-center gap-1 backdrop-blur-sm animate-pulse">
                            <Sparkles className="h-2.5 w-2.5 animate-spin text-purple-300" />
                            <span>AI Reading</span>
                          </div>
                        )}
                        {normalizeScope(item.scope) === 'global' && (
                          <div className={`absolute ${item.type === 'video' && item.aiStatus === 'processing' ? 'right-28' : 'right-10'} top-2 rounded bg-[#7831d6]/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#c4b5fd] shadow-sm`}>
                            Global
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => openCaptionDialog(item, e)}
                          className={`absolute left-2 ${canSchedule ? 'top-11' : 'top-9'} inline-flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm ${
                            item.caption?.trim()
                              ? 'border-emerald-500/30 bg-[#0a0a0a]/95 text-emerald-400 hover:bg-emerald-950/40'
                              : 'border-amber-500/30 bg-[#0a0a0a]/95 text-amber-300 hover:bg-amber-950/40'
                          }`}
                          title={item.caption?.trim() ? 'Caption saved (Click to edit)' : 'No caption saved (Click to add)'}
                        >
                          {item.caption?.trim() ? (
                            <MessageSquareCheck className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquareWarning className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {item.type !== 'video' && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                            <p className="m-0 truncate" title={item.name}>{item.name || 'Untitled media'}</p>
                          </div>
                        )}
                        {(item.tags || []).length > 0 && (
                          <div className={`absolute ${item.type === 'video' ? 'bottom-2' : 'bottom-7'} left-2 right-2 flex flex-wrap gap-1 pointer-events-none`}>
                            {(item.tags || []).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="max-w-[95px] truncate rounded bg-black/80 border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
                                title={tag}
                              >
                                {tag}
                              </span>
                            ))}
                            {(item.tags || []).length > 3 && (
                              <span className="rounded bg-black/80 border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400 shadow-sm">
                                +{item.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Media Actions */}
                      <div className="absolute right-2 top-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMediaMenuId((current) => (current === item._id ? null : item._id));
                          }}
                          className="p-1.5 bg-[#0a0a0a]/90 hover:bg-[#1f1f23] hover:text-white rounded-lg transition-all text-zinc-400 border border-white/[0.08] shadow-sm"
                          title="Media actions"
                          aria-label="Media actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {openMediaMenuId === item._id && (
                          <>
                            <button
                              type="button"
                              aria-label="Close media actions"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMediaMenuId(null);
                              }}
                              className="fixed inset-0 z-10 cursor-default bg-transparent"
                            />
                            <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a0a0a] py-1 shadow-2xl text-white">
                              <button
                                type="button"
                                onClick={(e) => openRenameMediaModal(item, e)}
                                disabled={!canManageThisMedia}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
                              >
                                <Pencil className="h-3.5 w-3.5 text-[#c4b5fd]" />
                                <span>Rename</span>
                              </button>
                              {item.type === 'video' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMediaMenuId(null);
                                      setViewingAiMediaId(item._id);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-[#c4b5fd]" />
                                    <span>AI Video Insights</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMediaMenuId(null);
                                      handleTriggerAiAnalysis(item._id, e);
                                    }}
                                    disabled={item.aiStatus === 'processing' || analyzingMediaId === item._id}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                    <span>{item.aiStatus === 'processing' ? 'AI Analyzing...' : 'Re-analyze with AI'}</span>
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMediaMenuId(null);
                                  navigate('/scheduler/new', { state: { preselectedMediaId: item._id } });
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/10"
                              >
                                <Clock className="h-3.5 w-3.5 text-[#c4b5fd]" />
                                <span>Schedule</span>
                              </button>
                              {canDelete && canManageThisMedia && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteMedia(item._id, e)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              );
            })}

            {!loadingMedia && filteredMedia.length === 0 && visibleFolders.length === 0 && (
              <div className="col-span-full border border-dashed border-white/[0.08] p-12 rounded-xl text-center text-zinc-500 text-xs bg-[#0a0a0a] shadow-sm">
                No media assets found in this folder.
              </div>
            )}
          </div>

          {hasMore && !loadingMedia && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => void fetchMedia(page + 1)}
                disabled={loadingMore}
                className="flex items-center gap-2 bg-[#7831d6] hover:bg-[#6825bc] text-white px-6 py-2 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-[#7831d6]/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load more media</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 rounded-2xl w-full max-w-sm text-white shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">
              {activeFolderId === 'root' ? 'New Campaign Folder' : 'New Nested Folder'}
            </h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Campaign folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-black border border-white/10 px-3.5 py-2 rounded-lg focus:outline-none focus:border-[#7831d6] focus:ring-1 focus:ring-[#7831d6] text-xs text-white placeholder:text-zinc-500"
                autoFocus
              />
              {activeFolderId === 'root' && canManageGlobalMedia && (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2">
                  <span className="text-xs font-semibold text-white">Global folder</span>
                  <input
                    type="checkbox"
                    checked={newFolderScope === 'global'}
                    onChange={(e) => setNewFolderScope(e.target.checked ? 'global' : 'campaign')}
                    className="h-3.5 w-3.5 accent-[#7831d6]"
                  />
                </label>
              )}
              {activeFolderId !== 'root' && activeFolderScope === 'global' && (
                <div className="rounded-lg border border-[#7831d6]/30 bg-[#7831d6]/20 px-3.5 py-2 text-[11px] font-semibold text-[#c4b5fd]">
                  This nested folder will be global.
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); setNewFolderScope('campaign'); }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7831d6] hover:bg-[#6825bc] rounded-lg text-xs font-semibold text-white shadow-md shadow-[#7831d6]/30"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl w-full max-w-sm text-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
              <h3 className="text-xs font-bold text-white">Upload Assets</h3>
              {!uploading && (
                <button
                  onClick={() => { clearCarouselDrafts(); clearFileUploadDrafts(); setShowUploadModal(false); }}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {uploading ? (
              <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
                <div className="w-7 h-7 border-2 border-[#7831d6] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-white">{getUploadProgressText()}</span>
                {uploadProgress?.currentFile && (
                  <span className="max-w-[260px] truncate text-[10px] text-zinc-400">{uploadProgress.currentFile}</span>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {/* Row: Files */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.08] hover:border-[#7831d6]/50 hover:bg-white/[0.04] cursor-pointer transition-all group relative">
                  <input key={fileUploadInputKey} type="file" accept="image/*,video/*,audio/*,text/plain,.txt" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#7831d6]/20 transition-colors">
                    <Upload className="w-4 h-4 text-zinc-400 group-hover:text-[#c4b5fd]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight">Upload files</p>
                    <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Multiple files · optional .txt captions</p>
                  </div>
                </label>

                {/* Row: Carousel folders */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.08] hover:border-[#7831d6]/50 hover:bg-white/[0.04] cursor-pointer transition-all group relative">
                  <input type="file" accept="image/*,video/*" multiple webkitdirectory="true" directory="true" onChange={handleCarouselFolderSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#7831d6]/20 border border-[#7831d6]/30 flex items-center justify-center group-hover:bg-[#7831d6]/30 transition-colors">
                    <Images className="w-4 h-4 text-[#c4b5fd]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight">Import carousel folders</p>
                    <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Parent folder · one subfolder per carousel set</p>
                  </div>
                </label>

                {/* Row: Carousel from files */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.08] hover:border-[#7831d6]/50 hover:bg-white/[0.04] cursor-pointer transition-all group relative">
                  <input key={carouselUploadInputKey} type="file" accept="image/*,video/*" multiple onChange={handleCarouselFilesSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#7831d6]/20 border border-[#7831d6]/30 flex items-center justify-center group-hover:bg-[#7831d6]/30 transition-colors">
                    <Images className="w-4 h-4 text-[#c4b5fd]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight">Create carousel from files</p>
                    <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Pick images/videos · drag to reorder</p>
                  </div>
                </label>

                {/* Caption hint */}
                <div className="flex items-center gap-2 rounded-lg bg-[#7831d6]/10 border border-[#7831d6]/20 px-2.5 py-2 text-[10px] text-[#c4b5fd]">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  <span><strong>Caption tip:</strong> Include a <code className="font-mono bg-black/40 px-1 py-0.5 rounded">.txt</code> file with the same name as each media file to auto-match captions.</span>
                </div>

                {/* Gemini AI Video Tagging & Hook Reading info */}
                <div className="flex items-center gap-2 rounded-lg bg-purple-950/30 border border-purple-500/20 px-2.5 py-2 text-[10px] text-purple-300">
                  <Sparkles className="w-3 h-3 flex-shrink-0 text-[#c4b5fd]" />
                  <span><strong>Gemini AI:</strong> Video uploads are auto-analyzed for opening hooks, app showcase scenes, and smart tags in the background.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {renamingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 rounded-2xl w-full max-w-sm text-white shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Rename Folder</h3>
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Folder name"
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                className="w-full bg-black border border-white/10 px-3.5 py-2 rounded-lg focus:outline-none focus:border-[#7831d6] focus:ring-1 focus:ring-[#7831d6] text-xs text-white"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenameFolderModal}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFolderId === renamingFolder._id || !renameFolderName.trim()}
                  className="px-4 py-2 bg-[#7831d6] hover:bg-[#6825bc] rounded-lg text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingFolderId === renamingFolder._id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {folderPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-start gap-3 border-b border-white/[0.08] pb-3">
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
                <Trash2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold text-white">Delete folder</h3>
                <p className="m-0 mt-1 truncate text-[11px] font-semibold text-zinc-400" title={folderPendingDelete.name}>
                  {folderPendingDelete.name || 'Folder'}
                </p>
              </div>
            </div>
            <p className="m-0 text-xs leading-relaxed text-zinc-300">
              This will delete the folder and every file inside it. Large folders can take a moment while stored media is removed.
            </p>
            {deletingFolderId === folderPendingDelete._id && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-400">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
                <span>Deleting folder and files...</span>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteFolderModal}
                disabled={Boolean(deletingFolderId)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                disabled={Boolean(deletingFolderId)}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-50"
              >
                {deletingFolderId === folderPendingDelete._id && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>{deletingFolderId === folderPendingDelete._id ? 'Deleting...' : 'Delete folder'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {taggingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white">Manage Folder Tags</h3>
                <p className="mt-1 truncate text-[11px] text-zinc-400" title={taggingFolder.name}>
                  {taggingFolder.name || 'Folder'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFolderTagsModal}
                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label="Close folder tags"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFolderTags} className="space-y-4">
              <div className="rounded-lg border border-white/[0.08] bg-black p-2">
                <div className="flex min-h-[38px] flex-wrap items-center gap-1.5">
                  {folderTagDrafts.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 border border-white/10 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeFolderTagDraft(tag)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-white/20 hover:text-white"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={folderTagInput}
                    onChange={(e) => setFolderTagInput(e.target.value)}
                    onKeyDown={handleFolderTagInputKeyDown}
                    placeholder={folderTagDrafts.length ? 'Add another tag...' : 'Type a tag and press Enter'}
                    className="min-w-[150px] flex-1 bg-transparent px-1 py-1 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => addFolderTagDraft()}
                  disabled={!folderTagInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeFolderTagsModal}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingFolderTagsId === taggingFolder._id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingFolderTagsId === taggingFolder._id ? 'Saving...' : 'Save tags'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {taggingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white">Manage Media Tags</h3>
                <p className="mt-1 truncate text-[11px] text-zinc-400" title={taggingMedia.name}>
                  {taggingMedia.name || 'Media asset'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMediaTagsModal}
                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label="Close media tags"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMediaTags} className="space-y-4">
              <div className="rounded-lg border border-white/[0.08] bg-black p-2">
                <div className="flex min-h-[38px] flex-wrap items-center gap-1.5">
                  {mediaTagDrafts.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 border border-white/10 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeMediaTagDraft(tag)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-white/20 hover:text-white"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={mediaTagInput}
                    onChange={(e) => setMediaTagInput(e.target.value)}
                    onKeyDown={handleMediaTagInputKeyDown}
                    placeholder={mediaTagDrafts.length ? 'Add another tag...' : 'Type a tag and press Enter'}
                    className="min-w-[150px] flex-1 bg-transparent px-1 py-1 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => addMediaTagDraft()}
                  disabled={!mediaTagInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeMediaTagsModal}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMediaTagsId === taggingMedia._id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingMediaTagsId === taggingMedia._id ? 'Saving...' : 'Save tags'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {renamingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 rounded-2xl w-full max-w-sm text-white shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Rename Media File</h3>
            <form onSubmit={handleRenameMedia} className="space-y-4">
              <input
                type="text"
                placeholder="File name"
                value={renameMediaName}
                onChange={(e) => setRenameMediaName(e.target.value)}
                className="w-full bg-black border border-white/10 px-3.5 py-2 rounded-lg focus:outline-none focus:border-[#7831d6] focus:ring-1 focus:ring-[#7831d6] text-xs text-white"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenameMediaModal}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMediaNameId === renamingMedia._id || !renameMediaName.trim()}
                  className="px-4 py-2 bg-[#7831d6] hover:bg-[#6825bc] rounded-lg text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingMediaNameId === renamingMedia._id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {captionDialogMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.08] p-6 rounded-2xl w-full max-w-lg text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-2">
              <div>
                <h3 className="text-sm font-bold text-white">Edit Caption</h3>
                <p className="mt-1 truncate text-[11px] text-zinc-400 max-w-[240px]" title={captionDialogMedia.name}>
                  {captionDialogMedia.name || 'Media asset'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAICaption}
                disabled={generatingCaption}
                className="flex items-center gap-1.5 bg-[#7831d6] hover:bg-[#6825bc] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md shadow-[#7831d6]/25"
              >
                <Sparkles className={`h-3.5 w-3.5 ${generatingCaption ? 'animate-spin' : ''}`} />
                <span>{generatingCaption ? 'Generating...' : 'AI Generate'}</span>
              </button>
            </div>
            <form onSubmit={handleCaptionDialogSave} className="space-y-4">
              <textarea
                value={getCaptionDraft(captionDialogMedia)}
                onChange={(e) => setCaptionDrafts((current) => ({
                  ...current,
                  [captionDialogMedia._id]: e.target.value,
                }))}
                placeholder="Caption for this asset..."
                className="h-40 w-full rounded-lg border border-white/10 bg-black p-3 text-xs leading-relaxed text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#7831d6] focus:ring-1 focus:ring-[#7831d6] resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeCaptionDialog}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-zinc-300 border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCaptionId === captionDialogMedia._id || getCaptionDraft(captionDialogMedia) === (captionDialogMedia.caption || '')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-[#7831d6]/25"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingCaptionId === captionDialogMedia._id ? 'Saving...' : 'Save caption'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Video Intelligence Modal */}
      {viewingAiMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl w-full max-w-xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-zinc-950/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#7831d6]/20 border border-[#7831d6]/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#c4b5fd]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                    <span>AI Video Intelligence</span>
                    {viewingAiMedia.aiStatus === 'processing' && (
                      <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-medium animate-pulse">
                        Analyzing...
                      </span>
                    )}
                    {viewingAiMedia.aiStatus === 'completed' && (
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-medium">
                        Analyzed
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate max-w-md" title={viewingAiMedia.name}>
                    {viewingAiMedia.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAiMediaId(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close AI modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {viewingAiMedia.aiStatus === 'processing' && (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                  <div className="w-8 h-8 border-2 border-[#7831d6] border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="font-semibold text-white text-xs m-0">Gemini AI is reading this video...</p>
                    <p className="text-[11px] text-zinc-400 mt-1 mb-0">Analyzing opening hook, app screens & generating tags</p>
                  </div>
                </div>
              )}

              {viewingAiMedia.aiStatus === 'failed' && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                  <p className="font-semibold m-0">AI Analysis could not complete</p>
                  <p className="text-[11px] text-rose-400 mt-1 mb-0">{viewingAiMedia.aiError || 'Error occurred during analysis.'}</p>
                </div>
              )}

              {/* Folder Classification Info */}
              <div className="p-3 rounded-xl border border-white/[0.08] bg-zinc-950 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Folder / Placement</span>
                  <p className="text-xs font-semibold text-white mt-0.5 m-0">
                    {getMediaFolderName(viewingAiMedia, folders)}
                  </p>
                </div>
                {getMediaFolderKind(viewingAiMedia, folders) === 'hook' && (
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600/30 to-purple-600/30 border border-purple-400/40 text-[#c4b5fd] text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3 h-3 text-purple-300" /> Hook (Hooks Folder)
                  </span>
                )}
                {getMediaFolderKind(viewingAiMedia, folders) === 'showcase' && (
                  <span className="px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <Images className="w-3 h-3 text-sky-400" /> App Showcase (Showcase Folder)
                  </span>
                )}
              </div>

              {/* Video Summary */}
              {viewingAiMedia.aiAnalysis?.summary && (
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-zinc-950">
                  <h4 className="text-[11px] font-bold text-[#c4b5fd] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Video Summary
                  </h4>
                  <p className="text-zinc-200 leading-relaxed text-xs m-0">
                    {viewingAiMedia.aiAnalysis.summary}
                  </p>
                </div>
              )}

              {/* Reaction & Emotion Understanding */}
              {(viewingAiMedia.aiAnalysis?.reaction?.primaryEmotion || (viewingAiMedia.tags || []).length > 0) && (
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-zinc-950">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5 m-0">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Reaction / Emotion
                    </h4>
                    {viewingAiMedia.aiAnalysis?.reaction?.primaryEmotion && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 border border-purple-500/40 text-purple-300 font-bold uppercase tracking-wide">
                        {viewingAiMedia.aiAnalysis.reaction.primaryEmotion}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-xs">
                    {viewingAiMedia.aiAnalysis?.reaction?.description && (
                      <p className="text-zinc-300 text-[11px] leading-relaxed m-0">
                        {viewingAiMedia.aiAnalysis.reaction.description}
                      </p>
                    )}
                    {viewingAiMedia.aiAnalysis?.reaction?.openingDialogue && (
                      <div className="bg-black/60 border border-white/[0.06] p-2.5 rounded-lg text-[11px] italic text-zinc-300">
                        "{viewingAiMedia.aiAnalysis.reaction.openingDialogue}"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-zinc-950">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 m-0">
                    <Tags className="w-3.5 h-3.5" /> Media Tags
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const current = viewingAiMedia;
                      setViewingAiMediaId(null);
                      openMediaTagsModal(current);
                    }}
                    className="text-[10px] text-[#c4b5fd] hover:underline"
                  >
                    Edit tags
                  </button>
                </div>
                {(viewingAiMedia.tags || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(viewingAiMedia.tags || []).map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white text-[11px] font-semibold">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-[11px] m-0">No tags assigned yet.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08] bg-zinc-950/60">
              <button
                type="button"
                onClick={(e) => handleTriggerAiAnalysis(viewingAiMedia._id, e)}
                disabled={viewingAiMedia.aiStatus === 'processing' || analyzingMediaId === viewingAiMedia._id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-all disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${analyzingMediaId === viewingAiMedia._id ? 'animate-spin' : ''}`} />
                <span>{viewingAiMedia.aiStatus === 'processing' ? 'AI Analyzing...' : 'Re-analyze with Gemini'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingAiMediaId(null)}
                className="px-4 py-1.5 rounded-lg bg-[#7831d6] hover:bg-[#6825bc] text-xs font-semibold text-white shadow-md transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default MediaLibrary;
