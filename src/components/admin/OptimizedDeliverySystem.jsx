import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  FaTruck,
  FaClock,
  FaMapMarkerAlt,
  FaPhone,
  FaCheckCircle,
  FaUser,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaChartLine,
  FaMoneyBillWave,
  FaSignInAlt,
  FaSignOutAlt,
  FaExclamationTriangle,
  FaRoute,
  FaBatteryHalf,
  FaGasPump,
  FaWrench,
  FaMotorcycle,
  FaCar,
  FaBicycle,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const OptimizedDeliverySystem = ({ currentRestaurantId, userRole }) => {
  // États principaux
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [deliverers, setDeliverers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // États pour les modals
  const [showDelivererModal, setShowDelivererModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedDeliverer, setSelectedDeliverer] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  
  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [delivererFilter, setDelivererFilter] = useState('all');
  
  // États pour les filtres des livreurs
  const [delivererSearchTerm, setDelivererSearchTerm] = useState('');
  const [delivererStatusFilter, setDelivererStatusFilter] = useState('all'); // all, active, inactive, online, offline
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // name, phone, vehicleType, zone, rating, deliveries
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  
  // Formulaires
  const [delivererForm, setDelivererForm] = useState({
    name: '',
    phone: '',
    email: '',
    vehicleType: 'moto',
    vehicleNumber: '',
    zone: '',
    active: true,
    maxCapacity: 5,
    currentLocation: null
  });
  
  const [expenseForm, setExpenseForm] = useState({
    type: 'fuel',
    amount: 0,
    description: '',
    delivererId: '',
    date: new Date().toISOString().split('T')[0],
    receipt: null
  });

  // Types de véhicules
  const VEHICLE_TYPES = [
    { value: 'moto', label: '🏍️ Moto', icon: FaMotorcycle, capacity: 3, speed: 'rapide' },
    { value: 'car', label: '🚗 Voiture', icon: FaCar, capacity: 8, speed: 'moyen' },
    { value: 'bicycle', label: '🚲 Vélo', icon: FaBicycle, capacity: 2, speed: 'lent' },
    { value: 'scooter', label: '🛵 Scooter', icon: FaMotorcycle, capacity: 2, speed: 'rapide' }
  ];

  // Types de dépenses
  const EXPENSE_TYPES = [
    { value: 'fuel', label: '⛽ Carburant', icon: FaGasPump, color: 'blue' },
    { value: 'maintenance', label: '🔧 Maintenance', icon: FaWrench, color: 'orange' },
    { value: 'repair', label: '🛠️ Réparation', icon: FaWrench, color: 'red' },
    { value: 'other', label: '📋 Autres', icon: FaMoneyBillWave, color: 'gray' }
  ];

  // Chargement des données
  useEffect(() => {
    if (!currentRestaurantId) return;
    loadAllData();
  }, [currentRestaurantId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadOrders(),
        loadDeliverers(),
        loadShifts(),
        loadExpenses()
      ]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    const ordersQuery = query(
      collection(db, 'orders'),
      where('restaurantId', '==', currentRestaurantId),
      where('status', 'in', ['delivering', 'delivered', 'en_livraison', 'livree', 'client_indisponible'])
    );
    
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(ordersData);
    });
    
    return unsubscribe;
  };

  const loadDeliverers = async () => {
    const deliverersSnap = await getDocs(
      query(
        collection(db, 'deliverers'),
        where('restaurantId', '==', currentRestaurantId)
      )
    );
    
    const deliverersData = deliverersSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    setDeliverers(deliverersData);
  };

  const loadShifts = async () => {
    const shiftsSnap = await getDocs(
      query(
        collection(db, 'deliveryShifts'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('startTime', 'desc')
      )
    );
    
    const shiftsData = shiftsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    setShifts(shiftsData);
  };

  const loadExpenses = async () => {
    const expensesSnap = await getDocs(
      query(
        collection(db, 'deliveryExpenses'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('date', 'desc')
      )
    );
    
    const expensesData = expensesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    setExpenses(expensesData);
  };

  // Calculs et statistiques
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const deliveringOrders = orders.filter(o => 
      ['delivering', 'en_livraison'].includes(o.status) && 
      o.assignedDeliverer && 
      o.assignedDeliverer !== 'Non assigné'
    );
    
    const deliveredToday = orders.filter(o => {
      if (!['delivered', 'livree'].includes(o.status)) return false;
      if (!o.deliveryCompletedAt) return false;
      const deliveryDate = o.deliveryCompletedAt.toDate();
      return deliveryDate >= today;
    });
    
    const avgDeliveryTime = deliveredToday.length > 0
      ? Math.round(deliveredToday.reduce((sum, o) => sum + (o.deliveryDurationMinutes || 0), 0) / deliveredToday.length)
      : 0;
    
    const totalDeliveryFees = deliveredToday.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    
    const activeDeliverers = deliverers.filter(d => d.active).length;
    
    const todayExpenses = expenses.filter(e => {
      const expenseDate = e.date.toDate();
      return expenseDate >= today;
    });
    
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    return {
      delivering: deliveringOrders.length,
      delivered: deliveredToday.length,
      avgTime: avgDeliveryTime,
      totalFees: totalDeliveryFees,
      activeDeliverers,
      totalExpenses,
      profit: totalDeliveryFees - totalExpenses
    };
  }, [orders, deliverers, expenses]);

  // Filtrage des données
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => {
        if (statusFilter === 'delivering') {
          return ['delivering', 'en_livraison'].includes(order.status);
        } else if (statusFilter === 'delivered') {
          return ['delivered', 'livree'].includes(order.status);
        }
        return true;
      });
    }
    
    if (delivererFilter !== 'all') {
      filtered = filtered.filter(order => order.assignedDeliverer === delivererFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.assignedDeliverer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.address?.area?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [orders, statusFilter, delivererFilter, searchTerm]);

  // Filtrage et tri des livreurs
  const filteredDeliverers = useMemo(() => {
    let filtered = deliverers;
    
    // Filtre par recherche
    if (delivererSearchTerm) {
      filtered = filtered.filter(deliverer => 
        deliverer.name.toLowerCase().includes(delivererSearchTerm.toLowerCase()) ||
        deliverer.phone.toLowerCase().includes(delivererSearchTerm.toLowerCase()) ||
        deliverer.email?.toLowerCase().includes(delivererSearchTerm.toLowerCase()) ||
        deliverer.zone?.toLowerCase().includes(delivererSearchTerm.toLowerCase())
      );
    }
    
    // Filtre par statut
    if (delivererStatusFilter !== 'all') {
      filtered = filtered.filter(deliverer => {
        switch (delivererStatusFilter) {
          case 'active':
            return deliverer.active === true;
          case 'inactive':
            return deliverer.active === false;
          case 'online':
            return deliverer.isOnline === true;
          case 'offline':
            return deliverer.isOnline === false;
          default:
            return true;
        }
      });
    }
    
    // Filtre par type de véhicule
    if (vehicleTypeFilter !== 'all') {
      filtered = filtered.filter(deliverer => deliverer.vehicleType === vehicleTypeFilter);
    }
    
    // Filtre par zone
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(deliverer => deliverer.zone === zoneFilter);
    }
    
    // Tri
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'phone':
          aValue = a.phone;
          bValue = b.phone;
          break;
        case 'vehicleType':
          aValue = a.vehicleType;
          bValue = b.vehicleType;
          break;
        case 'zone':
          aValue = a.zone || '';
          bValue = b.zone || '';
          break;
        case 'rating':
          aValue = a.rating || 0;
          bValue = b.rating || 0;
          break;
        case 'deliveries':
          aValue = a.totalDeliveries || 0;
          bValue = b.totalDeliveries || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  }, [deliverers, delivererSearchTerm, delivererStatusFilter, vehicleTypeFilter, zoneFilter, sortBy, sortOrder]);

  // Statistiques des livreurs
  const delivererStats = useMemo(() => {
    const total = deliverers.length;
    const active = deliverers.filter(d => d.active).length;
    const online = deliverers.filter(d => d.isOnline).length;
    const byVehicle = VEHICLE_TYPES.reduce((acc, type) => {
      acc[type.value] = deliverers.filter(d => d.vehicleType === type.value).length;
      return acc;
    }, {});
    
    return { total, active, online, byVehicle };
  }, [deliverers]);

  // Gestion des livreurs
  const handleCreateDeliverer = async () => {
    try {
      if (!delivererForm.name.trim() || !delivererForm.phone.trim()) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      await addDoc(collection(db, 'deliverers'), {
        ...delivererForm,
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
        totalDeliveries: 0,
        rating: 0,
        earnings: 0,
        currentLocation: null,
        isOnline: false
      });
      
      toast.success('Livreur créé avec succès');
      resetDelivererForm();
      loadDeliverers();
    } catch (error) {
      console.error('Erreur création livreur:', error);
      toast.error('Erreur lors de la création du livreur');
    }
  };

  const handleUpdateDeliverer = async () => {
    try {
      await updateDoc(doc(db, 'deliverers', selectedDeliverer.id), {
        ...delivererForm,
        updatedAt: serverTimestamp()
      });
      
      toast.success('Livreur modifié avec succès');
      resetDelivererForm();
      loadDeliverers();
    } catch (error) {
      console.error('Erreur modification livreur:', error);
      toast.error('Erreur lors de la modification du livreur');
    }
  };

  const handleDeleteDeliverer = async (delivererId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce livreur ?')) return;
    
    try {
      await deleteDoc(doc(db, 'deliverers', delivererId));
      toast.success('Livreur supprimé avec succès');
      loadDeliverers();
    } catch (error) {
      console.error('Erreur suppression livreur:', error);
      toast.error('Erreur lors de la suppression du livreur');
    }
  };

  const resetDelivererForm = () => {
    setDelivererForm({
      name: '',
      phone: '',
      email: '',
      vehicleType: 'moto',
      vehicleNumber: '',
      zone: '',
      active: true,
      maxCapacity: 5,
      currentLocation: null
    });
    setSelectedDeliverer(null);
    setShowDelivererModal(false);
  };

  // Gestion des dépenses
  const handleCreateExpense = async () => {
    try {
      if (!expenseForm.amount || !expenseForm.type || !expenseForm.delivererId) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      await addDoc(collection(db, 'deliveryExpenses'), {
        ...expenseForm,
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
        amount: Number(expenseForm.amount)
      });
      
      toast.success('Dépense enregistrée avec succès');
      resetExpenseForm();
      loadExpenses();
    } catch (error) {
      console.error('Erreur création dépense:', error);
      toast.error('Erreur lors de l\'enregistrement de la dépense');
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      type: 'fuel',
      amount: 0,
      description: '',
      delivererId: '',
      date: new Date().toISOString().split('T')[0],
      receipt: null
    });
    setSelectedExpense(null);
    setShowExpenseModal(false);
  };

  // Gestion des horaires
  const handleStartShift = async (delivererId) => {
    try {
      await addDoc(collection(db, 'deliveryShifts'), {
        delivererId,
        restaurantId: currentRestaurantId,
        startTime: serverTimestamp(),
        endTime: null,
        status: 'active',
        createdAt: serverTimestamp()
      });
      
      toast.success('Service démarré');
      loadShifts();
    } catch (error) {
      console.error('Erreur démarrage service:', error);
      toast.error('Erreur lors du démarrage du service');
    }
  };

  const handleEndShift = async (shiftId) => {
    try {
      await updateDoc(doc(db, 'deliveryShifts', shiftId), {
        endTime: serverTimestamp(),
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      
      toast.success('Service terminé');
      loadShifts();
    } catch (error) {
      console.error('Erreur fin service:', error);
      toast.error('Erreur lors de la fin du service');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🚚 Système de Livraison Optimisé</h2>
            <p className="text-gray-600 mt-1">Gestion complète des livraisons, livreurs et dépenses</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FaChartLine className="inline mr-2" />
                Tableau de bord
              </button>
              <button
                onClick={() => setActiveTab('tracking')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'tracking'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FaTruck className="inline mr-2" />
                Suivi
              </button>
              <button
                onClick={() => setActiveTab('deliverers')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'deliverers'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FaUser className="inline mr-2" />
                Livreurs
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'expenses'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FaMoneyBillWave className="inline mr-2" />
                Dépenses
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      {activeTab === 'dashboard' && (
        <DashboardView stats={stats} deliverers={deliverers} orders={orders} />
      )}
      
      {activeTab === 'tracking' && (
        <TrackingView 
          orders={filteredOrders} 
          deliverers={deliverers}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          delivererFilter={delivererFilter}
          setDelivererFilter={setDelivererFilter}
        />
      )}
      
      {activeTab === 'deliverers' && (
        <DeliverersView 
          deliverers={filteredDeliverers}
          allDeliverers={deliverers}
          shifts={shifts}
          stats={delivererStats}
          searchTerm={delivererSearchTerm}
          setSearchTerm={setDelivererSearchTerm}
          statusFilter={delivererStatusFilter}
          setStatusFilter={setDelivererStatusFilter}
          vehicleTypeFilter={vehicleTypeFilter}
          setVehicleTypeFilter={setVehicleTypeFilter}
          zoneFilter={zoneFilter}
          setZoneFilter={setZoneFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          onEdit={handleUpdateDeliverer}
          onDelete={handleDeleteDeliverer}
          onStartShift={handleStartShift}
          onEndShift={handleEndShift}
          onAdd={() => setShowDelivererModal(true)}
          vehicleTypes={VEHICLE_TYPES}
        />
      )}
      
      {activeTab === 'expenses' && (
        <ExpensesView 
          expenses={expenses}
          deliverers={deliverers}
          onEdit={handleCreateExpense}
        />
      )}

      {/* Modals */}
      {showDelivererModal && (
        <DelivererModal
          form={delivererForm}
          setForm={setDelivererForm}
          onSubmit={selectedDeliverer ? handleUpdateDeliverer : handleCreateDeliverer}
          onClose={resetDelivererForm}
          isEdit={!!selectedDeliverer}
          vehicleTypes={VEHICLE_TYPES}
        />
      )}
      
      {showExpenseModal && (
        <ExpenseModal
          form={expenseForm}
          setForm={setExpenseForm}
          onSubmit={handleCreateExpense}
          onClose={resetExpenseForm}
          deliverers={deliverers}
          expenseTypes={EXPENSE_TYPES}
        />
      )}
    </div>
  );
};

// Composants de vue
const DashboardView = ({ stats, deliverers, orders }) => (
  <div className="space-y-6">
    {/* Statistiques principales */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">En cours</p>
            <p className="text-3xl font-bold text-orange-600">{stats.delivering}</p>
          </div>
          <FaTruck className="text-4xl text-orange-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Livrées aujourd'hui</p>
            <p className="text-3xl font-bold text-green-600">{stats.delivered}</p>
          </div>
          <FaCheckCircle className="text-4xl text-green-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Temps moyen</p>
            <p className="text-3xl font-bold text-blue-600">{stats.avgTime} min</p>
          </div>
          <FaClock className="text-4xl text-blue-500" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Bénéfice</p>
            <p className="text-2xl font-bold text-purple-600">{stats.profit.toLocaleString()} FCFA</p>
          </div>
          <FaMoneyBillWave className="text-4xl text-purple-500" />
        </div>
      </div>
    </div>

    {/* Livreurs actifs */}
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Livreurs Actifs</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deliverers.filter(d => d.active).map(deliverer => (
          <div key={deliverer.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">{deliverer.name}</h4>
              <span className={`px-2 py-1 rounded-full text-xs ${
                deliverer.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {deliverer.isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
            <p className="text-sm text-gray-600">{deliverer.phone}</p>
            <p className="text-sm text-gray-500">{deliverer.vehicleType}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TrackingView = ({ orders, deliverers, searchTerm, setSearchTerm, statusFilter, setStatusFilter, delivererFilter, setDelivererFilter }) => (
  <div className="space-y-6">
    {/* Filtres */}
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous</option>
            <option value="delivering">En cours</option>
            <option value="delivered">Livrées</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Livreur</label>
          <select
            value={delivererFilter}
            onChange={(e) => setDelivererFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous</option>
            {deliverers.map(deliverer => (
              <option key={deliverer.id} value={deliverer.name}>{deliverer.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>

    {/* Liste des commandes */}
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commande</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Livreur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Temps</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frais</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">#{order.id.slice(-6).toUpperCase()}</div>
                  <div className="text-xs text-gray-500">
                    {order.createdAt?.toDate().toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FaUser className="text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">{order.assignedDeliverer || 'Non assigné'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FaMapMarkerAlt className="text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">{order.address?.area || '-'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    order.status === 'client_indisponible' 
                      ? 'bg-yellow-100 text-yellow-800'
                      : ['delivering', 'en_livraison'].includes(order.status)
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {order.status === 'client_indisponible' ? 'Client indisponible' :
                     ['delivering', 'en_livraison'].includes(order.status) ? 'En livraison' : 'Livrée'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {order.deliveryDurationMinutes ? (
                    <div className="flex items-center text-green-600 font-bold">
                      <FaClock className="mr-2" />
                      {order.deliveryDurationMinutes} min
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-bold text-gray-900">
                    {order.deliveryFee?.toLocaleString() || 0} FCFA
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {order.contact?.phone && (
                    <a
                      href={`tel:${order.contact.phone}`}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                    >
                      <FaPhone className="mr-2" />
                      Appeler
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="text-center py-12">
            <FaTruck className="mx-auto text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">Aucune livraison à afficher</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const DeliverersView = ({ 
  deliverers, 
  allDeliverers, 
  shifts, 
  stats, 
  searchTerm, 
  setSearchTerm, 
  statusFilter, 
  setStatusFilter, 
  vehicleTypeFilter, 
  setVehicleTypeFilter, 
  zoneFilter, 
  setZoneFilter, 
  sortBy, 
  setSortBy, 
  sortOrder, 
  setSortOrder, 
  onEdit, 
  onDelete, 
  onStartShift, 
  onEndShift, 
  onAdd, 
  vehicleTypes 
}) => {
  // Obtenir les zones uniques
  const uniqueZones = [...new Set(allDeliverers.map(d => d.zone).filter(Boolean))];
  
  return (
    <div className="space-y-6">
      {/* Statistiques des livreurs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <FaUser className="text-3xl text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Actifs</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <FaCheckCircle className="text-3xl text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En ligne</p>
              <p className="text-2xl font-bold text-orange-600">{stats.online}</p>
            </div>
            <FaClock className="text-3xl text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Motos</p>
              <p className="text-2xl font-bold text-purple-600">{stats.byVehicle.moto || 0}</p>
            </div>
            <FaMotorcycle className="text-3xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filtres avancés */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Filtres et Recherche</h3>
          <button
            onClick={onAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
          >
            <FaPlus className="mr-2" />
            Ajouter un livreur
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom, téléphone, zone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          
          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">Tous</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="online">En ligne</option>
              <option value="offline">Hors ligne</option>
            </select>
          </div>
          
          {/* Type de véhicule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Véhicule</label>
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">Tous</option>
              {vehicleTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          {/* Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">Toutes</option>
              {uniqueZones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          
          {/* Tri par */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trier par</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="name">Nom</option>
              <option value="phone">Téléphone</option>
              <option value="vehicleType">Véhicule</option>
              <option value="zone">Zone</option>
              <option value="rating">Note</option>
              <option value="deliveries">Livraisons</option>
            </select>
          </div>
          
          {/* Ordre de tri */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ordre</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="asc">Croissant</option>
              <option value="desc">Décroissant</option>
            </select>
          </div>
        </div>
        
        {/* Résumé des filtres */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600">
            {deliverers.length} livreur{deliverers.length > 1 ? 's' : ''} trouvé{deliverers.length > 1 ? 's' : ''}
          </span>
          {(searchTerm || statusFilter !== 'all' || vehicleTypeFilter !== 'all' || zoneFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setVehicleTypeFilter('all');
                setZoneFilter('all');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      </div>

      {/* Liste des livreurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deliverers.map(deliverer => {
          const IconComponent = vehicleTypes.find(t => t.value === deliverer.vehicleType)?.icon || FaUser;
          const currentShift = shifts.find(s => s.delivererId === deliverer.id && s.status === 'active');
          
          return (
            <div key={deliverer.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              {/* Header avec actions */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <IconComponent className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{deliverer.name}</h3>
                      <p className="text-sm text-gray-600">{deliverer.phone}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(deliverer)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Modifier"
                    >
                      <FaEdit size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(deliverer.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Supprimer"
                    >
                      <FaTrash size={16} />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Informations principales */}
              <div className="p-4 space-y-3">
                {/* Statuts */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Statut:</span>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      deliverer.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {deliverer.active ? 'Actif' : 'Inactif'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      deliverer.isOnline ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {deliverer.isOnline ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                </div>
                
                {/* Véhicule et zone */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Véhicule:</span>
                    <span className="text-sm font-medium">{deliverer.vehicleType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Zone:</span>
                    <span className="text-sm font-medium">{deliverer.zone || 'Non définie'}</span>
                  </div>
                </div>
                
                {/* Statistiques */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Livraisons</p>
                    <p className="text-lg font-semibold text-gray-900">{deliverer.totalDeliveries || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Note</p>
                    <p className="text-lg font-semibold text-gray-900">{deliverer.rating || 0}/5</p>
                  </div>
                </div>
                
                {/* Actions de service */}
                {deliverer.active && (
                  <div className="pt-2 border-t border-gray-100">
                    {currentShift ? (
                      <button
                        onClick={() => onEndShift(currentShift.id)}
                        className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition text-sm font-medium"
                      >
                        <FaSignOutAlt className="inline mr-2" />
                        Terminer le service
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartShift(deliverer.id)}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition text-sm font-medium"
                      >
                        <FaSignInAlt className="inline mr-2" />
                        Démarrer le service
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Message si aucun livreur */}
      {deliverers.length === 0 && (
        <div className="text-center py-12">
          <FaUser className="mx-auto text-6xl text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">Aucun livreur trouvé</p>
          <p className="text-gray-400 text-sm mt-2">
            {searchTerm || statusFilter !== 'all' || vehicleTypeFilter !== 'all' || zoneFilter !== 'all' 
              ? 'Essayez de modifier vos filtres de recherche'
              : 'Commencez par ajouter un livreur'
            }
          </p>
        </div>
      )}
    </div>
  );
};

const ExpensesView = ({ expenses, deliverers, onEdit }) => (
  <div className="space-y-6">
    {/* Bouton d'ajout */}
    <div className="flex justify-end">
      <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
        <FaPlus className="inline mr-2" />
        Ajouter une dépense
      </button>
    </div>

    {/* Liste des dépenses */}
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Livreur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{expense.type}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-bold text-gray-900">{expense.amount.toLocaleString()} FCFA</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{expense.delivererId}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {expense.date.toDate().toLocaleDateString('fr-FR')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{expense.description || '-'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Modals
const DelivererModal = ({ form, setForm, onSubmit, onClose, isEdit, vehicleTypes }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">{isEdit ? 'Modifier le livreur' : 'Nouveau livreur'}</h3>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type de véhicule *</label>
          <select
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {vehicleTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de véhicule</label>
          <input
            type="text"
            value={form.vehicleNumber}
            onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
          <input
            type="text"
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Capacité maximale</label>
          <input
            type="number"
            value={form.maxCapacity}
            onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="1"
            max="20"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Actif
          </label>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
        >
          Annuler
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {isEdit ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </div>
  </div>
);

const ExpenseModal = ({ form, setForm, onSubmit, onClose, deliverers, expenseTypes }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Nouvelle dépense</h3>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            {expenseTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Montant *</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Livreur *</label>
          <select
            value={form.delivererId}
            onChange={(e) => setForm({ ...form, delivererId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Sélectionner un livreur</option>
            {deliverers.map(deliverer => (
              <option key={deliverer.id} value={deliverer.id}>{deliverer.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows="3"
          />
        </div>
      </div>
      <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
        >
          Annuler
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Enregistrer
        </button>
      </div>
    </div>
  </div>
);

export default OptimizedDeliverySystem;
