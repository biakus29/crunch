import React from 'react';
import { 
  FaUserTie, 
  FaCalculator, 
  FaUtensils, 
  FaShoppingBag, 
  FaBox, 
  FaTruck,
  FaHome,
  FaChartLine
} from 'react-icons/fa';
import { ROLES } from '../../utils/rolePermissions';

const RolePriorityIndicator = ({ userRole, activeSection }) => {
  // Configuration des interfaces prioritaires
  const roleConfig = {
    [ROLES.MANAGER]: {
      icon: <FaUserTie className="text-blue-600" />,
      label: 'Gérant',
      prioritySection: 'dashboard',
      priorityLabel: 'Tableau de Bord',
      description: 'Vue d\'ensemble complète du restaurant',
      color: 'blue'
    },
    [ROLES.ACCOUNTANT]: {
      icon: <FaCalculator className="text-green-600" />,
      label: 'Comptable',
      prioritySection: 'accountingReports',
      priorityLabel: 'Rapports Comptables',
      description: 'Gestion financière et rapports',
      color: 'green'
    },
    [ROLES.KITCHEN_SUPPLY]: {
      icon: <FaUtensils className="text-orange-600" />,
      label: 'Cuisine & Approvisionnements',
      prioritySection: 'purchases',
      priorityLabel: 'Achats & Approvisionnements',
      description: 'Gestion des achats et stocks',
      color: 'orange'
    },
    [ROLES.ORDER_MANAGER]: {
      icon: <FaShoppingBag className="text-purple-600" />,
      label: 'Gestionnaire Commandes',
      prioritySection: 'orders',
      priorityLabel: 'Commandes',
      description: 'Gestion des commandes et livraisons',
      color: 'purple'
    },
    [ROLES.SUPPLY_MANAGER]: {
      icon: <FaBox className="text-indigo-600" />,
      label: 'Gestionnaire Approvisionnements',
      prioritySection: 'supplies',
      priorityLabel: 'Approvisionnements',
      description: 'Gestion des stocks et fournisseurs',
      color: 'indigo'
    },
    [ROLES.DELIVERY_MANAGER]: {
      icon: <FaTruck className="text-red-600" />,
      label: 'Gestionnaire Livraisons',
      prioritySection: 'deliveryOptimized',
      priorityLabel: 'Système de Livraison',
      description: 'Gestion des livreurs et livraisons',
      color: 'red'
    }
  };

  const config = roleConfig[userRole];
  if (!config) return null;

  const isOnPrioritySection = activeSection === config.prioritySection;

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${
      isOnPrioritySection 
        ? `border-${config.color}-500 bg-${config.color}-50` 
        : 'border-gray-300'
    } p-4 mb-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {config.label}
            </h3>
            <p className="text-sm text-gray-600">
              {config.description}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          {isOnPrioritySection ? (
            <div className="flex items-center space-x-2">
              <FaHome className="text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Interface Prioritaire
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <FaChartLine className="text-gray-400" />
              <span className="text-sm text-gray-500">
                Interface Secondaire
              </span>
            </div>
          )}
        </div>
      </div>
      
      {!isOnPrioritySection && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            💡 <strong>Conseil :</strong> Votre interface prioritaire est "{config.priorityLabel}" 
            pour une gestion optimale de vos tâches.
          </p>
        </div>
      )}
    </div>
  );
};

export default RolePriorityIndicator;


