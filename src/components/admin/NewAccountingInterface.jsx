import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { 
  FaChartLine, 
  FaMoneyBillWave, 
  FaShoppingCart, 
  FaUtensils, 
  FaTruck, 
  FaBox,
  FaPlus,
  FaEye,
  FaEdit,
  FaTrash,
  FaDownload,
  FaFilter,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaWallet,
  FaCreditCard,
  FaMobile
} from 'react-icons/fa';

const NewAccountingInterface = ({ orders = [], items = [], extraLists = [], userRole, currentRestaurantId }) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [cache, setCache] = useState({});
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '',
    category: '',
    department: '',
    description: '',
    paymentMethod: 'cash'
  });
  const [newBudget, setNewBudget] = useState({
    title: '',
    amount: '',
    department: '',
    description: ''
  });

  // Fonction de chargement optimisée avec cache
  const loadData = async (forceRefresh = false) => {
    const cacheKey = `data_${currentRestaurantId}_${selectedPeriod}`;
    const now = Date.now();
    
    // Vérifier le cache (5 minutes de validité)
    if (!forceRefresh && cache[cacheKey] && (now - cache[cacheKey].timestamp) < 300000) {
      const cachedData = cache[cacheKey].data;
      setExpenses(cachedData.expenses);
      setBudgets(cachedData.budgets);
      setPurchaseLists(cachedData.purchaseLists);
      setLastUpdate(new Date(cachedData.timestamp));
      return;
    }

    try {
      setRefreshing(true);
      
      // Charger toutes les données en parallèle
      const [expensesSnap, budgetsSnap, purchasesSnap] = await Promise.all([
        getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc'))),
        getDocs(query(collection(db, 'budgets'), orderBy('createdAt', 'desc'))),
        getDocs(query(
          collection(db, 'purchaseLists'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        ))
      ]);

      const expensesData = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const budgetsData = budgetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const purchasesData = purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Mettre à jour le cache
      const cacheData = {
        expenses: expensesData,
        budgets: budgetsData,
        purchaseLists: purchasesData,
        timestamp: now
      };
      setCache(prev => ({ ...prev, [cacheKey]: cacheData }));

      // Mettre à jour les états
      setExpenses(expensesData);
      setBudgets(budgetsData);
      setPurchaseLists(purchasesData);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Charger les données au montage et lors des changements
  useEffect(() => {
    if (currentRestaurantId) {
      loadData();
    }
  }, [currentRestaurantId, selectedPeriod]);

  // Auto-refresh toutes les 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true); // Force refresh
    }, 120000);

    return () => clearInterval(interval);
  }, [currentRestaurantId, selectedPeriod]);

  // Filtrer les commandes par période avec support des dates personnalisées
  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Si des dates personnalisées sont définies, les utiliser
    if (customDateRange.start && customDateRange.end) {
      const startDate = new Date(customDateRange.start);
      const endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999); // Fin de journée
      
      return orders.filter(order => {
        const orderDate = new Date(order.timestamp?.toDate?.() || order.timestamp);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }
    
    // Filtrage par période prédéfinie
    switch (selectedPeriod) {
      case 'today':
        return orders.filter(order => {
          const orderDate = new Date(order.timestamp?.toDate?.() || order.timestamp);
          return orderDate >= today;
        });
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orders.filter(order => {
          const orderDate = new Date(order.timestamp?.toDate?.() || order.timestamp);
          return orderDate >= weekAgo;
        });
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orders.filter(order => {
          const orderDate = new Date(order.timestamp?.toDate?.() || order.timestamp);
          return orderDate >= monthAgo;
        });
      case 'quarter':
        const quarterAgo = new Date(today);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        return orders.filter(order => {
          const orderDate = new Date(order.timestamp?.toDate?.() || order.timestamp);
          return orderDate >= quarterAgo;
        });
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return orders.filter(order => {
          const orderDate = new Date(order.timestamp?.toDate?.() || order.timestamp);
          return orderDate >= yearAgo;
        });
      default:
        return orders;
    }
  }, [orders, selectedPeriod, customDateRange]);

  // Calculer les revenus
  const revenue = useMemo(() => {
    return filteredOrders
      .filter(order => order.isPaid)
      .reduce((sum, order) => {
        const orderTotal = order.items?.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0) || 0;
        const deliveryFee = order.deliveryFee || 0;
        return sum + orderTotal + deliveryFee;
      }, 0);
  }, [filteredOrders]);

  // Calculer les dépenses
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  }, [expenses]);

  // Calculer les achats
  const totalPurchases = useMemo(() => {
    return purchaseLists.reduce((sum, purchase) => sum + (Number(purchase.total) || 0), 0);
  }, [purchaseLists]);

  // Calculer les budgets
  const totalBudgets = useMemo(() => {
    return budgets.reduce((sum, budget) => sum + (Number(budget.amount) || 0), 0);
  }, [budgets]);

  // Bénéfice net
  const netProfit = revenue - totalExpenses - totalPurchases - totalBudgets;

  // Répartition des revenus par méthode de paiement
  const revenueByPayment = useMemo(() => {
    const paymentMethods = { cash: 0, mobile: 0, card: 0, other: 0 };
    
    filteredOrders
      .filter(order => order.isPaid)
      .forEach(order => {
        const orderTotal = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
        const deliveryFee = order.deliveryFee || 0;
        const total = orderTotal + deliveryFee;
        
        // Analyser le mode de paiement
        if (order.payment?.method === 'mobile_money' || order.paymentMethod === 'Mobile Money') {
          paymentMethods.mobile += total;
        } else if (order.payment?.method === 'card' || order.paymentMethod === 'Carte') {
          paymentMethods.card += total;
        } else if (order.payment?.method === 'cash' || order.paymentMethod === 'Cash') {
          paymentMethods.cash += total;
        } else {
          paymentMethods.other += total;
        }
      });
    
    return paymentMethods;
  }, [filteredOrders]);

  // Gestion des dépenses optimisée
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        amount: Number(newExpense.amount),
        date: Timestamp.now(),
        restaurantId: currentRestaurantId,
        createdBy: userRole
      });
      
      // Réinitialiser le formulaire
      setNewExpense({ title: '', amount: '', category: '', department: '', description: '', paymentMethod: 'cash' });
      setShowAddExpense(false);
      
      // Recharger les données avec cache invalidé
      await loadData(true);
    } catch (error) {
      console.error('Erreur ajout dépense:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gestion des budgets optimisée
  const handleAddBudget = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await addDoc(collection(db, 'budgets'), {
        ...newBudget,
        amount: Number(newBudget.amount),
        createdAt: Timestamp.now(),
        restaurantId: currentRestaurantId,
        createdBy: userRole
      });
      
      // Réinitialiser le formulaire
      setNewBudget({ title: '', amount: '', department: '', description: '' });
      setShowAddBudget(false);
      
      // Recharger les données avec cache invalidé
      await loadData(true);
    } catch (error) {
      console.error('Erreur ajout budget:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction de rafraîchissement manuel
  const handleRefresh = async () => {
    await loadData(true);
  };

  // Fonction pour effacer les dates personnalisées
  const clearCustomDates = () => {
    setCustomDateRange({ start: '', end: '' });
    setSelectedPeriod('today');
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount || 0);
  };

  const getPeriodLabel = () => {
    if (customDateRange.start && customDateRange.end) {
      const start = new Date(customDateRange.start).toLocaleDateString('fr-FR');
      const end = new Date(customDateRange.end).toLocaleDateString('fr-FR');
      return `Du ${start} au ${end}`;
    }
    
    switch (selectedPeriod) {
      case 'today': return 'Aujourd\'hui';
      case 'week': return 'Cette semaine';
      case 'month': return 'Ce mois';
      case 'quarter': return 'Ce trimestre';
      case 'year': return 'Cette année';
      default: return 'Toutes les périodes';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">💰 Comptabilité</h1>
        <p className="text-blue-100">Gestion financière simplifiée et intuitive</p>
      </div>

      {/* Période et Filtres Optimisés */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <FaCalendarAlt className="text-blue-600 text-lg" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Période: {getPeriodLabel()}</h2>
              {lastUpdate && (
                <p className="text-xs text-gray-500">
                  Dernière mise à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Périodes prédéfinies */}
            <div className="flex flex-wrap gap-2">
              {['today', 'week', 'month', 'quarter', 'year', 'all'].map(period => (
                <button
                  key={period}
                  onClick={() => {
                    setSelectedPeriod(period);
                    setCustomDateRange({ start: '', end: '' });
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedPeriod === period && !customDateRange.start
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period === 'today' ? 'Aujourd\'hui' : 
                   period === 'week' ? 'Semaine' : 
                   period === 'month' ? 'Mois' :
                   period === 'quarter' ? 'Trimestre' :
                   period === 'year' ? 'Année' : 'Tout'}
                </button>
              ))}
            </div>
            
            {/* Dates personnalisées */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Début"
              />
              <span className="text-gray-500">à</span>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Fin"
              />
              {(customDateRange.start || customDateRange.end) && (
                <button
                  onClick={clearCustomDates}
                  className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Bouton de rafraîchissement */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                refreshing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {refreshing ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-green-600"></div>
              ) : (
                <FaFilter className="text-xs" />
              )}
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>
        </div>
      </div>

      {/* Tableau de Bord Financier */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Revenus */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 sm:p-6 border border-green-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <FaMoneyBillWave className="text-white text-lg" />
            </div>
            <FaArrowUp className="text-green-600 text-lg" />
          </div>
          <h3 className="text-sm font-medium text-green-800 mb-1">Revenus</h3>
          <p className="text-2xl sm:text-3xl font-bold text-green-900">{formatPrice(revenue)} FCFA</p>
          <p className="text-xs text-green-600 mt-1">{filteredOrders.filter(o => o.isPaid).length} commandes payées</p>
        </div>

        {/* Dépenses */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 sm:p-6 border border-red-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <FaShoppingCart className="text-white text-lg" />
            </div>
            <FaArrowDown className="text-red-600 text-lg" />
          </div>
          <h3 className="text-sm font-medium text-red-800 mb-1">Dépenses</h3>
          <p className="text-2xl sm:text-3xl font-bold text-red-900">{formatPrice(totalExpenses)} FCFA</p>
          <p className="text-xs text-red-600 mt-1">{expenses.length} dépenses enregistrées</p>
        </div>

        {/* Achats */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 sm:p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <FaUtensils className="text-white text-lg" />
            </div>
            <FaArrowDown className="text-orange-600 text-lg" />
          </div>
          <h3 className="text-sm font-medium text-orange-800 mb-1">Achats Cuisine</h3>
          <p className="text-2xl sm:text-3xl font-bold text-orange-900">{formatPrice(totalPurchases)} FCFA</p>
          <p className="text-xs text-orange-600 mt-1">{purchaseLists.length} listes d'achats</p>
        </div>

        {/* Bénéfice Net */}
        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-red-50 to-red-100 border-red-200'} rounded-lg p-4 sm:p-6 border`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 ${netProfit >= 0 ? 'bg-blue-500' : 'bg-red-500'} rounded-lg`}>
              <FaEquals className="text-white text-lg" />
            </div>
            {netProfit >= 0 ? <FaArrowUp className="text-blue-600 text-lg" /> : <FaArrowDown className="text-red-600 text-lg" />}
          </div>
          <h3 className={`text-sm font-medium ${netProfit >= 0 ? 'text-blue-800' : 'text-red-800'} mb-1`}>Bénéfice Net</h3>
          <p className={`text-2xl sm:text-3xl font-bold ${netProfit >= 0 ? 'text-blue-900' : 'text-red-900'}`}>
            {formatPrice(netProfit)} FCFA
          </p>
          <p className={`text-xs ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'} mt-1`}>
            {netProfit >= 0 ? 'Profit positif' : 'Perte'}
          </p>
        </div>
      </div>

      {/* Répartition des Paiements */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <FaCreditCard className="mr-2 text-blue-600" />
          Répartition des Paiements
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <FaWallet className="text-green-600 text-2xl mx-auto mb-2" />
            <p className="text-sm text-gray-600">Espèces</p>
            <p className="font-bold text-green-600">{formatPrice(revenueByPayment.cash)} FCFA</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <FaMobile className="text-orange-600 text-2xl mx-auto mb-2" />
            <p className="text-sm text-gray-600">Mobile Money</p>
            <p className="font-bold text-orange-600">{formatPrice(revenueByPayment.mobile)} FCFA</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <FaCreditCard className="text-blue-600 text-2xl mx-auto mb-2" />
            <p className="text-sm text-gray-600">Carte</p>
            <p className="font-bold text-blue-600">{formatPrice(revenueByPayment.card)} FCFA</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <FaBox className="text-purple-600 text-2xl mx-auto mb-2" />
            <p className="text-sm text-gray-600">Autres</p>
            <p className="font-bold text-purple-600">{formatPrice(revenueByPayment.other)} FCFA</p>
          </div>
        </div>
      </div>

      {/* Actions Rapides */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Actions Rapides</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center justify-center p-4 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
          >
            <FaPlus className="text-red-600 mr-2" />
            <span className="text-red-800 font-medium">Nouvelle Dépense</span>
          </button>
          <button
            onClick={() => setShowAddBudget(true)}
            className="flex items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <FaPlus className="text-blue-600 mr-2" />
            <span className="text-blue-800 font-medium">Nouveau Budget</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
            <FaDownload className="text-green-600 mr-2" />
            <span className="text-green-800 font-medium">Exporter PDF</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
            <FaEye className="text-purple-600 mr-2" />
            <span className="text-purple-800 font-medium">Voir Détails</span>
          </button>
        </div>
      </div>

      {/* Budgets par Département */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Budgets par Département</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => {
            // Calculer les budgets par département
            const budgetsByDept = budgets.reduce((acc, budget) => {
              const dept = budget.department || 'divers';
              acc[dept] = (acc[dept] || 0) + (Number(budget.amount) || 0);
              return acc;
            }, {});

            // Calculer les dépenses par département
            const expensesByDept = expenses.reduce((acc, expense) => {
              const dept = expense.department || 'divers';
              acc[dept] = (acc[dept] || 0) + (Number(expense.amount) || 0);
              return acc;
            }, {});

            // Départements avec leurs informations
            const departments = [
              { 
                id: 'cuisine', 
                name: '🍳 Cuisine', 
                description: 'Maged\'Abord + Crunch',
                color: 'orange',
                budgets: (budgetsByDept.cuisine || 0) + (budgetsByDept.magedabord || 0) + (budgetsByDept.crunch || 0),
                expenses: (expensesByDept.cuisine || 0) + (expensesByDept.magedabord || 0) + (expensesByDept.crunch || 0)
              },
              { 
                id: 'magedabord', 
                name: '🍽️ Maged\'Abord', 
                description: 'Restaurant principal',
                color: 'blue',
                budgets: budgetsByDept.magedabord || 0,
                expenses: expensesByDept.magedabord || 0
              },
              { 
                id: 'crunch', 
                name: '🥪 Crunch', 
                description: 'Restaurant secondaire',
                color: 'green',
                budgets: budgetsByDept.crunch || 0,
                expenses: expensesByDept.crunch || 0
              },
              { 
                id: 'square', 
                name: '🏪 Square', 
                description: 'Service de livraison',
                color: 'purple',
                budgets: budgetsByDept.square || 0,
                expenses: expensesByDept.square || 0
              },
              { 
                id: 'divers', 
                name: '📦 Divers', 
                description: 'Autres dépenses',
                color: 'gray',
                budgets: budgetsByDept.divers || 0,
                expenses: expensesByDept.divers || 0
              }
            ];

            return departments.map(dept => {
              const remaining = dept.budgets - dept.expenses;
              const isOverBudget = remaining < 0;
              
              return (
                <div key={dept.id} className={`p-4 rounded-lg border-2 ${
                  isOverBudget ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-800">{dept.name}</h4>
                      <p className="text-sm text-gray-600">{dept.description}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      dept.color === 'orange' ? 'bg-orange-500' :
                      dept.color === 'blue' ? 'bg-blue-500' :
                      dept.color === 'green' ? 'bg-green-500' :
                      dept.color === 'purple' ? 'bg-purple-500' : 'bg-gray-500'
                    }`}></div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Budget alloué:</span>
                      <span className="font-medium text-blue-600">{formatPrice(dept.budgets)} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Dépensé:</span>
                      <span className="font-medium text-red-600">{formatPrice(dept.expenses)} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-2">
                      <span className={isOverBudget ? 'text-red-600' : 'text-green-600'}>
                        {isOverBudget ? 'Dépassement:' : 'Restant:'}
                      </span>
                      <span className={isOverBudget ? 'text-red-600' : 'text-green-600'}>
                        {formatPrice(Math.abs(remaining))} FCFA
                      </span>
                    </div>
                  </div>
                  
                  {isOverBudget && (
                    <div className="mt-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                      ⚠️ Budget dépassé
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Dépenses Récentes */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Dépenses Récentes</h3>
        <div className="space-y-3">
          {expenses.slice(0, 5).map(expense => (
            <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <FaShoppingCart className="text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{expense.title}</p>
                  <p className="text-sm text-gray-600">{expense.category} • {expense.department}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-600">{formatPrice(expense.amount)} FCFA</p>
                <p className="text-xs text-gray-500">
                  {expense.date?.toDate?.()?.toLocaleDateString('fr-FR') || 'Date inconnue'}
                </p>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FaShoppingCart className="text-4xl mx-auto mb-2" />
              <p>Aucune dépense enregistrée</p>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {/* Modal Nouvelle Dépense */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Nouvelle Dépense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Sélectionner</option>
                  <option value="cuisine">Cuisine</option>
                  <option value="livraison">Livraison</option>
                  <option value="marketing">Marketing</option>
                  <option value="administration">Administration</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                <select
                  value={newExpense.department}
                  onChange={(e) => setNewExpense({...newExpense, department: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Sélectionner</option>
                  <option value="cuisine">🍳 Cuisine (Maged'Abord + Crunch)</option>
                  <option value="magedabord">Maged'Abord</option>
                  <option value="crunch">Crunch</option>
                  <option value="square">Square</option>
                  <option value="divers">Divers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nouveau Budget */}
      {showAddBudget && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Nouveau Budget</h3>
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={newBudget.title}
                  onChange={(e) => setNewBudget({...newBudget, title: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                <input
                  type="number"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                <select
                  value={newBudget.department}
                  onChange={(e) => setNewBudget({...newBudget, department: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Sélectionner</option>
                  <option value="cuisine">🍳 Cuisine (Maged'Abord + Crunch)</option>
                  <option value="magedabord">Maged'Abord</option>
                  <option value="crunch">Crunch</option>
                  <option value="square">Square</option>
                  <option value="divers">Divers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newBudget.description}
                  onChange={(e) => setNewBudget({...newBudget, description: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddBudget(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewAccountingInterface;
