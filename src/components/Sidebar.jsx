import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { LayoutDashboard, Clock, FolderHeart, Film, Link2, Settings as SettingsIcon, ChevronLeft, ChevronRight, X, LogOut, Megaphone, Users, BarChart3, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PwaInstallButton } from './PwaInstallButton';
import { withCampaignScope } from '../utils/campaignScope';

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
  const adminViewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const isAdminViewingUser = canViewAdmin && Boolean(adminViewContext?.userId);
  const adminViewChannel = (location.state?.fromAdmin ? location.state.channel : null) || adminViewContext?.channel || null;
  const adminViewUserId = adminViewChannel?.user?._id || adminViewChannel?.userId?._id || adminViewChannel?.userId || adminViewContext?.userId || '';
  const displayedUserName = isAdminViewingUser
    ? (adminViewContext?.userName || adminViewChannel?.user?.name || adminViewChannel?.userId?.name || 'Selected user')
    : user?.name;
  const displayedUserEmail = isAdminViewingUser
    ? (adminViewContext?.userEmail || adminViewChannel?.user?.email || adminViewChannel?.userId?.email || '')
    : user?.email;
  const displayedAvatar = isAdminViewingUser
    ? (adminViewChannel?.avatarUrl || user?.avatar)
    : user?.avatar;
  const campaignStorageKey = `active-campaign-id:${adminViewUserId || user?._id || user?.email || 'default'}`;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('sidebar-collapsed', String(newVal));
      return newVal;
    });
  };

  const applyCampaign = (campaignList, preferredCampaignId = localStorage.getItem(campaignStorageKey) || activeCampaignId) => {
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
        const headers = {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        };
        if (canViewAdmin && !adminViewUserId) {
          const response = await fetch(`${API_BASE_URL}/api/admin/campaigns?scope=workspace`, { headers });
          if (response.ok) {
            const data = await response.json();
            setCampaigns(data);
            applyCampaign(data, localStorage.getItem(campaignStorageKey) || activeCampaignId);
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
            applyCampaign(campaignData, localStorage.getItem(campaignStorageKey) || activeCampaignId);
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
    setSelectedAccounts([]);
    navigate('/', { replace: true, state: {} });
  };

  const isCreator = user?.userType === 'account_handler';

  const navItems = isCreator ? [
    { name: 'My Campaigns', path: '/campaigns', icon: Megaphone },
    { name: 'My Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ] : [
    { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Scheduled Queue', path: '/scheduler', icon: Clock },
    { name: 'Media Library', path: '/media', icon: FolderHeart },
    { name: 'Video Editor', path: '/media/editor', icon: Film },
    { name: 'Publishing Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const managerItems = (!isCreator && canViewAdmin) ? [
    { name: 'Overview', path: '/admin', icon: BarChart3 },
    { name: 'Campaign Setup', path: '/admin/campaign', icon: Megaphone },
    { name: 'Team Access', path: '/admin/users', icon: Users },
  ] : [];
  const activeCampaign = campaigns.find(campaign => campaign._id === activeCampaignId);

  return (
    <aside className={`${isCollapsed ? 'w-12' : 'w-48'} ${isAdminViewingUser ? 'bg-[#111827] border-black/10 text-[#cbd5e1]' : 'bg-white border-[#e5e5ea] text-[#8e8e93]'} hidden border-r md:flex flex-col h-screen sticky top-0 transition-all duration-300`}>
      
      {/* Workspace header */}
      <div className={`${isCollapsed ? 'min-h-[34px] px-1.5 py-1' : 'min-h-[44px] px-2 py-1.5'} border-b flex items-center justify-between flex-shrink-0 ${isAdminViewingUser ? 'border-white/10 bg-[#111827]' : 'border-[#e5e5ea] bg-white'}`}>
        {!isCollapsed && (
          isCreator ? (
            <div className="min-w-0 flex flex-col justify-center">
              <h1 className={`m-0 truncate text-sm font-semibold leading-none ${isAdminViewingUser ? 'text-white' : 'text-[#1d1d1f]'}`} style={isAdminViewingUser ? { color: '#ffffff' } : undefined}>
                Creator Hub
              </h1>
              <span className={`mt-1 text-[9px] font-semibold uppercase ${isAdminViewingUser ? 'text-[#93c5fd]' : 'text-[#6b7280]'}`}>
                My Dashboard
              </span>
            </div>
          ) : (
            <div ref={campaignMenuRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsCampaignMenuOpen((current) => !current)}
                className={`group flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left transition ${
                  isAdminViewingUser
                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                    : 'border-[#d2d2d7] bg-[#f5f5f7] hover:border-[#a1a1aa] hover:bg-white'
                }`}
                title={activeCampaign?.name || (isAdminViewingUser ? (adminViewContext.userName || 'Campaign View') : 'EasyPost')}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[8px] font-bold uppercase ${isAdminViewingUser ? 'text-[#93c5fd]' : 'text-[#0071e3]'}`}>
                    {isAdminViewingUser ? 'Manager view' : 'Campaign workspace'}
                  </span>
                  <span className={`mt-0.5 block max-h-8 overflow-hidden text-sm font-bold leading-4 ${isAdminViewingUser ? 'text-white' : 'text-[#111827]'}`}>
                    {activeCampaign?.name || (isAdminViewingUser ? (adminViewContext.userName || 'Campaign View') : 'Select campaign')}
                  </span>
                </span>
                <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition ${isCampaignMenuOpen ? 'rotate-180' : ''} ${isAdminViewingUser ? 'text-[#cbd5e1]' : 'text-[#4b5563]'}`} />
              </button>

              {isCampaignMenuOpen && (
                <div className={`absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-lg border shadow-xl ${
                  isAdminViewingUser
                    ? 'border-white/10 bg-[#0f172a] text-[#cbd5e1] shadow-black/30'
                    : 'border-[#e5e5ea] bg-white text-[#1d1d1f] shadow-black/10'
                }`}>
                  <div className={`border-b px-3 py-2 ${isAdminViewingUser ? 'border-white/10' : 'border-[#f1f5f9]'}`}>
                    <p className={`m-0 text-[9px] font-bold uppercase tracking-wider ${isAdminViewingUser ? 'text-[#93c5fd]' : 'text-[#8e8e93]'}`}>
                      Switch campaign
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1">
                    {campaigns.length > 0 ? campaigns.map((campaign) => {
                      const isSelected = campaign._id === activeCampaignId;
                      return (
                        <button
                          key={campaign._id}
                          type="button"
                          onClick={() => selectCampaign(campaign)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                            isSelected
                              ? (isAdminViewingUser ? 'bg-white text-[#111827]' : 'bg-[#f5f5f7] text-[#1d1d1f]')
                              : (isAdminViewingUser ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-[#f8fafc]')
                          }`}
                        >
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${isSelected ? 'bg-emerald-500' : (isAdminViewingUser ? 'bg-white/20' : 'bg-[#d1d5db]')}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold">{campaign.name || 'Untitled campaign'}</span>
                            {(campaign.mainEmail || campaign.createdBy?.email) && (
                              <span className={`mt-0.5 block truncate text-[9px] ${isSelected ? 'text-inherit opacity-70' : (isAdminViewingUser ? 'text-[#9ca3af]' : 'text-[#8e8e93]')}`}>
                                {campaign.mainEmail || campaign.createdBy?.email}
                              </span>
                            )}
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                        </button>
                      );
                    }) : (
                      <div className={`px-2 py-4 text-center text-[10px] ${isAdminViewingUser ? 'text-[#9ca3af]' : 'text-[#8e8e93]'}`}>
                        No campaigns available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        )}
        <button
          onClick={toggleCollapse}
          className={`${isCollapsed ? 'mx-auto' : 'ml-1'} p-1 rounded-md active:scale-95 transition-all ${isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-[#f5f5f7]'}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'p-1.5' : 'p-2'} space-y-0.5 overflow-y-auto ${isAdminViewingUser ? 'bg-[#111827]' : 'bg-white'}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md text-xs font-normal transition-all duration-150 ${
                isCollapsed ? 'h-8 justify-center px-0 py-0' : 'px-2.5 py-1.5'
              } ${
                isActive
                  ? (isAdminViewingUser ? 'bg-white text-[#111827] font-semibold' : 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold')
                  : (isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]')
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}

        {managerItems.length > 0 && (
          <div className={`mt-2 pt-2 border-t ${isAdminViewingUser ? 'border-white/10' : 'border-[#e5e5ea]'}`}>
            {!isCollapsed && (
              <p className={`m-0 px-2.5 pb-1 text-[9px] font-semibold uppercase ${isAdminViewingUser ? 'text-[#9ca3af]' : 'text-[#8e8e93]'}`}>
                Manage Campaign
              </p>
            )}
            {managerItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md text-xs font-normal transition-all duration-150 ${
                    isCollapsed ? 'h-8 justify-center px-0 py-0' : 'px-2.5 py-1.5'
                  } ${
                    isActive
                      ? (isAdminViewingUser ? 'bg-white text-[#111827] font-semibold' : 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold')
                      : (isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]')
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </NavLink>
            ))}
          </div>
        )}

      </nav>

      {/* Sidebar Footer */}
      <div className={`${isCollapsed ? 'p-1.5' : 'p-2'} relative border-t text-[10px] flex-shrink-0 ${isAdminViewingUser ? 'border-white/10 bg-[#111827] text-[#9ca3af]' : 'border-[#e5e5ea] bg-white text-[#8e8e93]'}`}>
        <PwaInstallButton
          collapsed={isCollapsed}
          dark={isAdminViewingUser}
          className={isCollapsed ? 'mb-1.5 flex justify-center' : 'mb-1.5'}
          popoverClassName={isCollapsed ? 'left-0' : 'left-0'}
        />

        <div className={`flex items-center gap-2 rounded-md ${isCollapsed ? 'justify-center p-0' : 'p-1.5'} ${isAdminViewingUser ? 'bg-white/5' : 'bg-[#f5f5f7]'}`}>
          {isCollapsed ? (
            <button
              type="button"
              onClick={logout}
              className="rounded-full transition hover:opacity-80"
              title="Logout"
            >
              <img
                src={displayedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                crossOrigin="anonymous"
                className="h-6 w-6 rounded-full object-cover border border-black/10"
                alt=""
              />
            </button>
          ) : (
            <>
              <img
                src={displayedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                crossOrigin="anonymous"
                className="h-7 w-7 rounded-full object-cover border border-black/10 flex-shrink-0"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <p className={`m-0 truncate text-xs font-semibold ${isAdminViewingUser ? 'text-white' : 'text-[#1d1d1f]'}`}>{displayedUserName || 'Account'}</p>
                <p className="m-0 mt-0.5 truncate text-[9px]">{displayedUserEmail || user?.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className={`p-1.5 rounded-md transition ${isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-white hover:text-[#0071e3]'}`}
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {isAdminViewingUser && !isCollapsed && (
          <button
            type="button"
            onClick={exitAdminUserView}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit manager view</span>
          </button>
        )}

        {isAdminViewingUser && !isCollapsed && (
          <p className="m-0 mt-2 leading-relaxed">
            Viewing {adminViewContext.userEmail || 'another user'} in manager mode.
          </p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
