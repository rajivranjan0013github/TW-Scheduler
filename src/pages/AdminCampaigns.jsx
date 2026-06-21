import { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const statusOptions = ['active', 'paused', 'archived'];

const emptyForm = {
  name: '',
  description: '',
  mainEmail: '',
  status: 'active',
};

export const AdminCampaigns = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
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
      const campaignRes = await fetch('http://localhost:5001/api/admin/campaigns', { headers });
      const campaignData = await campaignRes.json();

      if (!campaignRes.ok) throw new Error(campaignData.message || 'Failed to load campaigns.');

      setCampaigns(campaignData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load campaign setup data on entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      mainEmail: campaign.mainEmail || campaign.createdBy?.email || '',
      status: campaign.status || 'active',
    });
    setError('');
    setIsDialogOpen(true);
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
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Campaign Manager</p>
          <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">Campaign Setup</h2>
          <p className="m-0 mt-1 text-xs text-[#8e8e93]">Create campaign workspaces and assign the main access email.</p>
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

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="m-0 truncate font-semibold">{campaign.mainEmail || campaign.createdBy?.email || 'Not set'}</p>
                    <p className="m-0 mt-0.5 text-[#8e8e93]">Main email</p>
                  </div>
                  <div>
                    <p className="m-0 truncate font-semibold">{campaign.createdBy?.email || 'Unknown'}</p>
                    <p className="m-0 mt-0.5 text-[#8e8e93]">Created by</p>
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
              <p className="m-0 mt-1 text-xs text-[#6e6e73]">Campaign access is controlled by the main email, separate from publishing channels.</p>
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
              <span className="text-xs font-semibold text-[#515154]">Main email</span>
              <input
                type="email"
                value={form.mainEmail}
                onChange={(event) => setForm((current) => ({ ...current, mainEmail: event.target.value }))}
                placeholder="owner@example.com"
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
