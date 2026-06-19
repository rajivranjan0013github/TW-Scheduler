import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, Clock, FolderHeart, Link2, Settings as SettingsIcon, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const { user } = useAuth();
  const canViewAdmin = user?.role === 'owner' || user?.role === 'admin';
  const adminViewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const isAdminViewingUser = canViewAdmin && Boolean(adminViewContext?.userId);
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

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Scheduled Queue', path: '/scheduler', icon: Clock },
    { name: 'Media Library', path: '/media', icon: FolderHeart },
    { name: 'Connected Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} ${isAdminViewingUser ? 'bg-[#111827] border-black/10 text-[#cbd5e1]' : 'bg-white border-[#e5e5ea] text-[#8e8e93]'} border-r flex flex-col h-screen sticky top-0 transition-all duration-300`}>
      
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
      <nav className={`flex-1 p-4 space-y-1 ${isAdminViewingUser ? 'bg-[#111827]' : 'bg-white'}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-normal transition-all duration-150 ${
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
      </nav>

      {/* Sidebar Footer */}
      <div className={`p-4 border-t text-[10px] flex-shrink-0 ${isAdminViewingUser ? 'border-white/10 bg-[#111827] text-[#9ca3af]' : 'border-[#e5e5ea] bg-white text-[#8e8e93]'}`}>
        {canViewAdmin && (
          <Link
            to="/admin"
            title={isCollapsed ? "Go to Admin" : undefined}
            className={`mb-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition ${isCollapsed ? 'px-0' : ''} ${isAdminViewingUser ? 'bg-white text-[#111827] hover:bg-[#f3f4f6]' : 'bg-[#1d1d1f] text-white hover:bg-black'}`}
          >
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
            {!isCollapsed && <span>Go to Admin</span>}
          </Link>
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
