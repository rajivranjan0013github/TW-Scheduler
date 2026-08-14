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
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';
import PlatformIcon from '../components/PlatformIcon';

const statusOptions = ['active', 'paused', 'archived'];
const platformOptions = ['instagram', 'facebook', 'youtube'];
const normalizeFolderId = (value) => String(value?._id || value || '');
const getFolderParentId = (folder) => normalizeFolderId(folder?.parentFolderId) || 'root';

const tabConfig = [
  { id: 'details', label: 'Details', icon: Settings },
  { id: 'accounts', label: 'Accounts', icon: Users },
];

export const AdminCampaigns = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campaign, setCampaign] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', mainEmail: '', status: 'active', promoFolderId: '', channels: [] });
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
        name: nextCampaign.name || '',
        description: nextCampaign.description || '',
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
            if (!campaignRes.ok) throw new Error(payload.message || 'Failed to load campaign.');
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
      setError(`This ${newChannelPlatform} account is already added to the campaign.`);
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
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save campaign.');
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

    const confirmed = window.confirm(`Delete campaign "${campaign.name}"? This will not delete posts or publishing channels.`);
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
        throw new Error(data.message || 'Failed to delete campaign.');
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
      <div className="min-h-screen bg-[#f5f5f7] px-3 py-3 text-[#1d1d1f] lg:px-5">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="border-b border-[#d2d2d7] pb-2">
            <h2 className="m-0 text-base font-semibold tracking-tight text-black">Campaign Setup</h2>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#d2d2d7] bg-white p-12 text-center">
            <p className="m-0 text-sm font-semibold text-[#1d1d1f]">No campaign selected</p>
            <p className="m-0 mt-1 text-xs text-[#6e6e73]">Select a campaign from the sidebar to edit it here.</p>
            <button
              type="button"
              onClick={() => navigate('/campaigns')}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4]"
            >
              Go to Campaign Selector
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-3 py-3 text-[#1d1d1f] lg:px-5">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="border-b border-[#d2d2d7] pb-2">
          <h2 className="m-0 text-base font-semibold tracking-tight text-black">Campaign Setup</h2>
          <p className="m-0 mt-0.5 text-xs text-[#6e6e73]">
            Edit details and manage accounts for the active campaign.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[#d2d2d7] bg-white p-10 text-center text-sm text-[#6e6e73]">Loading campaign...</div>
        ) : !campaign ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#d2d2d7] bg-white p-12 text-center">
            <p className="m-0 text-sm font-semibold text-[#1d1d1f]">Campaign not found</p>
            <p className="m-0 mt-1 text-xs text-[#6e6e73]">The selected campaign could not be loaded.</p>
          </div>
        ) : (
          <form onSubmit={saveCampaign}>
            <section className="overflow-hidden rounded-xl border border-[#d2d2d7] bg-white">
              {/* ── Tab Bar ── */}
              <div className="flex border-b border-[#e5e5ea]">
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
                          ? 'border-[#3478f6] text-[#3478f6]'
                          : 'border-transparent text-[#8e8e93] hover:text-[#1d1d1f]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {tab.id === 'accounts' && (
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-[#3478f6]/10 text-[#3478f6]' : 'bg-[#f5f5f7] text-[#8e8e93]'
                        }`}>
                          {form.channels?.length || 0}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Details Tab ── */}
              {activeTab === 'details' && (
                <div className="px-5 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Campaign Name</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                        placeholder="Enter campaign name"
                        required
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                        placeholder="What is this campaign about?"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Main Email</label>
                      <input
                        type="email"
                        value={form.mainEmail}
                        onChange={(e) => setForm((c) => ({ ...c, mainEmail: e.target.value }))}
                        placeholder="contact@example.com"
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm capitalize text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#6e6e73]">
                        <FolderOpen className="h-3.5 w-3.5 text-[#3478f6]" />
                        Promo Video Folder
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-[#d2d2d7] bg-[#f8f8fa] p-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#3478f6] shadow-sm ring-1 ring-black/5">
                          <Folder className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">Selected folder</p>
                          <p className="m-0 mt-0.5 truncate text-xs font-semibold text-[#1d1d1f]">
                            {selectedPromoFolder?.name || 'No promo folder assigned'}
                          </p>
                        </div>
                        {form.promoFolderId && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, promoFolderId: '' }))}
                            className="h-8 rounded-lg px-2.5 text-[10px] font-semibold text-[#8e8e93] transition hover:bg-white hover:text-red-600"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openPromoFolderPicker}
                          disabled={foldersLoading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3478f6] px-3 text-[10px] font-semibold text-white transition hover:bg-[#2f6fe4] disabled:cursor-wait disabled:opacity-60"
                        >
                          {foldersLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                          Choose folder
                        </button>
                      </div>
                      <p className="m-0 mt-1 text-[11px] text-[#8e8e93]">
                        Videos in this folder appear in the video editor’s Promo tab for this campaign.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Accounts Tab ── */}
              {activeTab === 'accounts' && (
                <div className="p-6 space-y-6">
                  {/* Info Header */}
                  <div>
                    <h3 className="text-base font-semibold text-[#1d1d1f] m-0">Campaign Social Channels</h3>
                    <p className="text-xs text-[#8e8e93] mt-1 m-0">
                      Add the social media accounts or channels of creators/influencers associated with this campaign.
                      The system will automatically check their verification status by scanning connected accounts.
                    </p>
                  </div>

                  {/* Inline Add Form */}
                  <div className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#6e6e73] mt-0 mb-4">
                      Add New Channel
                    </h4>

                    <div className="space-y-4">
                      {/* Platform Selector (Premium Pill buttons) */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">Select Platform</label>
                        <div className="flex gap-2">
                          {platformOptions.map((platform) => {
                            const isSelected = newChannelPlatform === platform;
                            let activeStyle = '';
                            if (platform === 'instagram') {
                              activeStyle = isSelected
                                ? 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white shadow-sm border-transparent'
                                : 'bg-white hover:bg-[#f5f5f7] border-[#d2d2d7] text-[#1d1d1f]';
                            } else if (platform === 'youtube') {
                              activeStyle = isSelected
                                ? 'bg-[#ff0000] text-white shadow-sm border-transparent'
                                : 'bg-white hover:bg-[#f5f5f7] border-[#d2d2d7] text-[#1d1d1f]';
                            } else if (platform === 'facebook') {
                              activeStyle = isSelected
                                ? 'bg-[#1877f2] text-white shadow-sm border-transparent'
                                : 'bg-white hover:bg-[#f5f5f7] border-[#d2d2d7] text-[#1d1d1f]';
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

                      {/* Inputs Grid */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">
                            Account Handle / Username
                          </label>
                          <input
                            type="text"
                            value={newChannelHandle}
                            onChange={(e) => setNewChannelHandle(e.target.value)}
                            placeholder={getPlatformPlaceholder(newChannelPlatform)}
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                          />
                          <p className="mt-1 text-[11px] text-[#8e8e93] leading-relaxed">
                            {getPlatformFormatHelp(newChannelPlatform)}
                          </p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">
                            Display Name <span className="text-[#8e8e93] font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={newChannelDisplayName}
                            onChange={(e) => setNewChannelDisplayName(e.target.value)}
                            placeholder="e.g. Cristiano Ronaldo"
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                          />
                          <p className="mt-1 text-[11px] text-[#8e8e93] leading-relaxed">
                            A friendly name to display in lists and reports.
                          </p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">
                            Handler Email <span className="text-[#8e8e93] font-normal">(Manual)</span>
                          </label>
                          <input
                            type="email"
                            value={newChannelHandlerEmail}
                            onChange={(e) => setNewChannelHandlerEmail(e.target.value)}
                            placeholder="creator@example.com"
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10"
                          />
                          <p className="mt-1 text-[11px] text-[#8e8e93] leading-relaxed">
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
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-4 w-4" />
                          Add Channel
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of Added Channels */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#6e6e73] m-0">
                      Added Channels ({form.channels?.length || 0})
                    </h4>

                    {(form.channels?.length || 0) === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d2d2d7] p-8 text-center bg-white">
                        <p className="m-0 text-sm font-semibold text-[#1d1d1f]">No channels added yet</p>
                        <p className="m-0 mt-1 text-xs text-[#8e8e93]">
                          Fill in the details above to add social channels to this campaign.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#e5e5ea] rounded-xl border border-[#e5e5ea] bg-white overflow-hidden">
                        {(form.channels || []).map((ch, idx) => {
                          const statusMeta = getChannelStatusMeta(ch);
                          return (
                            <div key={idx} className="flex items-center gap-3 p-4 hover:bg-[#fbfbfb] transition">
                              <div className="relative h-10 w-10 shrink-0">
                                {ch.avatarUrl ? (
                                  <img
                                    src={ch.avatarUrl}
                                    crossOrigin="anonymous"
                                    alt=""
                                    className="h-10 w-10 rounded-full border border-black/10 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e5ea] bg-[#f5f5f7] text-[#8e8e93]">
                                    <Users className="h-4 w-4" />
                                  </div>
                                )}
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white shadow-sm">
                                  <PlatformIcon platform={ch.platform} className="h-3.5 w-3.5" />
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="truncate text-xs font-semibold text-[#1d1d1f] capitalize">
                                    {ch.platform}
                                  </span>
                                  {ch.displayName && (
                                    <span className="truncate text-xs text-[#8e8e93]">
                                      ({ch.displayName})
                                    </span>
                                  )}
                                </div>
                                <p className="m-0 mt-0.5 text-[11px] text-[#8e8e93]">
                                  {ch.addedAt ? `Added on ${new Date(ch.addedAt).toLocaleDateString()}` : 'Publishing channel'}
                                </p>
                              </div>

                              <div className="w-44">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                                  Handle / ID
                                </label>
                                <input
                                  type="text"
                                  value={ch.handle || ch.requestedHandle || ''}
                                  onChange={(e) => updateChannel(idx, { handle: e.target.value.trim(), requestedHandle: e.target.value.trim() })}
                                  placeholder="@handle or ID"
                                  disabled={ch.isVerified}
                                  className="w-full rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-xs text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10 disabled:bg-[#f5f5f7] disabled:text-[#8e8e93] disabled:cursor-not-allowed"
                                />
                              </div>

                              <div className="w-48">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                                  Handler Email
                                </label>
                                <input
                                  type="email"
                                  value={ch.assignedHandlerEmail || ''}
                                  onChange={(e) => updateChannel(idx, { assignedHandlerEmail: e.target.value.trim().toLowerCase() })}
                                  placeholder="creator@example.com"
                                  disabled={ch.isVerified}
                                  className="w-full rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-xs text-[#1d1d1f] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/10 disabled:bg-[#f5f5f7] disabled:text-[#8e8e93] disabled:cursor-not-allowed"
                                />
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold border ${statusMeta.className}`}>
                                  {statusMeta.label}
                                </span>
                                <span className="text-[10px] text-[#8e8e93] max-w-[190px] text-right leading-tight">
                                  {statusMeta.detail}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeChannel(idx)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e93] transition hover:bg-red-50 hover:text-red-600 ml-2"
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
              <div className="flex items-center justify-between border-t border-[#e5e5ea] px-5 py-3">
                <button
                  type="button"
                  onClick={deleteCampaign}
                  disabled={!canDelete || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs font-semibold text-[#6e6e73] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4] disabled:opacity-60"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-folder-picker-title"
            className="flex h-[520px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-[#e5e5ea] px-5 py-4">
              <div>
                <h3 id="promo-folder-picker-title" className="text-sm font-extrabold !text-[#1d1d1f]">Choose Promo Folder</h3>
                <p className="m-0 mt-1 text-[10px] font-semibold text-[#6e6e73]">
                  Videos in this folder will appear in the editor’s Promo tab.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromoFolderPickerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8e93] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                aria-label="Close promo folder picker"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <label className="mb-3 flex items-center gap-2 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2.5 text-[#8e8e93] focus-within:border-[#3478f6] focus-within:bg-white">
                <Search className="h-3.5 w-3.5" />
                <input
                  type="search"
                  value={promoFolderSearch}
                  onChange={(event) => setPromoFolderSearch(event.target.value)}
                  placeholder="Search folders"
                  className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[#1d1d1f] outline-none placeholder:text-[#8e8e93]"
                />
              </label>

              <div className="space-y-1.5">
                {foldersLoading && (
                  <div className="flex items-center gap-2 p-4 text-[10px] font-semibold text-[#8e8e93]">
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
                            ? 'border-[#3478f6]/50 bg-[#3478f6]/10 text-[#3478f6]'
                            : 'border-transparent bg-[#f5f5f7] text-[#515154] hover:bg-[#ededf0] hover:text-[#1d1d1f]'}`}
                        >
                          <Folder className="h-4 w-4 shrink-0" />
                          <span className="truncate">{folder.name || 'Untitled folder'}</span>
                        </button>
                      );
                    })
                ) : renderPromoFolderTree('root'))}

                {!foldersLoading && promoFolders.length === 0 && (
                  <p className="p-4 text-center text-[10px] font-semibold text-[#8e8e93]">No folders found.</p>
                )}
                {!foldersLoading && promoFolderSearch.trim() && !promoFolders.some((folder) => (
                  String(folder.name || '').toLowerCase().includes(promoFolderSearch.trim().toLowerCase())
                )) && (
                  <p className="p-4 text-center text-[10px] font-semibold text-[#8e8e93]">No matching folders found.</p>
                )}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-[#e5e5ea] bg-[#f8f8fa] px-5 py-4">
              <button
                type="button"
                onClick={() => setPromoFolderPickerOpen(false)}
                className="rounded-xl border border-[#d2d2d7] bg-white px-4 py-2 text-[11px] font-bold text-[#6e6e73] hover:bg-[#f5f5f7]"
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
                className="rounded-xl bg-[#3478f6] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#2f6fe4] disabled:cursor-not-allowed disabled:opacity-40"
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
