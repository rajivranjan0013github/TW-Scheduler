import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Calendar, CheckCircle, Share2 } from 'lucide-react';

const getProxyUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('https://pub-') || url.includes('r2.cloudflarestorage.com')) {
    return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const copyToClipboard = (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
};

const PlatformLogo = ({ platform, className = 'h-7 w-7' }) => {
  if (platform === 'instagram') {
    return (
      <span className={`${className} inline-flex items-center justify-center rounded-lg bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[70%] w-[70%]">
          <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="8" r="1.1" fill="currentColor" />
        </svg>
      </span>
    );
  }

  if (platform === 'facebook') {
    return (
      <span className={`${className} inline-flex items-center justify-center rounded-full bg-[#1877f2] text-white`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[72%] w-[72%]">
          <path fill="currentColor" d="M14.2 8.1h2.2V4.4c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 1.9-5.4 5.4v3H4.3v4.1h3.5V24h4.3v-7.3h3.4l.5-4.1h-3.9V10c0-1.2.3-1.9 2.1-1.9Z" />
        </svg>
      </span>
    );
  }

  if (platform === 'youtube') {
    return (
      <span className={`${className} inline-flex items-center justify-center rounded-lg bg-[#ff0000] text-white`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[68%] w-[68%]">
          <path fill="currentColor" d="M23 12a30.1 30.1 0 0 0-.5-4.6 3 3 0 0 0-2.1-2.1C18.5 4.8 12 4.8 12 4.8s-6.5 0-8.4.5A3 3 0 0 0 1.5 7.4 31.4 31.4 0 0 0 1 12a31.4 31.4 0 0 0 .5 4.6 3 3 0 0 0 2.1 2.1c1.9.5 8.4.5 8.4.5s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.1.3.3 0 0 0 .5-4.6ZM9.5 15.5V8.5l6.5 3.5-6.5 3.5Z" />
        </svg>
      </span>
    );
  }

  return <span className={`${className} inline-flex items-center justify-center rounded-full bg-gray-200`} />;
};

export const CreatorCampaigns = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campaigns, setCampaigns] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharingPostId, setSharingPostId] = useState(null);
  const shareBlobRef = useRef(null);

  const isCreatorActionable = (post) => (
    ['manual', 'hybrid'].includes(post.scheduleMode)
    && !['posted_manual', 'published', 'published_auto', 'failed', 'cancelled'].includes(post.status)
  );

  const updatePostInList = (updatedPost) => {
    setPosts((current) => current.map((post) => (
      post._id === updatedPost._id ? updatedPost : post
    )));
  };

  const prepareVerificationRedirect = (campaignId) => {
    sessionStorage.setItem('connect_campaign_id', campaignId);
    sessionStorage.setItem('connect_return_path', '/campaigns');
  };

  const connectMetaOAuth = (campaignId) => {
    prepareVerificationRedirect(campaignId);
    const appId = import.meta.env.VITE_META_APP_ID || 'your-meta-app-id';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/facebook/callback');
    const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights,instagram_manage_insights');
    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    window.location.href = oauthUrl;
  };

  const connectInstagramOAuth = (campaignId) => {
    const appId = import.meta.env.VITE_INSTAGRAM_APP_ID;
    const facebookAppId = import.meta.env.VITE_META_APP_ID;
    if (!appId || appId === facebookAppId) {
      alert('Set VITE_INSTAGRAM_APP_ID to the Instagram App ID from Meta Dashboard > Instagram > API setup with Instagram login. It cannot be the Facebook App ID.');
      return;
    }

    prepareVerificationRedirect(campaignId);
    const rawRedirectUri = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || `${window.location.origin}/auth/instagram/callback`;
    sessionStorage.setItem('instagram_oauth_redirect_uri', rawRedirectUri);
    const redirectUri = encodeURIComponent(rawRedirectUri);
    const scope = encodeURIComponent('instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights');
    const oauthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.href = oauthUrl;
  };

  const connectYoutubeOAuth = async (campaignId) => {
    try {
      prepareVerificationRedirect(campaignId);
      const response = await fetch(`${API_BASE_URL}/api/accounts/youtube/auth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.message || 'Failed to start YouTube connection.');
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Failed to start YouTube OAuth:', error);
      alert('Failed to connect to the backend for YouTube OAuth.');
    }
  };

  const handleVerifyChannel = (channel) => {
    if (channel.platform === 'instagram') {
      connectInstagramOAuth(channel.campaignId);
      return;
    }

    if (channel.platform === 'youtube') {
      void connectYoutubeOAuth(channel.campaignId);
      return;
    }

    if (channel.platform === 'facebook') {
      connectMetaOAuth(channel.campaignId);
      return;
    }

    navigate('/channels', { state: { campaignId: channel.campaignId } });
  };

  const markPostDownloaded = async (post) => {
    const response = await fetch(`${API_BASE_URL}/api/scheduler/${post._id}/downloaded`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      updatePostInList(await response.json());
      void queryClient.invalidateQueries({ queryKey: ['creator'] });
      void queryClient.invalidateQueries({ queryKey: ['scheduler'] });
    }
  };

  const handleCopyCaption = async (post) => {
    const text = post.caption?.trim();
    if (!text) {
      alert('No caption or description is attached to this post.');
      return false;
    }

    try {
      await copyToClipboard(text);
      return true;
    } catch (err) {
      console.warn('Caption copy failed:', err);
      alert('Could not copy the caption. Please select and copy it manually.');
      return false;
    }
  };

  const getMediaFileName = (media) => {
    const rawName = media?.name || media?.url?.split('/').pop()?.split('?')[0] || 'creator-video.mp4';
    return rawName.includes('.') ? rawName : `${rawName}.mp4`;
  };

  const handleSharePost = async (post) => {
    const media = post.mediaIds?.[0];
    if (!media?.url) {
      alert('No video is attached to this post.');
      return;
    }

    if (post.caption?.trim()) {
      void handleCopyCaption(post);
    }
    setSharingPostId(post._id);

    try {
      void markPostDownloaded(post).catch((err) => {
        console.error('Failed to mark post downloaded:', err);
      });

      if (typeof navigator.share !== 'function') {
        alert('Native sharing is not available in this browser.');
        return;
      }

      const fileName = getMediaFileName(media);

      if (window.isSecureContext) {
        try {
          const cached = shareBlobRef.current;
          let blob = cached?.postId === post._id && cached?.mediaUrl === media.url
            ? cached.blob
            : null;

          if (!blob) {
            const response = await fetch(getProxyUrl(media.url));
            blob = response.ok ? await response.blob() : null;
          }

          if (blob) {
            const file = new File([blob], fileName, { type: blob.type || 'video/mp4' });
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: fileName,
                text: post.caption || '',
              });
              return;
            }
          }
        } catch (fileShareError) {
          if (fileShareError.name === 'AbortError') return;
          console.warn('File share failed, falling back to URL share:', fileShareError);
        }
      }

      await navigator.share({
        title: fileName,
        text: post.caption || '',
        url: media.url,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        alert('Could not open the share sheet for this video.');
      }
    } finally {
      setSharingPostId(null);
    }
  };

  const handleMarkManualPosted = async (post) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduler/${post._id}/manual-posted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ manualPostUrl: '' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Could not mark this post as posted.');
      }
      updatePostInList(data);
      await queryClient.invalidateQueries({ queryKey: ['creator'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduler'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      alert(err.message);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const fetchJson = async (url) => {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      };
      const [campData, postData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['creator', 'campaigns'],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/accounts/creator/campaigns`),
          staleTime: 2 * 60 * 1000,
        }),
        queryClient.fetchQuery({
          queryKey: ['creator', 'posts'],
          queryFn: () => fetchJson(`${API_BASE_URL}/api/scheduler/creator/posts`),
          staleTime: 20 * 1000,
        }),
      ]);

      setCampaigns(campData);
      setPosts(postData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [queryClient, token]);

  useEffect(() => {
    let active = true;
    const initialFetch = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const fetchJson = async (url) => {
          const response = await fetch(url, { headers });
          if (!response.ok) throw new Error(`Request failed: ${response.status}`);
          return response.json();
        };
        const [campData, postData] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['creator', 'campaigns'],
            queryFn: () => fetchJson(`${API_BASE_URL}/api/accounts/creator/campaigns`),
            staleTime: 2 * 60 * 1000,
          }),
          queryClient.fetchQuery({
            queryKey: ['creator', 'posts'],
            queryFn: () => fetchJson(`${API_BASE_URL}/api/scheduler/creator/posts`),
            staleTime: 20 * 1000,
          }),
        ]);

        if (!active) return;

        setCampaigns(campData);
        setPosts(postData);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (token) {
      initialFetch();
    }

    return () => {
      active = false;
    };
  }, [queryClient, token]);

  const pendingVerifications = campaigns.flatMap((camp) => (
    (camp.channels || [])
      .filter((ch) => !ch.isVerified)
      .map((ch) => ({ ...ch, campaignId: camp._id, campaignName: camp.name }))
  ));
  const assignedCampaigns = campaigns.filter((camp) => (camp.channels || []).length > 0);
  const creatorQueuePosts = posts.filter((post) => (
    ['manual', 'hybrid'].includes(post.scheduleMode)
    && !['failed', 'cancelled'].includes(post.status)
  ));
  const actionablePosts = posts.filter(isCreatorActionable);
  const nextQueuedPost = actionablePosts[0] || null;
  const getIdValue = (value) => (typeof value === 'object' && value !== null ? value._id : value);
  const getCampaignCreatorPosts = (campaignId) => (
    creatorQueuePosts.filter((post) => String(getIdValue(post.campaignId)) === String(campaignId))
  );

  const getPrimaryMedia = (post) => post.mediaIds?.[0] || null;
  const getPostAccounts = (post) => post.socialAccountIds || [];
  const getAccountLabel = (account) => account?.username || account?.name || account?.handle || account?.requestedHandle || 'Account';
  const creatorQueueTotal = creatorQueuePosts.length || actionablePosts.length;
  const nextShareMedia = getPrimaryMedia(nextQueuedPost || {});

  useEffect(() => {
    shareBlobRef.current = null;
    if (!nextQueuedPost?._id || !nextShareMedia?.url || typeof navigator.share !== 'function' || !window.isSecureContext) {
      return undefined;
    }

    let cancelled = false;
    fetch(getProxyUrl(nextShareMedia.url))
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!cancelled && blob) {
          shareBlobRef.current = {
            postId: nextQueuedPost._id,
            mediaUrl: nextShareMedia.url,
            blob,
          };
        }
      })
      .catch((err) => {
        console.warn('Share preload failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [nextQueuedPost?._id, nextShareMedia?.url]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-2 pb-4 pt-2 text-[#1d1d1f] sm:px-3 sm:pt-3 md:px-6 md:py-5">
      <div className="mx-auto max-w-4xl space-y-2 sm:space-y-3 md:space-y-4">
       

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[#d2d2d7] bg-white p-8 text-center text-sm text-[#6e6e73]">
            Syncing campaigns and calendar...
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {pendingVerifications.length > 0 && (
              <section className="rounded-lg border border-[#d2d2d7] bg-white">
                <div className="border-b border-[#e5e5ea] px-3 py-2.5 md:px-4 md:py-3">
                  <h2 className="m-0 text-sm font-semibold text-black">Channels To Verify</h2>
                </div>
                <div className="grid gap-2 p-3 md:gap-3 md:p-4 lg:grid-cols-2">
                  {pendingVerifications.map((ch) => (
                    <div key={`${ch.campaignId}-${ch.platform}-${ch.handle}`} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 md:p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <PlatformLogo platform={ch.platform} className="h-7 w-7 shrink-0 md:h-8 md:w-8" />
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">
                            {ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`}
                          </p>
                          <p className="m-0 truncate text-xs text-[#8a6b1f]">{ch.campaignName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVerifyChannel(ch)}
                        className="shrink-0 rounded-lg bg-[#1d1d1f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
                      >
                        Verify
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-lg border border-[#d2d2d7] bg-white">
              <div className="border-b border-[#e5e5ea] px-3 py-2.5 md:px-4 md:py-3">
                <h2 className="m-0 text-sm font-semibold text-black">My Campaigns</h2>
              </div>
              {assignedCampaigns.length > 0 ? (
                <div className="grid gap-2 p-3 md:gap-3 md:p-4 lg:grid-cols-2">
                  {assignedCampaigns.map((camp) => {
                    const verifiedCount = (camp.channels || []).filter((ch) => ch.isVerified).length;
                    const campaignPosts = getCampaignCreatorPosts(camp._id);
                    const campaignNextPost = campaignPosts.find(isCreatorActionable) || null;
                    const campaignPrimaryAccount = getPostAccounts(campaignNextPost || {})[0] || (camp.channels || [])[0] || null;
                    const campaignExtraAccountCount = Math.max(getPostAccounts(campaignNextPost || {}).length - 1, 0);
                    const campaignPostPosition = campaignNextPost
                      ? Math.max(creatorQueuePosts.findIndex((post) => post._id === campaignNextPost._id) + 1, 1)
                      : 0;
                    const campaignMedia = getPrimaryMedia(campaignNextPost || {});
                    const campaignMediaUrl = getProxyUrl(campaignMedia?.url);
                    return (
                      <div key={camp._id} className="rounded-lg border border-[#e5e5ea] bg-[#fbfbfb] p-3">
                        <div className="flex flex-col gap-1.5 border-b border-[#e5e5ea] pb-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate text-base font-semibold text-black">{camp.name}</span>
                              {campaignNextPost && (
                                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-[#1d1d1f]">
                                  Post {campaignPostPosition}/{creatorQueueTotal}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold capitalize text-[#6e6e73] border border-[#e5e5ea]">
                              {camp.status || 'active'}
                            </span>
                          </div>
                          {(camp.channels || []).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {(camp.channels || []).map((ch) => (
                                <span
                                  key={`${camp._id}-${ch.platform}-${ch.handle || ch.username}`}
                                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${
                                    ch.isVerified
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border-amber-100'
                                  }`}
                                >
                                  <PlatformLogo platform={ch.platform} className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[100px]">
                                    {(ch.handle || ch.username || '').startsWith('@')
                                      ? (ch.handle || ch.username)
                                      : `@${ch.handle || ch.username || 'channel'}`}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="mt-2.5 rounded-lg border border-[#e5e5ea] bg-white p-2.5">
                          {campaignNextPost ? (
                            <div className="flex flex-col items-center">
                              <div className="w-full max-w-[150px] overflow-hidden rounded-md border border-[#e5e5ea] bg-black">
                                {!campaignMedia?.url ? (
                                  <div className="flex aspect-[9/16] items-center justify-center bg-[#f5f5f7] p-2 text-center text-xs font-semibold text-[#6e6e73]">
                                    No media
                                  </div>
                                ) : campaignMedia.type === 'video' || campaignMedia.url.endsWith('.mp4') ? (
                                  <video
                                    src={campaignMediaUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="aspect-[9/16] w-full object-cover"
                                  />
                                ) : (
                                  <img src={campaignMediaUrl} alt="" className="aspect-[9/16] w-full object-cover" />
                                )}
                              </div>
                              <div className="mt-2.5 grid grid-cols-2 gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleSharePost(campaignNextPost)}
                                  disabled={sharingPostId === campaignNextPost._id}
                                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-black transition-colors"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                  {sharingPostId === campaignNextPost._id ? 'Opening' : 'Share Video'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkManualPosted(campaignNextPost)}
                                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Mark Posted
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2 text-center">
                              <p className="m-0 text-[10px] font-bold uppercase text-[#6e6e73]">Videos</p>
                              <p className="m-0 mt-0.5 text-xs font-semibold text-[#1d1d1f]">No videos yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-sm text-[#6e6e73] md:p-6">
                  <Calendar className="mx-auto h-7 w-7 text-[#8e8e93]/60" />
                  <p className="m-0 mt-2 font-semibold text-[#1d1d1f]">No campaign cards yet</p>
                  <p className="m-0 mt-1 text-xs">Assigned campaigns will appear here.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorCampaigns;
