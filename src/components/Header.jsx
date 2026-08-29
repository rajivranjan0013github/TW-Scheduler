import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChevronDown, Check, Globe, X } from 'lucide-react';
import { withCampaignScope } from '../utils/campaignScope';
import PlatformIcon from './PlatformIcon';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';

export const Header = ({ selectedAccounts, setSelectedAccounts }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [viewContextVersion, setViewContextVersion] = useState(0);
  const storedAdminView = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const adminViewChannel = (location.state?.fromAdmin ? location.state.channel : null) || storedAdminView?.channel || null;
  const adminViewUserId = adminViewChannel?.user?._id || adminViewChannel?.userId?._id || adminViewChannel?.userId || storedAdminView?.userId || '';
  const isAdminViewingUser = Boolean(adminViewUserId);
  const displayedUserName = isAdminViewingUser
    ? (storedAdminView?.userName || adminViewChannel?.user?.name || adminViewChannel?.userId?.name || 'Selected user')
    : user?.name;
  const displayedUserEmail = isAdminViewingUser
    ? (storedAdminView?.userEmail || adminViewChannel?.user?.email || adminViewChannel?.userId?.email || '')
    : user?.email;
  const displayedAvatar = isAdminViewingUser
    ? (adminViewChannel?.avatarUrl || user?.avatar)
    : user?.avatar;

  useEffect(() => {
    fetchAccounts();
  }, [adminViewChannel?._id, adminViewUserId]);

  const fetchAccounts = async () => {
    try {
      const headers = withHandlerPreviewHeaders({
        'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
      });
      const accountQuery = withCampaignScope(adminViewUserId ? `userId=${adminViewUserId}` : '');
      const response = await fetch(
        `${API_BASE_URL}/api/accounts${accountQuery}`,
        { headers }
      );
      if (response.ok) {
        const data = await response.json();
        const visibleAccounts = data;
        const nextAccounts = visibleAccounts.length > 0 ? visibleAccounts : (adminViewChannel ? [adminViewChannel] : []);

        setAccounts(nextAccounts);
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
      console.error('Failed to load accounts in header:', error);
    }
  };

  const toggleAccountSelection = (accId) => {
    if (selectedAccounts.includes(accId)) {
      setSelectedAccounts(selectedAccounts.filter(id => id !== accId));
    } else {
      setSelectedAccounts([...selectedAccounts, accId]);
    }
  };

  const selectAllAccounts = () => {
    setSelectedAccounts(accounts.map(acc => acc._id));
  };

  const clearAllAccounts = () => {
    setSelectedAccounts([]);
  };

  const exitAdminUserView = () => {
    sessionStorage.removeItem('admin_view_context');
    window.dispatchEvent(new CustomEvent('handler-preview-changed'));
    setSelectedAccounts([]);
    setViewContextVersion(version => version + 1);
    navigate('/', { replace: true, state: {} });
  };

  // Header component helper logic

  return (
    <header className="h-14 border-b border-white/[0.08] bg-[#0c0c0e]/80 backdrop-blur-xl px-4 flex items-center justify-between sticky top-0 z-30 text-white">

      {/* Social Account Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowAccountDropdown(!showAccountDropdown);
          }}
          className="flex items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] px-3.5 py-1.5 text-xs font-medium text-white transition-all"
        >
          <Globe className="w-3.5 h-3.5 text-zinc-300" />
          <span>Channels ({selectedAccounts.length})</span>
          <ChevronDown className="w-3 h-3 opacity-50 text-white" />
        </button>

        {showAccountDropdown && (
          <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#141417]/95 backdrop-blur-xl shadow-2xl p-3 z-50 animate-in fade-in duration-150 text-white">
            <div className="flex justify-between items-center pb-2 border-b border-white/[0.08] mb-2">
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.16em]">
                {adminViewChannel ? `${adminViewChannel.user?.name || adminViewChannel.userId?.name || 'User'} Channels` : 'Channel Filter'}
              </span>
              <div className="flex gap-2 text-[10px]">
                <button onClick={selectAllAccounts} className="text-zinc-400 hover:text-white transition-colors">All</button>
                <span className="text-zinc-600">|</span>
                <button onClick={clearAllAccounts} className="text-zinc-400 hover:text-white transition-colors">Clear</button>
              </div>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
              {accounts.map(acc => (
                <div
                  key={acc._id}
                  onClick={() => toggleAccountSelection(acc._id)}
                  className="flex items-center justify-between p-2 rounded-[10px] hover:bg-white/[0.04] cursor-pointer transition-all border border-transparent hover:border-white/[0.06]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-6 h-6 shrink-0">
                      {acc.avatarUrl ? (
                        <img
                          src={acc.avatarUrl}
                          crossOrigin="anonymous"
                          className="w-6 h-6 rounded-full object-cover border border-white/10"
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
                        className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-300 uppercase"
                        style={{ display: acc.avatarUrl ? 'none' : 'flex' }}
                      >
                        {(acc.name || acc.username || 'C').charAt(0)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white leading-tight">{acc.name}</p>
                      <p className="flex items-center gap-1 text-[9px] text-zinc-400">
                        <PlatformIcon platform={acc.platform} className="h-3 w-3" />
                        <span className="truncate">@{acc.username}</span>
                      </p>
                    </div>
                  </div>
                  {selectedAccounts.includes(acc._id) && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No publishing channels.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-4">
        {/* Profile Details */}
        {user && (
          <div className="flex items-center gap-3 border-l border-white/[0.08] pl-4">
            <div className="relative w-7 h-7 shrink-0">
              {displayedAvatar ? (
                <img
                  src={displayedAvatar}
                  crossOrigin="anonymous"
                  className="w-7 h-7 rounded-full object-cover border border-white/15"
                  alt="Avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center text-zinc-300"
                style={{ display: displayedAvatar ? 'none' : 'flex' }}
              >
                <PlatformIcon platform="default" className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-white leading-none">{displayedUserName}</p>
              {isAdminViewingUser && (
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-purple-300">
                  Manager view{displayedUserEmail ? ` · ${displayedUserEmail}` : ''}
                </p>
              )}
            </div>
            {isAdminViewingUser && (
              <button
                onClick={exitAdminUserView}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/[0.08]"
                title="Exit manager view"
              >
                <X className="h-3 w-3" />
                <span className="hidden lg:inline">Exit view</span>
              </button>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-[8px] border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
export default Header;
