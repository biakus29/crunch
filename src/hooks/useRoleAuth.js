import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ROLES, hasPermission, getDefaultSectionForRole } from '../utils/rolePermissions';

export const useRoleAuth = () => {
  const [user, setUser] = useState(null);
  // userRole devient un tableau de rôles pour supporter le multi-rôles
  const [userRole, setUserRole] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [isRestaurantOwner, setIsRestaurantOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      try {
        setLoading(true);
        setError(null);

        if (!authUser) {
          setUser(null);
          setUserRole(null);
          setRestaurantId(null);
          setIsRestaurantOwner(false);
          setLoading(false);
          return;
        }

        // Récupérer les informations utilisateur depuis usersrestau
        const userDoc = await getDoc(doc(db, 'usersrestau', authUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({ id: authUser.uid, ...userData });
          // Normaliser en tableau: privilégier userData.roles sinon basculer role -> [role]
          const rolesArray = Array.isArray(userData.roles)
            ? userData.roles
            : (userData.role ? [userData.role] : []);
          setUserRole(rolesArray);
          setRestaurantId(userData.restaurantId);
          setIsRestaurantOwner(false); // Utilisateur employé
        } else {
          // Fallback: vérifier si c'est un gérant de restaurant
          const restaurantQuery = query(
            collection(db, 'restaurants'),
            where('uid', '==', authUser.uid)
          );
          const restaurantSnap = await getDocs(restaurantQuery);
          
          if (!restaurantSnap.empty) {
            const restaurantDoc = restaurantSnap.docs[0];
            const restaurantData = restaurantDoc.data();
            
            setUser({
              id: authUser.uid,
              email: authUser.email,
              name: restaurantData.name,
              role: ROLES.MANAGER
            });
            // Propriétaire: rôle manager en tableau
            setUserRole([ROLES.MANAGER]);
            setRestaurantId(restaurantDoc.id);
            setIsRestaurantOwner(true); // Propriétaire du restaurant
          } else {
            setError('Utilisateur non autorisé');
          }
        }
      } catch (err) {
        console.error('Erreur authentification:', err);
        setError('Erreur lors de la vérification des permissions');
        // En cas d'erreur, permettre l'accès avec un rôle par défaut
        setUser({ id: authUser.uid, email: authUser.email, role: 'guest' });
        setUserRole(['guest']);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Vérifier si l'utilisateur a accès à une section
  const canAccess = (section, action = 'view') => {
    if (!userRole) return false;
    // hasPermission supporte maintenant un tableau de rôles
    return hasPermission(userRole, section, action);
  };

  // Vérifier si l'utilisateur peut accéder à tous les restaurants
  const canAccessAllRestaurants = () => {
    if (!userRole) return false;
    return isRestaurantOwner || hasPermission(userRole, 'any', 'accessAllRestaurants');
  };

  // Obtenir la section par défaut pour redirection
  const getDefaultSection = () => {
    if (!userRole) return null;
    // Si plusieurs rôles, retourner la première section par défaut trouvée
    if (Array.isArray(userRole)) {
      for (const r of userRole) {
        const s = getDefaultSectionForRole(r);
        if (s) return s;
      }
      return null;
    }
    return getDefaultSectionForRole(userRole);
  };

  // Vérifier si l'utilisateur est authentifié et autorisé
  const isAuthenticated = () => {
    return !!user && Array.isArray(userRole) ? userRole.length > 0 : !!userRole;
  };

  // Vérifier si l'utilisateur est un gérant (accès complet)
  const isManager = () => {
    return Array.isArray(userRole)
      ? userRole.includes(ROLES.MANAGER)
      : userRole === ROLES.MANAGER;
  };

  // Obtenir les informations de l'utilisateur connecté
  const getCurrentUser = () => {
    return {
      user,
      role: userRole, // peut être un tableau
      restaurantId,
      isManager: isManager(),
      isRestaurantOwner,
      isAuthenticated: isAuthenticated(),
      canAccessAllRestaurants: canAccessAllRestaurants()
    };
  };

  return {
    user,
    userRole,
    restaurantId,
    isRestaurantOwner,
    loading,
    error,
    canAccess,
    canAccessAllRestaurants,
    getDefaultSection,
    isAuthenticated,
    isManager,
    getCurrentUser
  };
};
