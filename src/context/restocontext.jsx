import { getAuth, onAuthStateChanged } from "firebase/auth";
import React, { useState, useEffect, createContext } from "react";
export const RestaurantContext = createContext();

export const RestaurantProvider = ({ children }) => {
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Supposons que restaurantId est dans les custom claims ou Firestore
        setCurrentRestaurantId(user.restaurantId || "restaurant123");
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <RestaurantContext.Provider value={{ currentRestaurantId, setCurrentRestaurantId }}>
      {children}
    </RestaurantContext.Provider>
  );
};