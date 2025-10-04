import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase"; // Assurez-vous que ceci pointe vers votre configuration Firebase

// Créer le contexte
const RestaurantContext = createContext();

// Hook personnalisé pour utiliser le contexte
export const useRestaurantContext = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error("useRestaurantContext doit être utilisé à l'intérieur de RestaurantProvider");
  }
  return context;
};

// Provider pour envelopper l'application
export const RestaurantProvider = ({ children }) => {
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    adresse: "",
    city: "",
    location: "",
    contact: "",
  });
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
  const [items, setItems] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Exemple : Charger les données du restaurant depuis Firestore (optionnel)
  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (currentRestaurantId) {
        try {
          setLoading(true);
          const restaurantRef = doc(db, "restaurants", currentRestaurantId);
          const restaurantSnap = await getDoc(restaurantRef);
          if (restaurantSnap.exists()) {
            const data = restaurantSnap.data();
            setRestaurant(data);
            setRestaurantForm({
              name: data.name || "",
              adresse: data.adresse || "",
              city: data.city || "",
              location: data.location || "",
              contact: data.contact || "",
            });
          } else {
            setError("Restaurant introuvable");
          }
        } catch (err) {
          console.error("Erreur lors du chargement du restaurant:", err);
          setError("Erreur lors du chargement du restaurant");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchRestaurantData();
  }, [currentRestaurantId]);

  // Fournir les valeurs au contexte
  const value = {
    restaurant,
    setRestaurant,
    restaurantForm,
    setRestaurantForm,
    currentRestaurantId,
    setCurrentRestaurantId,
    items,
    setItems,
    extraLists,
    setExtraLists,
    usersData,
    setUsersData,
    loading,
    setLoading,
    error,
    setError,
  };

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
};