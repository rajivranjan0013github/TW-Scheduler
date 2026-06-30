import React, { useCallback, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Folder, Images, Info, MessageSquareCheck, MessageSquareWarning, MoreVertical, Music, Pencil, Search, Upload, Plus, Trash2, ChevronRight, Clock, Save, Sparkles } from 'lucide-react';
import { getActiveCampaignId, withCampaignScope } from '../utils/campaignScope';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from './videoEditor/videoEditorConstants';
import { getProxiedMediaUrl } from '../utils/mediaUrls';

const getProxyUrl = (url) => getProxiedMediaUrl(url, API_BASE_URL);

const getErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
};

const normalizeFolderId = (folderId) => String(folderId?._id || folderId || '');

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

  const handleSaveCarouselSets = async () => {
    if (carouselDrafts.length === 0) return;

    const invalidSet = carouselDrafts.find((set) => set.slides.length < 2 || set.slides.length > 10);
    if (invalidSet) {
      alert(`${invalidSet.name} needs 2 to 10 slides for Instagram carousel publishing.`);
      return;
    }

    setUploading(true);
    resetUploadProgress();

    try {
      const parentResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
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

      let firstSetFolderId = null;
      for (const set of carouselDrafts) {
        const setResponse = await fetch(`${API_BASE_URL}/api/media/folders${withCampaignScope()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            campaignId: getActiveCampaignId(),
            name: set.name,
            parentFolderId: parentFolder._id,
            kind: 'carousel_set',
            carouselCaption: set.caption || '',
          }),
        });
        if (!setResponse.ok) {
          throw new Error(await getErrorMessage(setResponse, `Could not create ${set.name}.`));
        }
        const setFolder = await setResponse.json();
        if (!firstSetFolderId) firstSetFolderId = setFolder._id;

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

        const orderResponse = await fetch(`${API_BASE_URL}/api/media/folders/${setFolder._id}/carousel${withCampaignScope()}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            campaignId: getActiveCampaignId(),
            carouselCaption: set.caption || '',
            carouselOrder,
          }),
        });
        if (!orderResponse.ok) {
          throw new Error(await getErrorMessage(orderResponse, `Could not save slide order for ${set.name}.`));
        }
      }

      await invalidateMediaCaches();
      await fetchFolders();
      setActiveFolderId(parentFolder._id || firstSetFolderId || activeFolderId);
      clearCarouselDrafts();
    } catch (error) {
      console.error('Failed saving carousel sets:', error);
      alert(`Carousel set upload failed: ${error.message || 'Unable to save carousel sets.'}`);
    } finally {
      setUploading(false);
      resetUploadProgress();
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
  const visibleFolders = folders
    .filter((folder) => getFolderParentId(folder) === activeFolderId)
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

  const normalizedSearch = searchQuery.trim().toLowerCase();
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

    return (
      <div className="min-h-screen bg-[#f5f5f7] p-6 text-[#1d1d1f]">
        <div className="mb-5 rounded-xl border border-[#e5e5ea] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={clearCarouselDrafts}
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-3 py-1.5 text-xs font-semibold text-[#536079] hover:border-[#c7c7cc] hover:text-black"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              Back to Media Library
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-xl font-semibold tracking-tight text-black">Review Carousel Sets</h2>
              <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#4f46e5]">
                Draft
              </span>
            </div>
            <p className="mt-1 text-xs text-[#6e6e73]">Confirm slide order and captions before saving.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-2.5 py-1 text-[11px] font-semibold text-[#536079]">{carouselDrafts.length} set{carouselDrafts.length === 1 ? '' : 's'}</span>
              <span className="rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-2.5 py-1 text-[11px] font-semibold text-[#536079]">{totalSlides} slides</span>
              <span className="max-w-[260px] truncate rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-2.5 py-1 text-[11px] font-semibold text-[#536079]">{carouselParentName || 'Carousel Sets'}</span>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={clearCarouselDrafts}
              disabled={uploading}
              className="rounded-lg border border-[#e5e5ea] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCarouselSets}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4338ca] disabled:bg-[#c7c7cc]"
            >
              <Save className="h-3.5 w-3.5" />
              {uploading ? 'Saving...' : 'Save Carousel Sets'}
            </button>
          </div>
          </div>
        </div>

        {uploading && (
          <div className="rounded-xl border border-[#d8e0f4] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-[#4f46e5] border-t-transparent animate-spin" />
              <div className="min-w-0">
                <p className="m-0 text-xs font-semibold text-black">{getUploadProgressText()}</p>
                {uploadProgress?.currentFile && (
                  <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[#6b7280]">{uploadProgress.currentFile}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="grid grid-cols-[180px_minmax(0,1fr)_260px] gap-4 border-b border-[#ececf1] bg-[#fbfbfd] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] max-lg:hidden">
            <span>Carousel</span>
            <span>Slide Order</span>
            <span>Caption</span>
          </div>
          {carouselDrafts.map((set) => (
            <section key={set.id} className="grid grid-cols-[180px_minmax(0,1fr)_260px] gap-4 border-b border-[#f0f0f3] px-4 py-4 last:border-b-0 max-lg:grid-cols-1">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
                  <Images className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 truncate text-sm font-semibold text-[#111827]">{set.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-semibold text-[#6e6e73]">{set.slides.length} slides</span>
                    {(set.caption || '').trim() && (
                      <span className="rounded-md bg-[#ecfdf3] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803d]">Caption ready</span>
                    )}
                    {(set.slides.length < 2 || set.slides.length > 10) && (
                      <span className="rounded-md bg-[#fff7ed] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309]">Needs 2-10</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-1 hidden text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] max-lg:block">Slide Order</div>
                <div className="flex gap-2.5 overflow-x-auto pb-1">
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
	                        className={`group w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f8f8fa] p-1.5 transition-all ${isDragging ? 'opacity-60 ring-2 ring-[#4f46e5]/30' : 'hover:bg-[#eef2ff]'} ${uploading ? '' : 'cursor-grab active:cursor-grabbing'}`}
	                        title={slide.name}
	                      >
	                        <div className="relative aspect-square overflow-hidden rounded-lg bg-[#ececf1]">
	                          {slide.file.type.startsWith('video/') ? (
	                            <video src={slide.previewUrl} muted playsInline className="h-full w-full object-cover" />
	                          ) : (
	                            <img src={slide.previewUrl} className="h-full w-full object-cover" alt="" />
	                          )}
                            <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-white/95 px-1.5 text-[10px] font-bold text-[#4f46e5] shadow-sm">
                              {index + 1}
                            </span>
	                        </div>
	                        <span className="mt-1 block truncate px-0.5 text-[10px] font-semibold text-[#374151]">{slide.name}</span>
	                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 hidden text-[10px] font-bold uppercase tracking-wider text-[#6e6e73] max-lg:block">Caption</span>
                <textarea
                  value={set.caption}
                  onChange={(e) => updateCarouselCaption(set.id, e.target.value)}
                  disabled={uploading}
                  placeholder="Caption for this carousel..."
                  className="h-16 w-full resize-none rounded-lg border-0 bg-[#f8f8fa] p-2 text-[11px] leading-relaxed text-[#111827] placeholder:text-[#9ca3af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/25"
                />
              </label>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[#f5f5f7] min-h-screen text-[#1d1d1f]">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-black tracking-tight m-0">Media Library</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Store campaign media in R2 with captions saved to the library</p>
        </div>

        {canManageFolders && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#147ce5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Assets</span>
            </button>
            <button 
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] hover:bg-[#f5f5f7] text-[#1d1d1f] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Directory Breadcrumbs & Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[11px] text-[#8e8e93]">
          <span 
            onClick={() => { setActiveFolderId('root'); setSearchQuery(''); }}
            className={`cursor-pointer hover:text-black ${activeFolderId === 'root' ? 'text-black font-semibold' : ''}`}
          >
            Campaign Library
          </span>
          {breadcrumbFolders.map((folder) => (
            <React.Fragment key={folder._id}>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span
                onClick={() => setActiveFolderId(folder._id)}
                className={`cursor-pointer hover:text-black ${folder._id === activeFolderId ? 'text-black font-semibold' : ''}`}
              >
                {folder.name || 'Campaign View'}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Search Media Input */}
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f5f5f7] border border-[#e5e5ea] pl-8 pr-2.5 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-apple-blue text-xs text-black placeholder:text-gray-400"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-[#ff9500]/30 bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Folders List Grid */}
      {!searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {visibleFolders.map(folder => (
            <div 
              key={folder._id}
              onClick={() => setActiveFolderId(folder._id)}
              className="relative bg-white border border-[#e5e5ea] hover:border-gray-400 p-4 rounded-xl flex items-center justify-between cursor-pointer group transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                {folder.kind === 'carousel_set' ? (
                  <Images className="w-5 h-5 text-[#4f46e5]" />
                ) : (
                  <Folder className="w-5 h-5 text-gray-400" />
                )}
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-black group-hover:text-black transition-colors">{folder.name}</span>
                  {folder.kind === 'carousel_set' && (
                    <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-[#4f46e5]">
                      Carousel · {(folder.carouselOrder || []).length || 'set'} slides
                    </span>
                  )}
                </div>
              </div>
              {(canManageFolders || canDelete) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFolderMenuId((current) => (current === folder._id ? null : folder._id));
                    }}
                    className="p-1.5 hover:bg-[#f5f5f7] hover:text-black rounded-md transition-all text-gray-400"
                    title="Folder actions"
                    aria-label="Folder actions"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                  {openFolderMenuId === folder._id && (
                    <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-[#e5e5ea] bg-white py-1 shadow-lg">
                      {canManageFolders && (
                        <button
                          type="button"
                          onClick={(e) => openRenameFolderModal(folder, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Rename</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFolder(folder._id, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
            <div className="col-span-full border border-dashed border-[#e5e5ea] p-6 rounded-xl text-center text-[#8e8e93] text-xs">
              Loading folders...
            </div>
          )}
          {!loadingFolders && activeFolderId === 'root' && folders.length === 0 && (
            <div className="col-span-full border border-dashed border-[#e5e5ea] p-6 rounded-xl text-center text-[#8e8e93] text-xs">
              No campaigns created.
            </div>
          )}
        </div>
      )}

      {/* Media Files Grid */}
      <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
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
                          <video 
                            src={getProxyUrl(item.url)} 
                            poster={item.thumbnailUrl ? getProxyUrl(item.thumbnailUrl) : undefined}
                            crossOrigin="anonymous" 
                            className="w-full h-full object-cover cursor-pointer" 
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
                                src={getProxyUrl(item.url)}
                                controls
                                preload="metadata"
                                className="w-full"
                                style={{ height: '26px', borderRadius: '6px', filter: 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.85)' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <img src={getProxyUrl(item.thumbnailUrl || item.url)} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white border border-[#e5e5ea] p-6 rounded-2xl w-full max-w-md text-black shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-3">
              <h3 className="text-sm font-semibold text-black">Upload Campaign Assets</h3>
              {!uploading && (
                <button 
                  onClick={() => {
                    clearCarouselDrafts();
                    setShowUploadModal(false);
                  }}
                  className="text-gray-400 hover:text-black text-xs font-semibold"
                >
                  Close
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {uploading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-8 h-8 border-3 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold text-[#1d1d1f]">{getUploadProgressText()}</span>
                  {uploadProgress?.currentFile && (
                    <span className="max-w-[320px] truncate text-[10px] font-medium text-gray-500">
                      {uploadProgress.currentFile}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="border border-dashed border-[#e5e5ea] rounded-xl p-6 text-center hover:border-gray-400 cursor-pointer relative group transition-all bg-[#f5f5f7]">
                    <input 
                      type="file" 
                      accept="image/*,video/*,audio/*"
                      multiple
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="space-y-2 text-gray-400">
                      <Upload className="w-6 h-6 mx-auto text-gray-400" />
                      <p className="text-xs font-semibold text-black">Click to upload files</p>
                      <p className="text-[10px] text-gray-500">Supports videos/images/audio up to 100MB</p>
                    </div>
                  </div>

		                  <div className="border border-dashed border-[#d2d2d7] rounded-xl p-5 text-center hover:border-gray-400 cursor-pointer relative group transition-all bg-white">
		                    <input
		                      type="file"
	                      accept="image/*,video/*,audio/*"
                      multiple
                      webkitdirectory="true"
                      directory="true"
                      onChange={handleFolderUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="space-y-2 text-gray-400">
                      <Folder className="w-6 h-6 mx-auto text-gray-400" />
                      <p className="text-xs font-semibold text-black">Import campaign folder</p>
                      <p className="text-[10px] text-gray-500">Supports uploading entire nested folder structure</p>
	                    </div>
		                  </div>

			                  <div className="border border-dashed border-[#c7d2fe] rounded-xl p-5 text-center hover:border-[#4f46e5] cursor-pointer relative group transition-all bg-[#f8f7ff]">
			                    <input
			                      type="file"
			                      accept="image/*,video/*"
			                      multiple
			                      webkitdirectory="true"
			                      directory="true"
			                      onChange={handleCarouselFolderSelect}
			                      className="absolute inset-0 opacity-0 cursor-pointer"
			                    />
			                    <div className="space-y-2 text-gray-400">
			                      <Images className="w-6 h-6 mx-auto text-[#4f46e5]" />
			                      <p className="text-xs font-semibold text-black">Import carousel folders</p>
			                      <p className="text-[10px] text-gray-500">Choose a parent folder containing one folder per carousel</p>
			                    </div>
			                  </div>

			                  <div className="border border-dashed border-[#c7d2fe] rounded-xl p-5 text-center hover:border-[#4f46e5] cursor-pointer relative group transition-all bg-[#f8f7ff]">
			                    <input
			                      key={carouselUploadInputKey}
			                      type="file"
		                      accept="image/*,video/*"
		                      multiple
		                      onChange={handleCarouselFilesSelect}
		                      className="absolute inset-0 opacity-0 cursor-pointer"
		                    />
		                    <div className="space-y-2 text-gray-400">
		                      <Images className="w-6 h-6 mx-auto text-[#4f46e5]" />
		                      <p className="text-xs font-semibold text-black">Create carousel from files</p>
		                      <p className="text-[10px] text-gray-500">Select multiple images/videos in the order you want</p>
		                    </div>
		                  </div>

	                  <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 p-3.5 text-[11px] text-blue-800 leading-relaxed shadow-sm">
                    <Info className="h-4.5 w-4.5 shrink-0 text-[#0071e3] mt-0.5" />
                    <div>
                      <span className="font-semibold block text-black mb-0.5">Caption Auto-matching:</span>
                      To automatically apply captions when importing a folder, include a <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] font-mono text-[#0071e3] font-semibold">.txt</code> file matching the exact name of each media file (e.g., <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] font-mono text-[#0071e3]">video.mp4</code> and <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] font-mono text-[#0071e3]">video.txt</code>).
                    </div>
                  </div>
                </>
              )}
            </div>
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
