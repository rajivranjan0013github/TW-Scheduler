import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { AlertTriangle, RefreshCw, Shield, UserCog, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';

const roleStyles = {
  owner: 'bg-[#fff8e5] text-[#8a5a00] border-[#f5d074]',
  account_handler: 'bg-[#eef5ff] text-[#1d5fd1] border-[#bfdbff]',
};

const roleLabels = {
  owner: 'Owner',
  account_handler: 'Account handler',
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const tokenStatus = (accountHealth = {}) => {
  const statuses = accountHealth.tokenStatuses || [];
  if (statuses.includes('reauth_required')) {
    return { label: 'Reauth required', className: 'text-red-600' };
  }

  if (statuses.includes('expired')) {
    return { label: 'Token expired', className: 'text-red-600' };
  }

  const expiresAt = accountHealth.tokenExpiresAt;
  if (!expiresAt) {
    return statuses.includes('healthy')
      ? { label: 'Healthy', className: 'text-[#16733a]' }
      : { label: 'No expiry tracked', className: 'text-[#6e6e73]' };
  }

  const expires = new Date(expiresAt);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { label: 'Token expired', className: 'text-red-600' };
  }

  if (daysLeft <= 7) {
    return { label: `Expires in ${daysLeft}d`, className: 'text-[#8a5a00]' };
  }

  return { label: `Expires in ${daysLeft}d`, className: 'text-[#16733a]' };
};

export const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const totals = useMemo(() => users.reduce((acc, item) => {
    acc.users += 1;
    acc.connectedAccounts += item.metrics?.connectedAccounts || 0;
    acc.failedPosts += item.metrics?.failedPosts || 0;
    acc.media += item.metrics?.media || 0;
    return acc;
  }, { users: 0, connectedAccounts: 0, failedPosts: 0, media: 0 }), [users]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const campaignId = getActiveCampaignId();
      if (!campaignId) {
        setUsers([]);
        setError('Select a campaign workspace before managing team access.');
        return;
      }

      const query = new URLSearchParams({ campaignId, scope: 'workspace' });
      const response = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load admin users.');
      }

      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshUsers = () => fetchUsers();
    const timeout = window.setTimeout(refreshUsers, 0);
    window.addEventListener('campaign-selected', refreshUsers);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('campaign-selected', refreshUsers);
    };
  }, [fetchUsers]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-8 text-[#1d1d1f]">
      <div className="mb-6 flex flex-col gap-4 border-b border-[#e5e5ea] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Campaign Manager</p>
          <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight text-[#1d1d1f]">Team Access</h2>
          <p className="m-0 mt-1 text-xs text-[#8e8e93]">Manage users connected to the active campaign workspace.</p>
        </div>

        <button
          onClick={fetchUsers}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-[#e5e5ea] bg-white p-5">
          <Users className="h-4 w-4 text-[#3478f6]" />
          <p className="m-0 mt-4 text-2xl font-semibold">{totals.users}</p>
          <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Users</p>
        </div>
        <div className="rounded-lg border border-[#e5e5ea] bg-white p-5">
          <Shield className="h-4 w-4 text-[#3478f6]" />
          <p className="m-0 mt-4 text-2xl font-semibold">{totals.connectedAccounts}</p>
          <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Connected accounts</p>
        </div>
        <div className="rounded-lg border border-[#e5e5ea] bg-white p-5">
          <AlertTriangle className="h-4 w-4 text-[#d97706]" />
          <p className="m-0 mt-4 text-2xl font-semibold">{totals.failedPosts}</p>
          <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Failed scheduled posts</p>
        </div>
        <div className="rounded-lg border border-[#e5e5ea] bg-white p-5">
          <UserCog className="h-4 w-4 text-[#3478f6]" />
          <p className="m-0 mt-4 text-2xl font-semibold">{totals.media}</p>
          <p className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Media assets</p>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-[#d2d2d7] bg-white">
        <div className="grid grid-cols-[1.5fr_0.75fr_1fr_1fr] gap-4 border-b border-[#e5e5ea] bg-[#fbfbfd] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
          <span>User</span>
          <span>Role</span>
          <span>Workspace</span>
          <span>Health</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#6e6e73]">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6e6e73]">No users found for this campaign.</div>
        ) : (
          users.map((item) => {
            const health = tokenStatus(item.accountHealth);
            const isSelf = item._id === user?._id;
            const campaignRole = item.campaignRole || 'account_handler';

            return (
              <div key={item._id} className="grid grid-cols-[1.5fr_0.75fr_1fr_1fr] items-center gap-4 border-b border-[#e5e5ea] px-5 py-4 last:border-b-0">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    crossOrigin="anonymous"
                    alt=""
                    className="h-10 w-10 rounded-full border border-black/10 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-semibold text-[#1d1d1f]">
                      {item.name}
                      {isSelf && <span className="ml-2 text-[10px] font-semibold text-[#3478f6]">You</span>}
                    </p>
                    <p className="m-0 mt-0.5 truncate text-xs text-[#6e6e73]">{item.email}</p>
                    <p className="m-0 mt-1 text-[10px] text-[#8e8e93]">
                      Joined {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'unknown'}
                    </p>
                  </div>
                </div>

                <div>
                  <span className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${roleStyles[campaignRole] || roleStyles.account_handler}`}>
                    {roleLabels[campaignRole] || roleLabels.account_handler}
                  </span>
                </div>

                <div className="text-xs text-[#515154]">
                  <p className="m-0">{item.metrics?.connectedAccounts || 0}/{item.metrics?.accounts || 0} accounts connected</p>
                  <p className="m-0 mt-1">{item.metrics?.scheduledPosts || 0} scheduled, {item.metrics?.publishedPosts || 0} published</p>
                  <p className="m-0 mt-1">{item.metrics?.media || 0} media, {formatBytes(item.metrics?.storageBytes)}</p>
                </div>

                <div className="text-xs">
                  <p className={`m-0 font-semibold ${health.className}`}>{health.label}</p>
                  <p className="m-0 mt-1 text-[#6e6e73]">
                    {(item.accountHealth?.platforms || []).length > 0
                      ? item.accountHealth.platforms.join(', ')
                      : 'No connected platforms'}
                  </p>
                  {(item.metrics?.failedPosts || 0) > 0 && (
                    <p className="m-0 mt-1 font-semibold text-red-600">{item.metrics.failedPosts} failed posts</p>
                  )}
                  {(item.accountHealth?.tokenRefreshErrors || []).length > 0 && (
                    <p className="m-0 mt-1 truncate text-red-600" title={item.accountHealth.tokenRefreshErrors[0]}>
                      {item.accountHealth.tokenRefreshErrors[0]}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
