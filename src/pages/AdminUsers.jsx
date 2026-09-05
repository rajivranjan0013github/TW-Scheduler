import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Filter, RefreshCw, Search, Shield, User, UserCog, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getActiveCampaignId } from '../utils/campaignScope';

const roleStyles = {
  owner: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  account_handler: 'bg-[#7831d6]/15 text-[#c4b5fd] border-[#7831d6]/30',
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
    return { label: 'Reauth required', className: 'text-rose-400' };
  }

  if (statuses.includes('expired')) {
    return { label: 'Token expired', className: 'text-rose-400' };
  }

  const expiresAt = accountHealth.tokenExpiresAt;
  if (!expiresAt) {
    return statuses.includes('healthy')
      ? { label: 'Healthy', className: 'text-emerald-400' }
      : { label: 'No expiry tracked', className: 'text-zinc-500' };
  }

  const expires = new Date(expiresAt);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { label: 'Token expired', className: 'text-rose-400' };
  }

  if (daysLeft <= 7) {
    return { label: `Expires in ${daysLeft}d`, className: 'text-amber-400' };
  }

  return { label: `Expires in ${daysLeft}d`, className: 'text-emerald-400' };
};

export const AdminUsers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState([]);
  const hasLoadedUsersRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const campaignId = getActiveCampaignId();

  const totals = useMemo(() => users.reduce((acc, item) => {
    acc.users += 1;
    acc.connectedAccounts += item.metrics?.connectedAccounts || 0;
    acc.failedPosts += item.metrics?.failedPosts || 0;
    acc.media += item.metrics?.media || 0;
    return acc;
  }, { users: 0, connectedAccounts: 0, failedPosts: 0, media: 0 }), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q);

      const campaignRole = item.campaignRole || 'account_handler';
      const matchesRole = roleFilter === 'all' || campaignRole === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const openUserView = (item) => {
    if (!item?._id || item.campaignRole !== 'account_handler' || item.userType !== 'account_handler') return;

    sessionStorage.setItem('admin_view_context', JSON.stringify({
      userId: item._id,
      userName: item.name || 'Selected user',
      userEmail: item.email || '',
      userAvatar: item.avatar || '',
      userRole: item.role || 'editor',
      viewAs: 'account_handler',
    }));
    window.dispatchEvent(new CustomEvent('handler-preview-changed'));
    navigate('/campaigns', {
      state: {
        fromAdmin: true,
        preserveWorkspace: true,
        previewAsHandler: true,
      },
    });
  };

  const fetchUsers = useCallback(async ({ force = false } = {}) => {
    if (!hasLoadedUsersRef.current) setLoading(true);
    if (force) setRefreshing(true);
    setError('');
    try {
      const activeId = getActiveCampaignId();
      if (!activeId) {
        setUsers([]);
        hasLoadedUsersRef.current = true;
        return;
      }

      const query = new URLSearchParams({ campaignId: activeId, scope: 'workspace' });
      const queryKey = ['admin', 'users', activeId];
      if (force) {
        await queryClient.invalidateQueries({ queryKey });
      }
      const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('tw_token')}`,
            },
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.message || 'Failed to load admin users.');
          }
          return payload;
        },
        staleTime: 2 * 60 * 1000,
      });

      setUsers(data);
      hasLoadedUsersRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    const refreshUsers = () => fetchUsers();
    const timeout = window.setTimeout(refreshUsers, 0);
    window.addEventListener('campaign-selected', refreshUsers);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('campaign-selected', refreshUsers);
    };
  }, [fetchUsers]);

  /* ───────── No campaign selected state ───────── */
  if (!campaignId) {
    return (
      <div className="min-h-screen w-full bg-[#0c0c0e] p-4 lg:p-6 text-white font-sans antialiased">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white m-0">Team</h2>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7831d6]/20 text-[#c4b5fd]">
              <Users className="h-6 w-6" />
            </div>
            <p className="m-0 text-base font-semibold text-white">No campaign workspace selected</p>
            <p className="m-0 text-xs text-zinc-400 max-w-sm">
              Select a campaign workspace from the sidebar or campaign selector to manage team access.
            </p>
            <button
              type="button"
              onClick={() => navigate('/campaigns')}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#7831d6] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 hover:bg-[#6825bc] transition"
            >
              Go to Campaign Selector
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0c0c0e] p-4 lg:p-6 text-white space-y-6 font-sans antialiased pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white m-0">Team</h2>
          <p className="m-0 mt-1 text-xs text-zinc-400">Manage users and team accounts connected to the active campaign workspace.</p>
        </div>

        <button
          onClick={() => fetchUsers({ force: true })}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#c4b5fd]' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Users</p>
              <p className="m-0 mt-1.5 truncate text-2xl font-bold leading-none text-zinc-100 sm:text-3xl">{totals.users}</p>
            </div>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#7831d6]/20 text-[#c4b5fd]">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="m-0 mt-2 truncate text-xs font-medium text-zinc-500">Workspace members</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Connected Accounts</p>
              <p className="m-0 mt-1.5 truncate text-2xl font-bold leading-none text-zinc-100 sm:text-3xl">{totals.connectedAccounts}</p>
            </div>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Shield className="h-4 w-4" />
            </span>
          </div>
          <p className="m-0 mt-2 truncate text-xs font-medium text-zinc-500">Active social channels</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Failed Posts</p>
              <p className="m-0 mt-1.5 truncate text-2xl font-bold leading-none text-zinc-100 sm:text-3xl">{totals.failedPosts}</p>
            </div>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="m-0 mt-2 truncate text-xs font-medium text-zinc-500">Publishing failures</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Media Assets</p>
              <p className="m-0 mt-1.5 truncate text-2xl font-bold leading-none text-zinc-100 sm:text-3xl">{totals.media}</p>
            </div>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <UserCog className="h-4 w-4" />
            </span>
          </div>
          <p className="m-0 mt-2 truncate text-xs font-medium text-zinc-500">Campaign media uploads</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar & Search/Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="h-9 w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-8 text-xs font-medium text-white placeholder:text-zinc-500 outline-none focus:border-white/30 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <select
              id="filter-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-white/10 bg-black/40 pl-8 pr-8 text-xs font-semibold text-zinc-200 outline-none focus:border-white/30 cursor-pointer transition"
            >
              <option value="all" className="bg-[#141417] text-zinc-100">All Roles</option>
              <option value="owner" className="bg-[#141417] text-zinc-100">Owner</option>
              <option value="account_handler" className="bg-[#141417] text-zinc-100">Account Handler</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">▾</span>
          </div>

          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'}
          </span>

          {(searchQuery || roleFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
              }}
              className="text-xs font-semibold text-[#c4b5fd] hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-white/[0.04] border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            <tr>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Workspace Activity</th>
              <th className="py-3 px-4">Health & Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-xs text-zinc-400">
                  <div className="inline-flex items-center gap-2.5">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7831d6] border-t-transparent" />
                    <span>Loading team access...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-xs text-zinc-400">
                  No users found for this campaign.
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-xs text-zinc-400">
                  No users match the search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((item) => {
                const health = tokenStatus(item.accountHealth);
                const isSelf = item._id === user?._id;
                const campaignRole = item.campaignRole || 'account_handler';
                const canPreviewHandler = campaignRole === 'account_handler' && item.userType === 'account_handler';

                return (
                  <tr key={item._id} className="hover:bg-white/[0.02] transition">
                    {/* Member */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 shrink-0">
                          {item.avatar ? (
                            <img
                              src={item.avatar}
                              alt=""
                              className="h-9 w-9 rounded-full border border-white/10 object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  e.currentTarget.nextElementSibling.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className="h-9 w-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-zinc-400"
                            style={{ display: item.avatar ? 'none' : 'flex' }}
                          >
                            <User className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-zinc-100">
                              {item.name || 'User'}
                            </span>
                            {isSelf && (
                              <span className="rounded border border-[#7831d6]/40 bg-[#7831d6]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#c4b5fd]">
                                You
                              </span>
                            )}
                          </div>
                          <p className="m-0 mt-0.5 truncate text-xs text-zinc-400">{item.email}</p>
                          <p className="m-0 mt-0.5 text-[10px] text-zinc-500">
                            Joined {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'unknown'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${roleStyles[campaignRole] || roleStyles.account_handler}`}>
                        {roleLabels[campaignRole] || roleLabels.account_handler}
                      </span>
                    </td>

                    {/* Workspace Activity */}
                    <td className="py-3.5 px-4">
                      <p className="m-0 font-medium text-zinc-200">
                        {item.metrics?.connectedAccounts || 0}/{item.metrics?.accounts || 0} accounts connected
                      </p>
                      <p className="m-0 mt-1 text-zinc-400">
                        {item.metrics?.scheduledPosts || 0} scheduled · {item.metrics?.publishedPosts || 0} published
                      </p>
                      <p className="m-0 mt-1 text-zinc-500">
                        {item.metrics?.media || 0} media ({formatBytes(item.metrics?.storageBytes)})
                      </p>
                    </td>

                    {/* Health & Status */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <p className={`m-0 font-semibold ${health.className}`}>{health.label}</p>
                        <p className="m-0 text-zinc-400 truncate max-w-xs">
                          {(item.accountHealth?.platforms || []).length > 0
                            ? item.accountHealth.platforms.join(', ')
                            : 'No connected platforms'}
                        </p>
                        {(item.metrics?.failedPosts || 0) > 0 && (
                          <p className="m-0 font-semibold text-rose-400">
                            {item.metrics.failedPosts} failed posts
                          </p>
                        )}
                        {(item.accountHealth?.tokenRefreshErrors || []).length > 0 && (
                          <p className="m-0 truncate text-rose-400 max-w-xs" title={item.accountHealth.tokenRefreshErrors[0]}>
                            {item.accountHealth.tokenRefreshErrors[0]}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      {canPreviewHandler && (
                        <button
                          type="button"
                          onClick={() => openUserView(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-[#7831d6]/40 hover:bg-[#7831d6]/15 hover:text-[#c4b5fd] shadow-xs active:scale-95"
                          title="Preview dashboard as this creator"
                        >
                          <span>Preview</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
