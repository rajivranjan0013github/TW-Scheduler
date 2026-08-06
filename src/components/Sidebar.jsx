import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Clock, FolderHeart, Film, Link2, Settings as SettingsIcon, X, Megaphone, Users, BarChart3, ChevronDown, Check } from 'lucide-react';
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
    { name: 'Video Editor', label: 'Editor', path: '/media/editor', icon: Film },
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
    <aside className={`relative z-50 w-20 overflow-visible ${isAdminViewingUser ? 'bg-[#111827] border-black/10 text-[#cbd5e1]' : 'bg-white border-[#e5e5ea] text-[#8e8e93]'} hidden border-r md:flex flex-col h-screen sticky top-0 transition-all duration-300`}>
      
      {/* Workspace header */}
      <div className={`relative flex min-h-[56px] flex-shrink-0 items-center justify-center border-b px-2 py-2 ${isAdminViewingUser ? 'border-white/10 bg-[#111827]' : 'border-[#e5e5ea] bg-white'}`}>
        {isCreator ? (
          <div
            className={`flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl ${isAdminViewingUser ? 'bg-white/5 text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'}`}
            title="Creator Hub"
          >
            <Megaphone className="h-5 w-5" />
            <span className="max-w-full truncate text-[10px] font-semibold leading-none">Home</span>
          </div>
        ) : (
          <div ref={campaignMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsCampaignMenuOpen((current) => !current)}
                className={`group flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition ${
                  isAdminViewingUser
                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                    : 'border-[#d2d2d7] bg-[#f5f5f7] hover:border-[#a1a1aa] hover:bg-white'
                }`}
                title={campaignTitle}
              >
                <Megaphone className={`h-5 w-5 ${isAdminViewingUser ? 'text-[#cbd5e1]' : 'text-[#0071e3]'}`} />
                <span className={`max-w-full truncate text-[10px] font-semibold leading-none ${isAdminViewingUser ? 'text-[#cbd5e1]' : 'text-[#4b5563]'}`}>
                  {campaignTitle}
                </span>
                <ChevronDown className={`absolute bottom-1 right-1 h-3 w-3 transition ${isCampaignMenuOpen ? 'rotate-180' : ''} ${isAdminViewingUser ? 'text-[#cbd5e1]' : 'text-[#4b5563]'}`} />
              </button>

              {isCampaignMenuOpen && (
                <div className={`absolute left-[calc(100%+0.75rem)] top-0 z-[999] w-72 overflow-hidden rounded-xl border shadow-2xl ring-1 ring-black/5 ${
                  isAdminViewingUser
                    ? 'border-white/10 bg-[#0f172a] text-[#cbd5e1] shadow-black/30'
                    : 'border-[#d2d2d7] bg-white text-[#1d1d1f] shadow-black/20'
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
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-1 overflow-y-auto p-2 ${isAdminViewingUser ? 'bg-[#111827]' : 'bg-white'}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            title={item.name}
            className={({ isActive }) =>
              `flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-all duration-150 ${
                isActive
                  ? (isAdminViewingUser ? 'bg-white text-[#111827] font-semibold' : 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold')
                  : (isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]')
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="max-w-full truncate text-[10px] font-semibold leading-none">
              {item.label}
            </span>
          </NavLink>
        ))}

        {managerItems.length > 0 && (
          <div className={`mt-2 pt-2 border-t ${isAdminViewingUser ? 'border-white/10' : 'border-[#e5e5ea]'}`}>
            {managerItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end
                title={item.name}
                className={({ isActive }) =>
                  `flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-all duration-150 ${
                    isActive
                      ? (isAdminViewingUser ? 'bg-white text-[#111827] font-semibold' : 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold')
                      : (isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]')
                  }`
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none">
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        )}

      </nav>

      {/* Sidebar Footer */}
      <div className={`relative flex-shrink-0 space-y-2 border-t p-2 text-[10px] ${isAdminViewingUser ? 'border-white/10 bg-[#111827] text-[#9ca3af]' : 'border-[#e5e5ea] bg-white text-[#8e8e93]'}`}>
        <PwaInstallButton
          collapsed
          dark={isAdminViewingUser}
          className="flex justify-center"
          popoverClassName="left-0"
        />

        <div className={`flex items-center justify-center rounded-xl p-1 ${isAdminViewingUser ? 'bg-white/5' : 'bg-[#f5f5f7]'}`}>
            <button
              type="button"
              onClick={logout}
              className="rounded-full transition hover:opacity-80"
              title={`Logout ${displayedUserEmail || user?.email || ''}`.trim()}
            >
              <img
                src={displayedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                crossOrigin="anonymous"
                className="h-6 w-6 rounded-full object-cover border border-black/10"
                alt=""
              />
            </button>
        </div>

        {isAdminViewingUser && (
          <button
            type="button"
            onClick={exitAdminUserView}
            title="Exit manager view"
            className="flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#cbd5e1] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
