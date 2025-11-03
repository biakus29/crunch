import React, { useState, useEffect } from 'react';
import { auth } from '../../../firebase';
import { FaBox, FaShoppingCart, FaMapMarkerAlt, FaChartLine } from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PartnerProducts from './PartnerProducts';
import PartnerOrders from './PartnerOrders';
import PartnerQuartiers from './PartnerQuartiers';
import PartnerStats from './PartnerStats';

const TABS = [
  { id: 'products', label: 'Produits Partenaires', icon: FaBox },
  { id: 'orders', label: 'Commandes', icon: FaShoppingCart },
  { id: 'quartiers', label: 'Quartiers & Livraison', icon: FaMapMarkerAlt },
  { id: 'stats', label: 'Chiffres d\'affaires', icon: FaChartLine },
];

const PartnerDashboard = ({ currentRestaurantId, userRole }) => {
  const [authUser, setAuthUser] = useState(undefined);
  const [activeTab, setActiveTab] = useState('products');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setAuthUser(u || null);
    });
    return () => unsubscribe();
  }, []);

  if (authUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-600">
        Chargement…
      </div>
    );
  }

  if (authUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-lg text-center">
          <h2 className="text-2xl font-semibold text-blue-700 mb-4">
            Service Livraisons — Partenaires
          </h2>
          <p className="mb-4">Cette section nécessite une connexion dédiée pour le service partenaires.</p>
          <div className="space-y-2">
            <a
              href="/login-partners"
              className="inline-block w-full bg-blue-600 text-white px-4 py-2 rounded"
            >
              Se connecter (service partenaires)
            </a>
            <div className="text-sm text-gray-600 mt-2">
              Remarque: ce login est distinct du login restaurant.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'products':
        return <PartnerProducts currentRestaurantId={currentRestaurantId} />;
      case 'orders':
        return <PartnerOrders currentRestaurantId={currentRestaurantId} />;
      case 'quartiers':
        return <PartnerQuartiers />;
      case 'stats':
        return <PartnerStats currentRestaurantId={currentRestaurantId} userRole={userRole} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <h1 className="text-2xl font-bold text-blue-700">Dashboard Partenaires</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestion des produits, commandes et livraisons partenaires
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg shadow mb-4">
        <div className="flex border-b overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default PartnerDashboard;
