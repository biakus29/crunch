import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FaMoneyBillWave,
  FaChartLine,
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaDownload,
  FaEye,
  FaCheckCircle,
  FaClock,
  FaTimes,
} from 'react-icons/fa';
import { calculateOrderTotals } from '../../utils/adminUtils';

const FinancialOrdersView = ({ 
  orders = [], 
  items = [], 
  extraLists = [], 
  selectedDate, 
  dateFilterMode,
  setSelectedDate,
  setDateFilterMode 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PREPARING: 'preparing',
    READY: 'ready',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  };

  const STATUS_LABELS = {
    [ORDER_STATUS.PENDING]: 'En attente',
    [ORDER_STATUS.CONFIRMED]: 'Confirmée',
    [ORDER_STATUS.PREPARING]: 'En préparation',
    [ORDER_STATUS.READY]: 'Prête',
    [ORDER_STATUS.DELIVERED]: 'Livrée',
    [ORDER_STATUS.CANCELLED]: 'Annulée'
  };

  const STATUS_COLORS = {
    [ORDER_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
    [ORDER_STATUS.CONFIRMED]: 'bg-blue-100 text-blue-800',
    [ORDER_STATUS.PREPARING]: 'bg-orange-100 text-orange-800',
    [ORDER_STATUS.READY]: 'bg-purple-100 text-purple-800',
    [ORDER_STATUS.DELIVERED]: 'bg-green-100 text-green-800',
    [ORDER_STATUS.CANCELLED]: 'bg-red-100 text-red-800'
  };

  // Filtrage des commandes
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           order.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           order.contact?.phone?.includes(searchTerm);
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const matchesPayment = !paymentFilter || 
                            (paymentFilter === 'paid' && order.isPaid) ||
                            (paymentFilter === 'unpaid' && !order.isPaid);
      
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, searchTerm, statusFilter, paymentFilter]);

  // Calculs financiers
  const financialStats = useMemo(() => {
    const stats = {
      totalOrders: filteredOrders.length,
      totalRevenue: 0,
      paidOrders: 0,
      unpaidOrders: 0,
      paidRevenue: 0,
      unpaidRevenue: 0,
      deliveryFees: 0,
      subtotalRevenue: 0,
      averageOrderValue: 0,
      statusBreakdown: {}
    };

    filteredOrders.forEach(order => {
      const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);
      const deliveryFee = order.deliveryFee || 0;

      stats.totalRevenue += totalWithDelivery;
      stats.subtotalRevenue += subtotal;
      stats.deliveryFees += deliveryFee;

      if (order.isPaid) {
        stats.paidOrders++;
        stats.paidRevenue += totalWithDelivery;
      } else {
        stats.unpaidOrders++;
        stats.unpaidRevenue += totalWithDelivery;
      }

      // Breakdown par statut
      const status = order.status || ORDER_STATUS.PENDING;
      if (!stats.statusBreakdown[status]) {
        stats.statusBreakdown[status] = { count: 0, revenue: 0 };
      }
      stats.statusBreakdown[status].count++;
      stats.statusBreakdown[status].revenue += totalWithDelivery;
    });

    stats.averageOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;

    return stats;
  }, [filteredOrders, extraLists, items]);

  const exportToCSV = () => {
    const headers = [
      'ID Commande',
      'Date',
      'Client',
      'Téléphone',
      'Statut',
      'Payé',
      'Sous-total (FCFA)',
      'Frais livraison (FCFA)',
      'Total (FCFA)',
      'Mode paiement'
    ];

    const csvData = filteredOrders.map(order => {
      const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);
      const deliveryFee = order.deliveryFee || 0;

      return [
        order.id,
        order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleDateString('fr-FR') : '',
        order.contact?.name || 'Client inconnu',
        order.contact?.phone || '',
        STATUS_LABELS[order.status] || 'Inconnu',
        order.isPaid ? 'Oui' : 'Non',
        subtotal,
        deliveryFee,
        totalWithDelivery,
        order.paymentMethod || 'Non spécifié'
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `commandes_financier_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="space-y-6">
        {/* Header avec statistiques */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Vue Financière des Commandes</h3>
              <p className="text-sm text-gray-600">Analyse financière et suivi des revenus</p>
            </div>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center"
            >
              <FaDownload className="mr-2" /> Exporter CSV
            </button>
          </div>

          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaMoneyBillWave className="text-blue-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Chiffre d'affaires</p>
                  <p className="text-xl font-bold text-blue-900">{financialStats.totalRevenue.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaCheckCircle className="text-green-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-800">Commandes payées</p>
                  <p className="text-xl font-bold text-green-900">{financialStats.paidOrders}</p>
                  <p className="text-xs text-green-600">{financialStats.paidRevenue.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaClock className="text-red-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-800">En attente de paiement</p>
                  <p className="text-xl font-bold text-red-900">{financialStats.unpaidOrders}</p>
                  <p className="text-xs text-red-600">{financialStats.unpaidRevenue.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaChartLine className="text-purple-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-800">Panier moyen</p>
                  <p className="text-xl font-bold text-purple-900">{financialStats.averageOrderValue.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
          </div>

          {/* Répartition par statut */}
          <div>
            <h5 className="font-medium text-gray-800 mb-3">Répartition par statut</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(financialStats.statusBreakdown).map(([status, data]) => (
                <div key={status} className="text-center p-3 border rounded-lg">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{data.count} commandes</p>
                  <p className="text-xs text-gray-600">{data.revenue.toLocaleString()} FCFA</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher commande, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les paiements</option>
              <option value="paid">Payées</option>
              <option value="unpaid">Non payées</option>
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setPaymentFilter('');
                setSelectedDate('');
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-200 flex items-center justify-center"
            >
              <FaFilter className="mr-2" /> Réinitialiser
            </button>
          </div>
        </div>

        {/* Liste des commandes */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h4 className="font-semibold text-gray-800">
              Commandes ({filteredOrders.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commande</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sous-total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livraison</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);
                  const deliveryFee = order.deliveryFee || 0;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{order.contact?.name || 'Client inconnu'}</p>
                          <p className="text-xs text-gray-500">{order.contact?.phone || '-'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[order.status] || 'Inconnu'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {order.isPaid ? (
                            <FaCheckCircle className="text-green-500 mr-1" />
                          ) : (
                            <FaClock className="text-red-500 mr-1" />
                          )}
                          <span className={`text-xs font-medium ${order.isPaid ? 'text-green-800' : 'text-red-800'}`}>
                            {order.isPaid ? 'Payé' : 'En attente'}
                          </span>
                        </div>
                        {order.paymentMethod && (
                          <p className="text-xs text-gray-500">{order.paymentMethod}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {subtotal.toLocaleString()} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {deliveryFee.toLocaleString()} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        {totalWithDelivery.toLocaleString()} FCFA
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <div className="text-center py-8">
                <FaMoneyBillWave className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">Aucune commande trouvée</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal détail commande */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Détail financier - Commande #{selectedOrder.id.slice(0, 8)}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              {/* Informations client */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Informations client</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nom:</span>
                    <span className="ml-2 font-medium">{selectedOrder.contact?.name || 'Non spécifié'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Téléphone:</span>
                    <span className="ml-2 font-medium">{selectedOrder.contact?.phone || 'Non spécifié'}</span>
                  </div>
                </div>
              </div>

              {/* Détail financier */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">Détail financier</h4>
                {(() => {
                  const { subtotal, totalWithDelivery } = calculateOrderTotals(selectedOrder, extraLists, items);
                  const deliveryFee = selectedOrder.deliveryFee || 0;
                  
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sous-total articles:</span>
                        <span className="font-medium">{subtotal.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Frais de livraison:</span>
                        <span className="font-medium">{deliveryFee.toLocaleString()} FCFA</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="font-semibold text-gray-800">Total:</span>
                        <span className="font-bold text-green-600">{totalWithDelivery.toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Statut paiement:</span>
                        <span className={`font-medium ${selectedOrder.isPaid ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedOrder.isPaid ? 'Payé' : 'En attente'}
                        </span>
                      </div>
                      {selectedOrder.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Mode de paiement:</span>
                          <span className="font-medium">{selectedOrder.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Articles commandés */}
              <div>
                <h4 className="font-medium text-gray-800 mb-3">Articles commandés</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{item.dishName}</span>
                        <span className="text-gray-600 ml-2">x{item.quantity}</span>
                      </div>
                      <span className="font-medium">{(item.price * item.quantity).toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default FinancialOrdersView;
