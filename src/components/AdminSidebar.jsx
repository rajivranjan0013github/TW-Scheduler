import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, BarChart3, Megaphone, ShieldCheck, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/admin', icon: BarChart3 },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Campaign', path: '/admin/campaign', icon: Megaphone },
];

export const AdminSidebar = () => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('admin-sidebar-collapsed', String(newVal));
      return newVal;
    });
  };

  const exitAdminUserView = () => {
    sessionStorage.removeItem('admin_view_context');
  };

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-[#111827] border-r border-black/10 flex flex-col h-screen sticky top-0 text-[#cbd5e1] transition-all duration-300`}>
      <div className="p-4 border-b border-white/10 h-[73px] flex items-center justify-between flex-shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#3478f6]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-none m-0 !text-white">Admin Panel</h1>
              <span className="text-[10px] text-[#9ca3af] font-semibold tracking-wider uppercase mt-1 block">EasyPost control</span>
            </div>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg hover:bg-white/10 text-[#cbd5e1] hover:text-white active:scale-95 transition-all ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          item.disabled ? (
            <div
              key={item.name}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm text-[#6b7280] cursor-not-allowed ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </div>
              {!isCollapsed && <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6b7280]">Soon</span>}
            </div>
          ) : (
            <NavLink
              key={item.name}
              to={item.path}
              end
              title={isCollapsed ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-150 ${
                  isCollapsed ? 'justify-center px-0' : ''
                } ${
                  isActive
                    ? 'bg-white text-[#111827] font-semibold'
                    : 'text-[#cbd5e1] hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </NavLink>
          )
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 flex-shrink-0">
        {!isCollapsed && (
          <div className="mb-3 rounded-lg bg-white/5 p-3">
            <p className="m-0 text-xs font-semibold text-white truncate">{user?.name || 'Admin'}</p>
            <p className="m-0 mt-1 text-[10px] text-[#9ca3af] truncate">{user?.email}</p>
            <p className="m-0 mt-2 text-[10px] font-semibold uppercase tracking-wider text-[#93c5fd]">{user?.role}</p>
          </div>
        )}

        <Link
          to="/"
          onClick={exitAdminUserView}
          title={isCollapsed ? "Back to App" : undefined}
          className={`flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-[#111827] transition hover:bg-[#f3f4f6] ${isCollapsed ? 'px-0' : ''}`}
        >
          <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" />
          {!isCollapsed && <span>Back to App</span>}
        </Link>
      </div>
    </aside>
  );
};

export default AdminSidebar;
