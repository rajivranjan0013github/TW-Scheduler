import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Package,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProductEditorPage from '../components/campaigns/ProductEditorPage';
import CampaignVideoFormatsPreview from '../components/campaigns/CampaignVideoFormatsPreview';
import { emptyProductFields } from '../components/campaigns/campaignProductForm';

const emptyCampaignForm = {
  name: '',
  description: '',
  ...emptyProductFields,
};

export const CampaignSelector = ({ setSelectedAccounts = () => {} }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreateCampaign = Boolean(user);
  const storageKey = `active-campaign-id:${user?._id || user?.email || 'default'}`;
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(
    () => localStorage.getItem(storageKey) || ''
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [campaignForm, setCampaignForm] = useState(() => ({
    ...emptyCampaignForm,
  }));
  const [expandedDescIds, setExpandedDescIds] = useState(() => new Set());

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign._id === activeCampaignId),
    [campaigns, activeCampaignId]
  );

  const toggleExpandDesc = (id, event) => {
    event?.stopPropagation();
    setExpandedDescIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const persistCampaign = (campaign, { emitEvent = true } = {}) => {
    const previousCampaignId =
      localStorage.getItem(storageKey) ||
      localStorage.getItem('active-campaign-id') ||
      '';

    localStorage.setItem(storageKey, campaign._id);
    localStorage.setItem('active-campaign-id', campaign._id);
    localStorage.setItem('active-campaign-name', campaign.name || '');
    localStorage.setItem(
      'active-campaign-main-email',
      campaign.mainEmail || campaign.createdBy?.email || ''
    );
    setActiveCampaignId(campaign._id);
    setSelectedAccounts([]);
    if (!emitEvent || previousCampaignId === campaign._id) return;

    window.dispatchEvent(
      new CustomEvent('campaign-selected', {
        detail: {
          campaignId: campaign._id,
          campaignName: campaign.name || '',
          mainEmail: campaign.mainEmail || campaign.createdBy?.email || '',
        },
      })
    );
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError('');
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
      };
      const campaignResponse = await fetch(
        `${API_BASE_URL}/api/accounts/campaigns`,
        { headers }
      );
      if (!campaignResponse.ok) {
        const data = await campaignResponse.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to load products.');
      }

      const campaignData = await campaignResponse.json();
      setCampaigns(campaignData);

      if (campaignData.length > 0) {
        const savedId = localStorage.getItem(storageKey) || '';
        const nextCampaign =
          campaignData.find((campaign) => campaign._id === savedId) ||
          campaignData[0];
        persistCampaign(nextCampaign, { emitEvent: nextCampaign._id !== savedId });
        return;
      }

      localStorage.removeItem(storageKey);
      localStorage.removeItem('active-campaign-id');
      localStorage.removeItem('active-campaign-name');
      localStorage.removeItem('active-campaign-main-email');
      setSelectedAccounts([]);
      if (canCreateCampaign) {
        setIsCreating(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await fetchCampaigns();
      } catch (err) {
        if (active) setError(err.message || 'Failed to load products.');
      }
    };
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.email]);

  const handleSelectOnly = (campaign, event) => {
    event?.stopPropagation();
    persistCampaign(campaign);
  };

  const handleOpenQueue = (campaign, event) => {
    event?.stopPropagation();
    persistCampaign(campaign);
    navigate('/scheduler');
  };

  const openCreateForm = () => {
    setFormError('');
    setEditingCampaign(null);
    setCampaignForm({
      ...emptyCampaignForm,
    });
    setIsCreating(true);
  };

  const openEditForm = (campaign, event) => {
    event?.stopPropagation();
    setFormError('');
    setIsCreating(false);
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.productName || campaign.name || '',
      description: campaign.productDescription || campaign.description || '',
      productName: campaign.productName || campaign.name || '',
      productDescription: campaign.productDescription || campaign.description || '',
      productSource: campaign.productSource || 'app_store',
      productUrl: campaign.productUrl || campaign.productWebsite || '',
      productWebsite: campaign.productWebsite || '',
      category: campaign.category || '',
      iconUrl: campaign.iconUrl || '',
      targetAudience: campaign.targetAudience || '',
      keyBenefit: campaign.keyBenefit || '',
      coreFunction: campaign.coreFunction || '',
      useCases: campaign.useCases || [],
      targetAudienceList: campaign.targetAudienceList || [],
      marketingStrategies: campaign.marketingStrategies || [],
      keyMessaging: campaign.keyMessaging || [],
      positioningStatement: campaign.positioningStatement || '',
      primaryGoal: campaign.primaryGoal || 'app_downloads',
      rating: campaign.rating,
      ratingCount: campaign.ratingCount,
      screenshots: campaign.screenshots || [],
      showcaseMediaIds: campaign.showcaseMediaIds || [],
      showcaseLearning: campaign.showcaseLearning || null,
      creativeBlueprints: campaign.creativeBlueprints || [],
      strategyStatus: campaign.strategyStatus || 'none',
      promoFolderId: campaign.promoFolderId || null,
    });
  };

  const closeModal = () => {
    if (saving) return;
    setIsCreating(false);
    setEditingCampaign(null);
    setFormError('');
  };

  const handleSaveCampaign = async (
    e,
    { thenNavigateQueue = false, stayInEditor = false, customForm = null } = {}
  ) => {
    e?.preventDefault?.();
    const activeForm = customForm || campaignForm;

    const resolvedName = String(activeForm.productName || activeForm.name || '').trim() || 'My App';
    const resolvedDesc = String(activeForm.productDescription || activeForm.description || '').trim() || resolvedName;

    try {
      setSaving(true);
      setFormError('');

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
      };

      const payload = {
        name: resolvedName,
        description: resolvedDesc,
        productName: resolvedName,
        productDescription: resolvedDesc,
        productSource: activeForm.productSource || 'app_store',
        productUrl: activeForm.productUrl || '',
        category: activeForm.category || '',
        iconUrl: activeForm.iconUrl || '',
        targetAudience: activeForm.targetAudience || '',
        keyBenefit: activeForm.keyBenefit || '',
        coreFunction: activeForm.coreFunction || '',
        useCases: activeForm.useCases || [],
        targetAudienceList: activeForm.targetAudienceList || [],
        marketingStrategies: activeForm.marketingStrategies || [],
        keyMessaging: activeForm.keyMessaging || [],
        positioningStatement: activeForm.positioningStatement || '',
        screenshots: activeForm.screenshots || [],
        primaryGoal: activeForm.primaryGoal || 'app_downloads',
      };

      let savedData = null;

      if (editingCampaign) {
        // Edit existing product
        const response = await fetch(
          `${API_BASE_URL}/api/accounts/campaigns/${editingCampaign._id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to update product.');
        }

        savedData = data;
        setCampaigns((current) =>
          current.map((c) => (c._id === data._id ? { ...c, ...data } : c))
        );
        if (activeCampaignId === data._id) {
          persistCampaign(data);
        }
      } else {
        // Create new product
        const response = await fetch(
          `${API_BASE_URL}/api/accounts/campaigns`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...payload,
              mainEmail: user?.email || '',
              status: 'active',
            }),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to create product.');
        }

        savedData = data;
        setCampaigns((current) => [data, ...current]);
        // Auto-saving after link analysis must not remount the keyed route tree.
        // The builder needs to remain mounted so it can advance to Showcase.
        persistCampaign(data, { emitEvent: !stayInEditor });

        if (stayInEditor) {
          setEditingCampaign(data);
          setIsCreating(false);
        }
      }

      if (!stayInEditor) {
        closeModal();
      }

      if (thenNavigateQueue && savedData) {
        navigate('/scheduler');
      }

      return savedData;
    } catch (err) {
      setFormError(err.message || 'Failed to save product.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────
  // FULL PAGE VIEW: CREATE OR EDIT PRODUCT
  // ─────────────────────────────────────────────
  if (isCreating || editingCampaign || (!loading && campaigns.length === 0)) {
    return (
      <ProductEditorPage
        form={campaignForm}
        setForm={setCampaignForm}
        saving={saving}
        error={formError}
        isEditing={Boolean(editingCampaign)}
        canCancel={campaigns.length > 0}
        onCancel={closeModal}
        onSubmit={(e) => handleSaveCampaign(e, { thenNavigateQueue: false })}
        onSaveAndOpenQueue={(e) => handleSaveCampaign(e, { thenNavigateQueue: true })}
        onAutoSave={(analyzedForm) => handleSaveCampaign(null, { stayInEditor: true, customForm: analyzedForm })}
        campaignId={editingCampaign?._id || ''}
      />
    );
  }

  // ─────────────────────────────────────────────
  // FULL PAGE VIEW: PRODUCT WORKSPACES LIST
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0c0c0e] px-4 py-7 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
              Workspace Products
            </p>
            <h1 className="m-0 mt-1 text-2xl font-bold tracking-tight text-white">
              My App & Product Workspaces
            </h1>
            <p className="m-0 mt-1.5 max-w-2xl text-xs leading-5 text-zinc-400">
              Connect your App Store or Play Store apps to auto-generate TikTok, Reels, and Shorts campaigns.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchCampaigns}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canCreateCampaign && (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-[12px] bg-white px-4 py-2 text-xs font-semibold text-black shadow-sm transition hover:bg-zinc-200 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add New App
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141417]/95">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span className="text-xs font-medium tracking-wide text-zinc-400">
                Loading products...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm font-semibold text-red-300">
            {error}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const isActive = campaign._id === activeCampaign?._id;
              const mainEmail =
                campaign.mainEmail ||
                campaign.createdBy?.email ||
                '';
              const description =
                campaign.productDescription ||
                campaign.description ||
                '';
              const isExpanded = expandedDescIds.has(campaign._id);
              const isLongDescription = description.length > 180;

              return (
                <div
                  key={campaign._id}
                  onClick={(e) => handleSelectOnly(campaign, e)}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-5 shadow-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-white/30 bg-[#18181d] ring-1 ring-white/20'
                      : 'border-white/[0.08] bg-[#141417]/95 hover:border-white/[0.16] hover:bg-[#18181d]'
                  }`}
                >
                  {/* Card Top */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0">
                          {campaign.iconUrl ? (
                            <img
                              src={campaign.iconUrl}
                              alt={campaign.name || 'App icon'}
                              crossOrigin="anonymous"
                              className="h-11 w-11 rounded-[10px] object-cover border border-white/10 shadow-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  e.currentTarget.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className={`h-11 w-11 items-center justify-center rounded-[10px] border ${
                              isActive
                                ? 'bg-white/[0.10] border-white/20 text-white'
                                : 'bg-white/[0.03] border-white/[0.08] text-zinc-400'
                            }`}
                            style={{ display: campaign.iconUrl ? 'none' : 'flex' }}
                          >
                            <Package className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="m-0 text-sm font-semibold tracking-tight text-white group-hover:text-zinc-200 transition-colors truncate">
                              {campaign.name || 'Untitled product'}
                            </h2>
                            {campaign.category && (
                              <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.2 text-[9px] font-semibold text-zinc-300">
                                {campaign.category}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                            {campaign.productSource === 'app_store' && <span>🍎 App Store</span>}
                            {campaign.productSource === 'play_store' && <span>🤖 Play Store</span>}
                            {campaign.productSource === 'website' && <span>🌐 Website</span>}
                            {campaign.productUrl && (
                              <a
                                href={campaign.productUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-zinc-400 hover:text-white transition-colors hover:underline"
                                title="Open official store listing"
                              >
                                <span>Store</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Active indicator */}
                      {isActive && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-mono text-white shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          Active
                        </span>
                      )}
                    </div>

                    {/* Video Formats Preview */}
                    <div className="mt-3">
                      <CampaignVideoFormatsPreview
                        marketingStrategies={campaign.marketingStrategies || []}
                        keyMessaging={campaign.keyMessaging || []}
                      />
                    </div>

                    {/* Product Description */}
                    {description && (
                      <p className="m-0 mt-2 text-xs leading-relaxed text-zinc-400 line-clamp-2">
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom / Actions */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                    <button
                      type="button"
                      onClick={(e) => openEditForm(campaign, e)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                      title="View or edit product details"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
                      Edit & Formats
                    </button>

                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={(e) => handleSelectOnly(campaign, e)}
                          className="inline-flex items-center gap-1 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <Check className="h-3.5 w-3.5 text-zinc-400" />
                          Select
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => handleOpenQueue(campaign, e)}
                        className={`inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                          isActive
                            ? 'bg-white text-black hover:bg-zinc-200 shadow-sm'
                            : 'bg-white/[0.06] border border-white/[0.08] text-zinc-200 hover:bg-white/[0.10] hover:text-white'
                        }`}
                        title="Open Scheduled Queue for this product"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Queue</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignSelector;
