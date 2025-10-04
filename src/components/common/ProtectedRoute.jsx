import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authcontext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si pas d'utilisateur connecté, rediriger vers la page de connexion
  if (!isAuthenticated) {
    return <Navigate to="/loginrestau" state={{ from: location }} replace />;
  }

  // Si la route nécessite des droits admin et que l'utilisateur n'est pas admin
  if (adminOnly && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export { ProtectedRoute };
