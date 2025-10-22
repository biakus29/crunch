import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FaCode,
  FaDatabase,
  FaCog,
  FaBug,
  FaRocket,
  FaEye,
  FaUsers,
  FaShoppingCart,
  FaTruck,
  FaChartLine,
  FaMoneyBillWave,
  FaUtensils,
  FaFileExport,
  FaBroom,
  FaChartPie,
  FaSyncAlt,
  FaPlay,
  FaStop,
  FaRedo,
  FaTerminal,
  FaServer,
  FaShieldAlt,
  FaKey,
  FaLock,
  FaUnlock,
  FaWifi,
  FaWifiSlash,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle
} from 'react-icons/fa';

const DeveloperInterface = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStatus, setSystemStatus] = useState({
    database: 'connected',
    auth: 'active',
    storage: 'available',
    api: 'responsive'
  });
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState([]);

  // Vérifier si l'utilisateur est développeur
  const isDeveloper = userRole === 'developer' || userRole === 'admin';

  if (!isDeveloper) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <FaShieldAlt className="text-red-600 text-2xl mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Accès Refusé</h3>
            <p className="text-red-600 mt-1">
              Cette interface est réservée aux développeurs uniquement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Ajouter un log
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Tester une interface
  const testInterface = (interfaceName) => {
    addLog(`Test de l'interface: ${interfaceName}`, 'test');
    // Ici vous pouvez ajouter la logique de test
  };

  // Redémarrer le système
  const restartSystem = () => {
    addLog('Redémarrage du système...', 'warning');
    // Logique de redémarrage
  };

  // Nettoyer les logs
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs nettoyés', 'info');
  };

  // Interfaces disponibles
  const interfaces = [
    {
      id: 'dashboard',
      name: 'Tableau de Bord',
      icon: FaChartLine,
      color: 'blue',
      description: 'Vue d\'ensemble du système',
      status: 'active'
    },
    {
      id: 'orders',
      name: 'Gestion des Commandes',
      icon: FaShoppingCart,
      color: 'green',
      description: 'Interface de gestion des commandes',
      status: 'active'
    },
    {
      id: 'delivery',
      name: 'Système de Livraison',
      icon: FaTruck,
      color: 'purple',
      description: 'Gestion des livraisons et livreurs',
      status: 'active'
    },
    {
      id: 'reports',
      name: 'Rapports Comptables',
      icon: FaFileExport,
      color: 'orange',
      description: 'Rapports financiers et analyses',
      status: 'active'
    },
    {
      id: 'budgets',
      name: 'Gestion des Budgets',
      icon: FaMoneyBillWave,
      color: 'yellow',
      description: 'Gestion des budgets par département',
      status: 'active'
    },
    {
      id: 'kitchen',
      name: 'Gestion de Cuisine',
      icon: FaUtensils,
      color: 'red',
      description: 'Production et stock de cuisine',
      status: 'active'
    },
    {
      id: 'users',
      name: 'Gestion des Utilisateurs',
      icon: FaUsers,
      color: 'indigo',
      description: 'Gestion des rôles et permissions',
      status: 'active'
    },
    {
      id: 'cleanup',
      name: 'Nettoyage des Dépenses',
      icon: FaBroom,
      color: 'gray',
      description: 'Classification et nettoyage des dépenses',
      status: 'active'
    }
  ];

  // Statut du système
  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
      case 'active':
        return <FaCheckCircle className="text-green-500" />;
      case 'warning':
        return <FaExclamationTriangle className="text-yellow-500" />;
      case 'error':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaInfoCircle className="text-blue-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FaCode className="text-2xl text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Interface Développeur</h1>
                <p className="text-gray-600">Accès complet au système et outils de test</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FaWifi className="text-green-500" />
                <span className="text-sm text-gray-600">Système en ligne</span>
              </div>
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  debugMode ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {debugMode ? 'Debug ON' : 'Debug OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm h-screen overflow-y-auto">
          <nav className="p-4">
            <div className="space-y-2">
              {[
                { id: 'overview', name: 'Vue d\'ensemble', icon: FaEye },
                { id: 'interfaces', name: 'Interfaces', icon: FaServer },
                { id: 'database', name: 'Base de Données', icon: FaDatabase },
                { id: 'logs', name: 'Logs Système', icon: FaTerminal },
                { id: 'tools', name: 'Outils', icon: FaCog }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="mr-3" />
                  {tab.name}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(systemStatus).map(([key, status]) => (
                  <div key={key} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 capitalize">
                          {key.replace('_', ' ')}
                        </p>
                        <p className="text-2xl font-bold text-gray-900">{status}</p>
                      </div>
                      {getStatusIcon(status)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Actions Rapides</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => addLog('Test du système', 'test')}
                    className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <FaPlay className="mr-2 text-green-600" />
                    Tester
                  </button>
                  <button
                    onClick={restartSystem}
                    className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <FaRedo className="mr-2 text-blue-600" />
                    Redémarrer
                  </button>
                  <button
                    onClick={() => setDebugMode(!debugMode)}
                    className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <FaBug className="mr-2 text-purple-600" />
                    Debug
                  </button>
                  <button
                    onClick={clearLogs}
                    className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <FaBroom className="mr-2 text-red-600" />
                    Nettoyer
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interfaces' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Interfaces Disponibles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {interfaces.map((interface_) => (
                    <div
                      key={interface_.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <interface_.icon className={`text-2xl text-${interface_.color}-600`} />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(interface_.status)}`}>
                          {interface_.status}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">{interface_.name}</h4>
                      <p className="text-sm text-gray-600 mb-3">{interface_.description}</p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => testInterface(interface_.name)}
                          className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Tester
                        </button>
                        <button className="flex-1 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">
                          Accéder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">État de la Base de Données</h3>
                <div className="space-y-4">
                  {[
                    { name: 'Commandes', count: '1,234', status: 'active' },
                    { name: 'Utilisateurs', count: '45', status: 'active' },
                    { name: 'Menus', count: '12', status: 'active' },
                    { name: 'Livreurs', count: '8', status: 'active' }
                  ].map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        {getStatusIcon(item.status)}
                        <span className="ml-3 font-medium">{item.name}</span>
                      </div>
                      <span className="text-gray-600">{item.count} enregistrements</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Logs Système</h3>
                  <button
                    onClick={clearLogs}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Nettoyer
                  </button>
                </div>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-gray-500">Aucun log disponible</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500">[{log.timestamp}]</span>
                        <span className={`ml-2 ${
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'warning' ? 'text-yellow-400' :
                          log.type === 'test' ? 'text-blue-400' :
                          'text-green-400'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Outils de Développement</h3>
                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <span>Console de Développement</span>
                      <FaTerminal />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <span>Inspecteur de Base de Données</span>
                      <FaDatabase />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <span>Testeur d'API</span>
                      <FaRocket />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <span>Générateur de Données</span>
                      <FaSyncAlt />
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Configuration</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Mode Debug</span>
                      <button
                        onClick={() => setDebugMode(!debugMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                          debugMode ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            debugMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Logs Détaillés</span>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Mode Test</span>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeveloperInterface;
