import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

const RestaurantInfo = () => {
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    adresse: "",
    city: "",
    location: "",
    contact: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "restaurants"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const restaurantDoc = querySnapshot.docs[0];
          setCurrentRestaurantId(restaurantDoc.id);
          const data = restaurantDoc.data();
          setRestaurant({ id: restaurantDoc.id, ...data });
          setRestaurantForm({
            name: data.name || "",
            adresse: data.adresse || "",
            city: data.city || "",
            location: data.location || "",
            contact: data.contact || "",
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateRestaurantInfo = async () => {
    try {
      const restaurantRef = doc(db, "restaurants", currentRestaurantId);
      await updateDoc(restaurantRef, { ...restaurantForm, updatedAt: Timestamp.now() });
      setRestaurant({ ...restaurant, ...restaurantForm });
      alert("Informations du restaurant mises à jour");
    } catch (error) {
      console.error("Erreur lors de la mise à jour du restaurant:", error);
      setError("Erreur lors de la mise à jour du restaurant");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Tableau de bord</h2>
        <nav className="space-y-2">
          <a href="/restaurant-info" className="block p-2 bg-green-600 text-white rounded-lg">Infos Restaurant</a>
          <a href="/menu-items" className="block p-2 hover:bg-gray-200 rounded-lg">Menus & Plats</a>
          <a href="/orders-feedback" className="block p-2 hover:bg-gray-200 rounded-lg">Commandes & Feedback</a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">
            Gestion des Informations du Restaurant
          </h3>
          {loading && (
            <div className="text-center p-4">
              <div
                className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"
                role="status"
              >
                <span className="sr-only">Chargement...</span>
              </div>
            </div>
          )}
          {error && (
            <p className="text-center text-red-600 p-4" role="alert">
              {error}
            </p>
          )}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["name", "adresse", "city", "location", "contact"].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field === "name"
                      ? "Nom du restaurant"
                      : field === "adresse"
                      ? "Adresse"
                      : field === "city"
                      ? "Ville"
                      : field === "location"
                      ? "Coordonnées GPS"
                      : "Contact"}
                  </label>
                  <input
                    type="text"
                    name={field}
                    placeholder={
                      field === "name"
                        ? "Nom du restaurant"
                        : field === "adresse"
                        ? "Adresse"
                        : field === "city"
                        ? "Ville"
                        : field === "location"
                        ? "Coordonnées GPS"
                        : "Contact"
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={restaurantForm[field]}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-6">
            <button
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
              onClick={updateRestaurantInfo}
              disabled={loading}
            >
              Mettre à jour les infos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantInfo;