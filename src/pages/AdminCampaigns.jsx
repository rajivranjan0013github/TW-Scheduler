import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Megaphone,
  Plus,
  Radio,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const statusOptions = ['active', 'paused', 'archived'];
const platformOptions = ['instagram', 'facebook', 'youtube'];

const emptyForm = {
  name: '',
  description: '',
  mainEmail: '',
  status: 'active',
  accountIds: [],
};

const getId = (value) => value?._id || value || '';

const getPlatformBadgeClasses = (platform) => {
  if (platform === 'instagram') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (platform === 'youtube') return 'bg-red-50 text-red-700 border-red-200';
  if (platform === 'facebook') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
};

const getStatusBadgeClasses = (status) => {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'paused') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const getAccountVerified = (account) => account?.isConnected !== false;

export const AdminCampaigns = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('instagram');
  const [isAddingAccounts, setIsAddingAccounts] = useState(false);

  const canDelete = user?.role === 'owner';

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign._id === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );

  const accountCountsByPlatform = useMemo(() => (
    platformOptions.reduce((counts, platform) => ({
      ...counts,
      [platform]: availableAccounts.filter((account) => account.platform === platform).length,
    }), {})
  ), [availableAccounts]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('tw_token')}` };
      const [campaignRes, accountRes] = await Promise.all([
        fetch('http://localhost:5001/api/admin/campaigns?scope=workspace', { headers }),
        fetch('http://localhost:5001/api/admin/social-accounts?scope=workspace', { headers }),
      ]);
      const campaignData = await campaignRes.json();
      const accountData = await accountRes.json();

      if (!campaignRes.ok) throw new Error(campaignData.message || 'Failed to load campaigns.');
      if (!accountRes.ok) throw new Error(accountData.message || 'Failed to load social accounts.');

      setCampaigns(campaignData);
      setAvailableAccounts(accountData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const closeForm = () => {
    setIsFormOpen(false);
    setSelectedCampaignId('');
    setForm(emptyForm);
    setAccountSearch('');
    setPlatformFilter('instagram');
    setIsAddingAccounts(false);
  };

  const openNewCampaign = () => {
    setSelectedCampaignId('');
    setForm(emptyForm);
    setError('');
    setAccountSearch('');
    setPlatformFilter('instagram');
    setIsAddingAccounts(false);
    setIsFormOpen(true);
  };

  const openCampaignAccounts = (campaign) => {
    setSelectedCampaignId(campaign._id);
    setForm({
      name: campaign.name || '',
      description: campaign.description || '',
      mainEmail: campaign.mainEmail || campaign.createdBy?.email || '',
      status: campaign.status || 'active',
      accountIds: (campaign.accountIds || []).map(getId).filter(Boolean),
    });
    setError('');
    setAccountSearch('');
    setPlatformFilter('instagram');
    setIsAddingAccounts(false);
    setIsFormOpen(true);
  };

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    const selectedIds = new Set(form.accountIds);
    return availableAccounts.filter((account) => {
      if (account.platform !== platformFilter) return false;
      if (selectedIds.has(account._id)) return false;
      if (!query) return true;
      return [
        account.name,
        account.username,
        account.accountId,
        account.userId?.name,
        account.userId?.email,
        account.campaignId?.name,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [accountSearch, availableAccounts, form.accountIds, platformFilter]);

  const selectedAccountsForForm = useMemo(() => {
    const accountMap = new Map(availableAccounts.map((account) => [account._id, account]));
    return form.accountIds
      .map((accountId) => accountMap.get(accountId))
      .filter(Boolean);
  }, [availableAccounts, form.accountIds]);

  const addAccount = (accountId) => {
    setForm((current) => (
      current.accountIds.includes(accountId)
        ? current
        : { ...current, accountIds: [...current.accountIds, accountId] }
    ));
  };

  const removeAccount = (accountId) => {
    setForm((current) => ({
      ...current,
      accountIds: current.accountIds.filter((id) => id !== accountId),
    }));
  };

  const openPublishingChannels = () => {
    navigate('/channels');
  };

  const saveCampaign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(
        selectedCampaignId
          ? `http://localhost:5001/api/admin/campaigns/${selectedCampaignId}?scope=workspace`
          : 'http://localhost:5001/api/admin/campaigns?scope=workspace',
        {
          method: selectedCampaignId ? 'PATCH' : 'POST',
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

      setCampaigns((current) => {
        if (selectedCampaignId) {
          return current.map((campaign) => campaign._id === data._id ? data : campaign);
        }
        return [data, ...current];
      });
      setAvailableAccounts((current) => current.map((account) => {
        if (form.accountIds.includes(account._id)) {
          return { ...account, campaignId: { _id: data._id, name: data.name, status: data.status } };
        }
        if (getId(account.campaignId) === data._id) {
          return { ...account, campaignId: null };
        }
        return account;
      }));
      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async () => {
    if (!selectedCampaign || !canDelete) return;

    const confirmed = window.confirm(`Delete campaign "${selectedCampaign.name}"? This will not delete posts or publishing channels.`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5001/api/admin/campaigns/${selectedCampaign._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('tw_token')}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete campaign.');
      }

      setCampaigns((current) => current.filter((campaign) => campaign._id !== selectedCampaign._id));
      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-3 py-3 text-[#1d1d1f] lg:px-5">
      <div className={`mx-auto space-y-3 ${isFormOpen ? 'max-w-5xl' : 'max-w-5xl'}`}>
        <div className="flex flex-col gap-2 border-b border-[#d2d2d7] pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold tracking-tight text-black">Campaign Setup</h2>
            {!isFormOpen && (
              <p className="m-0 mt-0.5 text-xs text-[#6e6e73]">
                Create campaigns and assign verified publishing accounts.
              </p>
            )}
          </div>
          {isFormOpen ? (
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center justify-center rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              Back to campaigns
            </button>
          ) : (
            <button
              type="button"
              onClick={openNewCampaign}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4]"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-3">
          {!isFormOpen && (
          <section className="overflow-hidden rounded-xl border border-[#d2d2d7] bg-white">
            <div className="flex items-center justify-between border-b border-[#e5e5ea] px-4 py-3">
              <div>
                <h3 className="m-0 text-sm font-semibold">Campaigns</h3>
                <p className="m-0 mt-1 text-xs text-[#6e6e73]">{campaigns.length} total</p>
              </div>
              <span className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                {campaigns.filter((campaign) => campaign.status === 'active').length} active
              </span>
            </div>

            <div className="divide-y divide-[#e5e5ea]">
              {loading ? (
                <div className="p-10 text-center text-sm text-[#6e6e73]">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#8e8e93]">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="m-0 text-sm font-semibold text-[#1d1d1f]">No campaigns yet</p>
                    <p className="m-0 mt-1 text-xs text-[#6e6e73]">Create a campaign, then add publishing accounts.</p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewCampaign}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Campaign
                  </button>
                </div>
              ) : campaigns.map((campaign) => (
                <div
                  key={campaign._id}
                  className={`grid gap-3 px-4 py-3 transition lg:grid-cols-[minmax(0,1fr)_170px_124px] lg:items-center ${
                    selectedCampaignId === campaign._id ? 'bg-[#f8fbff]' : 'bg-white hover:bg-[#fbfbfd]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">{campaign.name}</p>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadgeClasses(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="m-0 mt-1 line-clamp-2 text-xs leading-5 text-[#6e6e73]">
                      {campaign.description || 'No description added yet.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex -space-x-2">
                      {(campaign.accountIds || []).length === 0 ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#c7c7cc] bg-white text-[#8e8e93]">
                          <Radio className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        (campaign.accountIds || []).slice(0, 4).map((account) => (
                          <img
                            key={account._id}
                            src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt=""
                            className="h-8 w-8 rounded-full border-2 border-white object-cover"
                            title={`${account.name} · ${account.platform}`}
                          />
                        ))
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 font-semibold text-[#1d1d1f]">
                        {campaign.accountIds?.length || 0} account{campaign.accountIds?.length === 1 ? '' : 's'}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[#8e8e93]">
                        {(campaign.accountIds || []).length > 0
                          ? (campaign.accountIds || []).slice(0, 2).map((account) => account.platform).join(', ')
                          : 'None assigned'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCampaignAccounts(campaign)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3478f6] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add account
                  </button>
                </div>
              ))}
            </div>
          </section>
          )}

          {isFormOpen && (
            <form onSubmit={saveCampaign} className="overflow-hidden rounded-xl border border-[#d2d2d7] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#e5e5ea] px-3 py-2">
                <div>
                  <h3 className="m-0 text-sm font-semibold">
                    {selectedCampaignId ? 'Add accounts to campaign' : 'New campaign'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  aria-label="Close campaign setup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 p-3">
                <section className="grid gap-2 lg:grid-cols-[minmax(180px,0.85fr)_minmax(220px,1.15fr)_140px] lg:items-end">
                  <label className="block">
                    <span className="text-xs font-semibold text-[#515154]">Campaign name</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="June launch"
                      className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3478f6]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#515154]">Description</span>
                    <input
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Channels and posts for this campaign..."
                      className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3478f6]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#515154]">Status</span>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-sm capitalize outline-none focus:border-[#3478f6]"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </section>

                <section className="grid gap-2 lg:grid-cols-[112px_minmax(0,1fr)_auto] lg:items-center">
                  <div>
                    <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-[#515154]">In campaign</h4>
                    <p className="m-0 text-xs text-[#8e8e93]">{selectedAccountsForForm.length} attached</p>
                  </div>
                  <div className="flex min-h-9 flex-wrap gap-1.5 rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] p-1.5">
                    {selectedAccountsForForm.length === 0 ? (
                      <span className="px-1.5 py-1 text-xs font-medium text-[#8e8e93]">No accounts in this campaign.</span>
                    ) : selectedAccountsForForm.map((account) => (
                      <button
                        key={account._id}
                        type="button"
                        onClick={() => removeAccount(account._id)}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#d2d2d7] bg-white px-2 py-1 text-xs font-semibold text-[#1d1d1f] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <img
                          src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt=""
                          className="h-4 w-4 rounded-full object-cover"
                        />
                        <span className="truncate">{account.name}</span>
                        <X className="h-3 w-3 shrink-0" />
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAccounts((current) => !current);
                        setAccountSearch('');
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2f6fe4]"
                    >
                      {isAddingAccounts ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {isAddingAccounts ? 'Hide add' : 'Add accounts'}
                    </button>
                  </div>
                </section>

                {isAddingAccounts && (
                <section>
                  <div className="mb-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="grid gap-1.5 sm:grid-cols-3">
                      {platformOptions.map((platform) => (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => {
                            setPlatformFilter(platform);
                            setAccountSearch('');
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-left text-xs font-semibold capitalize transition ${
                            platformFilter === platform
                              ? 'border-[#3478f6] bg-[#eef5ff] text-[#1d1d1f]'
                              : 'border-[#d2d2d7] bg-white text-[#6e6e73] hover:bg-[#f5f5f7]'
                          }`}
                        >
                          <span>{platform}</span>
                          <span className="ml-2 text-[10px] font-medium text-[#8e8e93]">
                            {accountCountsByPlatform[platform] || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e8e93]" />
                      <input
                        value={accountSearch}
                        onChange={(event) => setAccountSearch(event.target.value)}
                        placeholder={`Search ${platformFilter}`}
                        className="w-full rounded-lg border border-[#d2d2d7] bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[#3478f6]"
                      />
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto rounded-lg border border-[#e5e5ea]">
                    {filteredAccounts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-[#6e6e73]">
                        No available {platformFilter} account found for adding.
                        <button
                          type="button"
                          onClick={openPublishingChannels}
                          className="ml-2 font-semibold text-[#3478f6] hover:text-[#2f6fe4]"
                        >
                          Connect new
                        </button>
                      </div>
                    ) : filteredAccounts.map((account) => {
                      const assignedCampaignId = getId(account.campaignId);
                      const assignedElsewhere = assignedCampaignId && assignedCampaignId !== selectedCampaignId;
                      const selected = form.accountIds.includes(account._id);
                      const verified = getAccountVerified(account);
                      const disabled = selected || !verified;

                      return (
                        <div key={account._id} className="grid gap-2 border-b border-[#e5e5ea] px-3 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_142px_auto] sm:items-center">
                          <div className="flex min-w-0 items-center gap-2">
                            <img
                              src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">{account.name}</p>
                                <span className={`rounded border px-2 py-0.5 text-[9px] font-semibold uppercase ${getPlatformBadgeClasses(account.platform)}`}>
                                  {account.platform}
                                </span>
                              </div>
                              <p className="m-0 mt-1 truncate text-xs text-[#6e6e73]">
                                @{account.username || 'account'} · {account.userId?.email || account.accountId || 'No owner email'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                            <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
                              verified
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {verified ? 'Verified' : 'Not verified'}
                            </span>
                            {(assignedElsewhere || selected) && (
                              <span className="rounded border border-[#d2d2d7] bg-[#fbfbfd] px-2 py-0.5 text-[#6e6e73]">
                                {selected ? 'Added here' : account.campaignId?.name || 'Assigned'}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => addAccount(account._id)}
                            disabled={disabled}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3478f6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2f6fe4] disabled:cursor-not-allowed disabled:bg-[#d2d2d7]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {selected ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[#e5e5ea] px-3 py-2">
                <button
                  type="button"
                  onClick={deleteCampaign}
                  disabled={!selectedCampaignId || !canDelete || saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-xs font-semibold text-[#6e6e73] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2f6fe4] disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCampaigns;
