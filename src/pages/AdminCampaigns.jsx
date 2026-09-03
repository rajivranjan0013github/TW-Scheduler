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
  Save,
  Search,
  Settings,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';
import ProductDetailsFields from '../components/campaigns/ProductDetailsFields';
import VideoFormatsStudio from '../components/campaigns/VideoFormatsStudio';
import { emptyProductFields } from '../components/campaigns/campaignProductForm';

const statusOptions = ['active', 'paused', 'archived'];
const normalizeFolderId = (value) => String(value?._id || value || '');
const getFolderParentId = (folder) => normalizeFolderId(folder?.parentFolderId) || 'root';

const tabConfig = [
  { id: 'details', label: 'Details', icon: Settings },
  { id: 'formats', label: 'Video Formats', icon: Video },
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
      <div className="min-h-screen bg-black p-4 pb-8 text-white lg:p-6">
        <div className="w-full space-y-4">
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
    <div className="min-h-screen bg-[#0c0c0e] p-4 pb-8 text-white lg:p-6">
      <div className="w-full space-y-4">
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
          <div className="py-16 text-center text-sm text-zinc-400">Loading product...</div>
        ) : !campaign ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="m-0 text-sm font-semibold text-white">Product not found</p>
            <p className="m-0 mt-1 text-xs text-zinc-400">The selected product could not be loaded.</p>
          </div>
        ) : (
          <form onSubmit={saveCampaign} className="space-y-6">
            {/* ── Tab Bar & Channels Link ── */}
            <div className="flex items-center justify-between border-b border-white/[0.08]">
              <div className="flex gap-4">
                {tabConfig.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition -mb-px ${
                        isActive
                          ? 'border-[#7831d6] text-white'
                          : 'border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => navigate('/channels', { state: { campaignId } })}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                <span>Channels: <strong className="text-white">{form.channels?.length || 0}</strong> active</span>
                <span className="text-[#c4b5fd] font-bold">Manage in Channels →</span>
              </button>
            </div>

            {/* ── Details Tab ── */}
            {activeTab === 'details' && (
              <div className="py-2 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <ProductDetailsFields
                      form={form}
                      setForm={setForm}
                      showHeader={false}
                      showVideoFormats={false}
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
                      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/40 p-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-white shadow-sm ring-1 ring-white/10">
                          <Folder className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-xs font-semibold text-white">
                            {selectedPromoFolder?.name || 'No promo folder assigned'}
                          </p>
                        </div>
                        {form.promoFolderId && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, promoFolderId: '' }))}
                            className="h-8 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-zinc-300 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openPromoFolderPicker}
                          disabled={foldersLoading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#7831d6] px-3.5 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] disabled:cursor-wait disabled:opacity-60"
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
                <div className="py-4">
                  <VideoFormatsStudio
                    marketingStrategies={form.marketingStrategies || []}
                    onChange={(updatedStrategies) => setForm((c) => ({ ...c, marketingStrategies: updatedStrategies }))}
                    keyMessaging={form.keyMessaging || []}
                  />
                </div>
              )}



              {/* ── Action Bar ── */}
              <div className="flex items-center justify-between border-t border-white/[0.08] pt-6 pb-12">
                <button
                  type="button"
                  onClick={deleteCampaign}
                  disabled={!canDelete || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-300 shadow-sm transition hover:bg-rose-500/25 hover:border-rose-500/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
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
                className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/15 hover:text-white"
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
                className="rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] disabled:cursor-not-allowed disabled:opacity-40"
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
