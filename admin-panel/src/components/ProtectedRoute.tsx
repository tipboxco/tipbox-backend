import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Redirects to /login if no token. Returns null until AuthProvider isReady (optional loading can be added to prevent flash).
 */
function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" aria-hidden />
        <span>Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
