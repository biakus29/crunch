import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import {
  FaUsers,
  FaMoneyBillWave,
  FaChartLine,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaFilter,
  FaDownload,
  FaEye,
  FaStore,
  FaShoppingCart,
  FaReceipt,
  FaExclamationTriangle,
  FaBell
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import ManagerDetailModal from './ManagerDetailModal';
import ManagerPerformanceChart from './ManagerPerformanceChart';
import ManagerAlertSystem from './ManagerAlertSystem';

const ManagerExpenseTracker = ({ currentRestaurantId, userRole }) => {
  const [managers, setManagers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedManager, setSelectedManager] = useState('all');
  const [selectedRestaurant, setSelectedRestaurant] = useState('all');
  const [selectedManagerDetail, setSelectedManagerDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAllData();
  }, [currentRestaurantId, selectedPeriod, dateRange]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadManagers(),
        loadRestaurants(),
        loadExpenses(),
        loadPurchases(),
        loadOrders()
      ]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async () => {
    try {
      const managersQuery = query(
        collection(db, 'usersrestau'),
        where('role', 'in', ['manager', 'accountant', 'kitchen_supply', 'supply_manager'])
      );
      const managersSnap = await getDocs(managersQuery);
      const managersData = managersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setManagers(managersData);
    } catch (error) {
      console.error('Erreur chargement gérants:', error);
    }
  };

  const loadRestaurants = async () => {
    try {
      const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
      const restaurantsData = restaurantsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRestaurants(restaurantsData);
    } catch (error) {
      console.error('Erreur chargement restaurants:', error);
    }
  };

  const loadExpenses = async () => {
    try {
      let expensesQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      
      if (currentRestaurantId) {
        expensesQuery = query(
          collection(db, 'expenses'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        );
      }

      const expensesSnap = await getDocs(expensesQuery);
      const expensesData = expensesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(expensesData);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    }
  };

  const loadPurchases = async () => {
    try {
      let purchasesQuery = query(collection(db, 'purchaseLists'), orderBy('date', 'desc'));
      
      if (currentRestaurantId) {
        purchasesQuery = query(
          collection(db, 'purchaseLists'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        );
      }

      const purchasesSnap = await getDocs(purchasesQuery);
      const purchasesData = purchasesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPurchases(purchasesData);
    } catch (error) {
      console.error('Erreur chargement achats:', error);
    }
  };

  const loadOrders = async () => {
    try {
      let ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      
      if (currentRestaurantId) {
        ordersQuery = query(
          collection(db, 'orders'),
          orderBy('createdAt', 'desc')
        );
      }

      const ordersSnap = await getDocs(ordersQuery);
      const ordersData = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      toast.error('Erreur lors du chargement des commandes');
    }
  };

  // Filtrer les données par période
  const filterByDateRange = (items, dateField = 'date') => {
    return items.filter(item => {
      const itemDate = item[dateField];
      if (!itemDate) return false;
      
      let dateToCompare;
      if (itemDate.toDate) {
        dateToCompare = itemDate.toDate().toISOString().split('T')[0];
      } else {
        dateToCompare = itemDate;
      }
      
      return dateToCompare >= dateRange.start && dateToCompare <= dateRange.end;
    });
  };

  // Calculer les métriques par gérant
  const managerMetrics = useMemo(() => {
    const metrics = {};

    managers.forEach(manager => {
      const managerId = manager.id;
      const managerName = manager.name || manager.email;
      const restaurantId = manager.restaurantId;
      const restaurant = restaurants.find(r => r.id === restaurantId);

      // Filtrer par restaurant si sélectionné
      if (selectedRestaurant !== 'all' && restaurantId !== selectedRestaurant) {
        return;
      }

      // Dépenses créées par ce gérant
      const managerExpenses = filterByDateRange(
        expenses.filter(exp => 
          (exp.createdBy === manager.email || exp.createdBy === manager.id) && 
          exp.restaurantId === restaurantId
        )
      );

      // Achats créés par ce gérant
      const managerPurchases = filterByDateRange(
        purchases.filter(purchase => purchase.restaurantId === restaurantId)
      );

      // Commandes créées par ce gérant (uniquement celles avec createdByManager)
      const managerOrders = filterByDateRange(
        orders.filter(order => order.createdByManager === manager.email),
        'createdAt'
      );

      // Calcul des revenus des commandes créées
      const managerRevenue = managerOrders.reduce((sum, order) => {
        const orderTotal = order.items?.reduce((itemSum, item) => 
          itemSum + (item.price * item.quantity), 0) || 0;
        return sum + orderTotal + (order.deliveryFee || 0);
      }, 0);

      // Calculs financiers
      const totalExpenses = managerExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const totalPurchases = managerPurchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0);
      const totalCosts = totalExpenses + totalPurchases;

      const netProfit = managerRevenue - totalCosts;
      const profitMargin = managerRevenue > 0 ? (netProfit / managerRevenue) * 100 : 0;
      
      // Ratio Revenus/Dépenses pour mesurer l'efficacité
      const revenueExpenseRatio = totalCosts > 0 ? (managerRevenue / totalCosts) : 0;

      metrics[managerId] = {
        manager: {
          id: managerId,
          name: managerName,
          role: manager.role,
          email: manager.email
        },
        restaurant: restaurant ? {
          id: restaurant.id,
          name: restaurant.name
        } : null,
        expenses: {
          count: managerExpenses.length,
          total: totalExpenses,
          items: managerExpenses
        },
        purchases: {
          count: managerPurchases.length,
          total: totalPurchases,
          items: managerPurchases
        },
        orders: {
          count: managerOrders.length,
          total: managerRevenue,
          items: managerOrders
        },
        financial: {
          revenue: managerRevenue,
          costs: totalCosts,
          profit: netProfit,
          margin: profitMargin,
          revenueExpenseRatio: revenueExpenseRatio
        }
      };
    });

    return metrics;
  }, [managers, restaurants, expenses, purchases, orders, dateRange, selectedRestaurant]);

  // Filtrer par gérant sélectionné
  const filteredMetrics = useMemo(() => {
    if (selectedManager === 'all') {
      return managerMetrics;
    }
    return { [selectedManager]: managerMetrics[selectedManager] };
  }, [managerMetrics, selectedManager]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const values = Object.values(filteredMetrics);
    return {
      totalManagers: Object.keys(filteredMetrics).length,
      totalRevenue: Object.values(filteredMetrics).reduce((sum, m) => sum + m.financial.revenue, 0),
      totalCosts: Object.values(filteredMetrics).reduce((sum, m) => sum + m.financial.costs, 0),
      totalProfit: Object.values(filteredMetrics).reduce((sum, m) => sum + m.financial.profit, 0),
      avgMargin: Object.keys(filteredMetrics).length > 0 ? values.reduce((sum, m) => sum + m.financial.margin, 0) / values.length : 0
    };
  }, [filteredMetrics]);

  // Alertes pour gérants en difficulté
  const alerts = useMemo(() => {
    const values = Object.values(filteredMetrics);
    const criticalManagers = values.filter(m => m.financial.profit < 0);
    const lowMarginManagers = values.filter(m => m.financial.margin < 10 && m.financial.profit >= 0);
    
    return {
      critical: criticalManagers,
      warning: lowMarginManagers,
      total: criticalManagers.length + lowMarginManagers.length
    };
  }, [filteredMetrics]);

  const handleViewManager = (manager) => {
    setSelectedManagerDetail(manager);
    setShowDetailModal(true);
  };

  const exportToCSV = () => {
    const csvData = Object.values(filteredMetrics).map(metric => ({
      'Gérant': metric.manager.name,
      'Email': metric.manager.email,
      'Rôle': metric.manager.role,
      'Restaurant': metric.restaurant?.name || 'N/A',
      'Dépenses Gérées (FCFA)': metric.expenses.total,
      'Nombre de Dépenses': metric.expenses.count,
      'Achats Supervisés (FCFA)': metric.purchases.total,
      'Commandes Créées': metric.orders.count,
      'Revenus Générés (FCFA)': metric.financial.revenue,
      'Impact Budgétaire (FCFA)': metric.financial.profit,
      'État': metric.financial.profit >= 0 ? 'Contrôle Budgétaire ✓' : 
              metric.expenses.count > 0 ? 'Actif' : 'Aucune donnée'
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi-depenses-gerants-${dateRange.start}-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <FaChartLine className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" />
        <p className="text-gray-600">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header avec filtres */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <FaUsers className="mr-3 text-blue-600" />
              Suivi des Dépenses par Gérant
            </h2>
            <p className="text-gray-600 mt-1">Évaluation des gérants basée sur leurs dépenses et contrôle budgétaire</p>

            {/* Explication du système */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-800 mb-2">💰 Système d'Évaluation par Dépenses</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-red-700 mb-1">📊 Dépenses Créées</h5>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Responsabilité directe des coûts</li>
                    <li>• Contrôle budgétaire par gérant</li>
                    <li>• Impact sur la rentabilité</li>
                    <li>• Gestion des achats et frais</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-green-700 mb-1">📈 Performance Budgétaire</h5>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Volume de dépenses gérées</li>
                    <li>• Efficacité de contrôle des coûts</li>
                    <li>• Contribution aux économies</li>
                    <li>• Rapport coût/bénéfice</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 p-3 bg-green-50 rounded border-l-4 border-green-400">
                <h5 className="font-medium text-green-700 mb-1">🎯 Objectif</h5>
                <p className="text-gray-600 text-xs">
                  Évaluer chaque gérant sur sa capacité à gérer et optimiser les dépenses de son restaurant.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {alerts.total > 0 && (
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                  showAlerts 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                <FaBell className="mr-2" />
                {alerts.total} Alerte{alerts.total > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <FaDownload className="mr-2" />
              Exporter CSV
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Période de début</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Période de fin</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gérant</label>
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les gérants</option>
              {managers.map(manager => (
                <option key={manager.id} value={manager.id}>
                  {manager.name || manager.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant</label>
            <select
              value={selectedRestaurant}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les restaurants</option>
              {restaurants.map(restaurant => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {showAlerts && alerts.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6"
        >
          <div className="flex items-center mb-4">
            <FaExclamationTriangle className="text-red-500 text-xl mr-3" />
            <h3 className="text-lg font-semibold text-red-800">
              Alertes de Performance ({alerts.total})
            </h3>
          </div>
          
          <div className="space-y-4">
            {alerts.critical.length > 0 && (
              <div>
                <h4 className="font-medium text-red-700 mb-2">
                  🔴 Gérants en déficit ({alerts.critical.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {alerts.critical.map(manager => (
                    <div key={manager.manager.id} className="bg-white rounded-lg p-3 border border-red-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{manager.manager.name}</p>
                          <p className="text-sm text-gray-600">{manager.restaurant?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">
                            {manager.financial.profit.toLocaleString()} FCFA
                          </p>
                          <button
                            onClick={() => handleViewManager(manager)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Voir détails
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alerts.warning.length > 0 && (
              <div>
                <h4 className="font-medium text-orange-700 mb-2">
                  🟡 Gérants avec marge faible ({alerts.warning.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {alerts.warning.map(manager => (
                    <div key={manager.manager.id} className="bg-white rounded-lg p-3 border border-orange-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{manager.manager.name}</p>
                          <p className="text-sm text-gray-600">{manager.restaurant?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-orange-600">
                            {manager.financial.margin.toFixed(1)}%
                          </p>
                          <button
                            onClick={() => handleViewManager(manager)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Voir détails
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <FaUsers className="text-blue-600 text-2xl mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Gérants Actifs</p>
              <p className="text-2xl font-bold text-blue-600">{globalStats.totalManagers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <FaArrowDown className="text-red-600 text-2xl mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Dépenses Totales Gérées</p>
              <p className="text-2xl font-bold text-red-600">
                {globalStats.totalCosts.toLocaleString()} FCFA
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <FaMoneyBillWave className="text-blue-600 text-2xl mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Contrôle Budgétaire</p>
              <p className="text-2xl font-bold text-blue-600">
                {globalStats.totalProfit >= 0 ? '+' : ''}{globalStats.totalProfit.toLocaleString()} FCFA
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <FaEquals className={`text-2xl mr-3 ${globalStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            <div>
              <p className="text-sm font-medium text-gray-600">État Financier</p>
              <p className={`text-2xl font-bold ${globalStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {globalStats.totalProfit >= 0 ? 'Excédent' : 'Déficit'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Graphique de performance */}
      <ManagerPerformanceChart 
        managers={Object.values(filteredMetrics)}
        dateRange={dateRange}
      />

      {/* Tableau des gérants */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Performance Budgétaire par Gérant</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gérant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Restaurant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dépenses Gérées
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Achats Supervisés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impact Budgétaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  État
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.values(filteredMetrics).map((metric) => (
                <tr key={metric.manager.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {metric.manager.name?.charAt(0) || metric.manager.email?.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {metric.manager.name || metric.manager.email}
                        </div>
                        <div className="text-sm text-gray-500">{metric.manager.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FaStore className="text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {metric.restaurant?.name || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-red-600">
                      {metric.expenses.total.toLocaleString()} FCFA
                    </div>
                    <div className="text-xs text-gray-500">
                      {metric.expenses.count} transactions
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-orange-600">
                      {metric.purchases.total.toLocaleString()} FCFA
                    </div>
                    <div className="text-xs text-gray-500">
                      {metric.purchases.count} achats
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      metric.financial.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.financial.profit >= 0 ? '+' : ''}{metric.financial.profit.toLocaleString()} FCFA
                    </div>
                    <div className="text-xs text-gray-500">
                      Impact net
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      metric.financial.profit >= 0 ? 'bg-green-100 text-green-800' :
                      metric.expenses.count > 0 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {metric.financial.profit >= 0 ? 'Contrôle ✓' : 
                       metric.expenses.count > 0 ? 'Actif' : 'Aucune donnée'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleViewManager(metric)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Voir les détails"
                    >
                      <FaEye />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de détails du gérant */}
      <ManagerDetailModal
        manager={selectedManagerDetail}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedManagerDetail(null);
        }}
      />

      {/* Système d'alertes */}
      <ManagerAlertSystem
        managers={Object.values(filteredMetrics)}
        onViewManager={handleViewManager}
        dateRange={dateRange}
      />
    </div>
  );
};

export default ManagerExpenseTracker;
