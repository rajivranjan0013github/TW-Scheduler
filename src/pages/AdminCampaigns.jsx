import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Megaphone, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const statusOptions = ['active', 'paused', 'archived'];

const numberFormat = new Intl.NumberFormat();

const emptyForm = {
  name: '',
  description: '',
  status: 'active',
  accountIds: [],
};

export const AdminCampaigns = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canDelete = user?.role === 'owner';

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign._id === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('tw_token')}` };
      const [campaignRes, accountRes] = await Promise.all([
        fetch('http://localhost:5001/api/admin/campaigns', { headers }),
        fetch('http://localhost:5001/api/admin/social-accounts', { headers }),
      ]);

      const [campaignData, accountData] = await Promise.all([
        campaignRes.json(),
        accountRes.json(),
      ]);

      if (!campaignRes.ok) throw new Error(campaignData.message || 'Failed to load campaigns.');
      if (!accountRes.ok) throw new Error(accountData.message || 'Failed to load social accounts.');

      setCampaigns(campaignData);
      setAccounts(accountData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedCampaignId('');
    setForm(emptyForm);
  };

  const openNewCampaign = () => {
    setSelectedCampaignId('');
    setForm(emptyForm);
    setError('');
    setIsDialogOpen(true);
  };

  const editCampaign = (campaign) => {
    setSelectedCampaignId(campaign._id);
    setForm({
      name: campaign.name || '',
      description: campaign.description || '',
      status: campaign.status || 'active',
      accountIds: (campaign.accountIds || []).map((account) => account._id || account),
    });
    setError('');
    setIsDialogOpen(true);
  };

  const toggleAccount = (accountId) => {
    setForm((current) => ({
      ...current,
      accountIds: current.accountIds.includes(accountId)
        ? current.accountIds.filter((id) => id !== accountId)
        : [...current.accountIds, accountId],
    }));
  };

  const saveCampaign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(
        selectedCampaignId
          ? `http://localhost:5001/api/admin/campaigns/${selectedCampaignId}`
          : 'http://localhost:5001/api/admin/campaigns',
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
      closeDialog();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async () => {
    if (!selectedCampaign || !canDelete) return;

    const confirmed = window.confirm(`Delete campaign "${selectedCampaign.name}"? This will not delete posts or social accounts.`);
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
      closeDialog();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-8 text-[#1d1d1f]">
      <div className="mb-6 flex flex-col gap-4 border-b border-[#e5e5ea] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Administration</p>
          <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">Campaign</h2>
          <p className="m-0 mt-1 text-xs text-[#8e8e93]">Create campaign groups and attach social media accounts to them.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[#d2d2d7] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e5ea] px-5 py-4">
            <div>
              <h3 className="m-0 text-sm font-semibold">Campaigns</h3>
              <p className="m-0 mt-1 text-xs text-[#6e6e73]">{campaigns.length} campaign groups</p>
            </div>
            <button
              onClick={openNewCampaign}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2f6fe4]"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="divide-y divide-[#e5e5ea]">
            {loading ? (
              <div className="p-8 text-center text-sm text-[#6e6e73]">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6e6e73]">No campaigns yet.</div>
            ) : campaigns.map((campaign) => (
              <div
                key={campaign._id}
                className="w-full bg-white p-5 text-left transition hover:bg-[#f5f5f7]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">{campaign.name}</p>
                    <p className="m-0 mt-1 line-clamp-2 text-xs text-[#6e6e73]">{campaign.description || 'No description'}</p>
                  </div>
                  <span className="rounded-lg border border-[#d2d2d7] bg-white px-2 py-1 text-[10px] font-semibold capitalize text-[#515154]">
                    {campaign.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="m-0 font-semibold">{campaign.metrics?.accounts || 0}</p>
                    <p className="m-0 mt-0.5 text-[#8e8e93]">Accounts</p>
                  </div>
                  <div>
                    <p className="m-0 font-semibold">{campaign.metrics?.posts || 0}</p>
                    <p className="m-0 mt-0.5 text-[#8e8e93]">Posts</p>
                  </div>
                  <div>
                    <p className="m-0 font-semibold">{numberFormat.format(campaign.metrics?.lifetimeViews || 0)}</p>
                    <p className="m-0 mt-0.5 text-[#8e8e93]">Views</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => editCampaign(campaign)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
        <form onSubmit={saveCampaign} className="w-full max-w-3xl rounded-xl border border-[#d2d2d7] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#e5e5ea] px-5 py-4">
            <div>
              <h3 className="m-0 text-sm font-semibold">{selectedCampaignId ? 'Edit campaign' : 'Create campaign'}</h3>
              <p className="m-0 mt-1 text-xs text-[#6e6e73]">Assign social accounts so admin dashboard can group views by campaign.</p>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              aria-label="Close campaign dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
            <label className="block">
              <span className="text-xs font-semibold text-[#515154]">Campaign name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="June launch"
                className="mt-2 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm outline-none focus:border-[#3478f6]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#515154]">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Channels and posts for this campaign..."
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm outline-none focus:border-[#3478f6]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#515154]">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm capitalize outline-none focus:border-[#3478f6]"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#515154]">Social accounts</span>
                <span className="text-[10px] font-semibold text-[#8e8e93]">{form.accountIds.length} selected</span>
              </div>
              <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-[#d2d2d7]">
                {accounts.length === 0 ? (
                  <div className="p-5 text-center text-xs text-[#6e6e73]">No social accounts available.</div>
                ) : accounts.map((account) => (
                  <label key={account._id} className="flex cursor-pointer items-center gap-3 border-b border-[#e5e5ea] p-3 last:border-b-0 hover:bg-[#f5f5f7]">
                    <input
                      type="checkbox"
                      checked={form.accountIds.includes(account._id)}
                      onChange={() => toggleAccount(account._id)}
                      className="h-4 w-4"
                    />
                    <img
                      src={account.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      crossOrigin="anonymous"
                      alt=""
                      className="h-9 w-9 rounded-full border border-black/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">{account.name}</p>
                      <p className="m-0 mt-0.5 truncate text-xs text-[#6e6e73]">
                        @{account.username || 'account'} · {account.platform} · {account.userId?.email || 'unknown owner'}
                      </p>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${account.isConnected ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#e5e5ea] px-5 py-4">
            <button
              type="button"
              onClick={deleteCampaign}
              disabled={!selectedCampaignId || !canDelete || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#6e6e73] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3478f6] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f6fe4] disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save campaign'}
            </button>
          </div>
        </form>
        </div>
      )}
    </div>
  );
};

export default AdminCampaigns;
