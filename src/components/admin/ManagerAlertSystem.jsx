import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBell,
  FaExclamationTriangle,
  FaTimes,
  FaEye,
  FaCheckCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const ManagerAlertSystem = ({ managers, onViewManager, dateRange }) => {
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [showNotifications, setShowNotifications] = useState(false);

  // Générer les alertes basées sur les performances
  useEffect(() => {
    const newAlerts = [];
    const now = Date.now();

    managers.forEach(manager => {
      const alertId = `${manager.manager.id}-${dateRange.start}-${dateRange.end}`;
      
      // Alerte critique : gérant en déficit
      if (manager.financial.profit < 0 && !dismissedAlerts.has(`critical-${alertId}`)) {
        newAlerts.push({
          id: `critical-${alertId}`,
          type: 'critical',
          title: 'Gérant en Déficit',
          message: `${manager.manager.name} (${manager.restaurant?.name}) a un déficit de ${Math.abs(manager.financial.profit).toLocaleString()} FCFA`,
          manager: manager,
          timestamp: now,
          priority: 1
        });
      }

      // Alerte warning : marge très faible
      if (manager.financial.margin < 5 && manager.financial.profit >= 0 && !dismissedAlerts.has(`warning-${alertId}`)) {
        newAlerts.push({
          id: `warning-${alertId}`,
          type: 'warning',
          title: 'Marge Très Faible',
          message: `${manager.manager.name} (${manager.restaurant?.name}) a une marge de seulement ${manager.financial.margin.toFixed(1)}%`,
          manager: manager,
          timestamp: now,
          priority: 2
        });
      }

      // Alerte info : performance excellente
      if (manager.financial.margin >= 25 && !dismissedAlerts.has(`success-${alertId}`)) {
        newAlerts.push({
          id: `success-${alertId}`,
          type: 'success',
          title: 'Performance Excellente',
          message: `${manager.manager.name} (${manager.restaurant?.name}) maintient une excellente marge de ${manager.financial.margin.toFixed(1)}%`,
          manager: manager,
          timestamp: now,
          priority: 3
        });
      }

      // Alerte coûts élevés : coûts > 80% des revenus
      const costRatio = manager.financial.revenue > 0 ? (manager.financial.costs / manager.financial.revenue) * 100 : 0;
      if (costRatio > 80 && manager.financial.profit >= 0 && !dismissedAlerts.has(`costs-${alertId}`)) {
        newAlerts.push({
          id: `costs-${alertId}`,
          type: 'warning',
          title: 'Coûts Élevés',
          message: `${manager.manager.name} (${manager.restaurant?.name}) a des coûts représentant ${costRatio.toFixed(1)}% des revenus`,
          manager: manager,
          timestamp: now,
          priority: 2
        });
      }
    });

    // Trier par priorité (1 = critique, 2 = warning, 3 = success)
    newAlerts.sort((a, b) => a.priority - b.priority);
    setAlerts(newAlerts);

    // Afficher les notifications toast pour les nouvelles alertes critiques
    newAlerts.filter(alert => alert.type === 'critical').forEach(alert => {
      toast.error(alert.message, {
        position: "top-right",
        autoClose: 8000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    });

  }, [managers, dismissedAlerts, dateRange]);

  const dismissAlert = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'critical':
        return <FaExclamationTriangle className="text-red-500" />;
      case 'warning':
        return <FaBell className="text-yellow-500" />;
      case 'success':
        return <FaCheckCircle className="text-green-500" />;
      default:
        return <FaBell className="text-blue-500" />;
    }
  };

  const getAlertColors = (type) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Bouton de notification flottant */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className={`relative p-4 rounded-full shadow-lg transition-colors ${
            alerts.some(a => a.type === 'critical') 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          <FaBell className="text-xl" />
          {alerts.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {alerts.length > 9 ? '9+' : alerts.length}
            </span>
          )}
        </button>
      </motion.div>

      {/* Panel de notifications */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-40 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Alertes de Performance</h3>
                  <p className="text-blue-100 text-sm">{alerts.length} notification{alerts.length > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-white hover:text-blue-200 p-1"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto h-full pb-20">
              {alerts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FaCheckCircle className="text-4xl mx-auto mb-4 text-green-500" />
                  <p>Aucune alerte active</p>
                  <p className="text-sm">Toutes les performances sont normales</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`p-4 rounded-lg border ${getAlertColors(alert.type)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="mt-1">
                            {getAlertIcon(alert.type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{alert.title}</h4>
                            <p className="text-sm mt-1 opacity-90">{alert.message}</p>
                            <p className="text-xs mt-2 opacity-75">
                              {new Date(alert.timestamp).toLocaleTimeString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="text-gray-400 hover:text-gray-600 ml-2"
                        >
                          <FaTimes className="text-sm" />
                        </button>
                      </div>
                      
                      <div className="flex space-x-2 mt-3">
                        <button
                          onClick={() => {
                            onViewManager(alert.manager);
                            setShowNotifications(false);
                          }}
                          className="text-xs px-3 py-1 bg-white bg-opacity-50 rounded-full hover:bg-opacity-75 transition-colors flex items-center"
                        >
                          <FaEye className="mr-1" />
                          Voir détails
                        </button>
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="text-xs px-3 py-1 bg-white bg-opacity-50 rounded-full hover:bg-opacity-75 transition-colors"
                        >
                          Ignorer
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-25 z-30"
            onClick={() => setShowNotifications(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ManagerAlertSystem;
