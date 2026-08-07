import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import ProtectedRoute from '../auth/ProtectedRoute';
import LoginPage from '../auth/LoginPage';
import RegisterPage from '../auth/RegisterPage';
import LandingPage from '../pages/LandingPage';
import DashboardPage from '../pages/DashboardPage';
import LibraryPage from '../pages/LibraryPage';
import ArtistPage from '../pages/ArtistPage';
import ReleasePage from '../pages/ReleasePage';
import MusicShell from '../layout/MusicShell';
import PlaylistsPage from '../pages/PlaylistsPage';

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route element={<MusicShell />}>
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/artist/:slug" element={<ArtistPage />} />
        <Route path="/release/:releaseId" element={<ReleasePage />} />
        <Route path="/app" element={<ProtectedRoute><DashboardPage initialView="overview" /></ProtectedRoute>} />
        <Route path="/app/profile" element={<ProtectedRoute><DashboardPage initialView="profile" /></ProtectedRoute>} />
        <Route path="/app/releases/:releaseId" element={<ProtectedRoute><DashboardPage initialView="profile" /></ProtectedRoute>} />
        <Route path="/app/playlists" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
        <Route path="/app/playlists/:playlistId" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/app' : '/'} replace />} />
    </Routes>
  );
}
