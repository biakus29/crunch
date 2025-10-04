import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ROLES, hasPermission, getDefaultSectionForRole } from '../utils/rolePermissions';

export const useRoleAuth = () => {
  const [user, setUser] = useState(null);
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
          setUserRole(userData.role);
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
            setUserRole(ROLES.MANAGER);
            setRestaurantId(restaurantDoc.id);
            setIsRestaurantOwner(true); // Propriétaire du restaurant
          } else {
            setError('Utilisateur non autorisé');
          }
        }
      } catch (err) {
        console.error('Erreur authentification:', err);
        setError('Erreur lors de la vérification des permissions');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Vérifier si l'utilisateur a accès à une section
  const canAccess = (section, action = 'view') => {
    if (!userRole) return false;
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
    return getDefaultSectionForRole(userRole);
  };

  // Vérifier si l'utilisateur est authentifié et autorisé
  const isAuthenticated = () => {
    return !!user && !!userRole;
  };

  // Vérifier si l'utilisateur est un gérant (accès complet)
  const isManager = () => {
    return userRole === ROLES.MANAGER;
  };

  // Obtenir les informations de l'utilisateur connecté
  const getCurrentUser = () => {
    return {
      user,
      role: userRole,
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
