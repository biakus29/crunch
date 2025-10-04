import { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

// Fonction utilitaire pour vérifier si un utilisateur est admin
const checkAdminStatus = async (user) => {
  if (!user) return { isAdmin: false, userData: null };
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return { 
        isAdmin: userDoc.data().role === 'admin',
        userData: { ...user, ...userDoc.data() }
      };
    }
    return { isAdmin: false, userData: user };
  } catch (error) {
    console.error("Erreur lors de la vérification du statut admin:", error);
    return { isAdmin: false, userData: user };
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const { isAdmin: adminStatus, userData } = await checkAdminStatus(user);
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