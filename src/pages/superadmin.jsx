import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiHome, FiTrendingUp, FiTag, FiTruck, FiUsers, FiStar, FiPlus, 
  FiChevronDown, FiBarChart2, FiPieChart, FiDollarSign, FiSmile,
  FiActivity, FiShoppingBag, FiClock, FiX, FiSearch
} from 'react-icons/fi';
import { db, auth } from '../firebase'; // Importez votre configuration Firebase
import { onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ==================== Sidebar Component ====================
const Sidebar = ({ activeSection, setActiveSection }) => {
  const menuItems = [
    { id: 'sales', label: 'Suivi des ventes', icon: <FiBarChart2 className="w-5 h-5" /> },
    { id: 'dishes', label: 'Plats vendus', icon: <FiPieChart className="w-5 h-5" /> },
    { id: 'promotions', label: 'Promotions', icon: <FiTag className="w-5 h-5" /> },
    { id: 'orders', label: 'Commandes', icon: <FiTruck className="w-5 h-5" /> },
    { id: 'clients', label: 'Clients', icon: <FiUsers className="w-5 h-5" /> },
    { id: 'reviews', label: 'Avis', icon: <FiStar className="w-5 h-5" /> },
  ];

  return (
    <motion.div 
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-72 bg-gradient-to-b from-gray-900 to-gray-800 text-white h-screen fixed top-0 left-0 flex flex-col p-6 shadow-2xl z-50"
    >
      <div className="flex items-center mb-10">
        <div className="bg-blue-500 p-2 rounded-lg mr-3">
          <FiShoppingBag className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
          FoodDash Pro
        </h1>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-3">
          {menuItems.map((item) => (
            <motion.li 
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <button
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center w-full p-3 rounded-xl transition-all duration-300 ${
                  activeSection === item.id 
                    ? 'bg-blue-600 shadow-lg shadow-blue-500/20' 
                    : 'hover:bg-gray-700'
                }`}
              >
                <span className={`mr-3 ${activeSection === item.id ? 'text-white' : 'text-gray-300'}`}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      </nav>
      
      <div className="mt-auto pt-6 border-t border-gray-700">
        <div className="flex items-center p-3 text-gray-300 text-sm">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3">
            <span className="font-medium text-white">SA</span>
          </div>
          <div>
            <p className="font-medium text-white">Super Admin</p>
            <p className="text-xs">Administrateur principal</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ==================== Sales Chart Component ====================
// ==================== Sales Chart Component ====================
const SalesChart = ({ period }) => {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const [salesData, setSalesData] = useState({
    labels: [],
    data: [],
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899'],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startOfPeriod = {
      day: new Date(new Date().setHours(0, 0, 0, 0)),
      week: new Date(new Date().setDate(new Date().getDate() - 7)),
      month: new Date(new Date().setDate(new Date().getDate() - 30)),
    }[period];

    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
        const restaurants = restaurantsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        
        const salesByRestaurant = {};
        for (const restaurant of restaurants) {
          salesByRestaurant[restaurant.name] = 0;
          const ordersQuery = query(
            collection(db, 'orders'),
            where('restaurantId', '==', restaurant.id),
            where('timestamp', '>=', startOfPeriod)
          );
          const ordersSnapshot = await getDocs(ordersQuery);
          ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const total = calculateOrderTotal(order);
            salesByRestaurant[restaurant.name] += total;
          });
        }

        setSalesData({
          labels: Object.keys(salesByRestaurant),
          data: Object.values(salesByRestaurant),
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899'],
        });
      } catch (error) {
        console.error('Error fetching sales data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [period]);

  useEffect(() => {
    if (!isLoading && salesData.labels.length > 0) {
      const ctx = canvasRef.current.getContext('2d');
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: salesData.labels,
          datasets: [{
            label: `Ventes (FCFA) - ${period.charAt(0).toUpperCase() + period.slice(1)}`,
            data: salesData.data,
            backgroundColor: salesData.colors,
            borderColor: salesData.colors.map(color => color.replace('0.5', '1')),
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { 
              beginAtZero: true,
              grid: { color: 'rgba(0, 0, 0, 0.05)' },
              ticks: { callback: value => value.toLocaleString() + ' FCFA' }
            },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: { position: 'top', labels: { font: { size: 14 } } },
            tooltip: { callbacks: { label: context => 'Ventes: ' + context.raw.toLocaleString() + ' FCFA' } }
          },
          animation: { duration: 1000, easing: 'easeInOutQuart' }
        }
      });

      return () => chartRef.current && chartRef.current.destroy();
    }
  }, [salesData, isLoading]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-96 w-full flex items-center justify-center"
      >
        <p className="text-gray-500">Chargement des données...</p>
      </motion.div>
    );
  }

  if (salesData.labels.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-96 w-full flex items-center justify-center"
      >
        <p className="text-gray-500">Aucune donnée disponible pour cette période.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-96 w-full"
    >
      <canvas ref={canvasRef} aria-label="Graphique des ventes par restaurant" />
    </motion.div>
  );
};

// ==================== Dishes Chart Component ====================
const DishesChart = ({ period, dishesData }) => {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dishesData.labels,
        datasets: [
          {
            label: `Plat le plus vendu: ${dishesData.topName || 'Aucun'}`,
            data: dishesData.top,
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            borderWidth: 2,
          },
          {
            label: `Plat le moins vendu: ${dishesData.bottomName || 'Aucun'}`,
            data: dishesData.bottom,
            backgroundColor: '#EF4444',
            borderColor: '#B91C1C',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
          x: { grid: { display: false } },
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: context => context.dataset.label + ': ' + context.raw + ' ventes' } },
        },
        animation: { duration: 1000, easing: 'easeInOutQuart' },
      },
    });

    return () => chartRef.current && chartRef.current.destroy();
  }, [dishesData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-96 w-full"
    >
      <canvas ref={canvasRef} aria-label="Graphique des plats les plus et moins vendus" />
    </motion.div>
  );
};

// ==================== KPI Card Component ====================
const KPICard = ({ title, value, change, icon, color }) => {
  const colorClasses = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
    yellow: 'border-l-yellow-500'
  };

  const iconColors = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    yellow: 'text-yellow-500'
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 border-l-4 ${colorClasses[color]}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold mt-2 text-gray-800">{value}</p>
          <div className={`flex items-center mt-2 text-sm ${
            change.startsWith('+') ? 'text-green-500' : 'text-red-500'
          }`}>
            <FiActivity className="mr-1" /> {change} vs période précédente
          </div>
        </div>
        <div className={`p-3 rounded-lg bg-opacity-20 ${iconColors[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

// ==================== Orders Stats Component ====================
const OrdersStats = ({ period }) => {
  const [stats, setStats] = useState({ delivered: 0, canceled: 0 });

  useEffect(() => {
    const startOfPeriod = {
      day: new Date(new Date().setHours(0, 0, 0, 0)),
      week: new Date(new Date().setDate(new Date().getDate() - 7)),
      month: new Date(new Date().setDate(new Date().getDate() - 30))
    }[period];

    const unsubscribe = onSnapshot(
      query(collection(db, 'orders'), where('timestamp', '>=', startOfPeriod)),
      (snapshot) => {
        const delivered = snapshot.docs.filter(doc => doc.data().status === 'delivered').length;
        const canceled = snapshot.docs.filter(doc => doc.data().status === 'canceled').length;
        setStats({ delivered, canceled });
      }
    );

    return () => unsubscribe();
  }, [period]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <motion.div 
        whileHover={{ y: -3 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-700">Commandes livrées</h3>
          <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            +5.7%
          </div>
        </div>
        <div className="flex items-end">
          <p className="text-4xl font-bold text-gray-800 mr-2">{stats.delivered}</p>
          <p className="text-sm text-gray-500 mb-1">ce {period === 'day' ? 'jour' : period === 'week' ? 'semaine' : 'mois'}</p>
        </div>
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 rounded-full" 
            style={{ width: `${(stats.delivered / (stats.delivered + stats.canceled) || 1) * 100}%` }}
          ></div>
        </div>
      </motion.div>

      <motion.div 
        whileHover={{ y: -3 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-700">Commandes annulées</h3>
          <div className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
            -1.2%
          </div>
        </div>
        <div className="flex items-end">
          <p className="text-4xl font-bold text-gray-800 mr-2">{stats.canceled}</p>
          <p className="text-sm text-gray-500 mb-1">ce {period === 'day' ? 'jour' : period === 'week' ? 'semaine' : 'mois'}</p>
        </div>
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-red-500 rounded-full" 
            style={{ width: `${(stats.canceled / (stats.delivered + stats.canceled) || 1) * 100}%` }}
          ></div>
        </div>
      </motion.div>
    </div>
  );
};

// ==================== Clients Table Component ====================
const ClientsTable = () => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), async (snapshot) => {
      const clientsData = [];
      for (const doc of snapshot.docs) {
        const user = doc.data();
        const ordersQuery = query(collection(db, 'orders'), where('userId', '==', doc.id));
        const ordersSnapshot = await getDocs(ordersQuery);
        const orders = ordersSnapshot.docs.map(doc => doc.data());
        const totalSpent = orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
        const lastOrder = orders.sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp;
        clientsData.push({
          id: doc.id,
          name: user.name || 'Anonyme',
          email: user.email,
          orders: orders.length,
          totalSpent,
          lastOrder: lastOrder ? new Date(lastOrder).toISOString().split('T')[0] : ''
        });
      }
      setClients(clientsData);
    });

    return () => unsubscribe();
  }, []);

  const filteredClients = clients
    .filter((client) => 
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      } else {
        return sortOrder === 'asc' 
          ? a[sortBy] - b[sortBy] 
          : b[sortBy] - a[sortBy];
      }
    });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Étude des clients</h2>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Rechercher un client..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un client"
          />
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Nom
                  {sortBy === 'name' && (
                    <FiChevronDown className={`ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('orders')}
              >
                <div className="flex items-center">
                  Commandes
                  {sortBy === 'orders' && (
                    <FiChevronDown className={`ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('totalSpent')}
              >
                <div className="flex items-center">
                  Dépenses
                  {sortBy === 'totalSpent' && (
                    <FiChevronDown className={`ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('lastOrder')}
              >
                <div className="flex items-center">
                  Dernière commande
                  {sortBy === 'lastOrder' && (
                    <FiChevronDown className={`ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredClients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{client.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{client.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{client.orders}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{client.totalSpent.toLocaleString()} FCFA</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  <div className="flex items-center">
                    <FiClock className="mr-1 text-gray-400" />
                    {client.lastOrder ? new Date(client.lastOrder).toLocaleDateString() : '-'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== Reviews Stats Component ====================
const ReviewsStats = () => {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const ratingsCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviewsData.forEach(review => ratingsCount[review.rating]++);
      const total = reviewsData.length;
      setReviews(
        Object.entries(ratingsCount).map(([rating, count]) => ({
          rating: parseInt(rating),
          count,
          percentage: total ? (count / total) * 100 : 0
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  const averageRating = reviews.reduce((sum, review) => sum + (review.rating * review.count), 0) / 
                       reviews.reduce((sum, review) => sum + review.count, 0) || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition des avis</h3>
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.rating} className="flex items-center">
              <div className="w-10 text-gray-600">{review.rating} étoiles</div>
              <div className="flex-1 mx-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full" 
                    style={{ width: `${review.percentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-10 text-right text-sm text-gray-500">{review.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiques globales</h3>
        <div className="flex items-center justify-center mb-4">
          <div className="text-5xl font-bold text-gray-800 mr-4">{averageRating.toFixed(1)}</div>
          <div className="text-yellow-500">
            {[...Array(5)].map((_, i) => (
              <FiStar 
                key={i} 
                className={`inline ${i < Math.floor(averageRating) ? 'fill-current' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-sm text-gray-600">Avis positifs</p>
            <p className="text-xl font-bold text-blue-600">
              {reviews.filter(r => r.rating >= 4).reduce((sum, r) => sum + r.percentage, 0).toFixed(1)}%
            </p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <p className="text-sm text-gray-600">Avis négatifs</p>
            <p className="text-xl font-bold text-red-600">
              {reviews.filter(r => r.rating <= 2).reduce((sum, r) => sum + r.percentage, 0).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== Promotions Modal Component ====================
const PromotionsModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    discount: '',
    startDate: '',
    endDate: '',
    restaurants: []
  });
  const [allRestaurants, setAllRestaurants] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'restaurants'), (snapshot) => {
      setAllRestaurants(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRestaurantToggle = (restaurantId) => {
    setFormData(prev => {
      if (prev.restaurants.includes(restaurantId)) {
        return { ...prev, restaurants: prev.restaurants.filter(id => id !== restaurantId) };
      } else {
        return { ...prev, restaurants: [...prev.restaurants, restaurantId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await db.collection('promotions').add({
      ...formData,
      discount: parseInt(formData.discount),
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      status: 'active',
      createdAt: new Date()
    });
    setFormData({ name: '', discount: '', startDate: '', endDate: '', restaurants: [] });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Créer une promotion</h2>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la promotion*</label>
                    <input
                      type="text"
                      name="name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Remise d'été"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Réduction (%)*</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="discount"
                        min="1"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                        placeholder="Ex: 20"
                        value={formData.discount}
                        onChange={handleChange}
                        required
                      />
                      <span className="absolute right-3 top-2 text-gray-500">%</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date de début*</label>
                      <input
                        type="date"
                        name="startDate"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin*</label>
                      <input
                        type="date"
                        name="endDate"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.endDate}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Restaurants concernés</label>
                    <div className="grid grid-cols-2 gap-2">
                      {allRestaurants.map(restaurant => (
                        <label key={restaurant.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.restaurants.includes(restaurant.id)}
                            onChange={() => handleRestaurantToggle(restaurant.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{restaurant.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-6">
                  <motion.button
                    type="button"
                    onClick={onClose}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow hover:shadow-md transition-all"
                  >
                    Créer la promotion
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Main SuperAdmin Component ====================
// ==================== Main SuperAdmin Component ====================
const SuperAdmin = () => {
  const [activeSection, setActiveSection] = useState('sales');
  const [period, setPeriod] = useState('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [kpiData, setKpiData] = useState({
    totalSales: 0,
    newClients: 0,
    orders: 0,
    satisfaction: 0,
  });
  const [promotions, setPromotions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [dishesData, setDishesData] = useState({
    labels: [],
    top: [],
    bottom: [],
    topName: '',
    bottomName: '',
    topItems: {},
    bottomItems: {},
  });

  useEffect(() => {
    // KPI Data
    const startOfPeriod = {
      day: new Date(new Date().setHours(0, 0, 0, 0)),
      week: new Date(new Date().setDate(new Date().getDate() - 7)),
      month: new Date(new Date().setDate(new Date().getDate() - 30)),
    }[period];

    // Orders
    const unsubscribeOrders = onSnapshot(
      query(collection(db, 'orders'), where('timestamp', '>=', startOfPeriod)),
      async (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
        const totalSales = ordersData.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
        const ordersCount = ordersData.length;
        setKpiData(prev => ({ ...prev, totalSales, orders: ordersCount }));

        // Dishes Data
        const itemsCount = {};
        ordersData.forEach(order => {
          order.items.forEach(item => {
            itemsCount[item.name] = (itemsCount[item.name] || 0) + item.quantity;
          });
        });
        const sortedItems = Object.entries(itemsCount).sort((a, b) => b[1] - a[1]);
        const topItem = sortedItems[0] || ['Aucun', 0];
        const bottomItem = sortedItems[sortedItems.length - 1] || ['Aucun', 0];
        const topItems = sortedItems.slice(0, 5).reduce((obj, [name, count]) => ({ ...obj, [name]: count }), {});
        const bottomItems = sortedItems.slice(-5).reduce((obj, [name, count]) => ({ ...obj, [name]: count }), {});

        setDishesData({
          labels: [period === 'day' ? 'Aujourd’hui' : period === 'week' ? 'Cette semaine' : 'Ce mois'],
          top: [topItem[1]],
          bottom: [bottomItem[1]],
          topName: topItem[0],
          bottomName: bottomItem[0],
          topItems,
          bottomItems,
        });
      }
    );

    // Clients
    const unsubscribeClients = onSnapshot(collection(db, 'users'), async (snapshot) => {
      const newClients = snapshot.docs.filter(doc => 
        new Date(doc.data().createdAt) >= startOfPeriod
      ).length;
      setKpiData(prev => ({ ...prev, newClients }));
    });

    // Reviews
    const unsubscribeReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(reviewsData);
      const avgSatisfaction = reviewsData.reduce((sum, review) => sum + review.rating, 0) / 
                            reviewsData.length || 0;
      setKpiData(prev => ({ ...prev, satisfaction: (avgSatisfaction / 5 * 100).toFixed(1) }));
    });

    // Promotions
    const unsubscribePromotions = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeClients();
      unsubscribeReviews();
      unsubscribePromotions();
    };
  }, [period]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FoodDash Pro',
    url: 'https://www.fooddashpro.com',
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <main className="ml-72 p-8 w-full">
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        
        <div className="flex justify-between items-center mb-8">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold text-gray-800"
          >
            Tableau de bord <span className="text-blue-600">Super Admin</span>
          </motion.h1>
          
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex items-center space-x-4"
          >
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="appearance-none bg-white pl-4 pr-10 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-700"
              >
                <option value="day">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
              <FiChevronDown className="absolute right-3 top-3 text-gray-400" />
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <KPICard 
            title="Ventes totales" 
            value={`${kpiData.totalSales.toLocaleString()} FCFA`} 
            change="+12.5%" 
            icon={<FiDollarSign className="w-6 h-6" />} 
            color="blue" 
          />
          <KPICard 
            title="Nouveaux clients" 
            value={kpiData.newClients} 
            change="+8.2%" 
            icon={<FiUsers className="w-6 h-6" />} 
            color="green" 
          />
          <KPICard 
            title="Commandes" 
            value={kpiData.orders} 
            change="+5.7%" 
            icon={<FiTruck className="w-6 h-6" />} 
            color="purple" 
          />
          <KPICard 
            title="Satisfaction" 
            value={`${kpiData.satisfaction}%`} 
            change="+3.1%" 
            icon={<FiSmile className="w-6 h-6" />} 
            color="yellow" 
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {activeSection === 'sales' && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Suivi des ventes par restaurant</h2>
                  <button className="text-sm text-blue-500 hover:text-blue-700 flex items-center">
                    Voir le détail <FiChevronDown className="ml-1" />
                  </button>
                </div>
                <SalesChart period={period} />
              </div>
            )}

            {activeSection === 'dishes' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6">Performance des plats</h2>
                  <DishesChart period={period} dishesData={dishesData} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-medium text-gray-700 mb-4">Top 5 des plats</h3>
                    <ul className="space-y-3">
                      {Object.entries(dishesData.topItems || {}).map(([item, count], index) => (
                        <motion.li 
                          key={index} 
                          whileHover={{ x: 5 }}
                          className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg"
                        >
                          <span className="font-medium">{item}</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            {count} ventes
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-medium text-gray-700 mb-4">Flops 5 des plats</h3>
                    <ul className="space-y-3">
                      {Object.entries(dishesData.bottomItems || {}).map(([item, count], index) => (
                        <motion.li 
                          key={index} 
                          whileHover={{ x: 5 }}
                          className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg"
                        >
                          <span className="font-medium">{item}</span>
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                            {count} ventes
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'promotions' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800">Gestion des promotions</h2>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
                  >
                    <FiPlus className="mr-2" /> Nouvelle promotion
                  </motion.button>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Réduction</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurants</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {promotions.map((promo) => (
                          <motion.tr 
                            key={promo.id} 
                            whileHover={{ backgroundColor: 'rgba(249, 250, 251, 1)' }}
                            className="transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{promo.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{promo.discount}%</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{promo.restaurants.length}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                promo.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {promo.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'orders' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Statistiques des commandes</h2>
                <OrdersStats period={period} />
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Dernières commandes</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orders.slice(0, 4).map((order) => (
                          <motion.tr 
                            key={order.id}
                            whileHover={{ backgroundColor: 'rgba(249, 250, 251, 1)' }}
                            className="transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.userId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.restaurantId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{calculateOrderTotal(order).toLocaleString()} FCFA</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                order.status === 'delivered' 
                                  ? 'bg-green-100 text-green-800' 
                                  : order.status === 'pending'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'clients' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Analyse des clients</h2>
                <ClientsTable />
              </div>
            )}

            {activeSection === 'reviews' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Analyse des avis clients</h2>
                <ReviewsStats />
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Derniers avis</h3>
                  <div className="space-y-4">
                    {reviews.slice(0, 3).map(review => (
                      <motion.div 
                        key={review.id}
                        whileHover={{ scale: 1.01 }}
                        className="p-4 border border-gray-100 rounded-lg hover:shadow-sm transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-800">{review.userId}</p>
                            <p className="text-sm text-gray-500">{review.restaurantId}</p>
                          </div>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <FiStar 
                                key={i} 
                                className={`${i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{review.comment}</p>
                        <p className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString()}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <PromotionsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

// Fonction utilitaire pour calculer le total d'une commande
const calculateOrderTotal = (order) => {
  const subtotal = order.items.reduce((sum, item) => {
    const price = item.price || (item.sizes && item.sizes[item.size]?.price) || 0;
    return sum + (price * item.quantity);
  }, 0);
  const pointsReduction = order.pointsReduction || 0;
  return subtotal + (order.deliveryFee || 0) - pointsReduction;
};

export default SuperAdmin;