import { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

// Fonction utilitaire pour récupérer le profil et le rôle utilisateur
const getAugmentedUserData = async (user) => {
  if (!user) return { isAdmin: false, userData: null };

  try {
    // 1) Vérifier dans users
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        isAdmin: data.role === 'admin' || data.role === 'dev',
        userData: { ...user, ...data }
      };
    }

    // 2) Vérifier dans usersrestau
    const userRestauDoc = await getDoc(doc(db, 'usersrestau', user.uid));
    if (userRestauDoc.exists()) {
      const data = userRestauDoc.data();
      return {
        isAdmin: data.role === 'admin' || data.role === 'dev',
        userData: { ...user, ...data }
      };
    }

    // 3) Fallback: vérifier partnerUsers (login partenaires)
    const partnerDoc = await getDoc(doc(db, 'partnerUsers', user.uid));
    if (partnerDoc.exists()) {
      const data = partnerDoc.data();
      const role = data.role || 'partner';
      const restaurantId = data.restaurantId || null;
      return {
        isAdmin: role === 'admin' || role === 'dev',
        userData: { ...user, role, restaurantId, ...data }
      };
    }

    // 4) Aucun profil trouvé, retourner l'utilisateur Firebase basique
    return { isAdmin: false, userData: user };
  } catch (error) {
    console.error("Erreur lors de la récupération du profil utilisateur:", error);
    return { isAdmin: false, userData: user };
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const { isAdmin: adminStatus, userData } = await getAugmentedUserData(firebaseUser);
        setUser(userData);
        setIsAdmin(adminStatus);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    isAdmin,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
}