import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Upload,
  Clock,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
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
        if (campaignData.length === 1) {
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
    if (!campaignForm.name.trim()) {
      setCreateError('Workspace name is required.');
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
            name: campaignForm.name,
            mainEmail: user?.email || '',
            description: campaignForm.description,
            status: 'active',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create workspace.');
      }

      setCampaigns((current) => [data, ...current]);
      persistCampaign(data);
      setIsCreating(false);
      navigate('/scheduler');
    } catch (err) {
      setCreateError(err.message || 'Failed to create workspace.');
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
      <div className="min-h-screen bg-black flex items-center justify-center px-6 py-12 text-white">
        <div className="w-full max-w-lg">
          {/* Welcome hero */}
          <div className="text-center mb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7831d6] to-[#9333ea] text-white shadow-lg mb-6 shadow-purple-950/40">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="m-0 text-3xl font-semibold tracking-tight text-white">
              Welcome, {firstName}!
            </h1>
            <p className="m-0 mt-3 text-sm leading-6 text-zinc-400 max-w-md mx-auto">
              Let's set up your workspace in under 2 minutes.
              You'll be scheduling your first post in no time.
            </p>
          </div>

          {/* Workspace creation form */}
          <form
            onSubmit={createCampaign}
            className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/80"
          >
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7831d6]/20 text-[#c4b5fd]">
                <Megaphone className="h-4 w-4" />
              </div>
              <div>
                <h2 className="m-0 text-sm font-semibold text-white">
                  Name your workspace
                </h2>
                <p className="m-0 text-[11px] text-zinc-400">
                  This is where all your content and channels will live
                </p>
              </div>
            </div>

            {createError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
                {createError}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-300">
                  Workspace name
                </span>
                <input
                  value={campaignForm.name}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. My Brand, Summer Campaign, Client Name..."
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20 placeholder:text-zinc-600"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-zinc-300">
                  Description{' '}
                  <span className="font-normal text-zinc-500">(optional)</span>
                </span>
                <textarea
                  value={campaignForm.description}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="What will you be posting about?"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#7831d6] focus:ring-2 focus:ring-[#7831d6]/20 placeholder:text-zinc-600"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#7831d6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-60 active:scale-[0.98] shadow-md"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* "What's next" preview */}
          <div className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-5">
            <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
              What happens next
            </p>
            <div className="space-y-3">
              {[
                {
                  icon: Link2,
                  label: 'Connect your Instagram, Facebook, or YouTube',
                  color: '#7831d6',
                },
                {
                  icon: Upload,
                  label: 'Upload your videos and images',
                  color: '#9333ea',
                },
                {
                  icon: Clock,
                  label: 'Schedule your first post',
                  color: '#10b981',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  </div>
                  <span className="text-xs text-zinc-300">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signed-in context */}
          <p className="m-0 mt-5 text-center text-[11px] text-zinc-500">
            Signed in as{' '}
            <span className="font-semibold text-zinc-300">{user?.email}</span>
          </p>
        </div>
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
              Workspaces
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-tight text-white">
              Select Workspace
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              You are signed in as{' '}
              <span className="font-semibold text-white">
                {user?.email}
              </span>
              . Choose the workspace you want to manage.
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
                New workspace
              </button>
            )}
          </div>
        </div>

        {isCreating && (
          <form
            onSubmit={createCampaign}
            className="rounded-lg border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl shadow-black/80"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Workspace setup
                </p>
                <h2 className="m-0 mt-1 text-lg font-semibold tracking-tight text-white">
                  New workspace
                </h2>
              </div>
              {campaigns.length > 0 && (
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close workspace form"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {createError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
                {createError}
              </div>
            )}

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-300">
                  Workspace name
                </span>
                <input
                  value={campaignForm.name}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Workspace name"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#7831d6]"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-zinc-300">
                Description
              </span>
              <textarea
                value={campaignForm.description}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Workspace description"
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#7831d6]"
              />
            </label>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6825bc] disabled:opacity-60 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Creating...' : 'Create workspace and continue'}
              </button>
            </div>
          </form>
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
                        Workspace
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
                    {campaign.description || 'Workspace'}
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
