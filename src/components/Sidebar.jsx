import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, Clock, FolderHeart, Link2, Settings as SettingsIcon, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const { user } = useAuth();
  const canViewAdmin = user?.role === 'owner' || user?.role === 'admin';
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
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-[#e5e5ea] flex flex-col h-screen sticky top-0 text-[#8e8e93] transition-all duration-300`}>
      
      {/* App Store Connect style header */}
      <div className="p-4 border-b border-[#e5e5ea] flex items-center justify-between bg-white h-[73px] flex-shrink-0">
        {!isCollapsed && (
          <div className="flex flex-col justify-center">
            <h1 className="text-base font-semibold text-[#1d1d1f] tracking-tight leading-none m-0">EasyPost</h1>
            <span className="text-[10px] text-[#8e8e93] font-medium tracking-wider uppercase mt-1">Publishing Hub</span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg hover:bg-[#f5f5f7] text-gray-500 active:scale-95 transition-all ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 bg-white">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-normal transition-all duration-150 ${
                isCollapsed ? 'justify-center px-0' : ''
              } ${
                isActive
                  ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold'
                  : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-[#e5e5ea] text-[10px] text-[#8e8e93] bg-white flex-shrink-0">
        {canViewAdmin && (
          <Link
            to="/admin"
            title={isCollapsed ? "Go to Admin" : undefined}
            className={`mb-4 flex items-center justify-center gap-2 rounded-lg bg-[#1d1d1f] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-black ${isCollapsed ? 'px-0' : ''}`}
          >
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
            {!isCollapsed && <span>Go to Admin</span>}
          </Link>
        )}
        {!isCollapsed && (
          <p className="m-0 leading-relaxed">
            This product is powered by{' '}
            <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1d1d1f]">
              thousandway to make
            </a>
          </p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
