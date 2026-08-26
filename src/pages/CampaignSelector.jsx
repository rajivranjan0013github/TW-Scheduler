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
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProductEditorPage from '../components/campaigns/ProductEditorPage';
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
    () =>
      localStorage.getItem(storageKey) ||
      localStorage.getItem('active-campaign-id') ||
      ''
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
        const savedId =
          localStorage.getItem(storageKey) ||
          localStorage.getItem('active-campaign-id') ||
          '';
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
    fetchCampaigns();
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
    });
  };

  const closeModal = () => {
    if (saving) return;
    setIsCreating(false);
    setEditingCampaign(null);
    setFormError('');
  };

  const handleSaveCampaign = async (event, { thenNavigateQueue = false } = {}) => {
    if (event?.preventDefault) event.preventDefault();
    if (!campaignForm.productName.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!campaignForm.productDescription.trim()) {
      setFormError('Product description is required.');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
      };

      const payload = {
        name: campaignForm.productName,
        description: campaignForm.productDescription,
        productName: campaignForm.productName,
        productDescription: campaignForm.productDescription,
        productSource: campaignForm.productSource || 'app_store',
        productUrl: campaignForm.productUrl || '',
        category: campaignForm.category || '',
        iconUrl: campaignForm.iconUrl || '',
        targetAudience: campaignForm.targetAudience || '',
        keyBenefit: campaignForm.keyBenefit || '',
        coreFunction: campaignForm.coreFunction || '',
        useCases: campaignForm.useCases || [],
        targetAudienceList: campaignForm.targetAudienceList || [],
        marketingStrategies: campaignForm.marketingStrategies || [],
        keyMessaging: campaignForm.keyMessaging || [],
        positioningStatement: campaignForm.positioningStatement || '',
        screenshots: campaignForm.screenshots || [],
        primaryGoal: campaignForm.primaryGoal || 'app_downloads',
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
        persistCampaign(data);
      }

      closeModal();

      if (thenNavigateQueue && savedData) {
        navigate('/scheduler');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save product.');
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
      />
    );
  }

  // ─────────────────────────────────────────────
  // FULL PAGE VIEW: PRODUCT WORKSPACES LIST
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black px-4 py-7 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-5">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-purple-400">
              Workspace Products
            </p>
            <h1 className="m-0 mt-1 text-2xl font-bold tracking-tight text-white">
              My App & Product Workspaces
            </h1>
            <p className="m-0 mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">
              Connect your App Store or Play Store apps to auto-generate TikTok, Reels, and Shorts campaigns.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchCampaigns}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {canCreateCampaign && (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7831d6] to-[#9333ea] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#7831d6]/25 transition hover:brightness-110 hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4" />
                Add New App
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/10 bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7831d6] border-t-transparent" />
              <span className="text-xs font-semibold tracking-wide text-zinc-400">
                Loading products...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm font-semibold text-red-300">
            {error}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-gradient-to-b from-[#0f0c18] via-[#09070e] to-[#040306] p-5 shadow-lg transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'border-[#7831d6] ring-2 ring-[#7831d6]/30 shadow-[#7831d6]/10'
                      : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Card Top */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {campaign.iconUrl ? (
                          <img
                            src={campaign.iconUrl}
                            alt={campaign.name || 'App icon'}
                            className="h-11 w-11 rounded-xl object-cover border border-white/10 shadow-sm"
                          />
                        ) : (
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                            isActive
                              ? 'bg-[#7831d6]/20 border-[#7831d6]/40 text-[#c4b5fd]'
                              : 'bg-white/[0.05] border-white/10 text-zinc-400'
                          }`}>
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="m-0 text-base font-semibold tracking-tight text-white group-hover:text-purple-200 transition-colors truncate">
                              {campaign.name || 'Untitled product'}
                            </h2>
                            {campaign.category && (
                              <span className="rounded-md bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                                {campaign.category}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                            {campaign.productSource === 'app_store' && <span>🍎 App Store</span>}
                            {campaign.productSource === 'play_store' && <span>🤖 Play Store</span>}
                            {campaign.productSource === 'website' && <span>🌐 Website</span>}
                            {campaign.productUrl && (
                              <a
                                href={campaign.productUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-purple-400 hover:text-purple-300 transition-colors hover:underline"
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
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7831d6]/20 border border-[#7831d6]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#c4b5fd] shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>

                    {/* Product Description */}
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/40 p-3.5">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Product Description & Hook
                      </p>
                      {description ? (
                        <div>
                          <p className={`m-0 text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap ${
                            !isExpanded && isLongDescription ? 'line-clamp-4' : ''
                          }`}>
                            {description}
                          </p>
                          {isLongDescription && (
                            <button
                              type="button"
                              onClick={(e) => toggleExpandDesc(campaign._id, e)}
                              className="mt-1.5 text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors underline underline-offset-2"
                            >
                              {isExpanded ? 'Show less' : 'Read full description'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="m-0 text-xs italic text-zinc-500">
                          No description provided. Click &apos;Edit Details&apos; to add one.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom / Actions */}
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
                    <button
                      type="button"
                      onClick={(e) => openEditForm(campaign, e)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                      title="View or edit product details"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
                      Edit Details
                    </button>

                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={(e) => handleSelectOnly(campaign, e)}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                        >
                          <Check className="h-3.5 w-3.5 text-zinc-400" />
                          Select
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => handleOpenQueue(campaign, e)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-[#7831d6] text-white hover:bg-[#6825bc] shadow-md shadow-[#7831d6]/20'
                            : 'bg-white/10 text-zinc-200 hover:bg-white/15 hover:text-white'
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
