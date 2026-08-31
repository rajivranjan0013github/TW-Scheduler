import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';
import ProductDetailsFields from '../components/campaigns/ProductDetailsFields';
import VideoFormatsStudio from '../components/campaigns/VideoFormatsStudio';
import { emptyProductFields } from '../components/campaigns/campaignProductForm';

const statusOptions = ['active', 'paused', 'archived'];
const platformOptions = ['instagram', 'facebook', 'youtube'];
const normalizeFolderId = (value) => String(value?._id || value || '');
const getFolderParentId = (folder) => normalizeFolderId(folder?.parentFolderId) || 'root';

const tabConfig = [
  { id: 'details', label: 'Details', icon: Settings },
  { id: 'formats', label: 'Video Formats', icon: Video },
  { id: 'accounts', label: 'Accounts', icon: Users },
];

export const AdminCampaigns = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campaign, setCampaign] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    mainEmail: '',
    status: 'active',
    promoFolderId: '',
    channels: [],
    ...emptyProductFields,
  });
  const [promoFolders, setPromoFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [promoFolderPickerOpen, setPromoFolderPickerOpen] = useState(false);
  const [promoFolderSearch, setPromoFolderSearch] = useState('');
  const [pendingPromoFolderId, setPendingPromoFolderId] = useState('');
  const [expandedPromoFolderIds, setExpandedPromoFolderIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // States for adding a channel inline
  const [newChannelPlatform, setNewChannelPlatform] = useState('instagram');
  const [newChannelHandle, setNewChannelHandle] = useState('');
  const [newChannelDisplayName, setNewChannelDisplayName] = useState('');
  const [newChannelHandlerEmail, setNewChannelHandlerEmail] = useState('');

  const [activeTab, setActiveTab] = useState('details');

  const canDelete = user?.role === 'owner';
  const campaignId = getActiveCampaignId();
  const applyCampaignToForm = (nextCampaign) => {
    setCampaign(nextCampaign || null);
    if (nextCampaign) {
      setForm({
        name: nextCampaign.productName || nextCampaign.name || '',
        description: nextCampaign.productDescription || nextCampaign.description || '',
        productSource: nextCampaign.productSource || 'website',
        productUrl: nextCampaign.productUrl || nextCampaign.productWebsite || '',
        productWebsite: nextCampaign.productWebsite || '',
        productName: nextCampaign.productName || nextCampaign.name || '',
        productDescription: nextCampaign.productDescription || nextCampaign.description || '',
        category: nextCampaign.category || '',
        iconUrl: nextCampaign.iconUrl || '',
        targetAudience: nextCampaign.targetAudience || '',
        keyBenefit: nextCampaign.keyBenefit || '',
        coreFunction: nextCampaign.coreFunction || '',
        useCases: nextCampaign.useCases || [],
        targetAudienceList: nextCampaign.targetAudienceList || [],
        marketingStrategies: nextCampaign.marketingStrategies || [],
        keyMessaging: nextCampaign.keyMessaging || [],
        positioningStatement: nextCampaign.positioningStatement || '',
        screenshots: nextCampaign.screenshots || [],
        mainEmail: nextCampaign.mainEmail || nextCampaign.createdBy?.email || '',
        status: nextCampaign.status || 'active',
        promoFolderId: String(nextCampaign.promoFolderId?._id || nextCampaign.promoFolderId || ''),
        channels: nextCampaign.channels || [],
      });
    }
  };
  const invalidateCampaignCaches = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin'] }),
    queryClient.invalidateQueries({ queryKey: ['channels'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['scheduler'] }),
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('tw_token')}` };
        const campaign = await queryClient.fetchQuery({
          queryKey: ['admin', 'campaign', campaignId, 'detail'],
          queryFn: async () => {
            const campaignRes = await fetch(`${API_BASE_URL}/api/admin/campaigns/${campaignId}?scope=workspace`, { headers });
            const payload = await campaignRes.json();
            if (!campaignRes.ok) throw new Error(payload.message || 'Failed to load product.');
            return payload;
          },
          staleTime: 2 * 60 * 1000,
        });

        applyCampaignToForm(campaign || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId, queryClient]);

  useEffect(() => {
    if (!campaignId) return;
    const controller = new AbortController();

    const loadPromoFolders = async () => {
      setFoldersLoading(true);
      try {
        const params = new URLSearchParams({ campaignId });
        const response = await fetch(`${API_BASE_URL}/api/media/folders?${params.toString()}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Failed to load promo folders.');
        setPromoFolders((Array.isArray(payload) ? payload : [])
          .filter((folder) => folder.kind !== 'carousel_set')
          .sort((left, right) => (left.name || '').localeCompare(right.name || '', undefined, {
            numeric: true,
            sensitivity: 'base',
          })));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Failed to load promo folders.');
      } finally {
        if (!controller.signal.aborted) setFoldersLoading(false);
      }
    };

    void loadPromoFolders();
    return () => controller.abort();
  }, [campaignId]);

  const addChannel = () => {
    if (!newChannelHandle.trim()) return;
    const cleanHandle = newChannelHandle.trim();

    // Check if channel already exists in form.channels (case-insensitive handle check)
    const exists = form.channels.some(
      (ch) => ch.platform === newChannelPlatform && ch.handle.toLowerCase() === cleanHandle.toLowerCase()
    );
    if (exists) {
      setError(`This ${newChannelPlatform} account is already added to the product.`);
      return;
    }

    setError('');
    setForm((c) => ({
      ...c,
      channels: [
        ...c.channels,
        {
          platform: newChannelPlatform,
          handle: cleanHandle,
          displayName: newChannelDisplayName.trim(),
          assignedHandlerEmail: newChannelHandlerEmail.trim().toLowerCase(),
          addedAt: new Date().toISOString(),
        },
      ],
    }));

    setNewChannelHandle('');
    setNewChannelDisplayName('');
    setNewChannelHandlerEmail('');
  };

  const removeChannel = (indexToRemove) => {
    setForm((c) => ({
      ...c,
      channels: c.channels.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const getPlatformPlaceholder = (platform) => {
    switch (platform) {
      case 'instagram':
        return 'e.g., @cristiano or cristiano';
      case 'youtube':
        return 'e.g., @mrbeast or UC-lHJZR3Gqxm24_Vd_AJ5Yw';
      case 'facebook':
        return 'e.g., Page Name, Page Username, or ID';
      default:
        return 'Enter handle';
    }
  };

  const getPlatformFormatHelp = (platform) => {
    switch (platform) {
      case 'instagram':
        return "Instagram handles should be the user's exact username (e.g., @cristiano).";
      case 'youtube':
        return 'YouTube channels can be specified by their custom handle (e.g., @mrbeast) or unique Channel ID.';
      case 'facebook':
        return 'Facebook accounts should be the Page Name, Page Username, or numerical Page ID.';
      default:
        return '';
    }
  };

  const updateChannel = (index, updates) => {
    setForm((current) => ({
      ...current,
      channels: current.channels.map((channel, idx) => (
        idx === index ? { ...channel, ...updates } : channel
      )),
    }));
  };

  const selectedPromoFolder = promoFolders.find((folder) => (
    normalizeFolderId(folder) === String(form.promoFolderId)
  ));

  const openPromoFolderPicker = () => {
    setPendingPromoFolderId(String(form.promoFolderId || ''));
    setPromoFolderSearch('');
    setExpandedPromoFolderIds(new Set());
    setPromoFolderPickerOpen(true);
  };

  const togglePromoFolder = (folderId) => {
    setExpandedPromoFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderPromoFolderTree = (parentId = 'root', depth = 0) => promoFolders
    .filter((folder) => getFolderParentId(folder) === parentId)
    .map((folder) => {
      const folderId = normalizeFolderId(folder);
      const hasChildren = promoFolders.some((candidate) => getFolderParentId(candidate) === folderId);
      const expanded = expandedPromoFolderIds.has(folderId);
      const selected = pendingPromoFolderId === folderId;
      return (
        <div key={folderId}>
          <div
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            className={`flex items-center rounded-xl border py-1.5 pr-2 ${selected
              ? 'border-[#3478f6]/50 bg-[#3478f6]/10'
              : 'border-transparent bg-[#f5f5f7] hover:bg-[#ededf0]'}`}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => togglePromoFolder(folderId)}
                className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8e8e93] hover:bg-white hover:text-[#1d1d1f]"
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.name || 'folder'}`}
                aria-expanded={expanded}
              >
                {expanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="mr-1 h-6 w-6 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => setPendingPromoFolderId(folderId)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] font-bold ${selected
                ? 'text-[#3478f6]'
                : 'text-[#515154] hover:text-[#1d1d1f]'}`}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{folder.name || 'Untitled folder'}</span>
            </button>
          </div>
          {hasChildren && expanded && (
            <div className="mt-1 space-y-1">{renderPromoFolderTree(folderId, depth + 1)}</div>
          )}
        </div>
      );
    });

  const getChannelStatusMeta = (channel) => {
    if (channel.isVerified) {
      const verifiedOwner = channel.assignedHandlerName || channel.assignedHandlerEmail || channel.name || channel.username;
      return {
        label: 'Verified',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        detail: verifiedOwner
          ? `Verified by ${verifiedOwner}`
          : 'OAuth connected',
      };
    }

    if (channel.assignedHandlerEmail) {
      return {
        label: 'Manual only',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        detail: `Assigned to ${channel.assignedHandlerEmail}`,
      };
    }

    return {
      label: 'Unassigned',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      detail: 'Add handler email for manual tasks',
    };
  };

  const saveCampaign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/campaigns/${campaignId}?scope=workspace`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
          },
          body: JSON.stringify({
            ...form,
            name: form.productName,
            description: form.productDescription,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save product.');
      }

      setCampaign(data);
      applyCampaignToForm(data);
      queryClient.setQueryData(['admin', 'campaign', campaignId, 'detail'], data);
      queryClient.setQueryData(['admin', 'campaigns', 'workspace'], (current = []) => {
        if (!Array.isArray(current)) return current;
        return current.map((item) => (item._id === data._id ? data : item));
      });
      await invalidateCampaignCaches();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async () => {
    if (!campaign || !canDelete) return;

    const confirmed = window.confirm(`Delete product "${campaign.productName || campaign.name}"? This will not delete posts or publishing channels.`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/${campaign._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete product.');
      }

      localStorage.removeItem('active-campaign-id');
      await invalidateCampaignCaches();
      navigate('/campaigns');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ───────── No campaign selected ───────── */
  if (!campaignId) {
    return (
      <div className="min-h-screen bg-black px-3 py-3 text-white lg:px-5">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="border-b border-white/10 pb-2">
            <h2 className="m-0 text-base font-semibold tracking-tight text-white">Product Setup</h2>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-12 text-center shadow-sm">
            <p className="m-0 text-sm font-semibold text-white">No product selected</p>
            <p className="m-0 mt-1 text-xs text-zinc-400">Select a product from the sidebar to edit it here.</p>
            <button
              type="button"
              onClick={() => navigate('/campaigns')}
              className="mt-2 inline-flex items-center gap-2 rounded-[8px] bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 shadow-sm"
            >
              Go to Product Selector
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] px-3 py-3 text-white lg:px-5">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="border-b border-white/[0.08] pb-2">
          <h2 className="m-0 text-base font-semibold tracking-tight text-white">Product Setup</h2>
          <p className="m-0 mt-0.5 text-xs text-zinc-400">
            Edit details and manage accounts for the active product.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-medium text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-10 text-center text-sm text-zinc-400">Loading product...</div>
        ) : !campaign ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#141417]/95 p-12 text-center">
            <p className="m-0 text-sm font-semibold text-white">Product not found</p>
            <p className="m-0 mt-1 text-xs text-zinc-400">The selected product could not be loaded.</p>
          </div>
        ) : (
          <form onSubmit={saveCampaign}>
            <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141417]/95 shadow-xl backdrop-blur-xl">
              {/* ── Tab Bar ── */}
              <div className="flex border-b border-white/[0.08]">
                {tabConfig.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition ${
                        isActive
                          ? 'border-white text-white'
                          : 'border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {tab.id === 'accounts' && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                          {form.channels?.length || 0}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Details Tab ── */}
              {activeTab === 'details' && (
                <div className="p-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <ProductDetailsFields
                        form={form}
                        setForm={setForm}
                        heading="Product profile"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-300">Main Contact Email</label>
                      <input
                        type="email"
                        value={form.mainEmail}
                        onChange={(e) => setForm((c) => ({ ...c, mainEmail: e.target.value }))}
                        placeholder="contact@brand.com"
                        className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-300">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
                        className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm capitalize text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status} className="bg-black text-white">{status}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                        <FolderOpen className="h-3.5 w-3.5 text-white" />
                        Promo Video Folder
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-white shadow-sm ring-1 ring-white/10">
                          <Folder className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Selected folder</p>
                          <p className="m-0 mt-0.5 truncate text-xs font-semibold text-white">
                            {selectedPromoFolder?.name || 'No promo folder assigned'}
                          </p>
                        </div>
                        {form.promoFolderId && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, promoFolderId: '' }))}
                            className="h-8 rounded-lg px-2.5 text-[10px] font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-rose-400"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openPromoFolderPicker}
                          disabled={foldersLoading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-white px-3 text-[10px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60 shadow-sm"
                        >
                          {foldersLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                          Choose folder
                        </button>
                      </div>
                      <p className="m-0 mt-1 text-[11px] text-zinc-500">
                        Videos in this folder appear in the video editor’s Promo tab for this product.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Video Formats Tab ── */}
              {activeTab === 'formats' && (
                <div className="p-6">
                  <VideoFormatsStudio
                    marketingStrategies={form.marketingStrategies || []}
                    onChange={(updatedStrategies) => setForm((c) => ({ ...c, marketingStrategies: updatedStrategies }))}
                    keyMessaging={form.keyMessaging || []}
                  />
                </div>
              )}

              {/* ── Accounts Tab ── */}
              {activeTab === 'accounts' && (
                <div className="p-6 space-y-6">
                  {/* Info Header */}
                  <div>
                    <h3 className="text-base font-semibold text-white m-0">Product Social Channels</h3>
                    <p className="text-xs text-zinc-400 mt-1 m-0">
                      Add the social media accounts or channels associated with this product.
                      The system will automatically check their verification status by scanning connected accounts.
                    </p>
                  </div>

                  {/* Inline Add Form */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mt-0 mb-4">
                      Add New Channel
                    </h4>

                    <div className="space-y-4">
                      {/* Platform Selector (Premium Pill buttons) */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-300">Select Platform</label>
                        <div className="flex gap-2">
                          {platformOptions.map((platform) => {
                            const isSelected = newChannelPlatform === platform;
                            let activeStyle = '';
                            if (platform === 'instagram') {
                              activeStyle = isSelected
                                ? 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white shadow-sm border-transparent'
                                : 'bg-[#0a0a0a] hover:bg-white/10 border-white/10 text-white';
                            } else if (platform === 'youtube') {
                              activeStyle = isSelected
                                ? 'bg-[#ff0000] text-white shadow-sm border-transparent'
                                : 'bg-[#0a0a0a] hover:bg-white/10 border-white/10 text-white';
                            } else if (platform === 'facebook') {
                              activeStyle = isSelected
                                ? 'bg-[#1877f2] text-white shadow-sm border-transparent'
                                : 'bg-[#0a0a0a] hover:bg-white/10 border-white/10 text-white';
                            }

                            return (
                              <button
                                key={platform}
                                type="button"
                                onClick={() => setNewChannelPlatform(platform)}
                                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold capitalize transition ${activeStyle}`}
                              >
                                <PlatformIcon platform={platform} className="h-4 w-4" />
                                {platform === 'youtube' ? 'YouTube' : platform}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inputs row */}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                            Handle / Channel ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newChannelHandle}
                            onChange={(e) => setNewChannelHandle(e.target.value)}
                            placeholder={getPlatformPlaceholder(newChannelPlatform)}
                            className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10 placeholder:text-zinc-600"
                          />
                          <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                            {getPlatformFormatHelp(newChannelPlatform)}
                          </p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                            Display Name <span className="text-zinc-500 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={newChannelDisplayName}
                            onChange={(e) => setNewChannelDisplayName(e.target.value)}
                            placeholder="e.g. Cristiano Ronaldo"
                            className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10 placeholder:text-zinc-600"
                          />
                          <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                            A friendly name to display in lists and reports.
                          </p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-300">
                            Handler Email <span className="text-zinc-500 font-normal">(Manual)</span>
                          </label>
                          <input
                            type="email"
                            value={newChannelHandlerEmail}
                            onChange={(e) => setNewChannelHandlerEmail(e.target.value)}
                            placeholder="creator@example.com"
                            className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10 placeholder:text-zinc-600"
                          />
                          <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                            Required only when this unverified handle should receive manual tasks.
                          </p>
                        </div>
                      </div>

                      {/* Form action */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={addChannel}
                          disabled={!newChannelHandle.trim()}
                          className="inline-flex items-center gap-1.5 rounded-[8px] bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Add Channel
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of Added Channels */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 m-0">
                      Added Channels ({form.channels?.length || 0})
                    </h4>

                    {(form.channels?.length || 0) === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center bg-white/[0.02]">
                        <p className="m-0 text-sm font-semibold text-white">No channels added yet</p>
                        <p className="m-0 mt-1 text-xs text-zinc-500">
                          Fill in the details above to add social channels to this product.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                        {(form.channels || []).map((ch, idx) => {
                          const statusMeta = getChannelStatusMeta(ch);
                          return (
                            <div key={idx} className="flex items-center gap-3 p-4 hover:bg-white/[0.04] transition">
                              <div className="relative h-10 w-10 shrink-0">
                                {ch.avatarUrl ? (
                                  <img
                                    src={ch.avatarUrl}
                                    crossOrigin="anonymous"
                                    alt=""
                                    className="h-10 w-10 rounded-full border border-white/10 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400">
                                    <Users className="h-4 w-4" />
                                  </div>
                                )}
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-[#141417] shadow-sm">
                                  <PlatformIcon platform={ch.platform} className="h-3.5 w-3.5" />
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="truncate text-xs font-semibold text-white capitalize">
                                    {ch.platform}
                                  </span>
                                  {ch.displayName && (
                                    <span className="truncate text-xs text-zinc-400">
                                      ({ch.displayName})
                                    </span>
                                  )}
                                </div>
                                <p className="m-0 mt-0.5 text-[11px] text-zinc-500">
                                  {ch.addedAt ? `Added on ${new Date(ch.addedAt).toLocaleDateString()}` : 'Publishing channel'}
                                </p>
                              </div>

                              <div className="w-44">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                  Handle / ID
                                </label>
                                <input
                                  type="text"
                                  value={ch.handle || ch.requestedHandle || ''}
                                  onChange={(e) => updateChannel(idx, { handle: e.target.value.trim(), requestedHandle: e.target.value.trim() })}
                                  placeholder="@handle or ID"
                                  disabled={ch.isVerified}
                                  className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10 disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
                                />
                              </div>

                              <div className="w-48">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                  Handler Email
                                </label>
                                <input
                                  type="email"
                                  value={ch.assignedHandlerEmail || ''}
                                  onChange={(e) => updateChannel(idx, { assignedHandlerEmail: e.target.value.trim().toLowerCase() })}
                                  placeholder="creator@example.com"
                                  disabled={ch.isVerified}
                                  className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-white/30 focus:ring-1 focus:ring-white/10 disabled:bg-white/5 disabled:text-zinc-500 disabled:cursor-not-allowed"
                                />
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border ${statusMeta.className}`}>
                                  {statusMeta.label}
                                </span>
                                <span className="text-[10px] text-zinc-400 max-w-[190px] text-right leading-tight">
                                  {statusMeta.detail}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeChannel(idx)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-500/20 hover:text-rose-400 ml-2"
                                aria-label={`Remove ${ch.handle}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Action Bar ── */}
              <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3 bg-black/40">
                <button
                  type="button"
                  onClick={deleteCampaign}
                  disabled={!canDelete || saving}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60 shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </section>
          </form>
        )}
      </div>

      {promoFolderPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-folder-picker-title"
            className="flex h-[520px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141417]/95 text-white shadow-2xl backdrop-blur-2xl"
          >
            <header className="flex items-start justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h3 id="promo-folder-picker-title" className="text-sm font-extrabold text-white">Choose Promo Folder</h3>
                <p className="m-0 mt-1 text-[10px] font-semibold text-zinc-400">
                  Videos in this folder will appear in the editor’s Promo tab.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromoFolderPickerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label="Close promo folder picker"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-zinc-400 focus-within:border-white/30">
                <Search className="h-3.5 w-3.5" />
                <input
                  type="search"
                  value={promoFolderSearch}
                  onChange={(event) => setPromoFolderSearch(event.target.value)}
                  placeholder="Search folders"
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-zinc-500"
                />
              </label>

              <div className="space-y-1.5">
                {foldersLoading && (
                  <div className="flex items-center gap-2 p-4 text-[10px] font-semibold text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading folders…
                  </div>
                )}

                {!foldersLoading && (promoFolderSearch.trim() ? (
                  promoFolders
                    .filter((folder) => String(folder.name || '').toLowerCase().includes(promoFolderSearch.trim().toLowerCase()))
                    .map((folder) => {
                      const folderId = normalizeFolderId(folder);
                      const selected = pendingPromoFolderId === folderId;
                      return (
                        <button
                          key={folderId}
                          type="button"
                          onClick={() => setPendingPromoFolderId(folderId)}
                          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold ${selected
                            ? 'border-white/20 bg-white/[0.08] text-white'
                            : 'border-transparent bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'}`}
                        >
                          <Folder className="h-4 w-4 shrink-0" />
                          <span className="truncate">{folder.name || 'Untitled folder'}</span>
                        </button>
                      );
                    })
                ) : renderPromoFolderTree('root'))}

                {!foldersLoading && promoFolders.length === 0 && (
                  <p className="p-4 text-center text-[10px] font-semibold text-zinc-400">No folders found.</p>
                )}
                {!foldersLoading && promoFolderSearch.trim() && !promoFolders.some((folder) => (
                  String(folder.name || '').toLowerCase().includes(promoFolderSearch.trim().toLowerCase())
                )) && (
                  <p className="p-4 text-center text-[10px] font-semibold text-zinc-400">No matching folders found.</p>
                )}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-white/[0.08] bg-black/60 px-5 py-4">
              <button
                type="button"
                onClick={() => setPromoFolderPickerOpen(false)}
                className="rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({ ...current, promoFolderId: pendingPromoFolderId }));
                  setPromoFolderPickerOpen(false);
                }}
                disabled={!pendingPromoFolderId || foldersLoading}
                className="rounded-[8px] bg-white px-4 py-2 text-[11px] font-bold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
              >
                Use This Folder
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminCampaigns;
