import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Megaphone, Plus, RefreshCw, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const emptyCampaignForm = {
  name: '',
  description: '',
};

export const CampaignSelector = ({ setSelectedAccounts = () => {} }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreateCampaign = Boolean(user);
  const storageKey = `active-campaign-id:${user?._id || user?.email || 'default'}`;
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(() => localStorage.getItem(storageKey) || localStorage.getItem('active-campaign-id') || '');
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

  const persistCampaign = (campaign) => {
    localStorage.setItem(storageKey, campaign._id);
    localStorage.setItem('active-campaign-id', campaign._id);
    localStorage.setItem('active-campaign-name', campaign.name || '');
    localStorage.setItem('active-campaign-main-email', campaign.mainEmail || campaign.createdBy?.email || '');
    setActiveCampaignId(campaign._id);
    setSelectedAccounts([]);
    window.dispatchEvent(new CustomEvent('campaign-selected', {
      detail: {
        campaignId: campaign._id,
        campaignName: campaign.name || '',
        mainEmail: campaign.mainEmail || campaign.createdBy?.email || '',
      },
    }));
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError('');
      const headers = { Authorization: `Bearer ${localStorage.getItem('tw_token')}` };
      const campaignResponse = await fetch('http://localhost:5001/api/accounts/campaigns', { headers });
      if (!campaignResponse.ok) {
        const data = await campaignResponse.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to load campaigns.');
      }

      const campaignData = await campaignResponse.json();
      setCampaigns(campaignData);

      if (campaignData.length > 0) {
        const savedId = localStorage.getItem(storageKey) || localStorage.getItem('active-campaign-id') || '';
        const nextCampaign = campaignData.find((campaign) => campaign._id === savedId) || campaignData[0];
        persistCampaign(nextCampaign);
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
    navigate('/dashboard');
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
    if (!campaignForm.name.trim()) {
      setCreateError('Campaign name is required.');
      return;
    }

    try {
      setSaving(true);
      setCreateError('');
      const response = await fetch('http://localhost:5001/api/accounts/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
        body: JSON.stringify({
          name: campaignForm.name,
          mainEmail: user?.email || '',
          description: campaignForm.description,
          status: 'active',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create campaign.');
      }

      setCampaigns((current) => [data, ...current]);
      persistCampaign(data);
      setIsCreating(false);
      navigate('/dashboard');
    } catch (err) {
      setCreateError(err.message || 'Failed to create campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-8 py-7 text-[#1d1d1f]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#d2d2d7] pb-5">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Campaign access</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-tight">
              {campaigns.length === 0 ? 'Create your campaign' : 'Select a campaign'}
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#6e6e73]">
              Signed in as <span className="font-semibold text-[#1d1d1f]">{user?.email}</span>. {campaigns.length === 0
                ? 'Tell us what product or campaign this workspace is for.'
                : 'Choose the campaign workspace you want to manage.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCampaigns}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            {canCreateCampaign && campaigns.length > 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0071e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#005bbd]"
              >
                <Plus className="h-3.5 w-3.5" />
                New campaign
              </button>
            )}
          </div>
        </div>

        {isCreating && (
          <form onSubmit={createCampaign} className="rounded-lg border border-[#d2d2d7] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93]">Campaign setup</p>
                <h2 className="m-0 mt-1 text-lg font-semibold tracking-tight">
                  {campaigns.length === 0 ? 'Tell us about your product' : 'New campaign workspace'}
                </h2>
              </div>
              {campaigns.length > 0 && (
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  aria-label="Close campaign form"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {createError && (
              <div className="mt-4 rounded-lg border border-[#fecaca] bg-[#fff1f2] p-3 text-xs font-semibold text-[#b91c1c]">
                {createError}
              </div>
            )}

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-[#515154]">Campaign name</span>
                <input
                  value={campaignForm.name}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Campaign name"
                  className="mt-2 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm outline-none focus:border-[#3478f6]"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[#515154]">Description</span>
              <textarea
                value={campaignForm.description}
                onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Campaign description"
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm outline-none focus:border-[#3478f6]"
              />
            </label>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#005bbd] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Creating...' : 'Create campaign and continue'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-[#d2d2d7] bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0071e3] border-t-transparent" />
              <span className="text-xs font-semibold tracking-wide text-[#8e8e93]">Loading campaigns...</span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[#fecaca] bg-[#fff1f2] p-5 text-sm font-semibold text-[#b91c1c]">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-[#d2d2d7] bg-white p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#eef5ff] text-[#3478f6]">
              <Megaphone className="h-5 w-5" />
            </div>
            <h2 className="m-0 mt-4 text-lg font-semibold">No campaign assigned</h2>
            <p className="m-0 mt-2 max-w-xl text-sm leading-6 text-[#6e6e73]">
              This email does not have any campaign workspace yet.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {canCreateCampaign && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#005bbd]"
                >
                  <Plus className="h-4 w-4" />
                  Create campaign
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const isActive = campaign._id === activeCampaign?._id;
              const mainEmail = campaign.mainEmail || campaign.createdBy?.email || 'No main email set';
              return (
                <button
                  key={campaign._id}
                  type="button"
                  onClick={() => handleSelect(campaign)}
                  className={`flex min-h-[220px] flex-col rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    isActive ? 'border-[#0071e3] ring-2 ring-[#0071e3]/15' : 'border-[#d2d2d7]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93]">Campaign</p>
                      <h2 className="m-0 mt-1 text-lg font-semibold tracking-tight text-[#1d1d1f]">{campaign.name}</h2>
                    </div>
                    {isActive ? <CheckCircle2 className="h-5 w-5 text-[#0071e3]" /> : <ArrowRight className="h-5 w-5 text-[#8e8e93]" />}
                  </div>

                  <p className="m-0 mt-3 line-clamp-3 text-sm leading-5 text-[#6e6e73]">
                    {campaign.description || 'Campaign workspace'}
                  </p>

                  <div className="mt-5 flex flex-1 items-end">
                    <div className="w-full rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93]">Main email</p>
                      <p className="m-0 mt-1 truncate text-xs font-semibold text-[#1d1d1f]">{mainEmail}</p>
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
