import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FaChartLine, FaMoneyBillWave, FaShoppingCart, FaMotorcycle } from 'react-icons/fa';

const PartnerStats = ({ currentRestaurantId, userRole }) => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalDeliveryFees: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    averageOrderValue: 0,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [topPartners, setTopPartners] = useState([]);

  useEffect(() => {
    if (currentRestaurantId) {
      loadStats();
    }
  }, [currentRestaurantId, dateFilter]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo;
      default:
        return null;
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      let q = query(
        collection(db, 'partnerOrders'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('createdAt', 'desc')
      );

      const snap = await getDocs(q);
      let allOrders = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      }));

      // Apply date filter
      const filterDate = getDateFilter();
      if (filterDate) {
        allOrders = allOrders.filter((order) => order.createdAt >= filterDate);
      }

      setOrders(allOrders);

      // Calculate stats
      const totalOrders = allOrders.length;
      const deliveredOrders = allOrders.filter((o) => o.status === 'delivered').length;
      const pendingOrders = allOrders.filter(
        (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
      ).length;

      const totalRevenue = allOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const totalDeliveryFees = allOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

      const averageOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0;

      // Calculate top partners
      const partnerStats = {};
      allOrders
        .filter((o) => o.status === 'delivered')
        .forEach((order) => {
          const partner = order.partnerName || 'Inconnu';
          if (!partnerStats[partner]) {
            partnerStats[partner] = {
              name: partner,
              orders: 0,
              revenue: 0,
              deliveryFees: 0,
            };
          }
          partnerStats[partner].orders += 1;
          partnerStats[partner].revenue += order.totalAmount || 0;
          partnerStats[partner].deliveryFees += order.deliveryFee || 0;
        });

      const topPartnersList = Object.values(partnerStats)
        .sort((a, b) => b.deliveryFees - a.deliveryFees)
        .slice(0, 5);

      setTopPartners(topPartnersList);

      setStats({
        totalOrders,
        totalRevenue,
        totalDeliveryFees,
        deliveredOrders,
        pendingOrders,
        averageOrderValue,
      });
    } catch (e) {
      console.error('Erreur chargement stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color.replace('text', 'bg').replace('700', '100')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  // Check if user is manager to view stats
  const isManager = userRole === 'manager' || userRole === 'dev' || userRole === 'admin';

  if (!isManager) {
    return (
      <div className="text-center py-12">
        <FaChartLine className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Accès restreint</h3>
        <p className="text-gray-600">
          Seuls les gérants peuvent consulter les chiffres d'affaires.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Chiffres d'affaires</h3>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tout</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">7 derniers jours</option>
          <option value="month">30 derniers jours</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={FaMoneyBillWave}
              label="Frais de livraison"
              value={`${stats.totalDeliveryFees.toLocaleString()} FCFA`}
              color="text-green-700"
              subtext="Revenus de livraison"
            />
            <StatCard
              icon={FaShoppingCart}
              label="Commandes livrées"
              value={stats.deliveredOrders}
              color="text-blue-700"
              subtext={`${stats.pendingOrders} en cours`}
            />
            <StatCard
              icon={FaChartLine}
              label="Chiffre d'affaires total"
              value={`${stats.totalRevenue.toLocaleString()} FCFA`}
              color="text-purple-700"
              subtext={`Moyenne: ${Math.round(stats.averageOrderValue).toLocaleString()} FCFA`}
            />
          </div>

          {/* Top Partners */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FaMotorcycle className="text-blue-600" />
              Top 5 Partenaires (par frais de livraison)
            </h4>
            {topPartners.length > 0 ? (
              <div className="space-y-3">
                {topPartners.map((partner, index) => (
                  <div
                    key={partner.name}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{partner.name}</div>
                        <div className="text-xs text-gray-500">
                          {partner.orders} commande{partner.orders > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700">
                        {partner.deliveryFees.toLocaleString()} FCFA
                      </div>
                      <div className="text-xs text-gray-500">
                        Total: {partner.revenue.toLocaleString()} FCFA
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">Aucune donnée disponible</p>
            )}
          </div>

          {/* Recent Orders Summary */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h4 className="font-semibold text-gray-900 mb-4">Résumé des commandes</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{stats.pendingOrders}</div>
                <div className="text-xs text-gray-600 mt-1">En attente</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{stats.deliveredOrders}</div>
                <div className="text-xs text-gray-600 mt-1">Livrées</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{stats.totalOrders}</div>
                <div className="text-xs text-gray-600 mt-1">Total</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">
                  {Math.round(stats.averageOrderValue).toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 mt-1">Panier moyen (FCFA)</div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">📊 À propos des statistiques</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Les frais de livraison représentent le revenu principal du service partenaires</li>
              <li>• Seules les commandes livrées sont comptabilisées dans le chiffre d'affaires</li>
              <li>• Les statistiques sont mises à jour en temps réel</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default PartnerStats;
