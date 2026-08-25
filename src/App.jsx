import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BarChart3, Clock, FolderHeart, Link2, Megaphone, Settings as SettingsIcon } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import { PwaInstallButton } from './components/PwaInstallButton';
import Home from './pages/Home';
import Login from './pages/Login';
import CampaignSelector from './pages/CampaignSelector';
import MediaLibrary from './pages/MediaLibrary';
import CalendarView from './pages/CalendarView';
import ScheduleQueue from './pages/ScheduleQueue';
import QueueManagement from './pages/QueueManagement';
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
import { BulkVideoBuilder } from './pages/BulkVideoBuilder';
import OnboardingScreen from './pages/OnboardingScreen';
import CreatorCampaigns from './pages/CreatorCampaigns';

const VideoEditorV2 = lazy(() => import('./pages/videoEditorV2/VideoEditorV2'));

const TimelineEditorFallback = () => (
  <div className="flex h-[100dvh] items-center justify-center bg-black">
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a0a] px-5 py-4 text-xs font-bold text-white shadow-sm">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#7831d6] border-t-transparent" />
      Opening Timeline Editor…
    </div>
  </div>
);

function MobileNav({ isCreator, canViewAdmin }) {
  const items = isCreator
    ? [
        { name: 'Products', path: '/campaigns', icon: Megaphone },
        { name: 'Channels', path: '/channels', icon: Link2 },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ]
    : [
        { name: 'Products', path: '/campaigns', icon: Megaphone },
        ...(canViewAdmin ? [{ name: 'Performance', path: '/dashboard', icon: BarChart3 }] : []),
        { name: 'Queue', path: '/scheduler', icon: Clock },
        { name: 'Media', path: '/media', icon: FolderHeart },
        { name: 'Channels', path: '/channels', icon: Link2 },
      ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#09060e]/95 backdrop-blur-2xl px-1 pt-0.5 shadow-[0_-4px_25px_rgba(120,49,214,0.12)] md:hidden mobile-safe-nav text-white">
      <div className="absolute -top-8 right-2">
        <PwaInstallButton
          collapsed
          popoverClassName="right-0"
        />
      </div>
      <div className={`mx-auto grid h-full gap-0.5 ${isCreator ? 'max-w-xs grid-cols-3' : `max-w-md ${canViewAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}`}>
        {items.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end
            className={({ isActive }) =>
              `flex h-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[9px] font-semibold leading-none transition-all ${
                isActive
                  ? 'bg-gradient-to-b from-[#8a3ff2] to-[#6d24cf] text-white shadow-[0_0_12px_rgba(120,49,214,0.4)] font-bold'
                  : 'text-zinc-400 hover:text-white active:bg-white/[0.08]'
              }`
            }
          >
            <item.icon className="h-3.5 w-3.5" />
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
  const canEditQueue = ['owner', 'admin', 'editor'].includes(user?.role);
  const handlerPreviewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const isHandlerPreview = handlerPreviewContext?.viewAs === 'account_handler' || Boolean(location.state?.previewAsHandler);
  const isCreator = user?.userType === 'account_handler' || isHandlerPreview;

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
  const isTimelineEditorPage = location.pathname === '/media/editor'
    || location.pathname === '/media/editor-v2';
  
  // Creators always see their sidebar since they aren't restricted by campaign selection state
  const hideSidebar = isTimelineEditorPage
    || (isCreator ? false : (isOnCampaignPage && !hasActiveCampaign));

  return (
    <div className="flex bg-black h-[100dvh] text-white antialiased overflow-x-visible overflow-y-hidden font-sans">
      {!hideSidebar && (
        <Sidebar
          selectedAccounts={selectedAccounts}
          setSelectedAccounts={setSelectedAccounts}
        />
      )}

      <main className={`min-w-0 flex-1 overflow-y-auto ${!hideSidebar ? 'mobile-safe-main-padding md:pb-0' : ''}`}>
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
              <Route path="/dashboard" element={canViewAdmin ? <AdminDashboard /> : <Navigate to="/scheduler" replace />} />
              <Route path="/scheduler" element={<CalendarView selectedAccounts={selectedAccounts} />} />
              <Route path="/scheduler/new" element={canEditQueue ? <ScheduleQueue selectedAccounts={selectedAccounts} /> : <Navigate to="/scheduler" replace />} />
              <Route path="/scheduler/queue" element={canEditQueue ? <QueueManagement /> : <Navigate to="/scheduler" replace />} />
              <Route path="/scheduler/queue/:accountId" element={canEditQueue ? <QueueManagement /> : <Navigate to="/scheduler" replace />} />
              <Route path="/media" element={<MediaLibrary />} />
              <Route path="/media/editor" element={<Suspense fallback={<TimelineEditorFallback />}><VideoEditorV2 /></Suspense>} />
              <Route path="/media/editor-v2" element={<Navigate to={`/media/editor${location.search}`} replace />} />
              <Route path="/media/bulk-builder" element={<BulkVideoBuilder />} />
              <Route path="/channels" element={<Channels selectedAccounts={selectedAccounts} />} />
              <Route path="/channels/:id/feed" element={<PublishedFeed />} />
              <Route path="/channels/:id/posts/:metaPostId" element={<PostDetails />} />
              <Route path="/settings" element={<Settings />} />
              {canViewAdmin && <Route path="/admin" element={<Navigate to="/dashboard" replace />} />}
              {canViewAdmin && <Route path="/admin/users" element={<AdminUsers />} />}
              {canViewAdmin && <Route path="/admin/campaign" element={<AdminCampaigns />} />}
              {canViewAdmin && <Route path="/admin/folders" element={<AdminFolders />} />}
              {canViewAdmin && <Route path="/admin/folders/:id" element={<AdminFolderDetails />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </main>

      {!hideSidebar && <MobileNav isCreator={isCreator} canViewAdmin={canViewAdmin} />}
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
