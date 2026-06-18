import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MediaLibrary from './pages/MediaLibrary';
import CalendarView from './pages/CalendarView';
import Comments from './pages/Comments';
import Channels from './pages/Channels';
import FacebookCallback from './pages/FacebookCallback';
import InstagramCallback from './pages/InstagramCallback';
import YoutubeCallback from './pages/YoutubeCallback';

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06040a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-400 font-semibold tracking-wide">Syncing Creator Suite...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth/facebook/callback" element={<FacebookCallback />} />
        <Route path="/auth/instagram/callback" element={<InstagramCallback />} />
        <Route path="/auth/youtube/callback" element={<YoutubeCallback />} />
        <Route
          path="*"
          element={
            !user ? (
              <Login />
            ) : (
              <div className="flex bg-[#f5f5f7] h-screen text-[#1d1d1f] antialiased overflow-hidden font-sans">
                
                {/* Navigation Sidebar */}
                <Sidebar />

                {/* Right Content Panel */}
                <div className="flex-1 flex flex-col h-screen overflow-hidden">
                  
                  {/* Header Controls */}
                  <Header 
                    selectedAccounts={selectedAccounts} 
                    setSelectedAccounts={setSelectedAccounts} 
                  />

                  {/* Main Dashboard Pages router container */}
                  <main className="flex-1 overflow-y-auto">
                    <Routes>
                      <Route path="/" element={<Dashboard selectedAccounts={selectedAccounts} />} />
                      <Route path="/scheduler" element={<CalendarView selectedAccounts={selectedAccounts} />} />
                      <Route path="/media" element={<MediaLibrary />} />
                      <Route path="/channels" element={<Channels />} />
                      <Route path="/comments" element={<Comments />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            )
          }
        />
      </Routes>
    </Router>
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
