import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authcontext';

const ProtectedRoute = ({ children, adminOnly = false, allowedRoles = [] }) => {
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
    // Si on accède à une route partenaire, rediriger vers le login partenaire
    if (location.pathname.includes('partner-')) {
      return <Navigate to="/login-partners" state={{ from: location }} replace />;
    }
    return <Navigate to="/loginrestau" state={{ from: location }} replace />;
  }

  // Vérifier les rôles autorisés si spécifiés
  if (allowedRoles.length > 0) {
    const userRole = user?.role || '';
    if (!allowedRoles.includes(userRole) && !isAdmin) { // Admin peut toujours accéder
      return <Navigate to="/unauthorized" replace />;
    }
    return children;
  }

  // Sinon, vérifier si admin requis
  if (adminOnly && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export { ProtectedRoute };
