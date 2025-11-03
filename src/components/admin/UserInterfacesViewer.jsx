import React, { useState } from 'react';
import { 
  FaUser, 
  FaUserTie, 
  FaShoppingCart, 
  FaTruck, 
  FaUtensils, 
  FaBox, 
  FaCode,
  FaEye,
  FaExternalLinkAlt,
  FaArrowLeft
} from 'react-icons/fa';

const UserInterfacesViewer = ({ userRole }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedInterface, setSelectedInterface] = useState(null);

  // Définition des rôles et leurs interfaces
  const roleInterfaces = {
    'manager': {
      label: 'Gérant',
      icon: <FaUserTie className="text-blue-600" />,
      color: 'blue',
      description: 'Accès complet au système de gestion',
      interfaces: [
        { id: 'dashboard', name: 'Tableau de Bord', description: 'Vue d\'ensemble des activités' },
        { id: 'orders', name: 'Gestion des Commandes', description: 'Suivi et gestion des commandes' },
        { id: 'reports', name: 'Rapports', description: 'Analyses et statistiques' },
        { id: 'accountingCenter', name: 'Centre Comptable', description: 'Gestion financière unifiée' },
        { id: 'managers', name: 'Gestion des Utilisateurs', description: 'Administration des comptes' },
        { id: 'deliveryOptimized', name: 'Système de Livraison', description: 'Gestion des livraisons' },
        { id: 'kitchen', name: 'Cuisine', description: 'Gestion de la production' }
      ]
    },
    'accountant': {
      label: 'Comptable',
      icon: <FaUser className="text-green-600" />,
      color: 'green',
      description: 'Focus sur la gestion financière et comptable',
      interfaces: [
        { id: 'accountingCenter', name: 'Centre Comptable', description: 'Interface principale comptable' },
        { id: 'orders', name: 'Commandes (Vue Financière)', description: 'Analyse financière des commandes' },
        { id: 'reports', name: 'Rapports Financiers', description: 'Rapports et analyses financières' },
        { id: 'budgets', name: 'Gestion des Budgets', description: 'Planification et suivi des budgets' },
        { id: 'expenseClassification', name: 'Classification des Sorties', description: 'Organisation des dépenses' },
        { id: 'accountAdjustment', name: 'Ajustement des Comptes', description: 'Correction des soldes' },
        { id: 'purchases', name: 'Achats', description: 'Suivi des achats et coûts' }
      ]
    },
    'kitchen_supply': {
      label: 'Responsable Cuisine',
      icon: <FaUtensils className="text-orange-600" />,
      color: 'orange',
      description: 'Gestion de la cuisine et des approvisionnements',
      interfaces: [
        { id: 'menus', name: 'Gestion des Menus', description: 'Création et modification des menus' },
        { id: 'categories', name: 'Catégories', description: 'Organisation des catégories' },
        { id: 'ingredients', name: 'Ingrédients', description: 'Base de données des ingrédients' },
        { id: 'purchases', name: 'Achats', description: 'Gestion des achats d\'ingrédients' },
        { id: 'kitchen', name: 'Cuisine', description: 'Gestion de la production' },
        { id: 'supplyReports', name: 'Rapports Appro', description: 'Analyses d\'approvisionnement' }
      ]
    },
    'order_manager': {
      label: 'Gestionnaire Commandes',
      icon: <FaShoppingCart className="text-purple-600" />,
      color: 'purple',
      description: 'Spécialisé dans la gestion des commandes',
      interfaces: [
        { id: 'orders', name: 'Commandes', description: 'Interface principale des commandes' },
        { id: 'createOrder', name: 'Créer Commande', description: 'Création de nouvelles commandes' },
        { id: 'takeawayOrder', name: 'Commandes à Emporter', description: 'Gestion des commandes sur place' },
        { id: 'payments', name: 'Paiements', description: 'Suivi des paiements' },
        { id: 'loyalty', name: 'Points Fidélité', description: 'Programme de fidélité' },
        { id: 'comments', name: 'Avis Clients', description: 'Gestion des retours clients' }
      ]
    },
    'delivery_manager': {
      label: 'Gestionnaire Livraison',
      icon: <FaTruck className="text-red-600" />,
      color: 'red',
      description: 'Gestion complète du système de livraison',
      interfaces: [
        { id: 'deliveryOptimized', name: 'Système Livraison', description: 'Interface principale livraison' },
        { id: 'deliveryDashboard', name: 'Tableau de Bord Livraison', description: 'Vue d\'ensemble livraisons' },
        { id: 'deliveryTracking', name: 'Suivi Livraisons', description: 'Suivi en temps réel' },
        { id: 'deliverers', name: 'Livreurs', description: 'Gestion des livreurs' },
        { id: 'deliveryShifts', name: 'Horaires Livreurs', description: 'Planification des équipes' },
        { id: 'deliveryExpenses', name: 'Dépenses Livraison', description: 'Gestion des coûts' }
      ]
    },
    'supply_manager': {
      label: 'Gestionnaire Approvisionnements',
      icon: <FaBox className="text-teal-600" />,
      color: 'teal',
      description: 'Gestion des approvisionnements et stocks',
      interfaces: [
        { id: 'supplies', name: 'Approvisionnements', description: 'Interface principale approvisionnements' },
        { id: 'ingredients', name: 'Ingrédients', description: 'Gestion des ingrédients' },
        { id: 'purchases', name: 'Achats', description: 'Planification des achats' },
        { id: 'supplyReports', name: 'Rapports Appro', description: 'Analyses d\'approvisionnement' }
      ]
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setSelectedInterface(null);
  };

  const handleInterfaceSelect = (interfaceId) => {
    setSelectedInterface(interfaceId);
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setSelectedInterface(null);
  };

  const handleBackToInterfaces = () => {
    setSelectedInterface(null);
  };

  if (selectedInterface && selectedRole) {
    // Vue de l'interface sélectionnée
    const role = roleInterfaces[selectedRole];
    const interfaceInfo = role.interfaces.find(i => i.id === selectedInterface);
    
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={handleBackToInterfaces}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Retour aux interfaces {role.label}
          </button>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            {role.icon}
            <span className="ml-3">{interfaceInfo.name}</span>
          </h2>
          <p className="text-gray-600 mt-2">{interfaceInfo.description}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔄</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Simulation de l'interface {interfaceInfo.name}
            </h3>
            <p className="text-gray-600 mb-6">
              Cette interface serait affichée avec les permissions du rôle {role.label}
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  // Ici on pourrait rediriger vers l'interface réelle
                  console.log(`Redirection vers ${selectedInterface} avec rôle ${selectedRole}`);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <FaExternalLinkAlt className="mr-2" />
                Ouvrir l'interface réelle
              </button>
              <button
                onClick={handleBackToInterfaces}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedRole) {
    // Vue des interfaces d'un rôle
    const role = roleInterfaces[selectedRole];
    
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={handleBackToRoles}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Retour aux rôles
          </button>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            {role.icon}
            <span className="ml-3">Interfaces {role.label}</span>
          </h2>
          <p className="text-gray-600 mt-2">{role.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {role.interfaces.map((interfaceItem) => (
            <div
              key={interfaceItem.id}
              onClick={() => handleInterfaceSelect(interfaceItem.id)}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {interfaceItem.name}
                </h3>
                <FaEye className="text-gray-400" />
              </div>
              <p className="text-gray-600 text-sm mb-4">
                {interfaceItem.description}
              </p>
              <div className="flex items-center text-blue-600 text-sm">
                <span>Cliquer pour voir</span>
                <FaExternalLinkAlt className="ml-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vue principale - sélection des rôles
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          👥 Interfaces Utilisateurs
        </h1>
        <p className="text-gray-600 text-lg">
          Explorez toutes les interfaces disponibles pour chaque rôle utilisateur
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(roleInterfaces).map(([roleKey, role]) => (
          <div
            key={roleKey}
            onClick={() => handleRoleSelect(roleKey)}
            className={`bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-all cursor-pointer border-2 hover:border-${role.color}-300`}
          >
            <div className="flex items-center mb-4">
              <div className="text-3xl mr-4">{role.icon}</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {role.label}
                </h3>
                <p className="text-gray-600 text-sm">
                  {role.interfaces.length} interfaces
                </p>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              {role.description}
            </p>
            <div className="flex items-center text-blue-600 text-sm">
              <span>Cliquer pour explorer</span>
              <FaExternalLinkAlt className="ml-2" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          💡 Comment utiliser cette interface
        </h3>
        <ul className="text-blue-700 space-y-2">
          <li>• <strong>Sélectionnez un rôle</strong> pour voir ses interfaces disponibles</li>
          <li>• <strong>Cliquez sur une interface</strong> pour la prévisualiser</li>
          <li>• <strong>Testez les permissions</strong> de chaque rôle utilisateur</li>
          <li>• <strong>Développez</strong> en comprenant l'expérience utilisateur</li>
        </ul>
      </div>
    </div>
  );
};

export default UserInterfacesViewer;




