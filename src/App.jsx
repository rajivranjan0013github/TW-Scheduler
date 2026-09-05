import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BarChart3, CalendarPlus, Clock, FolderHeart, Home as HomeIcon, Link2, Megaphone, Settings as SettingsIcon } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Login from './pages/Login';
import CampaignSelector from './pages/CampaignSelector';
import MediaLibrary from './pages/MediaLibrary';
import CalendarView from './pages/CalendarView';
import ScheduleQueue from './pages/ScheduleQueue';
import QueueManagement from './pages/QueueManagement';
import Channels from './pages/Channels';
import CreatorChannels from './pages/CreatorChannels';
import AdminChannels from './pages/AdminChannels';
import PublishedFeed from './pages/PublishedFeed';
import PostDetails from './pages/PostDetails';
import Settings from './pages/Settings';
import AdminUsers from './pages/AdminUsers';
import AdminDashboard from './pages/AdminDashboard';
import CreatorAnalytics from './pages/CreatorAnalytics';
import AdminCampaigns from './pages/AdminCampaigns';
import AdminFolders from './pages/AdminFolders';
import AdminFolderDetails from './pages/AdminFolderDetails';
import FacebookCallback from './pages/FacebookCallback';
import GoogleLoginCallback from './pages/GoogleLoginCallback';
import InstagramCallback from './pages/InstagramCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import DataDeletion from './pages/DataDeletion';
import YoutubeCallback from './pages/YoutubeCallback';
import { BulkVideoBuilder } from './pages/BulkVideoBuilder';
import OnboardingScreen from './pages/OnboardingScreen';
import CreatorCampaigns from './pages/CreatorCampaigns';
import CreatorSchedulePost from './pages/CreatorSchedulePost';
import CreatorMedia from './pages/CreatorMedia';

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
  const location = useLocation();
  const items = isCreator
    ? [
        { name: 'Home', path: '/campaigns', icon: HomeIcon },
        { name: 'Media', path: '/media', icon: FolderHeart },
        { name: 'Schedule', path: '/schedule', icon: CalendarPlus },
        { name: 'Analytics', path: '/analytics', icon: BarChart3 },
        { name: 'Channels', path: '/channels', icon: Link2 },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ]
    : [
        { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
        ...(canViewAdmin ? [{ name: 'Performance', path: '/dashboard', icon: BarChart3 }] : []),
        { name: 'Queue', path: '/scheduler', icon: Clock },
        { name: 'Media', path: '/media', icon: FolderHeart },
        { name: 'Channels', path: '/channels', icon: Link2 },
      ];

  const checkIsActive = (path) => {
    if (path === '/campaigns') {
      return location.pathname === '/' || location.pathname === '/campaigns';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0c0c0e]/95 backdrop-blur-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)] md:hidden mobile-safe-nav text-white">
      <div className="mx-auto flex h-full items-center justify-around px-2 max-w-md">
        {items.map((item) => {
          const isActive = checkIsActive(item.path);
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center gap-1 transition-all py-1 px-3 rounded-xl active:scale-95"
            >
              <div
                className={`flex items-center justify-center rounded-xl transition-all ${
                  isActive
                    ? 'bg-white/10 text-white px-3 py-1'
                    : 'text-zinc-500 hover:text-zinc-300 px-3 py-1'
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'font-semibold text-white' : 'font-medium text-zinc-400'}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function AuthenticatedShell({ selectedAccounts, setSelectedAccounts }) {
  const { user } = useAuth();
  const location = useLocation();
  const [campaignVersion, setCampaignVersion] = useState(0);
  const canViewAdmin = user?.role === 'owner' || user?.role === 'admin';
  const canEditQueue = ['owner', 'admin', 'editor'].includes(user?.role) || isCreator;
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
              <Route path="/media" element={<CreatorMedia />} />
              <Route path="/schedule" element={<CreatorSchedulePost />} />
              <Route path="/scheduler" element={<CalendarView selectedAccounts={selectedAccounts} />} />
              <Route path="/scheduler/new" element={canEditQueue ? <ScheduleQueue selectedAccounts={selectedAccounts} /> : <Navigate to="/scheduler" replace />} />
              <Route path="/scheduler/queue" element={canEditQueue ? <QueueManagement /> : <Navigate to="/scheduler" replace />} />
              <Route path="/scheduler/queue/:accountId" element={canEditQueue ? <QueueManagement /> : <Navigate to="/scheduler" replace />} />
              <Route path="/analytics" element={<CreatorAnalytics />} />
              <Route path="/channels" element={<CreatorChannels selectedAccounts={selectedAccounts} />} />
              <Route path="/channels/:id/feed" element={<PublishedFeed />} />
              <Route path="/channels/:id/posts/:metaPostId" element={<PostDetails />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<CampaignSelector setSelectedAccounts={setSelectedAccounts} />} />
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
              <Route path="/channels" element={<AdminChannels selectedAccounts={selectedAccounts} />} />
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
  const location = useLocation();
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  const isAuthCallback = location.pathname.startsWith('/auth/');

  if (loading && !isAuthCallback) {
    return (
      <div className="min-h-screen bg-[#06040a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-400 font-semibold tracking-wide">Syncing ThousandPost...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/facebook/callback" element={<FacebookCallback />} />
      <Route path="/auth/google/callback" element={<GoogleLoginCallback />} />
      <Route path="/auth/instagram/callback" element={<InstagramCallback />} />
      <Route path="/auth/youtube/callback" element={<YoutubeCallback />} />
      <Route path="/youtube-callback" element={<YoutubeCallback />} />
      <Route path="/facebook-callback" element={<FacebookCallback />} />
      <Route path="/instagram-callback" element={<InstagramCallback />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/data-deletion" element={<DataDeletion />} />
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
          <Route
            path="*"
            element={<AuthenticatedShell selectedAccounts={selectedAccounts} setSelectedAccounts={setSelectedAccounts} />}
          />
        </>
      )}
    </Routes>
  );
}

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'mock-client-id';
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
