import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaMotorcycle, FaMapMarkerAlt, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: FaClock },
  confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-700', icon: FaCheckCircle },
  preparing: { label: 'En préparation', color: 'bg-purple-100 text-purple-700', icon: FaClock },
  ready: { label: 'Prête', color: 'bg-green-100 text-green-700', icon: FaCheckCircle },
  in_delivery: { label: 'En livraison', color: 'bg-orange-100 text-orange-700', icon: FaMotorcycle },
  delivered: { label: 'Livrée', color: 'bg-green-200 text-green-800', icon: FaCheckCircle },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: FaTimesCircle },
};

const DeliveryTracking = ({ currentRestaurantId }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, all, delivered

  useEffect(() => {
    if (currentRestaurantId) {
      loadDeliveries();
    }
  }, [currentRestaurantId, filter]);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      let q = query(
        collection(db, 'partnerOrders'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('createdAt', 'desc')
      );

      const snap = await getDocs(q);
      let allDeliveries = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
      }));

      // Apply filter
      if (filter === 'active') {
        allDeliveries = allDeliveries.filter(
          (d) => !['delivered', 'cancelled'].includes(d.status)
        );
      } else if (filter === 'delivered') {
        allDeliveries = allDeliveries.filter((d) => d.status === 'delivered');
      }

      setDeliveries(allDeliveries);
    } catch (e) {
      console.error('Erreur chargement livraisons:', e);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (deliveryId, newStatus) => {
    try {
      await updateDoc(doc(db, 'partnerOrders', deliveryId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      toast.success('Statut mis à jour');
      loadDeliveries();
    } catch (e) {
      console.error('Erreur mise à jour:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getTimeElapsed = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60); // minutes
    if (diff < 60) return `${diff} min`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ${diff % 60}min`;
    return `${Math.floor(hours / 24)}j ${hours % 24}h`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Suivi des Livraisons</h3>
          <p className="text-sm text-gray-600 mt-1">Suivez vos livraisons en temps réel</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
        >
          <option value="active">En cours</option>
          <option value="delivered">Livrées</option>
          <option value="all">Toutes</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries({
          pending: deliveries.filter((d) => d.status === 'pending').length,
          in_delivery: deliveries.filter((d) => d.status === 'in_delivery').length,
          delivered: deliveries.filter((d) => d.status === 'delivered').length,
          cancelled: deliveries.filter((d) => d.status === 'cancelled').length,
        }).map(([status, count]) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <div key={status} className="bg-white border rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${config.color.split(' ')[1]}`} />
                <span className="text-xs text-gray-600">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Deliveries List */}
      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => {
            const statusConfig = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={delivery.id}
                className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Mobile Layout */}
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={`w-4 h-4 ${statusConfig.color.split(' ')[1]}`} />
                        <span className={`text-xs font-medium px-2 py-1 rounded ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900">{delivery.customerName}</h4>
                      <p className="text-sm text-gray-600">{delivery.customerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Il y a</p>
                      <p className="text-sm font-semibold text-blue-600">
                        {getTimeElapsed(delivery.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="bg-gray-50 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{delivery.productName}</p>
                        <p className="text-xs text-gray-600">{delivery.partnerName}</p>
                      </div>
                      <p className="text-sm font-semibold">×{delivery.quantity}</p>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <FaMapMarkerAlt className="text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-gray-700">{delivery.deliveryAddress}</p>
                        <p className="text-xs text-gray-500">{delivery.quartierName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Deliverer */}
                  {delivery.assignedDeliverer && (
                    <div className="flex items-center gap-2 text-sm">
                      <FaMotorcycle className="text-blue-600" />
                      <span className="text-gray-700">
                        Livreur: <strong>{delivery.assignedDeliverer}</strong>
                      </span>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-gray-600">Montant total</span>
                    <span className="text-lg font-bold text-gray-900">
                      {delivery.totalAmount?.toLocaleString()} FCFA
                    </span>
                  </div>

                  {/* Status Update */}
                  {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
                    <div className="flex gap-2">
                      {delivery.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(delivery.id, 'confirmed')}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Confirmer
                        </button>
                      )}
                      {delivery.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(delivery.id, 'preparing')}
                          className="flex-1 px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                        >
                          En préparation
                        </button>
                      )}
                      {delivery.status === 'preparing' && (
                        <button
                          onClick={() => updateStatus(delivery.id, 'ready')}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Prête
                        </button>
                      )}
                      {delivery.status === 'ready' && (
                        <button
                          onClick={() => updateStatus(delivery.id, 'in_delivery')}
                          className="flex-1 px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                        >
                          En livraison
                        </button>
                      )}
                      {delivery.status === 'in_delivery' && (
                        <button
                          onClick={() => updateStatus(delivery.id, 'delivered')}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Livrée
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(delivery.id, 'cancelled')}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {deliveries.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <FaMotorcycle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {filter === 'active' ? 'Aucune livraison en cours' : 'Aucune livraison'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryTracking;
