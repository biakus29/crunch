import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { FaTruck, FaClock, FaMapMarkerAlt, FaPhone, FaCheckCircle, FaUser } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DeliveryTracking = ({ currentRestaurantId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('delivering'); // 'delivering', 'delivered', 'all'
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!currentRestaurantId) return;

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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentRestaurantId]);

  // Normaliser les statuts
  const normalizeStatus = (status) => {
    const statusMap = {
      'en_livraison': 'delivering',
      'livree': 'delivered',
      'delivering': 'delivering',
      'delivered': 'delivered'
    };
    return statusMap[status] || status;
  };

  const deliveringOrders = orders.filter(o => 
    (normalizeStatus(o.status) === 'delivering' || o.status === 'client_indisponible') &&
    o.assignedDeliverer && 
    o.assignedDeliverer !== 'Non assigné' &&
    o.assignedDeliverer.trim() !== ''
  );
  
  // Fonction pour filtrer par date
  const filterByDate = (order) => {
    const completedDate = order.deliveryCompletedAt 
      ? order.deliveryCompletedAt.toDate() 
      : (order.updatedAt ? order.updatedAt.toDate() : null);
    
    if (!completedDate) return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return completedDate.toDateString() === now.toDateString();
      
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return completedDate >= weekAgo;
      
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return completedDate >= monthAgo;
      
      case 'custom':
        if (!startDate || !endDate) return true;
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Fin de journée
        return completedDate >= start && completedDate <= end;
      
      default:
        return true;
    }
  };

  const deliveredToday = orders.filter(o => {
    if (normalizeStatus(o.status) !== 'delivered') return false;
    if (!o.assignedDeliverer || o.assignedDeliverer === 'Non assigné' || o.assignedDeliverer.trim() === '') return false;
    return filterByDate(o);
  });

  const filteredOrders = activeFilter === 'delivering' 
    ? deliveringOrders 
    : activeFilter === 'delivered' 
    ? deliveredToday 
    : [...deliveringOrders, ...deliveredToday];

  // Calculer les statistiques
  const avgDeliveryTime = deliveredToday.length > 0
    ? Math.round(deliveredToday.reduce((sum, o) => sum + (o.deliveryDurationMinutes || 0), 0) / deliveredToday.length)
    : 0;

  const totalDeliveryFees = deliveredToday.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

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

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En cours</p>
              <p className="text-3xl font-bold text-orange-600">{deliveringOrders.length}</p>
            </div>
            <FaTruck className="text-4xl text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Livrées aujourd'hui</p>
              <p className="text-3xl font-bold text-green-600">{deliveredToday.length}</p>
            </div>
            <FaCheckCircle className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Temps moyen</p>
              <p className="text-3xl font-bold text-blue-600">{avgDeliveryTime} min</p>
            </div>
            <FaClock className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Frais totaux</p>
              <p className="text-2xl font-bold text-purple-600">{totalDeliveryFees.toLocaleString()} FCFA</p>
            </div>
            <FaTruck className="text-4xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        {/* Filtres de statut */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter('delivering')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeFilter === 'delivering'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FaTruck className="inline mr-2" />
              En cours ({deliveringOrders.length})
            </button>
            <button
              onClick={() => setActiveFilter('delivered')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeFilter === 'delivered'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FaCheckCircle className="inline mr-2" />
              Livrées ({deliveredToday.length})
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Toutes ({filteredOrders.length})
            </button>
          </div>
        </div>

        {/* Filtres de date */}
        {activeFilter === 'delivered' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
            <div className="flex flex-wrap gap-2 items-end">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateFilter === 'today'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateFilter === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                7 derniers jours
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateFilter === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                30 derniers jours
              </button>
              <button
                onClick={() => setDateFilter('custom')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateFilter === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Personnalisé
              </button>
              
              {dateFilter === 'custom' && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Du</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Au</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Liste des livraisons */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Livreur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Temps
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frais
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{order.id.slice(-6).toUpperCase()}
                    </div>
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
                    {order.status === 'client_indisponible' ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Client indisponible
                      </span>
                    ) : normalizeStatus(order.status) === 'delivering' ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                        En livraison
                      </span>
                    ) : (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Livrée
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {normalizeStatus(order.status) === 'delivering' && order.deliveryStartedAt ? (
                      <div className="flex items-center text-orange-600 font-bold">
                        <FaClock className="mr-2" />
                        {Math.round((new Date() - order.deliveryStartedAt.toDate()) / 1000 / 60)} min
                      </div>
                    ) : order.deliveryDurationMinutes ? (
                      <div className="flex items-center text-green-600 font-bold">
                        <FaClock className="mr-2" />
                        {order.deliveryDurationMinutes} min
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                    {order.deliveryStartedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        {normalizeStatus(order.status) === 'delivering' ? 'Démarré' : 'Terminé'} à{' '}
                        {order.deliveryStartedAt.toDate().toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
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
          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <FaTruck className="mx-auto text-6xl text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Aucune livraison à afficher</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryTracking;
