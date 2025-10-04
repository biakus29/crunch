import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { FaTruck, FaMapMarkerAlt, FaPhone, FaCheckCircle, FaTimesCircle, FaClock, FaSignOutAlt, FaBox, FaArrowUp, FaArrowDown, FaUserSlash, FaPhoneAlt } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DeliveryPersonApp = () => {
  const navigate = useNavigate();
  const [deliverer, setDeliverer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deliveryOrder, setDeliveryOrder] = useState([]); // Ordre de livraison personnalisé

  useEffect(() => {
    // Vérifier l'authentification via localStorage
    const delivererPhone = localStorage.getItem('delivererPhone');
    const delivererName = localStorage.getItem('delivererName');
    const delivererId = localStorage.getItem('delivererId');

    if (!delivererPhone || !delivererName || !delivererId) {
      navigate('/login-livreur');
      return;
    }

    const loadDelivererData = async () => {
      try {
        // Charger les infos du livreur
        const delivererDoc = await getDoc(doc(db, 'deliverers', delivererId));
        if (!delivererDoc.exists()) {
          toast.error('Compte livreur non trouvé');
          localStorage.clear();
          navigate('/login-livreur');
          return;
        }

        const delivererData = { id: delivererDoc.id, ...delivererDoc.data() };
        
        // Vérifier si le compte est toujours actif
        if (!delivererData.active) {
          toast.error('Votre compte a été désactivé');
          localStorage.clear();
          navigate('/login-livreur');
          return;
        }

        setDeliverer(delivererData);

        // Écouter les commandes assignées au livreur
        const ordersQuery = query(
          collection(db, 'orders'),
          where('assignedDeliverer', '==', delivererData.name)
        );

        const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
          const ordersData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setOrders(ordersData.sort((a, b) => {
            const statusOrder = { 'pending': 0, 'confirmed': 1, 'preparing': 2, 'ready': 3, 'delivering': 4, 'delivered': 5, 'cancelled': 6 };
            return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
          }));
          setLoading(false);
        });

        return () => unsubscribeOrders();
      } catch (error) {
        console.error('Erreur:', error);
        toast.error('Erreur de chargement');
        setLoading(false);
      }
    };

    loadDelivererData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      localStorage.clear();
      navigate('/login-livreur');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const markClientUnavailable = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'client_indisponible',
        clientUnavailableAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.warning('Client marqué comme indisponible');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      // Vérifier s'il y a déjà une livraison en cours
      if (newStatus === 'en_livraison' || newStatus === 'delivering') {
        const activeDeliveries = orders.filter(o => 
          normalizeStatus(o.status) === 'delivering' && 
          o.id !== orderId &&
          o.assignedDeliverer === deliverer?.name
        );

        if (activeDeliveries.length > 0) {
          const activeOrder = activeDeliveries[0];
          const confirmMessage = `Vous avez déjà une livraison en cours (#${activeOrder.id.slice(-6).toUpperCase()} - ${activeOrder.address?.area}). Voulez-vous vraiment commencer une nouvelle livraison ? Cela mettra la précédente en pause.`;
          
          if (!window.confirm(confirmMessage)) {
            return;
          }
          
          // Mettre en pause la livraison précédente
          await updateDoc(doc(db, 'orders', activeOrder.id), {
            status: 'prete', // Remettre en "prête" (format français)
            deliveryPausedAt: serverTimestamp(),
            deliveryStartedAt: null, // Réinitialiser le timer
            updatedAt: serverTimestamp()
          });
          
          toast.info(`Livraison #${activeOrder.id.slice(-6).toUpperCase()} mise en pause`);
        }
      }

      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      // Ajouter le timestamp de début de livraison
      if (newStatus === 'en_livraison' || newStatus === 'delivering') {
        updateData.deliveryStartedAt = serverTimestamp();
      }

      // Ajouter le timestamp de fin de livraison et calculer la durée
      if (newStatus === 'livree' || newStatus === 'delivered') {
        updateData.deliveryCompletedAt = serverTimestamp();
        
        // Récupérer la commande pour calculer le temps
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (orderDoc.exists()) {
          const orderData = orderDoc.data();
          if (orderData.deliveryStartedAt) {
            const startTime = orderData.deliveryStartedAt.toDate();
            const endTime = new Date();
            const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);
            updateData.deliveryDurationMinutes = durationMinutes;
          }
        }
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);
      toast.success(`Commande ${newStatus === 'delivering' ? 'en cours de livraison' : 'livrée'}`);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      delivering: 'bg-orange-100 text-orange-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      preparing: 'En préparation',
      ready: 'Prête',
      delivering: 'En livraison',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Mapper les statuts français vers les statuts anglais
  const normalizeStatus = (status) => {
    const statusMap = {
      'en_livraison': 'delivering',
      'prete': 'ready',
      'livree': 'delivered',
      'ready': 'ready',
      'delivering': 'delivering',
      'delivered': 'delivered'
    };
    return statusMap[status] || status;
  };

  const activeOrders = orders.filter(o => {
    const normalized = normalizeStatus(o.status);
    return ['ready', 'delivering'].includes(normalized) || o.status === 'client_indisponible';
  });
  const completedOrders = orders.filter(o => normalizeStatus(o.status) === 'delivered');
  const todayEarnings = completedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

  // Fonctions pour gérer l'ordre de livraison
  const moveOrderUp = (index) => {
    if (index === 0) return;
    const newOrder = [...activeOrders];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setDeliveryOrder(newOrder.map(o => o.id));
  };

  const moveOrderDown = (index) => {
    if (index === activeOrders.length - 1) return;
    const newOrder = [...activeOrders];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setDeliveryOrder(newOrder.map(o => o.id));
  };

  // Trier les commandes selon l'ordre personnalisé
  const sortedActiveOrders = deliveryOrder.length > 0
    ? deliveryOrder.map(id => activeOrders.find(o => o.id === id)).filter(Boolean)
    : activeOrders;

  return (
    <div className="min-h-screen bg-gray-100">
      <ToastContainer position="top-center" autoClose={3000} />

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                <FaTruck className="text-2xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{deliverer?.name}</h1>
                <p className="text-sm text-blue-100">{deliverer?.vehicleType === 'moto' ? '🏍️ Moto' : '🚗 Voiture'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition"
            >
              <FaSignOutAlt className="text-xl" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-4xl mx-auto p-4">
        {/* Alerte livraison en cours */}
        {orders.filter(o => normalizeStatus(o.status) === 'delivering').length > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-4 rounded-lg">
            <div className="flex items-center">
              <FaTruck className="text-orange-500 text-xl mr-3 animate-pulse" />
              <div className="flex-1">
                <p className="font-bold text-orange-800">Livraison en cours</p>
                <p className="text-sm text-orange-700">
                  {orders.filter(o => normalizeStatus(o.status) === 'delivering')[0]?.address?.area} - 
                  #{orders.filter(o => normalizeStatus(o.status) === 'delivering')[0]?.id.slice(-6).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-blue-600">{activeOrders.length}</div>
            <div className="text-xs text-gray-600">En cours</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-green-600">{completedOrders.length}</div>
            <div className="text-xs text-gray-600">Livrées</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-purple-600">{todayEarnings.toLocaleString()}</div>
            <div className="text-xs text-gray-600">FCFA gagnés</div>
          </div>
        </div>

        {/* Commandes actives */}
        {activeOrders.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <FaClock className="mr-2 text-orange-500" />
                Commandes à livrer ({activeOrders.length})
              </h2>
              <p className="text-xs text-gray-500">↑ ↓ Réorganiser</p>
            </div>
            <div className="space-y-3">
              {sortedActiveOrders.map((order, index) => (
                <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg font-bold text-gray-700">#{index + 1}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          {order.isPaid && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Payé
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          Commande #{order.id.slice(-6).toUpperCase()}
                        </div>
                      </div>
                      {/* Boutons pour réorganiser */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveOrderUp(index)}
                          disabled={index === 0}
                          className={`p-1 rounded ${index === 0 ? 'text-gray-300' : 'text-blue-600 hover:bg-blue-50'}`}
                        >
                          <FaArrowUp />
                        </button>
                        <button
                          onClick={() => moveOrderDown(index)}
                          disabled={index === sortedActiveOrders.length - 1}
                          className={`p-1 rounded ${index === sortedActiveOrders.length - 1 ? 'text-gray-300' : 'text-blue-600 hover:bg-blue-50'}`}
                        >
                          <FaArrowDown />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-start text-sm">
                        <FaMapMarkerAlt className="text-red-500 mt-1 mr-2 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{order.address?.area || 'Zone non spécifiée'}</div>
                          <div className="text-gray-600">{order.address?.details || ''}</div>
                        </div>
                      </div>
                      {/* Contenu de la commande */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                          <FaBox className="mr-2" />
                          Contenu de la commande :
                        </div>
                        <div className="space-y-1">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-gray-700">
                                  <span className="font-bold">{item.quantity}x</span> {item.dishName}
                                  {item.extras && item.extras.length > 0 && (
                                    <span className="text-gray-500 text-xs ml-1">
                                      ({item.extras.map(e => e.name).join(', ')})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">Aucun détail disponible</span>
                          )}
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-300 text-xs font-bold text-gray-800">
                            Total : {order.items.reduce((sum, item) => sum + item.quantity, 0)} article(s)
                          </div>
                        )}
                      </div>

                      {/* Numéro du client avec bouton d'appel */}
                      <a 
                        href={`tel:${order.contact?.phone}`}
                        className="flex items-center text-sm bg-blue-50 p-3 rounded-lg hover:bg-blue-100 transition"
                      >
                        <FaPhoneAlt className="text-blue-600 mr-3 text-lg" />
                        <div className="flex-1">
                          <div className="text-xs text-blue-600 font-medium">Téléphone client</div>
                          <div className="font-bold text-blue-800">{order.contact?.phone}</div>
                        </div>
                        <div className="text-blue-600 font-medium text-xs">Appeler →</div>
                      </a>
                      {order.deliveryFee && (
                        <div className="flex items-center text-sm">
                          <FaBox className="text-green-500 mr-2" />
                          <span className="font-bold text-green-600">{order.deliveryFee.toLocaleString()} FCFA</span>
                        </div>
                      )}
                      {normalizeStatus(order.status) === 'delivering' && order.deliveryStartedAt && (
                        <div className="flex items-center text-sm">
                          <FaClock className="text-orange-500 mr-2" />
                          <span className="font-medium text-orange-600">
                            En cours depuis {Math.round((new Date() - order.deliveryStartedAt.toDate()) / 1000 / 60)} min
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {normalizeStatus(order.status) === 'ready' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'en_livraison')}
                            className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-orange-700 transition flex items-center justify-center"
                          >
                            <FaTruck className="mr-2" />
                            Partir livrer
                          </button>
                        )}
                        {normalizeStatus(order.status) === 'delivering' && (
                          <div className="flex-1 bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                            <p className="text-xs text-blue-800 font-medium mb-1">
                              ⏳ En attente de confirmation client
                            </p>
                            <p className="text-xs text-blue-600">
                              Le client confirmera la réception
                            </p>
                          </div>
                        )}
                        {order.status === 'client_indisponible' && (
                          <div className="flex-1 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                            <p className="text-xs text-yellow-800 font-medium mb-1">
                              ⚠️ Client indisponible
                            </p>
                            <p className="text-xs text-yellow-600">
                              En attente de rappel
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                          Détails
                        </button>
                      </div>
                      {/* Bouton client indisponible */}
                      {(normalizeStatus(order.status) === 'ready' || normalizeStatus(order.status) === 'delivering') && order.status !== 'client_indisponible' && (
                        <button
                          onClick={() => markClientUnavailable(order.id)}
                          className="w-full bg-yellow-50 border border-yellow-300 text-yellow-800 py-2 px-4 rounded-lg font-medium hover:bg-yellow-100 transition flex items-center justify-center text-sm"
                        >
                          <FaUserSlash className="mr-2" />
                          Client indisponible
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commandes livrées */}
        {completedOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
              <FaCheckCircle className="mr-2 text-green-500" />
              Livrées aujourd'hui ({completedOrders.length})
            </h2>
            <div className="space-y-2">
              {completedOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        #{order.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500">{order.address?.area}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-600">
                        {order.deliveryFee?.toLocaleString() || 0} FCFA
                      </div>
                      {order.deliveryDurationMinutes && (
                        <div className="text-xs text-orange-600 font-medium flex items-center justify-end">
                          <FaClock className="mr-1" />
                          {order.deliveryDurationMinutes} min
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {order.updatedAt ? new Date(order.updatedAt.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message si aucune commande */}
        {orders.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center shadow">
            <FaTruck className="mx-auto text-5xl text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune commande</h3>
            <p className="text-gray-500">Vous n'avez pas de commandes assignées pour le moment</p>
          </div>
        )}
      </div>

      {/* Modal détails commande */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Détails de la commande</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                  <FaTimesCircle className="text-2xl" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Numéro de commande</div>
                  <div className="font-medium">#{selectedOrder.id.slice(-6).toUpperCase()}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Statut</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Adresse de livraison</div>
                  <div className="font-medium">{selectedOrder.address?.area}</div>
                  <div className="text-sm text-gray-600">{selectedOrder.address?.details}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Contact client</div>
                  <a href={`tel:${selectedOrder.contact?.phone}`} className="text-blue-600 font-medium">
                    {selectedOrder.contact?.phone}
                  </a>
                </div>

                {selectedOrder.deliveryFee && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Frais de livraison</div>
                    <div className="text-2xl font-bold text-green-600">{selectedOrder.deliveryFee.toLocaleString()} FCFA</div>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Notes</div>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</div>
                  </div>
                )}

                {selectedOrder.isPaid && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center text-green-800">
                      <FaCheckCircle className="mr-2" />
                      <span className="font-medium">Commande déjà payée</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryPersonApp;
