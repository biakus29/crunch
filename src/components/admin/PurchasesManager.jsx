import React, { useState } from 'react';
import {
  FaShoppingCart,
  FaMoneyBillWave,
} from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import SimplePurchaseManager from './SimplePurchaseManager';
import BudgetManager from './BudgetManager';
import { hasPermission } from '../../utils/rolePermissions';

const PurchasesManager = ({ currentRestaurantId, userRole }) => {
  const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' ou 'budgets'

  return (
    <div className="p-4 sm:p-6">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      
      <div className="space-y-6">
        {/* Header avec onglets */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Gestion des Achats et Budgets</h3>
              <p className="text-sm text-gray-600">Suivi des achats et définition des budgets d'approvisionnement</p>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex space-x-1 mt-6">
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-4 py-2 rounded-lg font-medium transition duration-200 flex items-center ${
                activeTab === 'purchases'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FaShoppingCart className="mr-2" />
              Listes d'Achats
            </button>
            {hasPermission(userRole, 'purchases', 'viewFinances') && (
              <button
                onClick={() => setActiveTab('budgets')}
                className={`px-4 py-2 rounded-lg font-medium transition duration-200 flex items-center ${
                  activeTab === 'budgets'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FaMoneyBillWave className="mr-2" />
                Gestion des Budgets
              </button>
            )}
          </div>
        </div>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'purchases' ? (
          <SimplePurchaseManager 
            currentRestaurantId={currentRestaurantId} 
            userRole={userRole} 
          />
        ) : activeTab === 'budgets' && hasPermission(userRole, 'purchases', 'viewFinances') ? (
          <BudgetManager currentRestaurantId={currentRestaurantId} userRole={userRole} />
        ) : null}
      </div>

    </div>
  );
};

export default PurchasesManager;
