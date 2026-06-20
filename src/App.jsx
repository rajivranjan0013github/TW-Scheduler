import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import AdminSidebar from './components/AdminSidebar';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
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

const AdminShell = () => (
  <div className="flex bg-[#f5f5f7] h-screen text-[#1d1d1f] antialiased overflow-hidden font-sans">
    <AdminSidebar />
    <main className="flex-1 overflow-y-auto">
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/campaign" element={<AdminCampaigns />} />
        <Route path="/folders" element={<AdminFolders />} />
        <Route path="/folders/:id" element={<AdminFolderDetails />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </main>
  </div>
);

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const canViewAdmin = user?.role === 'owner' || user?.role === 'admin';

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
        ) : (
          <>
            <Route path="/auth/youtube/callback" element={<YoutubeCallback />} />
            {canViewAdmin && <Route path="/admin/*" element={<AdminShell />} />}
            <Route
              path="*"
              element={
                <div className="flex bg-[#f5f5f7] h-screen text-[#1d1d1f] antialiased overflow-hidden font-sans">
                  <Sidebar
                    selectedAccounts={selectedAccounts}
                    setSelectedAccounts={setSelectedAccounts}
                  />

                  <main className="flex-1 overflow-y-auto">
                    <Routes>
                      <Route path="/" element={<Dashboard selectedAccounts={selectedAccounts} />} />
                      <Route path="/scheduler" element={<CalendarView selectedAccounts={selectedAccounts} />} />
                      <Route path="/media" element={<MediaLibrary />} />
                      <Route path="/media/editor" element={<VideoEditor />} />
                      <Route path="/channels" element={<Channels />} />
                      <Route path="/channels/:id/feed" element={<PublishedFeed />} />
                      <Route path="/channels/:id/posts/:metaPostId" element={<PostDetails />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              }
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
