import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Save, Check, Trash2, LogOut, ShieldCheck } from 'lucide-react';
import { getHandlerPreviewContext } from '../utils/handlerPreview';

export const Settings = () => {
  const { user, updateProfile, deleteAccount, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const isCreator = user?.userType === 'account_handler' || Boolean(getHandlerPreviewContext());

  useEffect(() => {
    if (!showLogoutDialog) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowLogoutDialog(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutDialog]);

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    logout();
  };

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

    const success = await updateProfile({ name });
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
      case 'owner': return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'admin': return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'editor': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default: return 'bg-white/10 text-zinc-300 border-white/15';
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] p-4 font-sans text-white antialiased sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Title Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="m-0 text-2xl font-bold tracking-tight text-white">Settings</h2>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-300 shadow-sm transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
            title="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Success/Error Alerts */}
        {successMessage && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-300 shadow-sm animate-in fade-in duration-200">
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300 shadow-sm animate-in fade-in duration-200">
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        {/* Settings Form & Content (No Card) */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile Info Row */}
          <div className="flex flex-col items-center gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative h-16 w-16 shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  crossOrigin="anonymous"
                  className="h-16 w-16 rounded-full border border-white/15 object-cover shadow-sm"
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
                className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-300"
                style={{ display: user?.avatar ? 'none' : 'flex' }}
              >
                <User className="h-7 w-7 text-zinc-400" />
              </div>
            </div>
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h3 className="m-0 text-base font-bold text-white">{user?.name}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${getRoleBadgeColor(user?.role)}`}>
                  {user?.role || 'editor'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-300">
                  {isCreator ? 'Creator' : 'Campaign Maker'}
                </span>
              </div>
              <p className="m-0 text-xs text-zinc-400">{user?.email}</p>
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <User className="h-3.5 w-3.5 text-zinc-400" /> Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter full name"
                className="w-full rounded-xl border border-white/20 bg-zinc-700/85 px-4 py-3 text-xs text-white placeholder:text-zinc-300 outline-none transition hover:border-white/35 hover:bg-zinc-700 focus:border-[#7831d6] focus:bg-zinc-700 focus:ring-2 focus:ring-[#7831d6]/40 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Mail className="h-3.5 w-3.5 text-zinc-400" /> Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                title="Google email address cannot be changed."
                className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 text-xs text-zinc-300 outline-none shadow-sm"
              />
            </div>

          </div>

          {/* Save Button with Primary Brand Color */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#7831d6] px-5 py-2 text-xs font-semibold text-white shadow-md shadow-[#7831d6]/25 transition hover:bg-[#6825bc] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Legal & Platform Policies */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h4 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
              Legal & Compliance
            </h4>
          </div>
          <p className="m-0 text-xs text-zinc-400">
            Review platform terms, user rights, data protection guidelines, and deletion procedures:
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              to="/privacy-policy"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-and-conditions"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Terms & Conditions
            </Link>
            <Link
              to="/data-deletion"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Data Deletion Instructions
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border-t border-white/10 pt-6">
          <h4 className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-rose-400">
            Danger Zone
          </h4>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="m-0 text-xs font-semibold text-white">Delete Workspace Account</p>
              <p className="m-0 mt-0.5 text-[11px] text-zinc-400">Permanently delete your profile and connected channel credentials. This cannot be undone.</p>
            </div>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400 shadow-sm transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Account
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-300 shadow-sm transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog Alert */}
      {showLogoutDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowLogoutDialog(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#121216] p-6 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h3 id="logout-dialog-title" className="m-0 text-base font-semibold text-white">
                  Log Out
                </h3>
                <p className="m-0 mt-0.5 text-xs text-zinc-400">
                  Are you sure you want to log out?
                </p>
              </div>
            </div>

            <p className="mb-6 text-xs text-zinc-400 leading-relaxed">
              You will need to sign back in to access your workspace campaigns and channels.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutDialog(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 shadow-sm transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 active:scale-[0.98]"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
