import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  FaChartLine,
  FaUsers,
  FaMoneyBillWave,
  FaGift,
  FaDownload,
  FaCopy,
  FaShareAlt,
  FaCalendarAlt,
  FaTrophy,
  FaFilter,
  FaSync,
  FaShoppingBag
} from 'react-icons/fa';
import {
  generatePromoCode,
  calculateAmbassadorStats,
  exportStatsToCSV,
  formatPoints,
  formatPointsValue,
  LOYALTY_CONFIG
} from '../utils/loyaltyUtils';
import { formatPrice } from '../utils/adminUtils';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AmbassadorDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [ambassadorData, setAmbassadorData] = useState(null);
  const [promoCodes, setPromoCodes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState('month');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // État pour la création de code promo
  const [newPromoCode, setNewPromoCode] = useState({
    name: '',
    discountType: 'percentage',
    discountValue: 10,
    bonusPoints: 100,
    maxUses: 100,
    expirationDays: 30
  });

  // Charger les données de l'ambassadeur
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await loadAmbassadorData(user.uid);
      } else {
        window.location.href = '/login';
      }
    });
    return unsubscribe;
  }, []);

  const loadAmbassadorData = async (userId) => {
    try {
      setLoading(true);
      
      // Charger les données de l'ambassadeur
      const ambassadorQuery = query(
        collection(db, 'ambassadors'),
        where('userId', '==', userId)
      );
      const ambassadorSnap = await getDocs(ambassadorQuery);
      
      if (ambassadorSnap.empty) {
        console.error('Profil ambassadeur non trouvé');
        return;
      }

      const ambassadorDoc = ambassadorSnap.docs[0];
      const ambassador = { id: ambassadorDoc.id, ...ambassadorDoc.data() };
      setAmbassadorData(ambassador);

      // Charger les codes promo
      loadPromoCodes(ambassador.id);
      
      // Charger les commandes et commissions
      loadOrdersAndCommissions(ambassador.id);
      
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPromoCodes = (ambassadorId) => {
    const promoQuery = query(
      collection(db, 'promoCodes'),
      where('ambassadorId', '==', ambassadorId)
    );

    const unsubscribe = onSnapshot(promoQuery, (snapshot) => {
      const codes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPromoCodes(codes);
    });

    return unsubscribe;
  };

  const loadOrdersAndCommissions = (ambassadorId) => {
    // Écouter les commandes avec les codes promo de l'ambassadeur
    const activePromoCodes = promoCodes.map(p => p.code);
    
    if (activePromoCodes.length > 0) {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('promoCode', 'in', activePromoCodes),
        orderBy('timestamp', 'desc'),
        limit(500)
      );

      const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
        const ordersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersList);
        
        // Calculer les statistiques
        if (promoCodes.length > 0) {
          const mainPromo = promoCodes[0];
          const calculatedStats = calculateAmbassadorStats(ordersList, mainPromo);
          setStats(calculatedStats);
        }
      });
    }

    // Écouter les commissions
    const commissionsQuery = query(
      collection(db, 'ambassadorCommissions'),
      where('ambassadorId', '==', ambassadorId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeCommissions = onSnapshot(commissionsQuery, (snapshot) => {
      const commissionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCommissions(commissionsList);
    });
  };

  // Créer un nouveau code promo
  const createNewPromoCode = async () => {
    try {
      const code = generatePromoCode(ambassadorData.id);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + newPromoCode.expirationDays);

      const promoData = {
        code,
        name: newPromoCode.name || `Promo ${code}`,
        ambassadorId: ambassadorData.id,
        managerId: ambassadorData.managerId,
        discountType: newPromoCode.discountType,
        discountValue: Number(newPromoCode.discountValue),
        bonusPoints: Number(newPromoCode.bonusPoints),
        maxUses: Number(newPromoCode.maxUses),
        usesCount: 0,
        expirationDate,
        active: true,
        commissionRate: ambassadorData.commissionRate || LOYALTY_CONFIG.DEFAULT_AMBASSADOR_COMMISSION,
        createdAt: serverTimestamp(),
        totalRevenue: 0,
        totalOrders: 0
      };

      await addDoc(collection(db, 'promoCodes'), promoData);
      
      setShowCreateModal(false);
      setNewPromoCode({
        name: '',
        discountType: 'percentage',
        discountValue: 10,
        bonusPoints: 100,
        maxUses: 100,
        expirationDays: 30
      });

      alert('Code promo créé avec succès!');
    } catch (error) {
      console.error('Erreur lors de la création du code promo:', error);
      alert('Erreur lors de la création du code promo');
    }
  };

  // Copier un code promo
  const copyPromoCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Code ${code} copié!`);
  };

  // Partager un code promo
  const sharePromoCode = (code) => {
    const shareText = `🎉 Utilisez mon code promo ${code} pour bénéficier d'une réduction sur votre prochaine commande! 🍔`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Code Promo Restaurant',
        text: shareText,
        url: window.location.origin
      });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Texte de partage copié!');
    }
  };

  // Actualiser les données
  const refreshData = async () => {
    setRefreshing(true);
    await loadAmbassadorData(currentUser.uid);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Graphiques
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (context.dataset.label === 'Revenus') {
              return `${context.dataset.label}: ${formatPrice(context.parsed.y)} FCFA`;
            }
            return `${context.dataset.label}: ${context.parsed.y}`;
          }
        }
      }
    }
  };

  const revenueChartData = useMemo(() => {
    if (!stats) return null;

    const data = dateFilter === 'day' ? stats.dailyStats :
                 dateFilter === 'week' ? stats.weeklyStats :
                 stats.monthlyStats;

    const sortedEntries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sortedEntries.map(([key]) => key);
    const revenues = sortedEntries.map(([, value]) => value.revenue);
    const ordersCount = sortedEntries.map(([, value]) => value.orders);

    return {
      labels,
      datasets: [
        {
          label: 'Revenus',
          data: revenues,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y',
        },
        {
          label: 'Commandes',
          data: ordersCount,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1',
        }
      ]
    };
  }, [stats, dateFilter]);

  const performanceChartData = useMemo(() => {
    if (!promoCodes.length) return null;

    const labels = promoCodes.map(p => p.code);
    const uses = promoCodes.map(p => p.usesCount || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Utilisations',
          data: uses,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        }
      ]
    };
  }, [promoCodes]);

  const commissionsChartData = useMemo(() => {
    if (!commissions.length) return null;

    const pendingCommissions = commissions.filter(c => c.status === 'pending').length;
    const paidCommissions = commissions.filter(c => c.status === 'paid').length;

    return {
      labels: ['En attente', 'Payées'],
      datasets: [{
        data: [pendingCommissions, paidCommissions],
        backgroundColor: [
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
        ],
        borderColor: [
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      }]
    };
  }, [commissions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Tableau de bord Ambassadeur
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Bienvenue, {ambassadorData?.name || currentUser?.email}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshData}
                className={`p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <FaSync className="text-gray-600" />
              </button>
              <button
                onClick={() => exportStatsToCSV(stats, `stats-${new Date().toISOString().split('T')[0]}.csv`)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FaDownload className="mr-2" />
                Exporter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Commandes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalOrders || 0}
                </p>
              </div>
              <FaShoppingBag className="text-3xl text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenus Générés</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(stats?.totalRevenue || 0)}
                </p>
              </div>
              <FaMoneyBillWave className="text-3xl text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Points Distribués</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPoints(stats?.totalPoints || 0)}
                </p>
              </div>
              <FaGift className="text-3xl text-purple-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Commission Totale</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(stats?.totalCommission || 0)}
                </p>
              </div>
              <FaTrophy className="text-3xl text-yellow-500" />
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="border-b">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {['overview', 'codes', 'orders', 'commissions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'overview' && 'Vue d\'ensemble'}
                  {tab === 'codes' && 'Codes Promo'}
                  {tab === 'orders' && 'Commandes'}
                  {tab === 'commissions' && 'Commissions'}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Vue d'ensemble */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Filtres de période */}
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">Période:</span>
                  {['day', 'week', 'month'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setDateFilter(period)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        dateFilter === period
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {period === 'day' && 'Jour'}
                      {period === 'week' && 'Semaine'}
                      {period === 'month' && 'Mois'}
                    </button>
                  ))}
                </div>

                {/* Graphique des revenus */}
                {revenueChartData && (
                  <div className="bg-gray-50 rounded-lg p-4" style={{ height: '400px' }}>
                    <h3 className="text-lg font-semibold mb-4">Évolution des revenus</h3>
                    <Line 
                      data={revenueChartData} 
                      options={{
                        ...chartOptions,
                        scales: {
                          y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                          },
                          y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: {
                              drawOnChartArea: false,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance des codes */}
                  {performanceChartData && (
                    <div className="bg-gray-50 rounded-lg p-4" style={{ height: '300px' }}>
                      <h3 className="text-lg font-semibold mb-4">Performance des codes</h3>
                      <Bar data={performanceChartData} options={chartOptions} />
                    </div>
                  )}

                  {/* État des commissions */}
                  {commissionsChartData && (
                    <div className="bg-gray-50 rounded-lg p-4" style={{ height: '300px' }}>
                      <h3 className="text-lg font-semibold mb-4">État des commissions</h3>
                      <Doughnut data={commissionsChartData} options={chartOptions} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Codes Promo */}
            {activeTab === 'codes' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Mes codes promo</h3>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Créer un code
                  </button>
                </div>

                <div className="space-y-4">
                  {promoCodes.map((promo) => (
                    <div key={promo.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-mono font-bold text-blue-600">
                              {promo.code}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              promo.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {promo.active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{promo.name}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>Utilisé: {promo.usesCount}/{promo.maxUses}</span>
                            <span>Réduction: {promo.discountValue}{promo.discountType === 'percentage' ? '%' : ' FCFA'}</span>
                            <span>Points bonus: {promo.bonusPoints}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => copyPromoCode(promo.code)}
                            className="p-2 bg-white rounded-lg hover:bg-gray-100"
                          >
                            <FaCopy className="text-gray-600" />
                          </button>
                          <button
                            onClick={() => sharePromoCode(promo.code)}
                            className="p-2 bg-white rounded-lg hover:bg-gray-100"
                          >
                            <FaShareAlt className="text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de création de code promo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Créer un nouveau code promo</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du code
                </label>
                <input
                  type="text"
                  value={newPromoCode.name}
                  onChange={(e) => setNewPromoCode({...newPromoCode, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Promo Été 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de réduction
                </label>
                <select
                  value={newPromoCode.discountType}
                  onChange={(e) => setNewPromoCode({...newPromoCode, discountType: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="percentage">Pourcentage</option>
                  <option value="fixed">Montant fixe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valeur de réduction {newPromoCode.discountType === 'percentage' ? '(%)' : '(FCFA)'}
                </label>
                <input
                  type="number"
                  value={newPromoCode.discountValue}
                  onChange={(e) => setNewPromoCode({...newPromoCode, discountValue: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Points bonus
                </label>
                <input
                  type="number"
                  value={newPromoCode.bonusPoints}
                  onChange={(e) => setNewPromoCode({...newPromoCode, bonusPoints: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre max d'utilisations
                </label>
                <input
                  type="number"
                  value={newPromoCode.maxUses}
                  onChange={(e) => setNewPromoCode({...newPromoCode, maxUses: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Validité (jours)
                </label>
                <input
                  type="number"
                  value={newPromoCode.expirationDays}
                  onChange={(e) => setNewPromoCode({...newPromoCode, expirationDays: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={createNewPromoCode}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmbassadorDashboard;
