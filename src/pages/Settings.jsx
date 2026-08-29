import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Save, Check, Trash2, LogOut } from 'lucide-react';

export const Settings = () => {
  const { user, updateProfile, deleteAccount, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [userType, setUserType] = useState(user?.userType || 'account_handler');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    setErrorMessage('');
    const success = await deleteAccount();
    if (!success) {
      setErrorMessage('Could not delete this workspace account. Please try again.');
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    const success = await updateProfile({ name, userType });
    setSaving(false);
    if (success) {
      setSuccessMessage('Workspace settings updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage('Could not save settings. Please try again.');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner': return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      case 'admin': return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
      case 'editor': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      default: return 'bg-white/[0.06] text-zinc-300 border-white/[0.08]';
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-[#0c0c0e] min-h-screen text-white space-y-6 sm:space-y-8 font-sans antialiased">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Account Preferences
          </p>
          <h2 className="text-xl font-bold text-white tracking-tight m-0 mt-1">Settings</h2>
          <p className="text-zinc-400 text-xs mt-1">Manage your workspace profiles and application preferences</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-zinc-300 shadow-sm transition hover:bg-white/[0.06] hover:text-white"
          title="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Success/Error Alerts */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* Grid Content Panel */}
      <div className="max-w-3xl">
        
        {/* Profile Card & Form */}
        <div className="space-y-6">
          <form onSubmit={handleSave} className="bg-[#141417]/95 border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-xl">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 m-0 border-b border-white/[0.08] pb-3">Account Details</h3>

            {/* Profile Summary Info */}
            <div className="flex flex-col sm:flex-row items-center gap-5 bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <div className="relative w-16 h-16 shrink-0">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    crossOrigin="anonymous"
                    className="w-16 h-16 rounded-full object-cover border border-white/15 shadow-sm"
                    alt="Avatar Preview" 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextElementSibling) {
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center text-zinc-300"
                  style={{ display: user?.avatar ? 'none' : 'flex' }}
                >
                  <User className="w-7 h-7 text-zinc-400" />
                </div>
              </div>
              <div className="text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-sm font-bold text-white m-0">{user?.name}</h4>
                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(user?.role)}`}>
                    {user?.role || 'editor'}
                  </span>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border bg-white/[0.06] text-zinc-300 border-white/[0.08]">
                    {user?.userType === 'account_handler' ? 'Creator' : 'Campaign Maker'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 m-0">{user?.email}</p>
              </div>
            </div>

            {/* Input fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" /> Full Name
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                  placeholder="Enter full name"
                  className="w-full text-xs bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] focus:border-white/30 focus:ring-1 focus:ring-white/10 rounded-[10px] px-3 py-2 outline-none transition-all text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" /> Email Address
                </label>
                <input 
                  type="email" 
                  value={user?.email || ''} 
                  disabled
                  title="Google email address cannot be changed."
                  className="w-full text-xs bg-white/[0.02] border border-white/[0.06] rounded-[10px] px-3 py-2 text-zinc-500 cursor-not-allowed outline-none"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-zinc-300">Account Perspective / Role</label>
                <select 
                  value={userType} 
                  onChange={(e) => setUserType(e.target.value)} 
                  className="w-full text-xs bg-[#141417] border border-white/[0.08] hover:border-white/[0.12] focus:border-white/30 rounded-[10px] px-3 py-2 outline-none transition-all text-white capitalize"
                >
                  <option value="campaign_maker" className="bg-[#141417] text-white">Campaign Maker (Admins / Agencies)</option>
                  <option value="account_handler" className="bg-[#141417] text-white">Account Handler (Creators / Influencers)</option>
                </select>
                <p className="text-[10px] text-zinc-400 m-0 leading-relaxed mt-0.5">
                  Determines your navigation sidebar and permissions shell. Switching roles will redirect your active dashboard.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.08]">
              <button 
                type="submit" 
                disabled={saving}
                className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black rounded-[12px] px-4 py-2 text-xs font-semibold shadow-sm transition-all outline-none disabled:opacity-50 active:scale-[0.98]"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Session Card */}
          <div className="bg-[#141417]/95 border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-xl">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 m-0 border-b border-white/[0.08] pb-3">Session</h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white m-0">Sign Out of Session</p>
                <p className="text-[10px] text-zinc-400 m-0 mt-0.5">Disconnect and close your current session on this device.</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-rose-500/10 text-rose-400 border border-white/[0.08] hover:border-rose-500/30 rounded-[10px] px-4 py-2 text-xs font-semibold shadow-sm transition-all outline-none self-start sm:self-center w-full sm:w-auto"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Log Out</span>
              </button>
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-[#141417]/95 border border-rose-500/20 rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-xl">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-rose-400 m-0 border-b border-rose-500/20 pb-3">Danger Zone</h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white m-0">Delete Workspace Account</p>
                <p className="text-[10px] text-zinc-400 m-0 mt-0.5">Permanently delete your profile and connected channel credentials. This cannot be undone.</p>
              </div>
              
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-[10px] px-4 py-2 text-xs font-semibold shadow-sm transition-all outline-none self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-[10px] px-3.5 py-2 text-xs font-semibold shadow-sm transition-all outline-none"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 rounded-[10px] px-3.5 py-2 text-xs font-medium shadow-sm transition-all outline-none border border-white/[0.08]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Settings;
