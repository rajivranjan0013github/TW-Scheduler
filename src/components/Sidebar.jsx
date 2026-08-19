import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Clock, FolderHeart, Film, Layers, Link2, Settings as SettingsIcon, X, Megaphone, Users, BarChart3, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PwaInstallButton } from './PwaInstallButton';
import { withCampaignScope } from '../utils/campaignScope';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';

export const Sidebar = ({ selectedAccounts = [], setSelectedAccounts = () => {} }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const campaignMenuRef = useRef(null);
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const [isCampaignMenuOpen, setIsCampaignMenuOpen] = useState(false);
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

  const selectCampaign = (campaign) => {
    if (!campaign || campaign._id === activeCampaignId) {
      setIsCampaignMenuOpen(false);
      return;
    }

    applyCampaign(campaigns, campaign._id);
    setSelectedAccounts([]);
    setIsCampaignMenuOpen(false);
    queryClient.invalidateQueries();
    window.dispatchEvent(new CustomEvent('campaign-selected', {
      detail: {
        campaignId: campaign._id,
        campaignName: campaign.name || '',
        mainEmail: campaign.mainEmail || campaign.createdBy?.email || '',
      },
    }));
    navigate('/scheduler');
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
          }
        } else {
          setCampaigns([]);
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

  useEffect(() => {
    if (!isCampaignMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (campaignMenuRef.current && !campaignMenuRef.current.contains(event.target)) {
        setIsCampaignMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCampaignMenuOpen]);

  const exitAdminUserView = () => {
    sessionStorage.removeItem('admin_view_context');
    window.dispatchEvent(new CustomEvent('handler-preview-changed'));
    setSelectedAccounts([]);
    navigate('/', { replace: true, state: {} });
  };

  const isCreator = user?.userType === 'account_handler';

  const navItems = isCreator ? [
    { name: 'My Campaigns', label: 'Campaigns', path: '/campaigns', icon: Megaphone },
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
  const activeCampaign = campaigns.find(campaign => campaign._id === activeCampaignId);
  const campaignTitle = activeCampaign?.name || (isAdminViewingUser ? (adminViewContext.userName || 'Campaign View') : 'Select campaign');

  return (
    <aside className={`relative z-50 w-20 overflow-visible ${
      isAdminViewingUser
        ? 'bg-gradient-to-b from-[#0f1d38] via-[#091122] to-[#050811] text-zinc-300 border-white/[0.08]'
        : 'bg-gradient-to-b from-[#130b22] via-[#09060e] to-[#040306] text-zinc-400 border-white/[0.08]'
    } hidden border-r md:flex flex-col h-screen sticky top-0 transition-all duration-300 shadow-[1px_0_30px_rgba(120,49,214,0.07)] backdrop-blur-xl`}>
      
      {/* Workspace header */}
      <div className="relative flex min-h-[56px] flex-shrink-0 items-center justify-center border-b border-white/[0.08] px-2 py-2">
        {isCreator ? (
          <div
            className="flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white shadow-inner"
            title="Creator Hub"
          >
            <Megaphone className="h-5 w-5 text-[#9d5ce6]" />
            <span className="max-w-full truncate text-[10px] font-semibold leading-none">Home</span>
          </div>
        ) : (
          <div ref={campaignMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsCampaignMenuOpen((current) => !current)}
                className={`group flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all duration-200 ${
                  isAdminViewingUser
                    ? 'border-white/10 bg-white/[0.06] hover:bg-white/[0.12] text-white'
                    : 'border-white/[0.08] bg-white/[0.04] hover:border-[#7831d6]/60 hover:bg-white/[0.08] hover:shadow-[0_0_15px_rgba(120,49,214,0.25)] text-white'
                }`}
                title={campaignTitle}
              >
                <Megaphone className="h-5 w-5 text-[#9d5ce6] transition-transform group-hover:scale-110" />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none text-zinc-300">
                  {campaignTitle}
                </span>
                <ChevronDown className={`absolute bottom-1 right-1 h-3 w-3 transition-transform text-zinc-400 ${isCampaignMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCampaignMenuOpen && (
                <div className="absolute left-[calc(100%+0.75rem)] top-0 z-[999] w-72 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0717]/95 backdrop-blur-2xl text-white shadow-2xl shadow-black/90 ring-1 ring-white/10">
                  <div className="border-b border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
                    <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-[#c4b5fd]">
                      Switch campaign
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                    {campaigns.length > 0 ? campaigns.map((campaign) => {
                      const isSelected = campaign._id === activeCampaignId;
                      return (
                        <button
                          key={campaign._id}
                          type="button"
                          onClick={() => selectCampaign(campaign)}
                          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all ${
                            isSelected
                              ? 'bg-[#7831d6] text-white shadow-md shadow-[#7831d6]/30 font-semibold'
                              : 'text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${isSelected ? 'bg-white shadow-[0_0_6px_#fff]' : 'bg-zinc-600'}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs">{campaign.name || 'Untitled campaign'}</span>
                            {(campaign.mainEmail || campaign.createdBy?.email) && (
                              <span className={`mt-0.5 block truncate text-[9px] ${isSelected ? 'text-inherit opacity-80' : 'text-zinc-400'}`}>
                                {campaign.mainEmail || campaign.createdBy?.email}
                              </span>
                            )}
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                        </button>
                      );
                    }) : (
                      <div className="px-2 py-4 text-center text-[10px] text-zinc-400">
                        No campaigns available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-2 scrollbar-none">
        {navItems.map((item) => (
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

        {managerItems.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-white/[0.08] space-y-1.5">
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
      <div className="relative flex-shrink-0 space-y-2 border-t border-white/[0.08] p-2 text-[10px]">
        <PwaInstallButton
          collapsed
          dark={true}
          className="flex justify-center"
          popoverClassName="left-0"
        />

        <div className="flex items-center justify-center rounded-xl p-1 bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.15] transition-all">
            <button
              type="button"
              onClick={logout}
              className="rounded-full transition hover:opacity-80 hover:scale-105"
              title={`Logout ${displayedUserEmail || user?.email || ''}`.trim()}
            >
              <img
                src={displayedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                crossOrigin="anonymous"
                className="h-6 w-6 rounded-full object-cover border border-white/20 shadow-sm"
                alt=""
              />
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
