import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/authcontext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import SupplyManager from '../components/admin/SupplyManager';
import { Navigate } from 'react-router-dom';

const SupplyManagerDashboard = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'usersrestau', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile(userData);
          setRestaurantId(userData.restaurantId);
        }
      } catch (error) {
        console.error('Erreur chargement profil:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userProfile || userProfile.role !== 'supply_manager') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Accès non autorisé</h2>
          <p className="text-gray-600">Vous n'avez pas les droits pour accéder à cette interface.</p>
          <p className="text-sm text-gray-500 mt-2">Rôle requis: Gestionnaire des Approvisionnements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des Approvisionnements
              </h1>
              <p className="text-sm text-gray-600">
                Bienvenue, {userProfile.name}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{userProfile.name}</p>
                <p className="text-xs text-gray-500">Gestionnaire des Approvisionnements</p>
              </div>
              <button
                onClick={() => {
                  // Logout logic here
                  window.location.href = '/login';
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SupplyManager currentRestaurantId={restaurantId} userRole={userProfile?.role} />
      </div>
    </div>
  );
};

export default SupplyManagerDashboard;

