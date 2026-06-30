import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Clock, FolderHeart, LayoutDashboard, Link2, Megaphone, Settings as SettingsIcon } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import { PwaInstallButton } from './components/PwaInstallButton';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CampaignSelector from './pages/CampaignSelector';
import MediaLibrary from './pages/MediaLibrary';
import CalendarView from './pages/CalendarView';
import Channels from './pages/Channels';
import PublishedFeed from './pages/PublishedFeed';
import PostDetails from './pages/PostDetails';
import Settings from './pages/Settings';
import AdminUsers from './pages/AdminUsers';
import AdminDashboard from './pages/AdminDashboard';
import AdminCampaigns from './pages/AdminCampaigns';
import AdminFolders from './pages/AdminFolders';
import AdminFolderDetails from './pages/AdminFolderDetails';
import FacebookCallback from './pages/FacebookCallback';
import FacebookLoginCallback from './pages/FacebookLoginCallback';
import GoogleLoginCallback from './pages/GoogleLoginCallback';
import InstagramCallback from './pages/InstagramCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import YoutubeCallback from './pages/YoutubeCallback';
import { VideoEditor } from './pages/VideoEditor';
import { BulkVideoBuilder } from './pages/BulkVideoBuilder';
import OnboardingScreen from './pages/OnboardingScreen';
import CreatorCampaigns from './pages/CreatorCampaigns';

function MobileNav({ isCreator }) {
  const items = isCreator
    ? [
        { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
        { name: 'Channels', path: '/channels', icon: Link2 },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ]
    : [
        { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Queue', path: '/scheduler', icon: Clock },
        { name: 'Media', path: '/media', icon: FolderHeart },
        { name: 'Channels', path: '/channels', icon: Link2 },
      ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d2d2d7] bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <PwaInstallButton
        collapsed
        className="absolute -top-11 right-3"
        popoverClassName="right-0"
      />
      <div className={`mx-auto grid gap-1 ${isCreator ? 'max-w-sm grid-cols-3' : 'max-w-md grid-cols-5'}`}>
        {items.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            className={({ isActive }) =>
              `flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold transition ${
                isActive ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] active:bg-[#f5f5f7]'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AuthenticatedShell({ selectedAccounts, setSelectedAccounts }) {
  const { user } = useAuth();
  const location = useLocation();
  const [campaignVersion, setCampaignVersion] = useState(0);
  const canViewAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isCreator = user?.userType === 'account_handler';

  useEffect(() => {
    const refreshCampaignScopedRoutes = () => {
      setCampaignVersion((version) => version + 1);
    };

    window.addEventListener('campaign-selected', refreshCampaignScopedRoutes);
    return () => window.removeEventListener('campaign-selected', refreshCampaignScopedRoutes);
  }, []);

  // Only hide sidebar when there's no active campaign (first-time welcome screen).
  // Returning users with 2+ campaigns still see sidebar on the campaign picker.
  const hasActiveCampaign = Boolean(localStorage.getItem('active-campaign-id'));
  const isOnCampaignPage = location.pathname === '/' || location.pathname === '/campaigns';
  const isBulkBuilderPage = location.pathname === '/media/bulk-builder';
  
  // Creators always see their sidebar since they aren't restricted by campaign selection state
  const hideSidebar = isCreator ? false : (isBulkBuilderPage || (isOnCampaignPage && !hasActiveCampaign));

  return (
    <div className="flex bg-[#f5f5f7] h-screen text-[#1d1d1f] antialiased overflow-hidden font-sans">
      {!hideSidebar && (
        <Sidebar
          selectedAccounts={selectedAccounts}
          setSelectedAccounts={setSelectedAccounts}
        />
      )}

      <main className={`min-w-0 flex-1 overflow-y-auto ${!hideSidebar ? 'pb-20 md:pb-0' : ''}`}>
        <Routes key={campaignVersion}>
          {isCreator ? (
            <>
              <Route path="/" element={<CreatorCampaigns />} />
              <Route path="/campaigns" element={<CreatorCampaigns />} />
              <Route path="/channels" element={<Channels selectedAccounts={selectedAccounts} />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={hasActiveCampaign ? <Navigate to="/scheduler" replace /> : <CampaignSelector setSelectedAccounts={setSelectedAccounts} />} />
              <Route path="/campaigns" element={<CampaignSelector setSelectedAccounts={setSelectedAccounts} />} />
              <Route path="/dashboard" element={<Dashboard selectedAccounts={selectedAccounts} />} />
              <Route path="/scheduler" element={<CalendarView selectedAccounts={selectedAccounts} />} />
              <Route path="/media" element={<MediaLibrary />} />
              <Route path="/media/editor" element={<VideoEditor />} />
              <Route path="/media/bulk-builder" element={<BulkVideoBuilder />} />
              <Route path="/channels" element={<Channels selectedAccounts={selectedAccounts} />} />
              <Route path="/channels/:id/feed" element={<PublishedFeed />} />
              <Route path="/channels/:id/posts/:metaPostId" element={<PostDetails />} />
              <Route path="/settings" element={<Settings />} />
              {canViewAdmin && <Route path="/admin" element={<AdminDashboard />} />}
              {canViewAdmin && <Route path="/admin/users" element={<AdminUsers />} />}
              {canViewAdmin && <Route path="/admin/campaign" element={<AdminCampaigns />} />}
              {canViewAdmin && <Route path="/admin/folders" element={<AdminFolders />} />}
              {canViewAdmin && <Route path="/admin/folders/:id" element={<AdminFolderDetails />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>

      {!hideSidebar && <MobileNav isCreator={isCreator} />}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06040a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-400 font-semibold tracking-wide">Syncing EasyPost...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth/facebook/callback" element={<FacebookCallback />} />
        <Route path="/auth/facebook-login/callback" element={<FacebookLoginCallback />} />
        <Route path="/auth/google/callback" element={<GoogleLoginCallback />} />
        <Route path="/auth/instagram/callback" element={<InstagramCallback />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        {!user ? (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : !user.userType ? (
          <>
            <Route path="*" element={<OnboardingScreen />} />
          </>
        ) : (
          <>
            <Route path="/auth/youtube/callback" element={<YoutubeCallback />} />
            <Route
              path="*"
              element={<AuthenticatedShell selectedAccounts={selectedAccounts} setSelectedAccounts={setSelectedAccounts} />}
            />
          </>
        )}
    </Routes>
    </Router >
  );
}

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'mock-client-id';
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
