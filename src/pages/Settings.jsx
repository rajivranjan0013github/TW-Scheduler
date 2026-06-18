import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Save, Check, Database, Activity, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

export const Settings = () => {
  const { user, updateProfile, deleteAccount } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    setErrorMessage('');
    const success = await deleteAccount();
    if (!success) {
      setErrorMessage('Failed to delete workspace account. Check database connection.');
      setShowDeleteConfirm(false);
    }
  };

  // Preference states (mocked for rich UX details)
  const [emailDigest, setEmailDigest] = useState(true);
  const [pushNotification, setPushNotification] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    const success = await updateProfile({ name, avatar });
    setSaving(false);
    if (success) {
      setSuccessMessage('Workspace settings updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage('Failed to update workspace settings. Check database connection.');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'admin': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'editor': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-8 space-y-8 text-[#1d1d1f] min-h-screen bg-[#f5f5f7] font-sans">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e5e5ea]">
        <div>
          <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight m-0">Settings</h2>
          <p className="text-[#8e8e93] text-xs mt-1">Manage your workspace profiles and application preferences</p>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* Grid Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Card & Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-semibold text-black m-0 border-b border-[#f5f5f7] pb-3">Account Details</h3>

            {/* Profile Summary Info */}
            <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#f5f5f7]/55 p-4 rounded-xl border border-[#e5e5ea]">
              <img 
                src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                alt="Avatar Preview" 
              />
              <div className="text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-sm font-bold text-[#1d1d1f] m-0">{user?.name}</h4>
                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(user?.role)}`}>
                    {user?.role || 'editor'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 m-0">{user?.email}</p>
                <p className="text-[10px] text-gray-400 m-0">ID: {user?.googleId || 'local-developer'}</p>
              </div>
            </div>

            {/* Input fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                  placeholder="Enter full name"
                  className="w-full text-xs bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#3478f6] focus:bg-white rounded-lg px-3 py-2 outline-none transition-all text-[#1d1d1f]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email Address
                </label>
                <input 
                  type="email" 
                  value={user?.email || ''} 
                  disabled
                  title="Google email address cannot be changed."
                  className="w-full text-xs bg-gray-100 border border-[#e5e5ea] rounded-lg px-3 py-2 text-gray-400 cursor-not-allowed outline-none"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-500">Avatar URL</label>
                <input 
                  type="text" 
                  value={avatar} 
                  onChange={(e) => setAvatar(e.target.value)} 
                  placeholder="Paste profile image link"
                  className="w-full text-xs bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#3478f6] focus:bg-white rounded-lg px-3 py-2 outline-none transition-all text-[#1d1d1f]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#f5f5f7]">
              <button 
                type="submit" 
                disabled={saving}
                className="flex items-center gap-2 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-all outline-none disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Danger Zone Card */}
          <div className="bg-white border border-rose-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-rose-600 m-0 border-b border-rose-50 pb-3">Danger Zone</h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#1d1d1f] m-0">Delete Workspace Account</p>
                <p className="text-[10px] text-gray-500 m-0 mt-0.5">Permanently delete your profile and connected channel credentials. This cannot be undone.</p>
              </div>
              
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-all outline-none self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition-all outline-none"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-[#1d1d1f] rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition-all outline-none border border-[#e5e5ea]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar settings info */}
        <div className="space-y-6">
          
          {/* Preferences Card */}
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-black m-0 mb-4 uppercase tracking-wider text-[10px] text-gray-500">Preferences</h3>
            
            <div className="space-y-4">
              
              {/* Email summary toggle */}
              <div 
                onClick={() => setEmailDigest(!emailDigest)}
                className="flex items-center justify-between cursor-pointer select-none py-1.5"
              >
                <div>
                  <p className="text-xs font-semibold text-[#1d1d1f] m-0">Daily Publishing Digest</p>
                  <p className="text-[10px] text-gray-500 m-0 mt-0.5">Receive summary reports of active posts</p>
                </div>
                {emailDigest ? (
                  <ToggleRight className="w-6 h-6 text-[#0071e3]" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-gray-300" />
                )}
              </div>

              {/* Push notifications */}
              <div 
                onClick={() => setPushNotification(!pushNotification)}
                className="flex items-center justify-between cursor-pointer select-none py-1.5"
              >
                <div>
                  <p className="text-xs font-semibold text-[#1d1d1f] m-0">Sound FX</p>
                  <p className="text-[10px] text-gray-500 m-0 mt-0.5">Play dynamic success sounds on uploads</p>
                </div>
                {pushNotification ? (
                  <ToggleRight className="w-6 h-6 text-[#0071e3]" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-gray-300" />
                )}
              </div>

            </div>
          </div>

          {/* System Info Stats */}
          <div className="bg-white border border-[#e5e5ea] rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-black m-0 uppercase tracking-wider text-[10px] text-gray-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-gray-400" /> System Details
            </h3>
            
            <div className="text-[11px] space-y-2 text-[#515154]">
              <div className="flex justify-between py-1 border-b border-[#f5f5f7]">
                <span>App Environment</span>
                <span className="font-semibold text-black">Development</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#f5f5f7]">
                <span>Vite Dev Port</span>
                <span className="font-semibold text-black">5173</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#f5f5f7]">
                <span>API Server</span>
                <span className="font-semibold text-[#0071e3] underline">http://localhost:5001</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Settings;
