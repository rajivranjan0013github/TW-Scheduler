import React, { useCallback, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Folder, GripVertical, Images, Info, MessageSquareCheck, MessageSquareWarning, MoreVertical, Music, Pencil, Search, Upload, Plus, Trash2, ChevronRight, Clock, Save, Sparkles, Tags, X } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from './videoEditor/videoEditorConstants';
import { getMediaUrl } from '../utils/mediaUrls';
import LoadingVideoPreview from '../components/LoadingVideoPreview';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

const getErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
};

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');

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
  const [folders, setFolders] = useState([]);
  const [media, setMedia] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(() => {
    return location.state?.preselectedFolderId || 'root';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
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
  const [openMediaMenuId, setOpenMediaMenuId] = useState(null);
  const [captionDialogMedia, setCaptionDialogMedia] = useState(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
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
  const [draggingSlide, setDraggingSlide] = useState(null);
  // Per-set save progress: { [setId]: 'pending' | 'uploading' | 'done' | 'error' }
  const [setProgress, setSetProgress] = useState({});

  const authToken = token || localStorage.getItem('tw_token');
  const canUpload = ['owner', 'admin', 'editor'].includes(user?.role);
  const canDelete = ['owner', 'admin'].includes(user?.role);
  const canManageFolders = canUpload;
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

  const clearCarouselDrafts = () => {
    carouselDrafts.forEach((set) => {
      set.slides.forEach((slide) => URL.revokeObjectURL(slide.previewUrl));
    });
    setCarouselDrafts([]);
    setCarouselParentName('');
    setDraggingSlide(null);
    setCarouselUploadInputKey((current) => current + 1);
  };

  const uploadMediaFiles = async ({
    files,
    folderId,
    getCaption = () => '',
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

    const uploadViaNode = async (file, caption) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', folderId);
      formData.append('tags', '');
      formData.append('caption', caption);
      formData.append('socialAccountIds', '');
      formData.append('campaignId', getActiveCampaignId());

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

    const uploadDirectToR2 = async (file, caption) => {
      const campaignId = getActiveCampaignId();
      const contentType = file.type || 'application/octet-stream';
      const initResponse = await fetch(`${API_BASE_URL}/api/media/direct-upload/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId,
          folderId,
          name: file.name,
          contentType,
          size: file.size,
        }),
      });

      if (!initResponse.ok) {
        throw new Error(await getErrorMessage(initResponse, 'Direct upload is not available.'));
      }

      const upload = await initResponse.json();
      const r2Response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: file,
      });

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
          folderId,
          mediaId: upload.mediaId,
          name: file.name,
          contentType,
          size: file.size,
          storageKey: upload.storageKey,
          caption,
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

    await runWithConcurrency(files, UPLOAD_CONCURRENCY, async (file) => {
      active += 1;
      updateProgress(`${progressLabel}: ${file.webkitRelativePath || file.name}`);

      try {
        const caption = getCaption(file);
        if (shouldAttemptDirectUpload) {
          try {
            const uploaded = await uploadDirectToR2(file, caption);
            uploadedMedia.push({ file, media: uploaded });
            return;
          } catch (directError) {
            shouldAttemptDirectUpload = false;
            console.warn('Direct R2 upload failed, using Node upload fallback for this batch:', directError.message);
          }
        }
        const uploaded = await uploadViaNode(file, caption);
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

  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    setErrorMessage('');
    try {
      const campaignId = getActiveCampaignId();
      const data = await queryClient.fetchQuery({
        queryKey: ['media-library', 'folders', campaignId],
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
        staleTime: 2 * 60 * 1000,
      });
      setFolders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load folders:', error);
      setFolders([]);
      setErrorMessage(error.message || 'Failed to load folders.');
    } finally {
      setLoadingFolders(false);
    }
  }, [authToken, queryClient]);

  const PAGE_SIZE = 18;

  const fetchMedia = useCallback(async (targetPage = 1) => {
    const isFirstPage = targetPage === 1;
    if (isFirstPage) {
      setLoadingMedia(true);
    } else {
      setLoadingMore(true);
    }
    setErrorMessage('');
    try {
      const params = new URLSearchParams();
      const campaignId = getActiveCampaignId();
      if (campaignId) params.set('campaignId', campaignId);
      if (activeFolderId) params.set('folderId', activeFolderId);
      params.set('page', String(targetPage));
      params.set('limit', String(PAGE_SIZE));
      const url = `${API_BASE_URL}/api/media?${params.toString()}`;

      const data = await queryClient.fetchQuery({
        queryKey: ['media-library', 'media', campaignId || '', activeFolderId, targetPage, PAGE_SIZE],
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
        staleTime: 60 * 1000,
      });
      const items = Array.isArray(data) ? data : [];
      if (isFirstPage) {
        setMedia(items);
      } else {
        setMedia((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === PAGE_SIZE);
      setPage(targetPage);
    } catch (error) {
      console.error('Failed to load media:', error);
      if (isFirstPage) {
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
    queueMicrotask(() => void fetchMedia());
  }, [fetchMedia]);

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    resetUploadProgress();

    try {
      const { failedFiles } = await uploadMediaFiles({
        files: selectedFiles,
        folderId: activeFolderId === 'root' ? 'null' : activeFolderId,
        progressLabel: 'Uploading file',
      });

      await invalidateMediaCaches();
      void fetchMedia();

      if (failedFiles.length > 0) {
        alert(`${failedFiles.length} files could not be uploaded: ${failedFiles.slice(0, 5).join(', ')}`);
      }
    } catch (error) {
      console.error('Failed uploading file:', error);
      alert(`Upload failed: ${error.message || 'Unable to save these files.'}`);
    } finally {
      setUploading(false);
      resetUploadProgress();
      e.target.value = '';
      setShowUploadModal(false);
    }
  };

  const handleFolderUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const mediaFiles = selectedFiles.filter(file => (
      file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')
    ));

    if (mediaFiles.length === 0) {
      alert('No supported image, video, or audio files were found in this folder.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    resetUploadProgress();

    try {
      const captionMap = await buildCaptionFileMap(selectedFiles);
      const firstRelativePath = mediaFiles[0].webkitRelativePath || mediaFiles[0].name;
      const folderName = firstRelativePath.split('/')[0] || 'Uploaded Folder';
      const folderResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          campaignId: getActiveCampaignId(),
          name: folderName,
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });

      if (!folderResponse.ok) {
        throw new Error(await getErrorMessage(folderResponse, 'Could not create folder in media library.'));
      }

      const createdFolder = await folderResponse.json();
      const targetFolderId = createdFolder._id;

      const { failedFiles } = await uploadMediaFiles({
        files: mediaFiles,
        folderId: targetFolderId,
        getCaption: (file) => getImportedCaption(captionMap, file),
        progressLabel: 'Uploading folder file',
      });

      await invalidateMediaCaches();
      await fetchFolders();
      setActiveFolderId(targetFolderId);

      if (failedFiles.length > 0) {
        alert(`${failedFiles.length} files could not be uploaded: ${failedFiles.slice(0, 5).join(', ')}`);
      }
    } catch (error) {
      console.error('Failed uploading folder:', error);
      alert(`Folder upload failed: ${error.message || 'Unable to import this folder.'}`);
    } finally {
      setUploading(false);
      resetUploadProgress();
      e.target.value = '';
      setShowUploadModal(false);
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
          name: newFolderName.trim(),
          parentFolderId: activeFolderId === 'root' ? null : activeFolderId,
        }),
      });

      if (response.ok) {
        setNewFolderName('');
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

  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation();
    setOpenFolderMenuId(null);
    if (!window.confirm('Are you sure you want to delete this campaign folder? Files inside will be moved to the campaign library.')) return;

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
      } else {
        throw new Error(await getErrorMessage(response, 'Failed to delete folder.'));
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert(error.message || 'Failed to delete folder.');
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

  if (carouselDrafts.length > 0) {
    const totalSlides = carouselDrafts.reduce((sum, set) => sum + set.slides.length, 0);
    const validSets = carouselDrafts.filter((set) => set.slides.length >= 2 && set.slides.length <= 10).length;

    return (
      <div className="min-h-screen bg-[#f0f2f5] text-[#1d1d1f]">
        {/* Sticky Header Bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#e5e7eb] px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Title + Stats */}
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={clearCarouselDrafts}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors flex-shrink-0 shadow-sm"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Back
              </button>
              <div className="min-w-0">
                <h2 className="m-0 text-xl font-bold tracking-tight text-[#111827] leading-tight">{carouselParentName || 'Carousel Sets'}</h2>
                <p className="m-0 text-xs text-[#6b7280] mt-0.5">
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
                className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCarouselSets}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4338ca] transition-colors disabled:bg-[#a5b4fc] disabled:cursor-not-allowed"
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
          <div className="mx-6 mt-4 rounded-xl border border-[#c7d2fe] bg-[#eef2ff] overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#c7d2fe]/60">
              <div className="h-4 w-4 rounded-full border-2 border-[#4f46e5] border-t-transparent animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="m-0 text-xs font-semibold text-[#3730a3]">
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
                  <p className="m-0 mt-0.5 truncate text-[11px] text-[#6366f1]">{uploadProgress.currentFile}</p>
                )}
              </div>
              {/* Overall progress fraction */}
              {uploadProgress?.total > 0 && (
                <span className="flex-shrink-0 text-[11px] font-bold text-[#4f46e5]">
                  {uploadProgress.completed}/{uploadProgress.total}
                </span>
              )}
            </div>

            {/* Overall file progress bar */}
            {uploadProgress?.total > 0 && (
              <div className="h-1 w-full bg-[#c7d2fe]/40">
                <div
                  className="h-full bg-[#4f46e5] transition-all duration-300"
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
                          <svg className="w-4 h-4 text-[#16a34a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {status === 'uploading' && (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#4f46e5] border-t-transparent animate-spin" />
                        )}
                        {status === 'error' && (
                          <svg className="w-4 h-4 text-[#dc2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {status === 'pending' && (
                          <div className="w-3 h-3 rounded-full border-2 border-[#c7d2fe]" />
                        )}
                      </span>
                      <span className={`text-[11px] font-semibold truncate flex-1 ${
                        status === 'done' ? 'text-[#15803d]'
                        : status === 'error' ? 'text-[#dc2626]'
                        : status === 'uploading' ? 'text-[#3730a3]'
                        : 'text-[#9ca3af]'
                      }`}>
                        {set.name}
                        <span className="ml-1.5 font-normal opacity-70">· {set.slides.length} slides</span>
                      </span>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide ${
                        status === 'done' ? 'text-[#16a34a]'
                        : status === 'error' ? 'text-[#dc2626]'
                        : status === 'uploading' ? 'text-[#4f46e5]'
                        : 'text-[#d1d5db]'
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
              <section key={set.id} className="rounded-xl bg-white border border-[#e5e7eb] shadow-sm overflow-hidden">
                {/* Top header: number + name + badges — compact single row */}
                <div className="flex items-center gap-2.5 px-4 py-1.5 border-b border-[#f3f4f6]">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#f3f4f6] text-xs font-bold text-[#374151]">
                    {setIndex + 1}
                  </span>
                  <h3 className="m-0 flex-1 min-w-0 truncate text-sm font-semibold text-[#111827]">{set.name}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[11px] font-semibold text-[#1d4ed8]">
                      {set.slides.length} slides
                    </span>
                    {hasCaption && (
                      <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">Caption ✓</span>
                    )}
                    {hasSlideWarning && (
                      <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]">2–10 needed</span>
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
                            className={`group relative flex-shrink-0 rounded-lg overflow-hidden ${isDragging ? 'opacity-50' : ''} ${uploading ? '' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ width: '96px' }}
                            title={slide.name}
                          >
                            {slide.file.type.startsWith('video/') ? (
                              <video src={slide.previewUrl} muted playsInline className="w-full h-auto block" />
                            ) : (
                              <img src={slide.previewUrl} className="w-full h-auto block" alt="" />
                            )}
                            <span className="absolute left-1 top-1 rounded bg-white/90 px-1 py-0.5 text-[9px] font-bold text-[#374151] shadow-sm">
                              {index + 1}
                            </span>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="flex-shrink-0 w-[380px] p-2 border-l border-[#f3f4f6] flex flex-col gap-1">
                    <p className="m-0 text-[11px] font-semibold text-[#374151]">Caption</p>
                    <textarea
                      value={set.caption}
                      onChange={(e) => updateCarouselCaption(set.id, e.target.value)}
                      disabled={uploading}
                      placeholder="Caption..."
                      className="flex-1 w-full resize-none rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-2.5 text-xs leading-relaxed text-[#111827] placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 transition-all disabled:opacity-50"
                    />
                    {carouselDrafts.length > 1 && set.caption.trim() && (
                      <button
                        type="button"
                        onClick={() => applyToAll(set.caption)}
                        disabled={uploading}
                        className="self-end text-[11px] font-semibold text-[#4f46e5] hover:text-[#4338ca] disabled:opacity-40 transition-colors"
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
    <div className="p-4 space-y-3 bg-[#f5f5f7] min-h-screen text-[#1d1d1f]">

      {/* Single compact header row: title · breadcrumbs · actions */}
      <div className="flex items-center gap-3 border-b border-[#e5e5ea] pb-2.5">
        {/* Title */}
        <h2 className="m-0 text-sm font-bold text-black tracking-tight flex-shrink-0">Media Library</h2>

        {/* Breadcrumb divider */}
        <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] flex-1 min-w-0 overflow-hidden">
          <span
            onClick={() => { setActiveFolderId('root'); setSearchQuery(''); }}
            className={`cursor-pointer hover:text-black flex-shrink-0 ${activeFolderId === 'root' ? 'text-black font-semibold' : ''}`}
          >
            All
          </span>
          {breadcrumbFolders.map((folder) => (
            <React.Fragment key={folder._id}>
              <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <span
                onClick={() => setActiveFolderId(folder._id)}
                title={folder.name}
                className={`cursor-pointer hover:text-black truncate max-w-[120px] ${folder._id === activeFolderId ? 'text-black font-semibold' : ''}`}
              >
                {folder.name || 'Folder'}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#e5e5ea] pl-6 pr-2.5 py-1 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0071e3] text-[11px] text-black placeholder:text-gray-400 w-36"
            />
          </div>
          {canManageFolders && (
            <>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1 bg-[#0071e3] hover:bg-[#147ce5] text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
              >
                <Upload className="w-3 h-3" />
                <span>Upload Assets</span>
              </button>
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="flex items-center gap-1 bg-white border border-[#e5e5ea] hover:bg-[#f5f5f7] text-[#1d1d1f] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>Folder</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-[#ff9500]/30 bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Folders List Grid */}
      {(!searchQuery || visibleFolders.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {visibleFolders.map(folder => (
            <div
              key={folder._id}
              onClick={() => setActiveFolderId(folder._id)}
              className="relative bg-white border border-[#e5e5ea] hover:border-[#c7c7cc] hover:shadow-sm p-3 rounded-lg flex items-center gap-2.5 cursor-pointer group transition-all min-w-0"
            >
              {/* Icon */}
              <span className="flex-shrink-0">
                {folder.kind === 'carousel_set' ? (
                  <Images className="w-4 h-4 text-[#4f46e5]" />
                ) : (
                  <Folder className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                )}
              </span>
              {/* Name + subtitle — takes all remaining width */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <span
                  className="block truncate text-[11px] font-semibold text-[#1d1d1f] leading-tight"
                  title={folder.name}
                >
                  {folder.name}
                </span>
                {folder.kind === 'carousel_set' && (
                  <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-[#4f46e5] opacity-80 leading-tight mt-0.5">
                    {(folder.carouselOrder || []).length || '—'} slides
                  </span>
                )}
                {(folder.tags || []).length > 0 && (
                  <div className="mt-1 flex items-center gap-1 overflow-hidden">
                    {(folder.tags || []).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="max-w-[76px] truncate rounded bg-[#f2f2f7] px-1.5 py-0.5 text-[9px] font-semibold text-[#6e6e73]"
                        title={tag}
                      >
                        {tag}
                      </span>
                    ))}
                    {(folder.tags || []).length > 2 && (
                      <span className="text-[9px] font-semibold text-[#8e8e93]">
                        +{folder.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Actions kebab — only visible on hover to save space */}
              {(canManageFolders || canDelete) && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFolderMenuId((current) => (current === folder._id ? null : folder._id));
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#f5f5f7] text-gray-400 hover:text-black transition-all"
                    title="Folder actions"
                    aria-label="Folder actions"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                  {openFolderMenuId === folder._id && (
                    <div className="absolute right-0 top-6 z-20 w-32 overflow-hidden rounded-lg border border-[#e5e5ea] bg-white py-1 shadow-lg">
                      {canManageFolders && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => openRenameFolderModal(folder, e)}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => openFolderTagsModal(folder, e)}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                          >
                            <Tags className="h-3 w-3" />
                            <span>Add tags</span>
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFolder(folder._id, e)}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {loadingFolders && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] py-3 rounded-lg text-center text-[#8e8e93] text-[11px]">
              Loading folders...
            </div>
          )}
          {!loadingFolders && activeFolderId === 'root' && folders.length === 0 && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] py-3 rounded-lg text-center text-[#8e8e93] text-[11px]">
              No campaigns created.
            </div>
          )}
        </div>
      )}

      {/* Media Files Grid */}
      <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {loadingMedia && (
              <div className="col-span-full border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm">
                Loading media assets...
              </div>
            )}

            {!loadingMedia && filteredMedia.map(item => (
              <div
                key={item._id}
                className="bg-white border border-[#e5e5ea] rounded-xl overflow-visible group hover:border-gray-400 transition-all flex flex-col relative shadow-sm"
              >
                {(() => {
                  return (
                    <>
                      {/* Media Preview Box */}
                      <div className={`${item.type === 'audio' ? 'aspect-square' : 'aspect-[9/16]'} bg-[#f5f5f7] relative overflow-hidden rounded-xl flex items-center justify-center`}>
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
                          <div className="flex h-full w-full flex-col relative overflow-hidden"
                            style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' }}
                          >
                            {/* Top section — icon + name */}
                            <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                              <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
                                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                              >
                                <Music className="h-4 w-4 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-white text-[11px] font-semibold truncate leading-tight">
                                  {item.name?.replace(/\.[^.]+$/, '') || 'Audio'}
                                </p>
                                <p className="text-white/40 text-[9px] mt-0.5 uppercase tracking-wider font-medium">Audio file</p>
                              </div>
                            </div>

                            {/* Waveform visualization */}
                            <div className="flex-1 flex items-center justify-center px-3 py-1">
                              <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: '60px' }}>
                                {[3,8,5,14,8,20,12,25,18,30,22,35,28,38,32,40,35,42,38,40,35,38,32,30,28,35,40,38,34,30,25,20,28,35,30,25,18,22,15,12,8,14,10,6,4,8,12,6,3,5].map((h, i) => (
                                  <rect
                                    key={i}
                                    x={i * 4}
                                    y={30 - h / 2}
                                    width="2.5"
                                    height={h}
                                    rx="1.25"
                                    fill={`url(#audioWaveGrad-${item._id})`}
                                    opacity="0.85"
                                  />
                                ))}
                                <defs>
                                  <linearGradient id={`audioWaveGrad-${item._id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a78bfa" />
                                    <stop offset="100%" stopColor="#667eea" />
                                  </linearGradient>
                                </defs>
                              </svg>
                            </div>

                            {/* Audio controls at bottom */}
                            <div className="px-2 pb-2 pt-1">
                              <audio
                                src={getAssetUrl(item.url)}
                                controls
                                preload="metadata"
                                className="w-full"
                                style={{ height: '26px', borderRadius: '6px', filter: 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.85)' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <img src={getAssetUrl(item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                        )}
                        <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded text-[8px] uppercase font-bold text-black border border-[#e5e5ea] shadow-sm">
                          {item.type}
                        </div>
                        <div
                          className={`absolute left-2 top-9 inline-flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm ${
                            item.caption?.trim()
                              ? 'border-[#34c759]/20 bg-white/95 text-[#15803d]'
                              : 'border-[#ff9500]/20 bg-white/95 text-[#b45309]'
                          }`}
                          title={item.caption?.trim() ? 'Caption saved' : 'No caption saved'}
                        >
                          {item.caption?.trim() ? (
                            <MessageSquareCheck className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquareWarning className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          <p className="m-0 truncate" title={item.name}>{item.name || 'Untitled media'}</p>
                        </div>
                      </div>

                      {/* Media Actions */}
                      <div className="absolute right-2 top-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMediaMenuId((current) => (current === item._id ? null : item._id));
                          }}
                          className="p-1.5 bg-white/95 hover:bg-white hover:text-black rounded-lg transition-all text-gray-500 border border-[#e5e5ea] shadow-sm"
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
                            <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-lg border border-[#e5e5ea] bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={(e) => openRenameMediaModal(item, e)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Rename</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => openCaptionDialog(item, e)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                              >
                                <MessageSquareCheck className="h-3.5 w-3.5" />
                                <span>Edit caption</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMediaMenuId(null);
                                  navigate('/scheduler', { state: { preselectedMediaId: item._id } });
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                              >
                                <Clock className="h-3.5 w-3.5" />
                                <span>Schedule</span>
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteMedia(item._id, e)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-red-600 hover:bg-red-50"
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
            ))}

            {!loadingMedia && filteredMedia.length === 0 && (
              <div className="col-span-full border border-dashed border-[#e5e5ea] p-12 rounded-xl text-center text-gray-500 text-xs bg-white shadow-sm">
                No media assets found.
              </div>
            )}
          </div>

          {hasMore && !loadingMedia && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => void fetchMedia(page + 1)}
                disabled={loadingMore}
                className="flex items-center gap-2 bg-white border border-[#e5e5ea] hover:bg-[#f5f5f7] text-[#1d1d1f] hover:text-black px-6 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading more...</span>
                  </>
                ) : (
                  <span>Load More</span>
                )}
              </button>
            </div>
          )}
        </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-sm text-black shadow-xl">
            <h3 className="text-sm font-semibold text-black mb-4">
              {activeFolderId === 'root' ? 'New Campaign Folder' : 'New Nested Folder'}
            </h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Campaign folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] rounded-lg text-xs text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-[#e5e5ea] rounded-xl w-full max-w-sm text-black shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea]">
              <h3 className="text-xs font-bold text-black">Upload Assets</h3>
              {!uploading && (
                <button
                  onClick={() => { clearCarouselDrafts(); setShowUploadModal(false); }}
                  className="text-gray-400 hover:text-black transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {uploading ? (
              <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
                <div className="w-7 h-7 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-[#1d1d1f]">{getUploadProgressText()}</span>
                {uploadProgress?.currentFile && (
                  <span className="max-w-[260px] truncate text-[10px] text-gray-500">{uploadProgress.currentFile}</span>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {/* Row: Files */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-[#e5e5ea] hover:border-[#0071e3] hover:bg-[#f0f7ff] cursor-pointer transition-all group relative">
                  <input type="file" accept="image/*,video/*,audio/*" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center group-hover:bg-[#dbeafe] transition-colors">
                    <Upload className="w-4 h-4 text-gray-500 group-hover:text-[#0071e3]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Upload files</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Images, videos, audio · up to 100MB</p>
                  </div>
                </label>

                {/* Row: Folder */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-[#e5e5ea] hover:border-[#0071e3] hover:bg-[#f0f7ff] cursor-pointer transition-all group relative">
                  <input type="file" accept="image/*,video/*,audio/*" multiple webkitdirectory="true" directory="true" onChange={handleFolderUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center group-hover:bg-[#dbeafe] transition-colors">
                    <Folder className="w-4 h-4 text-gray-500 group-hover:text-[#0071e3]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Import campaign folder</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Uploads entire nested folder structure</p>
                  </div>
                </label>

                {/* Row: Carousel folders */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-[#c7d2fe] hover:border-[#4f46e5] hover:bg-[#f5f3ff] cursor-pointer transition-all group relative">
                  <input type="file" accept="image/*,video/*" multiple webkitdirectory="true" directory="true" onChange={handleCarouselFolderSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#ede9fe] flex items-center justify-center group-hover:bg-[#ddd6fe] transition-colors">
                    <Images className="w-4 h-4 text-[#4f46e5]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Import carousel folders</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Parent folder · one subfolder per carousel set</p>
                  </div>
                </label>

                {/* Row: Carousel from files */}
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-[#c7d2fe] hover:border-[#4f46e5] hover:bg-[#f5f3ff] cursor-pointer transition-all group relative">
                  <input key={carouselUploadInputKey} type="file" accept="image/*,video/*" multiple onChange={handleCarouselFilesSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#ede9fe] flex items-center justify-center group-hover:bg-[#ddd6fe] transition-colors">
                    <Images className="w-4 h-4 text-[#4f46e5]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Create carousel from files</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Pick images/videos · drag to reorder</p>
                  </div>
                </label>

                {/* Caption hint */}
                <div className="flex items-center gap-2 rounded-lg bg-[#eff6ff] border border-[#bfdbfe] px-2.5 py-2 text-[10px] text-[#1d4ed8]">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  <span><strong>Caption tip:</strong> Include a <code className="font-mono">.txt</code> file with the same name as each media file to auto-match captions.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {renamingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-sm text-black shadow-xl">
            <h3 className="text-sm font-semibold text-black mb-4">Rename Folder</h3>
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Folder name"
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenameFolderModal}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFolderId === renamingFolder._id || !renameFolderName.trim()}
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] rounded-lg text-xs text-white disabled:cursor-not-allowed disabled:bg-[#a7c7ed]"
                >
                  {savingFolderId === renamingFolder._id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taggingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-md text-black shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#e5e5ea] pb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-black">Manage Folder Tags</h3>
                <p className="mt-1 truncate text-[11px] text-[#8e8e93]" title={taggingFolder.name}>
                  {taggingFolder.name || 'Folder'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFolderTagsModal}
                className="rounded-md p-1 text-gray-400 hover:bg-[#f5f5f7] hover:text-black"
                aria-label="Close folder tags"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFolderTags} className="space-y-4">
              <div className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] p-2">
                <div className="flex min-h-[38px] flex-wrap items-center gap-1.5">
                  {folderTagDrafts.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeFolderTagDraft(tag)}
                        className="rounded p-0.5 text-[#8e8e93] hover:bg-[#f5f5f7] hover:text-black"
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
                    className="min-w-[150px] flex-1 bg-transparent px-1 py-1 text-xs text-black placeholder:text-gray-400 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => addFolderTagDraft()}
                  disabled={!folderTagInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5ea] bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeFolderTagsModal}
                    className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingFolderTagsId === taggingFolder._id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#147ce5] disabled:cursor-not-allowed disabled:bg-[#a7c7ed]"
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

      {renamingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-sm text-black shadow-xl">
            <h3 className="text-sm font-semibold text-black mb-4">Rename Media File</h3>
            <form onSubmit={handleRenameMedia} className="space-y-4">
              <input
                type="text"
                placeholder="File name"
                value={renameMediaName}
                onChange={(e) => setRenameMediaName(e.target.value)}
                className="w-full bg-[#f5f5f7] border border-[#e5e5ea] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0071e3] text-xs text-black"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenameMediaModal}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMediaNameId === renamingMedia._id || !renameMediaName.trim()}
                  className="px-4 py-2 bg-[#0071e3] hover:bg-[#147ce5] rounded-lg text-xs text-white disabled:cursor-not-allowed disabled:bg-[#a7c7ed]"
                >
                  {savingMediaNameId === renamingMedia._id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {captionDialogMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-lg text-black shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#e5e5ea] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-black">Edit Caption</h3>
                <p className="mt-1 truncate text-[11px] text-[#8e8e93] max-w-[240px]" title={captionDialogMedia.name}>
                  {captionDialogMedia.name || 'Media asset'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAICaption}
                disabled={generatingCaption}
                className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] disabled:bg-[#a7c7ed] disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
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
                className="h-40 w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] p-3 text-xs leading-relaxed text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0071e3] resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeCaptionDialog}
                  className="px-4 py-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-lg text-xs border border-[#e5e5ea]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCaptionId === captionDialogMedia._id || getCaptionDraft(captionDialogMedia) === (captionDialogMedia.caption || '')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#147ce5] disabled:cursor-not-allowed disabled:bg-[#a7c7ed]"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingCaptionId === captionDialogMedia._id ? 'Saving...' : 'Save caption'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default MediaLibrary;
