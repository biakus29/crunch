import React from 'react';
import { useRoleAuth } from '../../hooks/useRoleAuth';
import { ROLE_LABELS } from '../../utils/rolePermissions';
import { FaLock, FaSpinner } from 'react-icons/fa';

const RoleProtectedRoute = ({ 
  children, 
  requiredSection, 
  requiredAction = 'view',
  fallback = null 
}) => {
  const { loading, error, canAccess, userRole, isAuthenticated } = useRoleAuth();

  // Affichage pendant le chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  // Affichage en cas d'erreur
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <FaLock className="text-4xl text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Erreur d'authentification</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Vérifier si l'utilisateur est authentifié
  if (!isAuthenticated()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
          <FaLock className="text-4xl text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Accès non autorisé</h2>
          <p className="text-yellow-600">Vous devez être connecté pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  // Vérifier les permissions pour la section requise
  if (requiredSection && !canAccess(requiredSection, requiredAction)) {
    // Afficher le fallback personnalisé si fourni
    if (fallback) {
      return fallback;
    }

    // Affichage par défaut pour accès refusé
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200 max-w-md">
          <FaLock className="text-4xl text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Accès refusé</h2>
          <p className="text-red-600 mb-4">
            Votre rôle <strong>{ROLE_LABELS[userRole] || userRole}</strong> ne vous permet pas d'accéder à cette section.
          </p>
          <div className="text-sm text-gray-600">
            <p>Section demandée: <strong>{requiredSection}</strong></p>
            <p>Action demandée: <strong>{requiredAction}</strong></p>
          </div>
        </div>
      </div>
    );
  }

  // Afficher le contenu si toutes les vérifications passent
  return children;
};

// Composant pour afficher un message d'accès limité dans une section
export const AccessDeniedMessage = ({ section, action = 'view' }) => {
  const { userRole } = useRoleAuth();
  
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
      <div className="flex items-center gap-2 text-yellow-800">
        <FaLock />
        <h3 className="font-semibold">Accès limité</h3>
      </div>
      <p className="text-yellow-700 mt-2">
        Votre rôle <strong>{ROLE_LABELS[userRole] || userRole}</strong> ne vous permet pas 
        d'effectuer cette action ({action}) dans la section {section}.
      </p>
    </div>
  );
};

// Hook pour vérifier les permissions dans les composants
export const usePermissionCheck = () => {
  const { canAccess, userRole } = useRoleAuth();
  
  const checkPermission = (section, action = 'view') => {
    return canAccess(section, action);
  };
  
  const getPermissionMessage = (section, action = 'view') => {
    if (canAccess(section, action)) return null;
    
    return `Votre rôle ${ROLE_LABELS[userRole] || userRole} ne permet pas cette action.`;
  };
  
  return {
    checkPermission,
    getPermissionMessage,
    userRole
  };
};

export default RoleProtectedRoute;
