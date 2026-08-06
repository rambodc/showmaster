import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import LoadingScreen from '../components/LoadingScreen';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
