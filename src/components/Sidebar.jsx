import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Clock, FolderHeart, Film, Layers, Link2, Settings as SettingsIcon, X, Megaphone, Users, BarChart3, CalendarPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PwaInstallButton } from './PwaInstallButton';
import { withCampaignScope } from '../utils/campaignScope';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';

export const Sidebar = ({ selectedAccounts = [], setSelectedAccounts = () => {} }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const canViewAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isChannelInsightRoute = /^\/channels\/[^/]+\/(feed|posts\/)/.test(location.pathname);
  const rawAdminViewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const adminViewContext = isChannelInsightRoute ? null : rawAdminViewContext;
  const isAdminViewingUser = Boolean(adminViewContext?.userId);
  const adminViewChannel = (!isChannelInsightRoute && location.state?.fromAdmin ? location.state.channel : null) || adminViewContext?.channel || null;
  const adminViewUserId = adminViewChannel?.user?._id || adminViewChannel?.userId?._id || adminViewChannel?.userId || adminViewContext?.userId || '';
  const displayedUserEmail = isAdminViewingUser
    ? (adminViewContext?.userEmail || adminViewChannel?.user?.email || adminViewChannel?.userId?.email || '')
    : user?.email;
  const displayedAvatar = isAdminViewingUser
    ? (adminViewChannel?.avatarUrl || user?.avatar)
    : user?.avatar;
  const campaignStorageKey = `active-campaign-id:${adminViewUserId || user?._id || user?.email || 'default'}`;
  const getPreferredCampaignId = () => (
    localStorage.getItem(campaignStorageKey) ||
    localStorage.getItem('active-campaign-id') ||
    activeCampaignId
  );

  const applyCampaign = (campaignList, preferredCampaignId = getPreferredCampaignId()) => {
    const nextCampaign = campaignList.find(campaign => campaign._id === preferredCampaignId) || campaignList[0] || null;
    const nextCampaignId = nextCampaign?._id || '';

    setActiveCampaignId(nextCampaignId);
    if (nextCampaignId) {
      localStorage.setItem(campaignStorageKey, nextCampaignId);
      localStorage.setItem('active-campaign-id', nextCampaignId);
      localStorage.setItem('active-campaign-name', nextCampaign?.name || '');
      localStorage.setItem('active-campaign-main-email', nextCampaign?.mainEmail || nextCampaign?.createdBy?.email || '');
    } else {
      localStorage.removeItem(campaignStorageKey);
      localStorage.removeItem('active-campaign-id');
      localStorage.removeItem('active-campaign-name');
      localStorage.removeItem('active-campaign-main-email');
    }
    return nextCampaign;
  };

  useEffect(() => {
    const fetchCampaignWorkspace = async () => {
      try {
        const headers = withHandlerPreviewHeaders({
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        });
        if (canViewAdmin && !adminViewUserId) {
          const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/list?scope=workspace`, { headers });
          if (response.ok) {
            const data = await response.json();
            setCampaigns(data);
            applyCampaign(data, getPreferredCampaignId());
            return;
          }
        }

        const campaignResponse = await fetch(
          adminViewUserId ? `${API_BASE_URL}/api/accounts/campaigns?userId=${adminViewUserId}` : `${API_BASE_URL}/api/accounts/campaigns`,
          { headers }
        );

        if (campaignResponse.ok) {
          const campaignData = await campaignResponse.json();
          setCampaigns(campaignData);
          if (campaignData.length > 0) {
            applyCampaign(campaignData, getPreferredCampaignId());
            return;
          } else {
            applyCampaign([], '');
          }
        } else {
          setCampaigns([]);
          applyCampaign([], '');
        }

        const accountQuery = withCampaignScope(adminViewUserId ? `userId=${adminViewUserId}` : '');
        const response = await fetch(
          `${API_BASE_URL}/api/accounts${accountQuery}`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          const nextAccounts = data.length > 0 ? data : (adminViewChannel ? [adminViewChannel] : []);

          if (adminViewUserId) {
            setSelectedAccounts(nextAccounts.map(acc => acc._id));
          } else {
            const nextAccountIds = nextAccounts.map(acc => acc._id);
            const hasOutsideSelection = selectedAccounts.some(id => !nextAccountIds.includes(id));
            const hasNewAccounts = nextAccountIds.some(id => !selectedAccounts.includes(id));
            if (selectedAccounts.length === 0 || hasOutsideSelection || hasNewAccounts) {
              setSelectedAccounts(nextAccountIds);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load campaign workspace in sidebar:', error);
      }
    };

    // Load campaign publishing channels when the viewed workspace changes.
    if (user?.userType !== 'account_handler') {
      fetchCampaignWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminViewChannel?._id, adminViewUserId, user?.userType]);

  useEffect(() => {
    const syncSelectedCampaign = (event) => {
      if (event.detail?.campaignId) {
        setActiveCampaignId(event.detail.campaignId);
      }
    };

    window.addEventListener('campaign-selected', syncSelectedCampaign);
    return () => window.removeEventListener('campaign-selected', syncSelectedCampaign);
  }, []);

  const exitAdminUserView = () => {
    sessionStorage.removeItem('admin_view_context');
    window.dispatchEvent(new CustomEvent('handler-preview-changed'));
    setSelectedAccounts([]);
    navigate('/', { replace: true, state: {} });
  };

  const isCreator = user?.userType === 'account_handler';

  const navItems = isCreator ? [
    { name: 'My Campaigns', label: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { name: 'Schedule Post', label: 'Schedule', path: '/schedule', icon: CalendarPlus },
    { name: 'Analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'My Channels', label: 'Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
  ] : [
    { name: 'Campaigns', label: 'Campaigns', path: '/campaigns', icon: Megaphone },
    ...(canViewAdmin ? [{ name: 'Performance', label: 'Perf', path: '/dashboard', icon: BarChart3 }] : []),
    { name: 'Scheduled Queue', label: 'Queue', path: '/scheduler', icon: Clock },
    { name: 'Media Library', label: 'Media', path: '/media', icon: FolderHeart },
    { name: 'Timeline Editor', label: 'Editor', path: '/media/editor', icon: Film },
    { name: 'Bulk Builder', label: 'Bulk', path: '/media/bulk-builder', icon: Layers },
    { name: 'Publishing Channels', label: 'Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const managerItems = (!isCreator && canViewAdmin) ? [
    { name: 'Campaign Setup', label: 'Setup', path: '/admin/campaign', icon: Megaphone },
    { name: 'Team Access', label: 'Team', path: '/admin/users', icon: Users },
  ] : [];

  return (
    <aside className={`relative z-50 w-20 ${
      isAdminViewingUser
        ? 'bg-[#0e121a] text-zinc-300'
        : 'bg-[#0e0e11] text-zinc-400'
    } hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 backdrop-blur-xl border-none`}>
      
      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-2 scrollbar-none">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            title={item.name}
            className={({ isActive }) =>
              `flex h-12 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-sm scale-[1.02]'
                  : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white hover:scale-[1.02]'
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0 transition-transform" />
            <span className="max-w-full truncate text-[10px] font-semibold leading-none">
              {item.label}
            </span>
          </NavLink>
        ))}

        {managerItems.length > 0 && (
          <div className="mt-2.5 pt-2 space-y-1.5">
            {managerItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end
                title={item.name}
                className={({ isActive }) =>
                  `flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-b from-[#8a3ff2] to-[#6d24cf] text-white font-semibold shadow-[0_0_18px_rgba(120,49,214,0.45)] ring-1 ring-white/20 scale-[1.02]'
                      : 'text-zinc-400 hover:bg-white/[0.08] hover:text-white hover:scale-[1.02]'
                  }`
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0 transition-transform" />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none">
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        )}

      </nav>

      {/* Sidebar Footer */}
      <div className="relative flex-shrink-0 space-y-2 p-2 text-[10px]">
        <PwaInstallButton
          collapsed
          dark={true}
          className="flex justify-center"
          popoverClassName="left-0"
        />

        <div className="flex items-center justify-center rounded-xl p-1 bg-white/[0.04] transition-all">
            <button
              type="button"
              onClick={logout}
              className="relative h-6 w-6 rounded-full transition hover:opacity-80 hover:scale-105"
              title={`Logout ${displayedUserEmail || user?.email || ''}`.trim()}
            >
              {displayedAvatar ? (
                <img
                  src={displayedAvatar}
                  crossOrigin="anonymous"
                  className="h-6 w-6 rounded-full object-cover border border-white/20 shadow-sm"
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="h-6 w-6 rounded-full bg-white/[0.06] border border-white/20 flex items-center justify-center text-zinc-300 text-[10px] font-bold"
                style={{ display: displayedAvatar ? 'none' : 'flex' }}
              >
                {(displayedUserEmail || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            </button>
        </div>

        {isAdminViewingUser && (
          <button
            type="button"
            onClick={exitAdminUserView}
            title="Exit manager view"
            className="flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
