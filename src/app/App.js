import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import ProtectedRoute from '../auth/ProtectedRoute';
import LoginPage from '../auth/LoginPage';
import RegisterPage from '../auth/RegisterPage';
import LandingPage from '../pages/LandingPage';
import DashboardPage from '../pages/DashboardPage';
import '../App.css';

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
      <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? '/app' : '/'} replace />} />
    </Routes>
  );
}
