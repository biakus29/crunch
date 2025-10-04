import React, { useMemo } from 'react';
import {
  FaShoppingBag,
  FaMoneyBillWave,
  FaTruck,
  FaChartLine,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
} from 'react-icons/fa';

const ManagerDashboard = ({ orders, deliverers }) => {
  // Calculer les statistiques
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Commandes du jour
    const todayOrders = orders.filter((o) => {
      const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return orderDate >= today;
    });

    // Commandes en attente (pending, confirmed, preparing)
    const pendingOrders = orders.filter(
      (o) => ['pending', 'confirmed', 'preparing'].includes(o.status)
    );

    // Commandes en livraison
    const deliveringOrders = orders.filter((o) => o.status === 'delivering');

    // Commandes livrées aujourd'hui
    const deliveredToday = todayOrders.filter((o) => o.status === 'livree' || o.status === 'delivered');

    // Revenus du jour
    const todayRevenue = deliveredToday.reduce((sum, o) => {
      const subtotal = o.items?.reduce((s, item) => s + (item.price || 0) * (item.quantity || 1), 0) || 0;
      const deliveryFee = o.deliveryFee || 0;
      return sum + subtotal + deliveryFee;
    }, 0);

    // Commandes non payées
    const unpaidOrders = orders.filter((o) => !o.isPaid && o.status !== 'cancelled');

    // Livreurs actifs
    const activeDeliverers = deliverers.filter((d) => d.active);

    // Livreurs en service (avec commandes en cours)
    const busyDeliverers = activeDeliverers.filter((d) =>
      deliveringOrders.some((o) => o.assignedDeliverer === d.name)
    );

    return {
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      deliveringOrders: deliveringOrders.length,
      deliveredToday: deliveredToday.length,
      todayRevenue,
      unpaidOrders: unpaidOrders.length,
      activeDeliverers: activeDeliverers.length,
      busyDeliverers: busyDeliverers.length,
    };
  }, [orders, deliverers]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-3xl font-bold">Tableau de Bord Gérant</h2>
        <p className="mt-2 text-blue-100">Vue d'ensemble de votre activité</p>
      </div>

      {/* Alertes importantes */}
      {(stats.pendingOrders > 0 || stats.unpaidOrders > 5) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.pendingOrders > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
              <div className="flex items-center">
                <FaExclamationTriangle className="text-orange-500 text-2xl mr-3" />
                <div>
                  <h4 className="font-bold text-orange-800">Commandes en attente</h4>
                  <p className="text-orange-700">
                    {stats.pendingOrders} commande{stats.pendingOrders > 1 ? 's' : ''} à traiter
                  </p>
                </div>
              </div>
            </div>
          )}
          {stats.unpaidOrders > 5 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <div className="flex items-center">
                <FaExclamationTriangle className="text-red-500 text-2xl mr-3" />
                <div>
                  <h4 className="font-bold text-red-800">Paiements en attente</h4>
                  <p className="text-red-700">{stats.unpaidOrders} commandes non payées</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs Principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Commandes du jour */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Commandes Aujourd'hui</p>
              <p className="text-3xl font-bold text-gray-900">{stats.todayOrders}</p>
              <p className="text-xs text-green-600 mt-1">
                {stats.deliveredToday} livrées
              </p>
            </div>
            <FaShoppingBag className="text-4xl text-blue-500" />
          </div>
        </div>

        {/* Revenus du jour */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Revenus du Jour</p>
              <p className="text-3xl font-bold text-green-600">
                {stats.todayRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">FCFA</p>
            </div>
            <FaMoneyBillWave className="text-4xl text-green-500" />
          </div>
        </div>

        {/* Commandes en cours */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En Cours</p>
              <p className="text-3xl font-bold text-orange-600">{stats.pendingOrders}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.deliveringOrders} en livraison
              </p>
            </div>
            <FaClock className="text-4xl text-orange-500" />
          </div>
        </div>

        {/* Livreurs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Livreurs</p>
              <p className="text-3xl font-bold text-purple-600">{stats.activeDeliverers}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.busyDeliverers} en service
              </p>
            </div>
            <FaTruck className="text-4xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Taux de livraison */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800">Taux de Livraison</h4>
            <FaCheckCircle className="text-green-500 text-xl" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Livrées</span>
              <span className="font-bold text-green-600">{stats.deliveredToday}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">En livraison</span>
              <span className="font-bold text-orange-600">{stats.deliveringOrders}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">En attente</span>
              <span className="font-bold text-blue-600">{stats.pendingOrders}</span>
            </div>
          </div>
          {stats.todayOrders > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taux de réussite</span>
                <span className="text-lg font-bold text-green-600">
                  {Math.round((stats.deliveredToday / stats.todayOrders) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.round((stats.deliveredToday / stats.todayOrders) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Paiements */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800">Paiements</h4>
            <FaMoneyBillWave className="text-blue-500 text-xl" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Payées</span>
              <span className="font-bold text-green-600">
                {orders.filter((o) => o.isPaid).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Non payées</span>
              <span className="font-bold text-red-600">{stats.unpaidOrders}</span>
            </div>
          </div>
          {stats.unpaidOrders > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-red-600">
                ⚠️ {stats.unpaidOrders} commande{stats.unpaidOrders > 1 ? 's' : ''} à encaisser
              </p>
            </div>
          )}
        </div>

        {/* Performance livreurs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800">Livreurs</h4>
            <FaTruck className="text-purple-500 text-xl" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Actifs</span>
              <span className="font-bold text-green-600">{stats.activeDeliverers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">En service</span>
              <span className="font-bold text-blue-600">{stats.busyDeliverers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Disponibles</span>
              <span className="font-bold text-gray-600">
                {stats.activeDeliverers - stats.busyDeliverers}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="font-semibold text-gray-800 mb-4">Actions Rapides</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => (window.location.hash = '#orders')}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition"
          >
            <FaShoppingBag className="text-2xl text-blue-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-blue-900">Commandes</span>
          </button>
          <button
            onClick={() => (window.location.hash = '#reports')}
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition"
          >
            <FaChartLine className="text-2xl text-green-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-green-900">Rapports</span>
          </button>
          <button
            onClick={() => (window.location.hash = '#deliveryDashboard')}
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition"
          >
            <FaTruck className="text-2xl text-purple-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-purple-900">Livraisons</span>
          </button>
          <button
            onClick={() => (window.location.hash = '#payments')}
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition"
          >
            <FaMoneyBillWave className="text-2xl text-orange-600 mx-auto mb-2" />
            <span className="text-sm font-medium text-orange-900">Paiements</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
