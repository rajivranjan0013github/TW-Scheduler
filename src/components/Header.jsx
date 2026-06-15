import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChevronDown, Check, Globe } from 'lucide-react';

export const Header = ({ selectedAccounts, setSelectedAccounts }) => {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tw_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
        if (selectedAccounts.length === 0) {
          setSelectedAccounts(data.map(acc => acc._id));
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

  // Header component helper logic

  return (
    <header className="h-16 border-b border-[#e5e5ea] bg-white px-8 flex items-center justify-between sticky top-0 z-30 text-[#1d1d1f]">
      
      {/* Social Account Selector Dropdown */}
      <div className="relative">
        <button 
          onClick={() => {
            setShowAccountDropdown(!showAccountDropdown);
          }}
          className="flex items-center gap-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] px-3.5 py-1.5 rounded-lg text-xs font-medium border border-[#e5e5ea] transition-all text-[#1d1d1f]"
        >
          <Globe className="w-3.5 h-3.5 text-gray-500" />
          <span>Accounts ({selectedAccounts.length})</span>
          <ChevronDown className="w-3 h-3 opacity-50 text-[#1d1d1f]" />
        </button>

        {showAccountDropdown && (
          <div className="absolute left-0 mt-2 w-72 bg-white border border-[#d2d2d7] rounded-xl shadow-xl p-3 z-50 animate-in fade-in duration-150 text-[#1d1d1f]">
            <div className="flex justify-between items-center pb-2 border-b border-[#e5e5ea] mb-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Channel Filter</span>
              <div className="flex gap-2">
                <button onClick={selectAllAccounts} className="text-[10px] text-gray-500 hover:text-black">All</button>
                <span className="text-[10px] text-gray-300">|</span>
                <button onClick={clearAllAccounts} className="text-[10px] text-gray-500 hover:text-black">Clear</button>
              </div>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {accounts.map(acc => (
                <div 
                  key={acc._id}
                  onClick={() => toggleAccountSelection(acc._id)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[#f5f5f7] cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img src={acc.avatarUrl} className="w-6 h-6 rounded-full object-cover border border-black/10" alt="" />
                    <div>
                      <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">{acc.name}</p>
                      <p className="text-[9px] text-gray-500">@{acc.username} ({acc.platform})</p>
                    </div>
                  </div>
                  {selectedAccounts.includes(acc._id) && (
                    <Check className="w-3.5 h-3.5 text-[#0071e3]" />
                  )}
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No connected accounts.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-6">
        {/* Profile Details */}
        {user && (
          <div className="flex items-center gap-3 border-l border-[#e5e5ea] pl-6">
            <img 
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
              className="w-7 h-7 rounded-full object-cover border border-black/10" 
              alt="Avatar" 
            />
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-[#1d1d1f] leading-none">{user.name}</p>
            </div>
            <button 
              onClick={logout}
              className="p-1 hover:text-[#0071e3] text-gray-400 rounded-lg transition-all"
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
