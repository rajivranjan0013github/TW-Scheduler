import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';

const statusOptions = ['active', 'paused', 'archived'];
const platformOptions = ['instagram', 'facebook', 'youtube'];

const PlatformLogo = ({ platform, className = 'h-7 w-7' }) => {
  if (platform === 'instagram') {
    return (
      <span className={`${className} inline-flex items-center justify-center rounded-lg bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[70%] w-[70%]">
          <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="8" r="1.1" fill="currentColor" />
        </svg>
      </span>
    );
  }

  if (platform === 'facebook') {
    return (
      <span className={`${className} inline-flex items-center justify-center rounded-full bg-[#1877f2] text-white`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[72%] w-[72%]">
          <path fill="currentColor" d="M14.2 8.1h2.2V4.4c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 1.9-5.4 5.4v3H4.3v4.1h3.5V24h4.3v-7.3h3.4l.5-4.1h-3.9V10c0-1.2.3-1.9 2.1-1.9Z" />
        </svg>
      </span>
    );
  }

  if (platform === 'youtube') {
    return (
      <span className={`${className} inline-flex items-center justify-center rounded-lg bg-[#ff0000] text-white`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[68%] w-[68%]">
          <path fill="currentColor" d="M22 7.4a3 3 0 0 0-2.1-2.1C18 4.8 12 4.8 12 4.8s-6 0-7.9.5A3 3 0 0 0 2 7.4 31.4 31.4 0 0 0 1.5 12c0 1.6.2 3.2.5 4.6a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.4.5-3 .5-4.6s-.2-3.2-.5-4.6ZM10 15.3V8.7l5.7 3.3-5.7 3.3Z" />
        </svg>
      </span>
    );
  }

  return <span className={`${className} inline-flex items-center justify-center rounded-full bg-[#e5e5ea]`} />;
};

const tabConfig = [
  { id: 'details', label: 'Details', icon: Settings },
  { id: 'accounts', label: 'Accounts', icon: Users },
];

export const AdminCampaigns = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [campaign, setCampaign] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', mainEmail: '', status: 'active', channels: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // States for adding a channel inline
  const [newChannelPlatform, setNewChannelPlatform] = useState('instagram');
  const [newChannelHandle, setNewChannelHandle] = useState('');
  const [newChannelDisplayName, setNewChannelDisplayName] = useState('');

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
        const campaignList = await queryClient.fetchQuery({
          queryKey: ['admin', 'campaigns', 'workspace'],
          queryFn: async () => {
            const campaignRes = await fetch(`${API_BASE_URL}/api/admin/campaigns?scope=workspace`, { headers });
            const payload = await campaignRes.json();
            if (!campaignRes.ok) throw new Error(payload.message || 'Failed to load campaigns.');
            return payload;
          },
          staleTime: 2 * 60 * 1000,
        });

        const found = (Array.isArray(campaignList) ? campaignList : []).find((c) => c._id === campaignId);
        applyCampaignToForm(found || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId, queryClient]);

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
          addedAt: new Date().toISOString(),
        },
      ],
    }));

    setNewChannelHandle('');
    setNewChannelDisplayName('');
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
                                <PlatformLogo platform={platform} className="h-4 w-4 shrink-0" />
                                {platform === 'youtube' ? 'YouTube' : platform}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inputs Grid */}
                      <div className="grid gap-4 sm:grid-cols-2">
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
                        {(form.channels || []).map((ch, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-4 hover:bg-[#fbfbfb] transition">
                            <PlatformLogo platform={ch.platform} className="h-8 w-8 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="truncate text-sm font-semibold text-[#1d1d1f]">
                                  {ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`}
                                </span>
                                {ch.displayName && (
                                  <span className="truncate text-xs text-[#8e8e93]">
                                    ({ch.displayName})
                                  </span>
                                )}
                              </div>
                              <p className="m-0 mt-0.5 text-[11px] text-[#8e8e93] capitalize">
                                {ch.platform} {ch.addedAt && `· Added on ${new Date(ch.addedAt).toLocaleDateString()}`}
                              </p>
                            </div>

                            {/* Verification badge */}
                            <div className="flex flex-col items-end gap-1">
                              <span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold border ${
                                ch.isVerified
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {ch.isVerified ? 'Verified' : 'Unverified'}
                              </span>
                              {!ch.isVerified && (
                                <span className="text-[10px] text-[#8e8e93] max-w-[180px] text-right leading-tight">
                                  Owner needs to connect under Channels page.
                                </span>
                              )}
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
                        ))}
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
    </div>
  );
};

export default AdminCampaigns;
