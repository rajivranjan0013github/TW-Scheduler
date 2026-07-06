import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Calendar, CheckCircle, Share2 } from 'lucide-react';
import { getMediaUrl } from '../utils/mediaUrls';
import PlatformIcon from '../components/PlatformIcon';

const getAssetUrl = (url) => getMediaUrl(url, { apiBaseUrl: API_BASE_URL });

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

export const CreatorCampaigns = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campaigns, setCampaigns] = useState([]);
  const [posts, setPosts] = useState([]);
  const [todayTracking, setTodayTracking] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharingPostId, setSharingPostId] = useState(null);
  const shareBlobRef = useRef(null);

  const isCreatorActionable = (post) => (
    ['manual', 'hybrid'].includes(post.scheduleMode)
    && !['posted_manual', 'published', 'published_auto', 'failed', 'cancelled'].includes(post.status)
  );

  const getTodayTrackingQuery = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
    }).toString();
  };

  const formatPostTime = (value) => {
    if (!value) return '--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const fetchTodayTracking = useCallback((headers) => {
    const query = getTodayTrackingQuery();
    return queryClient.fetchQuery({
      queryKey: ['creator', 'today-tracking', query],
      queryFn: async () => {
        const response = await fetch(`${API_BASE_URL}/api/scheduler/creator/today-tracking?${query}`, { headers });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
          return { accounts: {} };
        }
        try {
          return await response.json();
        } catch (error) {
          console.warn('Creator tracking response was not valid JSON:', error);
          return { accounts: {} };
        }
      },
      staleTime: 60 * 1000,
    });
  }, [queryClient]);

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
    const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights,instagram_manage_insights');
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
            const response = await fetch(getAssetUrl(media.url));
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
      const [campData, postData, trackingData] = await Promise.all([
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
        fetchTodayTracking(headers),
      ]);

      setCampaigns(campData);
      setPosts(postData);
      setTodayTracking(trackingData.accounts || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchTodayTracking, queryClient, token]);

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
        const [campData, postData, trackingData] = await Promise.all([
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
          fetchTodayTracking(headers),
        ]);

        if (!active) return;

        setCampaigns(campData);
        setPosts(postData);
        setTodayTracking(trackingData.accounts || {});
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
  }, [fetchTodayTracking, queryClient, token]);

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
  const getPostAccounts = (post) => (
    (post.socialAccountIds || []).length > 0
      ? post.socialAccountIds
      : post.campaignChannelIds || []
  );
  const getAccountId = (account) => String(getIdValue(account) || '');
  const getAccountLabel = (account) => account?.username || account?.name || account?.handle || account?.requestedHandle || 'Account';
  const getAccountQueueGroups = (camp) => {
    const campaignPosts = getCampaignCreatorPosts(camp._id);
    const groups = new Map();

    (camp.channels || []).forEach((channel) => {
      const accountId = getAccountId(channel.socialAccountId || channel.matchedAccountId || channel._id);
      if (!accountId) return;
      groups.set(accountId, {
        accountId,
        account: channel,
        posts: [],
      });
    });

    campaignPosts.forEach((post) => {
      const postAccounts = getPostAccounts(post);
      postAccounts.forEach((account) => {
        const accountId = getAccountId(account);
        if (!accountId) return;
        if (!groups.has(accountId)) {
          groups.set(accountId, {
            accountId,
            account,
            posts: [],
          });
        }
        groups.get(accountId).posts.push(post);
      });
    });

    return Array.from(groups.values())
      .map((group) => {
        const actionableQueue = group.posts.filter(isCreatorActionable);
        return {
          ...group,
          posts: group.posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
          actionableQueue,
          nextPost: actionableQueue[0] || null,
        };
      })
      .sort((a, b) => {
        if (a.nextPost && !b.nextPost) return -1;
        if (!a.nextPost && b.nextPost) return 1;
        const aTime = a.nextPost ? new Date(a.nextPost.scheduledAt).getTime() : 0;
        const bTime = b.nextPost ? new Date(b.nextPost.scheduledAt).getTime() : 0;
        return aTime - bTime || getAccountLabel(a.account).localeCompare(getAccountLabel(b.account));
      });
  };
  const nextShareMedia = getPrimaryMedia(nextQueuedPost || {});

  useEffect(() => {
    shareBlobRef.current = null;
    if (!nextQueuedPost?._id || !nextShareMedia?.url || typeof navigator.share !== 'function' || !window.isSecureContext) {
      return undefined;
    }

    let cancelled = false;
    fetch(getAssetUrl(nextShareMedia.url))
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
                        <PlatformIcon platform={ch.platform} className="h-7 w-7 md:h-8 md:w-8" />
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

            <section className="space-y-2 md:space-y-3">
              <div className="px-1">
                <h2 className="m-0 text-sm font-semibold text-black">My Campaigns</h2>
              </div>
              {assignedCampaigns.length > 0 ? (
                <div className="grid gap-2 md:gap-3 lg:grid-cols-2">
                  {assignedCampaigns.flatMap((camp) => {
                    const accountQueues = getAccountQueueGroups(camp);
                    if (accountQueues.length === 0) {
                      return (
                        <div key={`${camp._id}-empty`} className="rounded-lg border border-[#e5e5ea] bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-black">{camp.name}</span>
                            <span className="shrink-0 rounded-full border border-[#e5e5ea] bg-white px-2 py-0.5 text-[10px] font-bold capitalize text-[#6e6e73]">
                              {camp.status || 'active'}
                            </span>
                          </div>
                          <div className="py-2 text-center">
                            <p className="m-0 text-[10px] font-bold uppercase text-[#6e6e73]">Videos</p>
                            <p className="m-0 mt-0.5 text-xs font-semibold text-[#1d1d1f]">No videos yet</p>
                          </div>
                        </div>
                      );
                    }

                    return accountQueues.map((queue) => {
                      const queuePost = queue.nextPost;
                      const tracking = todayTracking[queue.accountId] || { count: 0, posts: [] };
                      const postedToday = tracking.posts || [];
                      const queuePosition = queuePost
                        ? Math.max(queue.posts.findIndex((post) => post._id === queuePost._id) + 1, 1)
                        : 0;

                      return (
                        <div key={`${camp._id}-${queue.accountId}`} className="rounded-lg border border-[#e5e5ea] bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#e5e5ea] pb-2">
                            <span className="truncate text-sm font-semibold text-black">{camp.name}</span>
                            <span className="shrink-0 rounded-full border border-[#e5e5ea] bg-white px-2 py-0.5 text-[10px] font-bold capitalize text-[#6e6e73]">
                              {camp.status || 'active'}
                            </span>
                          </div>

                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <PlatformIcon platform={queue.account?.platform} className="h-6 w-6" />
                              <div className="min-w-0">
                                <p className="m-0 truncate text-xs font-semibold text-[#1d1d1f]">
                                  {getAccountLabel(queue.account).startsWith('@')
                                    ? getAccountLabel(queue.account)
                                    : `@${getAccountLabel(queue.account)}`}
                                </p>
                                <p className="m-0 text-[10px] font-semibold text-[#8e8e93]">
                                  {queue.nextPost ? `Post ${queuePosition}/${queue.actionableQueue.length}` : 'No videos yet'}
                                </p>
                              </div>
                            </div>
                            {queue.nextPost && (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                {queue.actionableQueue.length} left
                              </span>
                            )}
                          </div>

                          <div className="mb-2 rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-2.5 py-2">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase text-[#6e6e73]">Posted today</span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#1d1d1f]">
                                {tracking.count || 0}
                              </span>
                            </div>
                            {postedToday.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {postedToday.slice(0, 6).map((post) => (
                                  <span
                                    key={post.id}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked
                                      readOnly
                                      aria-label={`Posted at ${formatPostTime(post.publishedAt)}`}
                                      className="h-3 w-3 accent-emerald-600"
                                    />
                                    {formatPostTime(post.publishedAt)}
                                  </span>
                                ))}
                                {postedToday.length > 6 && (
                                  <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-[#6e6e73]">
                                    +{postedToday.length - 6}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="m-0 text-[10px] font-semibold text-[#8e8e93]">No live posts detected today</p>
                            )}
                          </div>

                          {queuePost ? (
                            <div className="grid w-full grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleSharePost(queuePost)}
                                disabled={sharingPostId === queuePost._id}
                                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                {sharingPostId === queuePost._id ? 'Opening' : 'Share Video'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkManualPosted(queuePost)}
                                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Mark Posted
                              </button>
                            </div>
                          ) : (
                            <div className="py-2 text-center">
                              <p className="m-0 text-[10px] font-bold uppercase text-[#6e6e73]">Videos</p>
                              <p className="m-0 mt-0.5 text-xs font-semibold text-[#1d1d1f]">No videos yet</p>
                            </div>
                          )}
                        </div>
                      );
                    });
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
