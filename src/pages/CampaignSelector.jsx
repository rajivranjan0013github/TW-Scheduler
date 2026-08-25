import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CampaignCreationModal from '../components/campaigns/CampaignCreationModal';
import { emptyProductFields } from '../components/campaigns/campaignProductForm';

const emptyCampaignForm = {
  name: '',
  description: '',
  ...emptyProductFields,
};

export const CampaignSelector = ({ setSelectedAccounts = () => {} }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [campaignForm, setCampaignForm] = useState(() => ({
    ...emptyCampaignForm,
  }));

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign._id === activeCampaignId),
    [campaigns, activeCampaignId]
  );

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
        throw new Error(data.message || 'Failed to load campaigns.');
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

        // Auto-navigate to the working queue if user has exactly 1 campaign
        // (no reason to make them "pick" when there's nothing to pick)
        if (campaignData.length === 1 && location.pathname === '/') {
          navigate('/scheduler', { replace: true });
        }
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
      setError(err.message || 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load campaign choices when the signed-in workspace changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.email]);

  const handleSelect = (campaign) => {
    persistCampaign(campaign);
    navigate('/scheduler');
  };

  const openCreateForm = () => {
    setCreateError('');
    setCampaignForm({
      ...emptyCampaignForm,
    });
    setIsCreating(true);
  };

  const closeCreateForm = () => {
    if (saving) return;
    setIsCreating(false);
    setCreateError('');
  };

  const createCampaign = async (event) => {
    event.preventDefault();
    if (!campaignForm.productName.trim()) {
      setCreateError('Product name is required.');
      return;
    }
    if (!campaignForm.productDescription.trim()) {
      setCreateError('Product description is required. Analyze the link or enter it manually.');
      return;
    }

    try {
      setSaving(true);
      setCreateError('');
      const response = await fetch(
        `${API_BASE_URL}/api/accounts/campaigns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
          },
          body: JSON.stringify({
            name: campaignForm.productName,
            mainEmail: user?.email || '',
            description: campaignForm.productDescription,
            productName: campaignForm.productName,
            productDescription: campaignForm.productDescription,
            status: 'active',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create product.');
      }

      setCampaigns((current) => [data, ...current]);
      persistCampaign(data);
      setIsCreating(false);
      navigate('/scheduler');
    } catch (err) {
      setCreateError(err.message || 'Failed to create product.');
    } finally {
      setSaving(false);
    }
  };

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  // ─────────────────────────────────────────────
  // FIRST-TIME USER: Welcome Screen
  // ─────────────────────────────────────────────
  if (!loading && campaigns.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7831d6] to-[#9333ea] text-white shadow-lg shadow-purple-950/40">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="m-0 mt-6 text-3xl font-semibold tracking-tight text-white">Welcome, {firstName}!</h1>
          <p className="m-0 mt-3 text-sm text-zinc-400">Let&apos;s add your first product.</p>
        </div>
        <CampaignCreationModal
          form={campaignForm}
          setForm={setCampaignForm}
          saving={saving}
          error={createError}
          onSubmit={createCampaign}
          onClose={closeCreateForm}
          canClose={false}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RETURNING USER: Campaign Picker (2+ campaigns)
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black px-8 py-7 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Products
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-white">
              Select Product
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              You are signed in as{' '}
              <span className="font-semibold text-white">
                {user?.email}
              </span>
              . Choose the product you want to manage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCampaigns}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            {canCreateCampaign && campaigns.length > 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6825bc] shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New product
              </button>
            )}
          </div>
        </div>

        {isCreating && (
          <CampaignCreationModal
            form={campaignForm}
            setForm={setCampaignForm}
            saving={saving}
            error={createError}
            onSubmit={createCampaign}
            onClose={closeCreateForm}
          />
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-white/10 bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7831d6] border-t-transparent" />
              <span className="text-xs font-semibold tracking-wide text-zinc-400">
                Loading workspaces...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm font-semibold text-red-300">
            {error}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const isActive = campaign._id === activeCampaign?._id;
              const mainEmail =
                campaign.mainEmail ||
                campaign.createdBy?.email ||
                'No main email set';
              return (
                <button
                  key={campaign._id}
                  type="button"
                  onClick={() => handleSelect(campaign)}
                  className={`flex min-h-[220px] flex-col rounded-lg border bg-[#0a0a0a] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7831d6] hover:bg-white/[0.04] ${
                    isActive
                      ? 'border-[#7831d6] ring-2 ring-[#7831d6]/25'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Product
                      </p>
                      <h2 className="m-0 mt-1 text-lg font-semibold tracking-tight text-white">
                        {campaign.name}
                      </h2>
                    </div>
                    {isActive ? (
                      <CheckCircle2 className="h-5 w-5 text-[#7831d6]" />
                    ) : (
                      <ArrowRight className="h-5 w-5 text-zinc-500" />
                    )}
                  </div>

                  <p className="m-0 mt-3 line-clamp-3 text-sm leading-5 text-zinc-400">
                    {campaign.productDescription || campaign.description || 'Product'}
                  </p>

                  <div className="mt-5 flex flex-1 items-end">
                    <div className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Main email
                      </p>
                      <p className="m-0 mt-1 truncate text-xs font-semibold text-white">
                        {mainEmail}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignSelector;
