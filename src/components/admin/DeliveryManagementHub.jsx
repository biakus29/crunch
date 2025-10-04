import React, { useState } from 'react';
import {
  FaTruck,
  FaClock,
  FaMoneyBillWave,
  FaChartLine,
  FaMapMarkedAlt,
  FaUsers,
} from 'react-icons/fa';
import DeliveryManager from './DeliveryManager';
import DeliveryShiftManager from './DeliveryShiftManager';
import DeliveryExpensesManager from './DeliveryExpensesManager';
import DeliveryFinancialDashboard from './DeliveryFinancialDashboard';
import DeliveryTracking from './DeliveryTracking';

const DeliveryManagementHub = ({ currentRestaurantId, userRole }) => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    {
      id: 'dashboard',
      label: 'Tableau de Bord',
      icon: FaChartLine,
      color: 'blue',
      description: 'Vue d\'ensemble financière et rapports',
    },
    {
      id: 'tracking',
      label: 'Suivi Livraisons',
      icon: FaMapMarkedAlt,
      color: 'green',
      description: 'Suivi en temps réel des livraisons',
    },
    {
      id: 'deliverers',
      label: 'Livreurs',
      icon: FaUsers,
      color: 'purple',
      description: 'Gestion des livreurs',
    },
    {
      id: 'shifts',
      label: 'Horaires',
      icon: FaClock,
      color: 'orange',
      description: 'Gestion des entrées/sorties',
    },
    {
      id: 'expenses',
      label: 'Dépenses',
      icon: FaMoneyBillWave,
      color: 'red',
      description: 'Suivi des dépenses (carburant, pannes, etc.)',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DeliveryFinancialDashboard currentRestaurantId={currentRestaurantId} />;
      case 'tracking':
        return <DeliveryTracking currentRestaurantId={currentRestaurantId} />;
      case 'deliverers':
        return <DeliveryManager currentRestaurantId={currentRestaurantId} userRole={userRole} />;
      case 'shifts':
        return <DeliveryShiftManager currentRestaurantId={currentRestaurantId} />;
      case 'expenses':
        return <DeliveryExpensesManager currentRestaurantId={currentRestaurantId} userRole={userRole} />;
      default:
        return <DeliveryFinancialDashboard currentRestaurantId={currentRestaurantId} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center">
              <FaTruck className="mr-3" />
              Centre de Gestion des Livraisons
            </h2>
            <p className="mt-2 text-blue-100">
              Gestion complète des livreurs, horaires, dépenses et rapports financiers
            </p>
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm
                    transition-all duration-200
                    ${
                      isActive
                        ? `border-${tab.color}-500 text-${tab.color}-600`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      mr-2 text-lg
                      ${isActive ? `text-${tab.color}-600` : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Description de l'onglet actif */}
        <div className="bg-gray-50 px-6 py-3 border-b">
          <p className="text-sm text-gray-600">
            {tabs.find((t) => t.id === activeTab)?.description}
          </p>
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="transition-all duration-300">{renderContent()}</div>
    </div>
  );
};

export default DeliveryManagementHub;
