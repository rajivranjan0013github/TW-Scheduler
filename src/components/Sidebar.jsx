import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Clock, FolderHeart, Link2, Settings as SettingsIcon } from 'lucide-react';

export const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Scheduled Queue', path: '/scheduler', icon: Clock },
    { name: 'Media Library', path: '/media', icon: FolderHeart },
    { name: 'Connected Channels', path: '/channels', icon: Link2 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#e5e5ea] flex flex-col h-screen sticky top-0 text-[#8e8e93]">
      
      {/* App Store Connect style header */}
      <div className="p-6 border-b border-[#e5e5ea] flex flex-col justify-center bg-white">
        <h1 className="text-base font-semibold text-[#1d1d1f] tracking-tight leading-none m-0">EasyPost</h1>
        <span className="text-[10px] text-[#8e8e93] font-medium tracking-wider uppercase mt-1">Publishing Hub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 bg-white">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-normal transition-all duration-150 ${
                isActive
                  ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold'
                  : 'text-[#8e8e93] hover:bg-[#f5f5f7]/50 hover:text-[#1d1d1f]'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-6 border-t border-[#e5e5ea] text-[10px] text-[#8e8e93] bg-white">
        <p className="m-0">
          This product is powered by{' '}
          <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1d1d1f]">
            thousandway to make
          </a>
        </p>
      </div>
    </aside>
  );
};
export default Sidebar;
