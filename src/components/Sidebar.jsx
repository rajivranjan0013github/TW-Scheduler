import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Clock, FolderHeart, Film, Link2, Settings as SettingsIcon, ShieldCheck, ChevronLeft, ChevronRight, Globe, Check, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ selectedAccounts = [], setSelectedAccounts = () => {} }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
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

  const fetchAccounts = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
      };
      const response = await fetch(
        adminViewUserId ? `http://localhost:5001/api/accounts?userId=${adminViewUserId}` : 'http://localhost:5001/api/accounts',
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        const nextAccounts = data.length > 0 ? data : (adminViewChannel ? [adminViewChannel] : []);
        setAccounts(nextAccounts);

        if (adminViewUserId) {
          setSelectedAccounts(nextAccounts.map(acc => acc._id));
        } else {
          const nextAccountIds = nextAccounts.map(acc => acc._id);
          const hasOutsideSelection = selectedAccounts.some(id => !nextAccountIds.includes(id));
          if (selectedAccounts.length === 0 || hasOutsideSelection) {
            setSelectedAccounts(nextAccountIds);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load accounts in sidebar:', error);
    }
  };

  useEffect(() => {
    // Load account filters when the viewed workspace changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminViewChannel?._id, adminViewUserId]);

  const toggleAccountSelection = (accountId) => {
    setSelectedAccounts((current) => (
      current.includes(accountId)
        ? current.filter(id => id !== accountId)
        : [...current, accountId]
    ));
  };

  const selectAllAccounts = () => {
    setSelectedAccounts(accounts.map(acc => acc._id));
  };

  const clearAllAccounts = () => {
    setSelectedAccounts([]);
  };

  const exitAdminUserView = () => {
    sessionStorage.removeItem('admin_view_context');
    setSelectedAccounts([]);
    navigate('/', { replace: true, state: {} });
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Scheduled Queue', path: '/scheduler', icon: Clock },
    { name: 'Media Library', path: '/media', icon: FolderHeart },
    { name: 'Video Editor', path: '/media/editor', icon: Film },
    { name: 'Connected Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-52'} ${isAdminViewingUser ? 'bg-[#111827] border-black/10 text-[#cbd5e1]' : 'bg-white border-[#e5e5ea] text-[#8e8e93]'} border-r flex flex-col h-screen sticky top-0 transition-all duration-300`}>
      
      {/* App Store Connect style header */}
      <div className={`p-4 border-b flex items-center justify-between h-[73px] flex-shrink-0 ${isAdminViewingUser ? 'border-white/10 bg-[#111827]' : 'border-[#e5e5ea] bg-white'}`}>
        {!isCollapsed && (
          <div className="flex flex-col justify-center">
            <h1 className={`text-base font-semibold tracking-tight leading-none m-0 ${isAdminViewingUser ? 'text-white' : 'text-[#1d1d1f]'}`} style={isAdminViewingUser ? { color: '#ffffff' } : undefined}>
              {isAdminViewingUser ? (adminViewContext.userName || 'User Workspace') : 'EasyPost'}
            </h1>
            <span className={`text-[10px] font-medium tracking-wider uppercase mt-1 ${isAdminViewingUser ? 'text-[#93c5fd]' : 'text-[#8e8e93]'}`}>
              {isAdminViewingUser ? 'Admin viewing user' : 'Publishing Hub'}
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg active:scale-95 transition-all ${isCollapsed ? 'mx-auto' : ''} ${isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-[#f5f5f7]'}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 p-2.5 space-y-1 overflow-y-auto ${isAdminViewingUser ? 'bg-[#111827]' : 'bg-white'}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-normal transition-all duration-150 ${
                isCollapsed ? 'justify-center px-0' : ''
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

        <div className={`mt-3 pt-3 border-t ${isAdminViewingUser ? 'border-white/10' : 'border-[#e5e5ea]'}`}>
          <div
            title={isCollapsed ? `Accounts (${selectedAccounts.length})` : undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${isCollapsed ? 'justify-center px-0' : ''} ${isAdminViewingUser ? 'text-[#cbd5e1]' : 'text-[#1d1d1f]'}`}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1">Accounts</span>
                <span className={`text-[10px] rounded px-1.5 py-0.5 ${isAdminViewingUser ? 'bg-white/10 text-[#cbd5e1]' : 'bg-[#f5f5f7] text-[#6e6e73]'}`}>
                  {selectedAccounts.length}
                </span>
              </>
            )}
          </div>

          {!isCollapsed && (
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between px-3 pb-1 text-[10px]">
                <button type="button" onClick={selectAllAccounts} className={`${isAdminViewingUser ? 'text-[#93c5fd] hover:text-white' : 'text-[#0071e3] hover:text-[#147ce5]'} font-semibold`}>
                  All
                </button>
                <button type="button" onClick={clearAllAccounts} className={`${isAdminViewingUser ? 'text-[#9ca3af] hover:text-white' : 'text-[#8e8e93] hover:text-[#1d1d1f]'} font-semibold`}>
                  Clear
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                {accounts.map(account => {
                  const isSelected = selectedAccounts.includes(account._id);
                  return (
                    <button
                      key={account._id}
                      type="button"
                      onClick={() => toggleAccountSelection(account._id)}
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                        isSelected
                          ? (isAdminViewingUser ? 'bg-white text-[#111827]' : 'bg-[#f5f5f7] text-[#1d1d1f]')
                          : (isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]')
                      }`}
                    >
                      <img src={account.avatarUrl} crossOrigin="anonymous" className="w-5 h-5 rounded-full object-cover border border-black/10 flex-shrink-0" alt="" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold">{account.name}</span>
                        <span className="block truncate text-[9px] opacity-70 capitalize">{account.platform}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0071e3] flex-shrink-0" />}
                    </button>
                  );
                })}

                {accounts.length === 0 && (
                  <p className={`px-3 py-2 text-[10px] ${isAdminViewingUser ? 'text-[#9ca3af]' : 'text-[#8e8e93]'}`}>No connected accounts.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className={`p-3 border-t text-[10px] flex-shrink-0 ${isAdminViewingUser ? 'border-white/10 bg-[#111827] text-[#9ca3af]' : 'border-[#e5e5ea] bg-white text-[#8e8e93]'}`}>
        {canViewAdmin && (
          <Link
            to="/admin"
            title={isCollapsed ? "Go to Admin" : undefined}
            className={`mb-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${isCollapsed ? 'px-0' : ''} ${isAdminViewingUser ? 'bg-white text-[#111827] hover:bg-[#f3f4f6]' : 'bg-[#1d1d1f] text-white hover:bg-black'}`}
          >
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
            {!isCollapsed && <span>Go to Admin</span>}
          </Link>
        )}
        <div className={`mb-3 flex items-center gap-2 rounded-lg ${isCollapsed ? 'justify-center p-0' : 'p-2'} ${isAdminViewingUser ? 'bg-white/5' : 'bg-[#f5f5f7]'}`}>
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
                className="h-7 w-7 rounded-full object-cover border border-black/10"
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
                className={`p-1.5 rounded-lg transition ${isAdminViewingUser ? 'text-[#cbd5e1] hover:bg-white/10 hover:text-white' : 'text-[#8e8e93] hover:bg-white hover:text-[#0071e3]'}`}
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
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit user view</span>
          </button>
        )}

        {!isCollapsed && (
          <p className="m-0 leading-relaxed">
            {isAdminViewingUser ? (
              <>Viewing {adminViewContext.userEmail || 'another user'} as admin.</>
            ) : (
              <>
                This product is powered by{' '}
                <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1d1d1f]">
                  thousandway to make
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
